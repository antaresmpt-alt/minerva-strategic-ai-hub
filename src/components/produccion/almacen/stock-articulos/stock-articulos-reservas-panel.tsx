"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  OtDestinoSearchInput,
  type OtSugerencia,
} from "@/components/produccion/almacen/ot-destino-search-input";
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
import {
  buildReservaNotas,
  OT_ENTREGA_TAG,
} from "@/lib/stock-articulos-atp-despacho";
import { parseStockImportInt } from "@/lib/stock-articulos-excel-import";
import { clientesOtLoteDifieren } from "@/lib/stock-articulos-cliente-match";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const supabase = createSupabaseBrowserClient();

export { OT_ENTREGA_TAG };

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

type Mode =
  | "reservar"
  | "consumir"
  | "liberar"
  | "consumir_sin_reserva"
  | "ot_entrega"
  | null;

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

function parseEnteroCampo(
  raw: string,
  label: string
): { ok: true; value: number } | { ok: false } {
  const n = parseStockImportInt(raw);
  if (n == null) {
    toast.error(`${label} es obligatorio.`);
    return { ok: false };
  }
  if (!Number.isFinite(n) || Number.isNaN(n) || n <= 0) {
    toast.error(`${label} debe ser un entero > 0 (admite 1.000 / 35.900).`);
    return { ok: false };
  }
  return { ok: true, value: n };
}

function parseOtCantidadMaestro(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string") {
    const cleaned = raw.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const n = Number(cleaned);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
}

/** Prefill nº pedido: pedido_cliente Optimus (p. ej. PC-9988); título es descripción/ref. */
function pedidoPrefillFromOt(s: {
  pedido_cliente?: string | null;
  titulo?: string | null;
}): string {
  return s.pedido_cliente?.trim() || "";
}

type Props = {
  stockId: string;
  referenciaCodigo: string;
  loteCliente: string | null;
  unidad: string;
  libre: number;
  canWrite: boolean;
  onChanged: () => Promise<void>;
};

