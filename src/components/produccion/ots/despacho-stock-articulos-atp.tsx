"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Boxes, Copy, Factory, Layers, Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessageFromUnknown } from "@/lib/error-message";
import {
  buildReservaNotas,
  planReservaLotes,
  resumenAtpDespacho,
  textoRepartoOptimus,
  type AtpDespachoLote,
  type AtpDespachoResumen,
} from "@/lib/stock-articulos-atp-despacho";

export type DespachoAtpDecision = "usar_stock" | "mezclar" | "fabricar";

const ESTADO_LABEL: Record<string, string> = {
  terminado: "Terminado",
  impreso: "Impreso",
  troquelado: "Troquelado",
  otro: "Otro",
};

function fmt(n: number): string {
  return n.toLocaleString("es-ES");
}

/** Stock libre de la referencia + lo ya reservado para esta OT. */
export function useDespachoStockAtp(args: {
  supabase: SupabaseClient;
  enabled: boolean;
  referenciaId: string | null;
  otNumero: string | null;
  otCliente: string | null;
  cantidadPedida: number | null;
}) {
  const { supabase, enabled, referenciaId, otNumero, otCliente, cantidadPedida } =
    args;
  const [lotes, setLotes] = useState<AtpDespachoLote[]>([]);
  const [reservadoOt, setReservadoOt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || !referenciaId || !otNumero) {
      setLotes([]);
      setReservadoOt(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [{ data: atp, error: atpErr }, { data: res, error: resErr }] =
          await Promise.all([
            supabase
              .from("stock_articulos_atp")
              .select(
                "id, referencia_codigo, referencia_cliente, cliente, unidad, poses, estado_proceso, cantidad_fisica, cantidad_libre, ubicacion_fisica, ot_origen, created_at"
              )
              .eq("referencia_id", referenciaId)
              .gt("cantidad_libre", 0)
              .limit(200),
            supabase
              .from("prod_stock_articulos_reservas")
              .select("cantidad_reservada, cantidad_consumida, estado")
              .eq("ot_numero", otNumero)
              .in("estado", ["activa", "parcial"]),
          ]);
        if (cancelled) return;
        if (atpErr) throw atpErr;
        if (resErr) throw resErr;
        setLotes((atp ?? []) as AtpDespachoLote[]);
        setReservadoOt(
          (res ?? []).reduce(
            (s, r) =>
              s +
              Math.max(
                0,
                Number(r.cantidad_reservada ?? 0) - Number(r.cantidad_consumida ?? 0)
              ),
            0
          )
        );
      } catch {
        // Sin permiso o vista no disponible: el despacho sigue como siempre.
        if (!cancelled) {
          setLotes([]);
          setReservadoOt(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, otNumero, referenciaId, supabase, tick]);

  const resumen = useMemo<AtpDespachoResumen | null>(() => {
    if (!enabled || !referenciaId || !otNumero) return null;
    return resumenAtpDespacho(lotes, otCliente, cantidadPedida);
  }, [cantidadPedida, enabled, lotes, otCliente, otNumero, referenciaId]);

  const relevante =
    resumen != null &&
    (resumen.ptUsables.length > 0 || reservadoOt > 0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { loading, resumen, reservadoOt, relevante, reload };
}

export function DespachoStockAtpBanner({
  resumen,
  reservadoOt,
  decision,
  onOpen,
}: {
  resumen: AtpDespachoResumen;
  reservadoOt: number;
  decision: DespachoAtpDecision | null;
  onOpen: () => void;
}) {
  const decisionLabel =
    decision === "usar_stock"
      ? "OT de entrega (sale de stock, no se despacha a producción)"
      : decision === "mezclar"
        ? "Mezclar: pendiente de partir en Optimus"
        : decision === "fabricar"
          ? "Fabricar completo"
          : null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
      <Boxes className="size-5 shrink-0 text-emerald-700" />
      <div className="min-w-0 flex-1 text-sm text-emerald-950">
        {resumen.librePtUsable > 0 ? (
          <p>
            Hay <strong>{fmt(resumen.librePtUsable)} uds</strong> terminadas
            libres en stock para esta referencia
            {resumen.cantidadPedida != null
              ? ` (pedido ${fmt(resumen.cantidadPedida)})`
              : ""}
            .
          </p>
        ) : null}
        {reservadoOt > 0 ? (
          <p>
            Esta OT ya tiene <strong>{fmt(reservadoOt)} uds</strong> reservadas
            de stock.
          </p>
        ) : null}
        {decisionLabel ? (
          <p className="mt-0.5 text-xs font-semibold text-emerald-800">
            Decisión: {decisionLabel}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-emerald-800">
            Antes de despachar, decide si se sirve de stock.
          </p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-emerald-400 bg-white text-emerald-900 hover:bg-emerald-100"
        onClick={onOpen}
      >
        {decision ? "Cambiar decisión" : "Ver opciones"}
      </Button>
    </div>
  );
}

export function DespachoStockAtpDialog({
  open,
  onOpenChange,
  supabase,
  resumen,
  reservadoOt,
  otNumero,
  otCliente,
  pedidoCliente,
  referenciaCodigo,
  onDecision,
  onReservado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supabase: SupabaseClient;
  resumen: AtpDespachoResumen;
  reservadoOt: number;
  otNumero: string;
  otCliente: string | null;
  pedidoCliente: string | null;
  referenciaCodigo: string | null;
  onDecision: (d: DespachoAtpDecision) => void;
  onReservado: () => void;
}) {
  const [reservando, setReservando] = useState(false);
  const pedida = resumen.cantidadPedida;
  const pendienteReservar =
    pedida == null ? 0 : Math.max(0, pedida - reservadoOt);
  const cubre =
    pedida != null && resumen.librePtUsable + reservadoOt >= pedida;
  const usarMezcla = pedida == null ? 0 : Math.min(resumen.librePtUsable, pedida);

  const textoOptimus = useMemo(
    () =>
      pedida == null
        ? ""
        : textoRepartoOptimus({
            otNumero,
            cliente: otCliente,
            referencia: referenciaCodigo ?? "",
            pedidoCliente,
            usarDeStock: usarMezcla,
            faltan: pedida - usarMezcla,
          }),
    [otCliente, otNumero, pedida, pedidoCliente, referenciaCodigo, usarMezcla]
  );

  async function usarStock() {
    if (pedida == null) return;
    if (pendienteReservar <= 0) {
      onDecision("usar_stock");
      toast.success("La OT ya está cubierta con reservas de stock.");
      return;
    }
    const plan = planReservaLotes(resumen.ptUsables, pendienteReservar);
    setReservando(true);
    let hechas = 0;
    try {
      for (const linea of plan) {
        const { error } = await supabase.rpc("prod_stock_articulos_reservar", {
          p_stock_id: linea.stockId,
          p_ot_numero: otNumero,
          p_cantidad: linea.cantidad,
          p_num_pedido: pedidoCliente?.trim() || undefined,
          p_notas: buildReservaNotas(true, "Despacho: servir de stock"),
        });
        if (error) throw error;
        hechas += 1;
      }
      toast.success(
        `Reservadas ${fmt(pendienteReservar)} uds en ${plan.length} lote${plan.length === 1 ? "" : "s"} para la OT ${otNumero}.`
      );
      onReservado();
      onDecision("usar_stock");
    } catch (e) {
      toast.error(
        `${hechas > 0 ? `Se reservaron ${hechas} de ${plan.length} lotes. ` : ""}${errorMessageFromUnknown(e)}`
      );
      if (hechas > 0) onReservado();
    } finally {
      setReservando(false);
    }
  }

  async function copiarOptimus() {
    try {
      await navigator.clipboard.writeText(textoOptimus);
      toast.success("Copiado. Pégalo al partir la OT en Optimus.");
    } catch {
      toast.error("No se pudo copiar; selecciona el texto a mano.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Stock disponible · OT {otNumero}</DialogTitle>
          <DialogDescription>
            Minerva no crea OTs: si hay que partir el pedido, se hace en
            Optimus (OT de entrega + OT de fabricación).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 px-6 py-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Pedido</p>
              <p className="font-mono text-lg font-bold text-[#002147]">
                {pedida != null ? fmt(pedida) : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-emerald-800">
                Libre usable
              </p>
              <p className="font-mono text-lg font-bold text-emerald-900">
                {fmt(resumen.librePtUsable)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-slate-500">
                Ya reservado OT
              </p>
              <p className="font-mono text-lg font-bold text-[#002147]">
                {fmt(reservadoOt)}
              </p>
            </div>
          </div>

          {resumen.ptUsables.length > 0 ? (
            <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1 text-left">Lote</th>
                    <th className="px-2 py-1 text-left">Cliente</th>
                    <th className="px-2 py-1 text-left">Ubicación</th>
                    <th className="px-2 py-1 text-right">Libre</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.ptUsables.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="px-2 py-1 font-mono">{l.ot_origen || "—"}</td>
                      <td className="px-2 py-1">{l.cliente || "Genérico"}</td>
                      <td className="px-2 py-1">{l.ubicacion_fisica || "—"}</td>
                      <td className="px-2 py-1 text-right font-mono tabular-nums">
                        {fmt(l.cantidad_libre)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {resumen.wipUsables.length > 0 ? (
            <p className="text-xs text-slate-600">
              También hay semielaborado (
              {resumen.wipUsables
                .map(
                  (l) =>
                    `${fmt(l.cantidad_libre)} ${l.unidad} ${ESTADO_LABEL[l.estado_proceso] ?? l.estado_proceso}`
                )
                .join(" · ")}
              ): puede acortar la ruta, pero no se reserva desde aquí.
            </p>
          ) : null}
          {resumen.otrosClientes.length > 0 ? (
            <p className="text-xs text-slate-500">
              Hay stock dedicado a otro cliente (
              {resumen.otrosClientes.map((l) => l.cliente).join(", ")}) que no se
              ofrece.
            </p>
          ) : null}

          {pedida == null ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              La OT no tiene cantidad: no se puede calcular el reparto.
            </p>
          ) : null}

          {pedida != null && !cubre ? (
            <div className="space-y-2 rounded-md border border-[#002147]/20 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold text-[#002147]">
                Mezclar: partir en Optimus
              </p>
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-800">
                {textoOptimus}
              </pre>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => void copiarOptimus()}
              >
                <Copy className="mr-1 size-3.5" />
                Copiar texto
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={reservando}
            onClick={() => onDecision("fabricar")}
          >
            <Factory className="mr-1.5 size-4" />
            Fabricar completo
          </Button>
          {pedida != null && !cubre && usarMezcla > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="border-[#002147]/40"
              disabled={reservando}
              onClick={() => onDecision("mezclar")}
            >
              <Layers className="mr-1.5 size-4" />
              Mezclar ({fmt(usarMezcla)} stock + {fmt(pedida - usarMezcla)} fabricar)
            </Button>
          ) : null}
          {cubre ? (
            <Button
              type="button"
              className="bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={reservando}
              onClick={() => void usarStock()}
            >
              {reservando ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <PackageCheck className="mr-1.5 size-4" />
              )}
              {pendienteReservar > 0
                ? `Usar stock · reservar ${fmt(pendienteReservar)} (OT entrega)`
                : "Usar stock (ya reservado)"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
