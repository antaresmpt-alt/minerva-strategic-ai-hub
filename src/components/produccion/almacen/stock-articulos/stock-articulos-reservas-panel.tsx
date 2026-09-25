"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { OtDestinoSearchInput } from "@/components/produccion/almacen/ot-destino-search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const supabase = createSupabaseBrowserClient();

export type StockArticuloReservaRow = {
  id: string;
  ot_numero: string;
  num_pedido: string | null;
  cantidad_reservada: number;
  cantidad_consumida: number;
  estado: string;
  notas: string | null;
  created_at: string;
};

type Mode = "reservar" | "consumir" | "liberar" | "consumir_sin_reserva" | null;

const ESTADO_RESERVA: Record<string, string> = {
  activa: "bg-blue-100 text-blue-800 border-blue-200",
  parcial: "bg-amber-100 text-amber-900 border-amber-200",
  consumida: "bg-slate-100 text-slate-600 border-slate-200",
  liberada: "bg-slate-100 text-slate-500 border-slate-200",
};

function friendlyReservaError(msg: string): string {
  const m = msg.toLowerCase();
  if (
    m.includes("no está en minerva") ||
    m.includes("prod_ots_general") ||
    m.includes("impórtala desde optimus") ||
    m.includes("importala desde optimus")
  ) {
    return "Esa OT aún no está en Minerva. Impórtala desde Optimus y vuelve a reservar.";
  }
  if (m.includes("no hay libre suficiente")) {
    return "No hay cantidad libre suficiente en este lote.";
  }
  if (m.includes("no hay reserva viva")) {
    return "No hay una reserva activa para esa OT en este lote.";
  }
  if (m.includes("p_motivo_sin_reserva") || m.includes("motivo_sin_reserva")) {
    return "Sin reserva hace falta un motivo obligatorio.";
  }
  if (m.includes("supera pendiente")) {
    return "El consumo supera lo pendiente de esa reserva.";
  }
  if (m.includes("físico insuficiente")) {
    return "No hay cantidad física suficiente.";
  }
  if (m.includes("sin permiso") || m.includes("stock_articulos_write")) {
    return "No tienes permiso para modificar stock de artículos.";
  }
  return msg;
}

type Props = {
  stockId: string;
  unidad: string;
  libre: number;
  canWrite: boolean;
  /** Tras mutación RPC: refrescar ATP + esta lista. */
  onChanged: () => Promise<void>;
};