export function StockArticulosReservasPanel({
  stockId,
  referenciaCodigo,
  loteCliente,
  unidad,
  libre,
  canWrite,
  onChanged,
}: Props) {
  const [reservas, setReservas] = useState<StockArticuloReservaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [ot, setOt] = useState("");
  const [otCliente, setOtCliente] = useState<string | null>(null);
  const [otTitulo, setOtTitulo] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [bultos, setBultos] = useState("");
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

  // Si escribe OT a mano (match exacto), resolver cliente + título + prefill.
  useEffect(() => {
    const n = ot.trim();
    if (n.length < 2) {
      setOtCliente(null);
      setOtTitulo(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      void (async () => {
        const { data } = await supabase
          .from("prod_ots_general")
          .select("cliente, cantidad, pedido_cliente, titulo")
          .eq("num_pedido", n)
          .limit(1);
        if (cancelled) return;
        const row = data?.[0] as
          | {
              cliente?: string | null;
              cantidad?: string | number | null;
              pedido_cliente?: string | null;
              titulo?: string | null;
            }
          | undefined;
        if (!row) {
          setOtCliente(null);
          setOtTitulo(null);
          return;
        }
        setOtCliente(
          typeof row.cliente === "string" ? row.cliente : null
        );
        setOtTitulo(
          typeof row.titulo === "string" && row.titulo.trim()
            ? row.titulo.trim()
            : null
        );
        if (mode === "reservar" || mode === "ot_entrega") {
          const qty = parseOtCantidadMaestro(row.cantidad);
          if (qty != null) {
            setCantidad((prev) => (prev.trim() ? prev : String(qty)));
          }
          const pedido = pedidoPrefillFromOt(row);
          if (pedido) {
            setNumPedido((prev) => (prev.trim() ? prev : pedido));
          }
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ot, mode]);

  const vivas = reservas.filter(
    (r) => r.estado === "activa" || r.estado === "parcial"
  );
  const clienteMismatch = clientesOtLoteDifieren(loteCliente, otCliente);

  function pendienteDe(otNumero: string): number | null {
    const viva = reservas.find(
      (r) =>
        r.ot_numero === otNumero &&
        (r.estado === "activa" || r.estado === "parcial")
    );
    if (!viva) return null;
    const pendiente = viva.cantidad_reservada - viva.cantidad_consumida;
    return pendiente > 0 ? pendiente : null;
  }

  function openMode(m: Mode, presetOt?: string) {
    setMode(m);
    setOt(presetOt ?? "");
    setOtCliente(null);
    setOtTitulo(null);
    const pendiente =
      m === "consumir" && presetOt ? pendienteDe(presetOt) : null;
    setCantidad(pendiente != null ? String(pendiente) : "");
    setBultos("");
    setNumPedido("");
    setNotas(m === "ot_entrega" ? OT_ENTREGA_TAG : "");
    setMotivoSinReserva("");
  }

  function onSelectOt(s: OtSugerencia) {
    setOt(s.ot_numero);
    setOtCliente(s.cliente);
    setOtTitulo(s.titulo?.trim() || null);
    if (mode === "reservar" || mode === "ot_entrega") {
      if (s.cantidad != null && s.cantidad > 0) {
        setCantidad(String(s.cantidad));
      }
      const pedido = pedidoPrefillFromOt(s);
      if (pedido) setNumPedido(pedido);
    }
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
        toast.error(friendlyReservaError(errorMessageFromUnknown(e)));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const parsed = parseEnteroCampo(cantidad, "Cantidad");
    if (!parsed.ok) return;
    const qty = parsed.value;

    let bultosN: number | undefined;
    if (bultos.trim()) {
      const b = parseStockImportInt(bultos);
      if (b == null || !Number.isFinite(b) || Number.isNaN(b) || b < 0) {
        toast.error("Bultos debe ser un entero >= 0.");
        return;
      }
      bultosN = b;
    }

    if (mode === "consumir_sin_reserva") {
      const motivo = motivoSinReserva.trim();
      if (!motivo) {
        toast.error("El motivo es obligatorio al consumir sin reserva.");
        return;
      }
      const ok = window.confirm(
        `Vas a descontar ${qty.toLocaleString("es-ES")} ${unidad} del físico del lote ${referenciaCodigo} para la OT ${otN} (sin reserva).\n¿Confirmar?`
      );
      if (!ok) return;
      setSubmitting(true);
      try {
        const { error } = await supabase.rpc("prod_stock_articulos_consumir", {
          p_stock_id: stockId,
          p_ot_numero: otN,
          p_cantidad: qty,
          p_bultos: bultosN,
          p_notas: notas.trim() || undefined,
          p_motivo_sin_reserva: motivo,
        });
        if (error) throw error;
        toast.success(
          `Consumo sin reserva · ${qty.toLocaleString("es-ES")} ${unidad}`
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
      const ok = window.confirm(
        `Vas a descontar ${qty.toLocaleString("es-ES")} ${unidad} del físico del lote ${referenciaCodigo} para la OT ${otN}.\n¿Confirmar?`
      );
      if (!ok) return;
      setSubmitting(true);
      try {
        const { data: cerro, error } = await supabase.rpc("prod_stock_articulos_consumir", {
          p_stock_id: stockId,
          p_ot_numero: otN,
          p_cantidad: qty,
          p_bultos: bultosN,
          p_notas: notas.trim() || undefined,
        });
        if (error) throw error;
        toast.success(
          cerro === true
            ? `Consumido ${qty.toLocaleString("es-ES")} ${unidad}. OT ${otN} cerrada y en histórico.`
            : `Consumido ${qty.toLocaleString("es-ES")} ${unidad} · OT ${otN}`
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

    if (mode === "reservar" || mode === "ot_entrega") {
      const uniqueNotes = buildReservaNotas(mode === "ot_entrega", notas);

      setSubmitting(true);
      try {
        const { error } = await supabase.rpc("prod_stock_articulos_reservar", {
          p_stock_id: stockId,
          p_ot_numero: otN,
          p_cantidad: qty,
          p_num_pedido: numPedido.trim() || undefined,
          p_bultos: bultosN,
          p_notas: uniqueNotes || undefined,
        });
        if (error) throw error;
        let marcada = mode !== "ot_entrega";
        if (mode === "ot_entrega") {
          const { error: marcaErr } = await supabase.rpc("prod_ot_entrega_marcar", {
            p_num_pedido: otN,
            p_marcar: true,
          });
          if (marcaErr) {
            toast.warning(
              `Reservado, pero la OT no quedó marcada como entrega: ${errorMessageFromUnknown(marcaErr)}`
            );
          } else {
            marcada = true;
          }
        }
        toast.success(
          mode === "ot_entrega"
            ? marcada
              ? `OT entrega ${otN}: reservados ${qty.toLocaleString("es-ES")} ${unidad}. Paso Entrega en el pipeline.`
              : `Reservados ${qty.toLocaleString("es-ES")} ${unidad} en la OT ${otN}.`
            : `Reservado ${qty.toLocaleString("es-ES")} ${unidad} · OT ${otN}`
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
            : mode === "ot_entrega"
              ? "OT de entrega (tag + reserva)"
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
              onClick={() => openMode("ot_entrega")}
            >
              OT entrega
            </Button>
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
        en Minerva (importada de Optimus). «OT entrega» marca la OT, reserva el
        lote y deja un paso Entrega. Consumir, al agotar la reserva, la cierra.
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
                  <TableHead className="text-xs whitespace-nowrap">
                    Acciones
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservas.map((r) => {
                const viva = r.estado === "activa" || r.estado === "parcial";
                const pendiente = r.cantidad_reservada - r.cantidad_consumida;
                const esEntrega = (r.notas ?? "").includes(OT_ENTREGA_TAG);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {r.ot_numero}
                        {esEntrega ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-[#002147]/10 text-[#002147] border-[#002147]/20"
                          >
                            entrega
                          </Badge>
                        ) : null}
                      </span>
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
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full px-2.5 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                              title="Consumir (baja el físico)"
                              onClick={() => openMode("consumir", r.ot_numero)}
                            >
                              Consumir
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full px-2.5 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                              title="Anular reserva (vuelve a libre, no baja físico)"
                              onClick={() => openMode("liberar", r.ot_numero)}
                            >
                              Liberar
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
            {mode === "ot_entrega" ? (
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5">
                La OT nace en Optimus. Se marca como entrega, se reserva el stock
                y queda el paso Entrega. No se crea otro número de OT.
              </p>
            ) : null}
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
                onChange={(v) => {
                  setOt(v);
                }}
                onSelectSuggestion={onSelectOt}
                source="maestro"
                placeholder="OT, pedido cliente, título…"
              />
              {otCliente ? (
                <p className="text-[11px] text-slate-500">
                  Cliente OT: <span className="font-medium">{otCliente}</span>
                  {loteCliente ? (
                    <>
                      {" "}
                      · Lote: <span className="font-medium">{loteCliente}</span>
                    </>
                  ) : null}
                </p>
              ) : null}
              {otTitulo ? (
                <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-md px-2 py-1.5 leading-snug">
                  <span className="text-slate-400">Texto OT · </span>
                  {otTitulo}
                </p>
              ) : null}
              {clienteMismatch ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                  Aviso: el cliente de la OT no coincide con el del lote. Puedes
                  seguir (útil para comprobar textos Optimus ↔ maestro); revisa
                  antes de confirmar.
                </p>
              ) : null}
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
                    mode === "reservar" || mode === "ot_entrega"
                      ? `Prefill = pedido OT · máx. libre ${libre.toLocaleString("es-ES")}`
                      : mode === "consumir"
                        ? "Pendiente de la reserva"
                        : "Ej. 5.000"
                  }
                />
              </div>
            ) : null}

            {mode === "reservar" || mode === "ot_entrega" ? (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Bultos</Label>
                  <Input
                    inputMode="numeric"
                    value={bultos}
                    onChange={(e) => setBultos(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">
                    Nº pedido (editable)
                  </Label>
                  <Input
                    value={numPedido}
                    onChange={(e) => setNumPedido(e.target.value)}
                    placeholder="Prefill = pedido cliente (p. ej. PC-9988)"
                  />
                </div>
              </>
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
                placeholder={
                  mode === "ot_entrega"
                    ? `${OT_ENTREGA_TAG} se añade solo`
                    : "Opcional"
                }
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