export function StockArticulosReservasPanel({
  stockId,
  unidad,
  libre,
  canWrite,
  onChanged,
}: Props) {
  const [reservas, setReservas] = useState<StockArticuloReservaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [ot, setOt] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [numPedido, setNumPedido] = useState("");
  const [notas, setNotas] = useState("");
  const [motivoSinReserva, setMotivoSinReserva] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("prod_stock_articulos_reservas")
        .select(
          "id, ot_numero, num_pedido, cantidad_reservada, cantidad_consumida, estado, notas, created_at"
        )
        .eq("stock_articulo_id", stockId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      setReservas((data ?? []) as StockArticuloReservaRow[]);
    } catch (e) {
      toast.error(
        `No se pudieron cargar reservas: ${errorMessageFromUnknown(e)}`
      );
    } finally {
      setLoading(false);
    }
  }, [stockId]);

  useEffect(() => {
    void load();
  }, [load]);

  const vivas = reservas.filter(
    (r) => r.estado === "activa" || r.estado === "parcial"
  );

  function openMode(m: Mode, presetOt?: string) {
    setMode(m);
    setOt(presetOt ?? "");
    setCantidad("");
    setNumPedido("");
    setNotas("");
    setMotivoSinReserva("");
  }

  async function submit() {
    if (!mode) return;
    const otN = ot.trim();
    if (!otN) {
      toast.error("Indica el número de OT (debe existir en Minerva).");
      return;
    }

    if (mode === "liberar") {
      setSubmitting(true);
      try {
        const { error } = await supabase.rpc("prod_stock_articulos_liberar", {
          p_stock_id: stockId,
          p_ot_numero: otN,
          p_notas: notas.trim() || undefined,
        });
        if (error) throw error;
        toast.success(`Reserva liberada · OT ${otN}`);
        setMode(null);
        await load();
        await onChanged();
      } catch (e) {
        toast.error(
          friendlyReservaError(errorMessageFromUnknown(e))
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const qty = Math.trunc(Number(cantidad));
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("La cantidad debe ser un entero > 0.");
      return;
    }

    if (mode === "consumir_sin_reserva") {
      const motivo = motivoSinReserva.trim();
      if (!motivo) {
        toast.error("El motivo es obligatorio al consumir sin reserva.");
        return;
      }
      setSubmitting(true);
      try {
        const { error } = await supabase.rpc("prod_stock_articulos_consumir", {
          p_stock_id: stockId,
          p_ot_numero: otN,
          p_cantidad: qty,
          p_notas: notas.trim() || undefined,
          p_motivo_sin_reserva: motivo,
        });
        if (error) throw error;
        toast.success(`Consumo sin reserva · ${qty.toLocaleString("es-ES")} ${unidad}`);
        setMode(null);
        await load();
        await onChanged();
      } catch (e) {
        toast.error(friendlyReservaError(errorMessageFromUnknown(e)));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "reservar") {
      setSubmitting(true);
      try {
        const { error } = await supabase.rpc("prod_stock_articulos_reservar", {
          p_stock_id: stockId,
          p_ot_numero: otN,
          p_cantidad: qty,
          p_num_pedido: numPedido.trim() || undefined,
          p_notas: notas.trim() || undefined,
        });
        if (error) throw error;
        toast.success(
          `Reservado ${qty.toLocaleString("es-ES")} ${unidad} · OT ${otN}`
        );
        setMode(null);
        await load();
        await onChanged();
      } catch (e) {
        toast.error(friendlyReservaError(errorMessageFromUnknown(e)));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === "consumir") {
      setSubmitting(true);
      try {
        const { error } = await supabase.rpc("prod_stock_articulos_consumir", {
          p_stock_id: stockId,
          p_ot_numero: otN,
          p_cantidad: qty,
          p_notas: notas.trim() || undefined,
        });
        if (error) throw error;
        toast.success(
          `Consumido ${qty.toLocaleString("es-ES")} ${unidad} · OT ${otN}`
        );
        setMode(null);
        await load();
        await onChanged();
      } catch (e) {
        toast.error(friendlyReservaError(errorMessageFromUnknown(e)));
      } finally {
        setSubmitting(false);
      }
    }
  }

  const title =
    mode === "reservar"
      ? "Reservar para OT"
      : mode === "consumir"
        ? "Consumir reserva"
        : mode === "liberar"
          ? "Liberar reserva"
          : mode === "consumir_sin_reserva"
            ? "Consumir sin reserva"
            : "";

  return (
    <div className="pt-3 space-y-2 border-t border-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Reservas
        </p>
        {canWrite ? (
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={libre <= 0}
              onClick={() => openMode("reservar")}
            >
              Reservar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={vivas.length === 0}
              onClick={() => openMode("consumir", vivas[0]?.ot_numero)}
            >
              Consumir
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-slate-500"
              onClick={() => openMode("consumir_sin_reserva")}
            >
              Sin reserva…
            </Button>
          </div>
        ) : null}
      </div>
      <p className="text-[11px] text-slate-400">
        Libre: {libre.toLocaleString("es-ES")} {unidad}. La OT debe existir ya
        en Minerva (importada de Optimus).
      </p>

      {loading ? (
        <Loader2 className="size-4 animate-spin text-slate-400" />
      ) : reservas.length === 0 ? (
        <p className="text-xs text-slate-400">Sin reservas en este lote.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="text-xs">OT</TableHead>
                <TableHead className="text-xs">Pedido</TableHead>
                <TableHead className="text-xs text-right">Reservado</TableHead>
                <TableHead className="text-xs text-right">Consumido</TableHead>
                <TableHead className="text-xs">Estado</TableHead>
                {canWrite ? (
                  <TableHead className="text-xs w-20" />
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservas.map((r) => {
                const viva = r.estado === "activa" || r.estado === "parcial";
                const pendiente = r.cantidad_reservada - r.cantidad_consumida;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono">
                      {r.ot_numero}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {r.num_pedido ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {r.cantidad_reservada.toLocaleString("es-ES")}
                      {viva && pendiente !== r.cantidad_reservada ? (
                        <span className="text-slate-400">
                          {" "}
                          (pend. {pendiente.toLocaleString("es-ES")})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {r.cantidad_consumida.toLocaleString("es-ES")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          ESTADO_RESERVA[r.estado] ??
                          "bg-slate-50 text-slate-600"
                        }
                      >
                        {r.estado}
                      </Badge>
                    </TableCell>
                    {canWrite ? (
                      <TableCell className="text-xs">
                        {viva ? (
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-1.5 text-xs"
                              onClick={() => openMode("consumir", r.ot_numero)}
                            >
                              Cons.
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-1.5 text-xs text-slate-500"
                              onClick={() => openMode("liberar", r.ot_numero)}
                            >
                              Lib.
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={mode != null}
        onOpenChange={(o) => {
          if (!o) setMode(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {mode === "consumir_sin_reserva" ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                Uso excepcional: gasta libre sin reserva previa. Exige motivo y
                no toca lo comprometido a otras OTs.
              </p>
            ) : null}
            {mode === "liberar" ? (
              <p className="text-xs text-slate-500">
                Libera el pendiente vivo de esa OT en este lote (no baja el
                físico).
              </p>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">OT *</Label>
              <OtDestinoSearchInput
                value={ot}
                onChange={setOt}
                placeholder="Buscar OT en Minerva…"
              />
            </div>

            {mode !== "liberar" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">
                  Cantidad ({unidad}) *
                </Label>
                <Input
                  inputMode="numeric"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder={
                    mode === "reservar"
                      ? `Máx. libre ${libre.toLocaleString("es-ES")}`
                      : "Entero > 0"
                  }
                />
              </div>
            ) : null}

            {mode === "reservar" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Nº pedido</Label>
                <Input
                  value={numPedido}
                  onChange={(e) => setNumPedido(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            ) : null}

            {mode === "consumir_sin_reserva" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Motivo *</Label>
                <Textarea
                  value={motivoSinReserva}
                  onChange={(e) => setMotivoSinReserva(e.target.value)}
                  rows={2}
                  placeholder="Obligatorio (auditoría)"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Notas</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode(null)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
