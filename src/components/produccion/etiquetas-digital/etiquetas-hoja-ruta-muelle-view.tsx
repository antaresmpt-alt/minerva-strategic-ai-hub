"use client";

import { Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { EntregaPlazoSemaforo } from "@/components/produccion/etiquetas-digital/entrega-plazo-semaforo";
import { EtiquetasHojaRutaMaquinaButtons } from "@/components/produccion/etiquetas-digital/etiquetas-hoja-ruta-maquina-buttons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, type Option } from "@/components/ui/select-native";
import { entregaPlazoSemaforo } from "@/lib/etiquetas-hoja-ruta-plazo";
import type { MaquinaHojaRutaField } from "@/lib/etiquetas-hoja-ruta-maquina";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";
import { cn } from "@/lib/utils";

type ChipId = "sinKon" | "sinTroq" | "sinNum" | "urgente" | "plazoRojo";

const CHIPS: { id: ChipId; label: string }[] = [
  { id: "sinKon", label: "Sin impresión" },
  { id: "sinTroq", label: "Sin troquel" },
  { id: "sinNum", label: "Sin numerar" },
  { id: "urgente", label: "Urgente" },
  { id: "plazoRojo", label: "Plazo ≤ 4 d" },
];

const ORDEN_OPTIONS: Option[] = [
  { value: "fecha_entrega_ot_asc", label: "Fecha entrega OT (asc)" },
  { value: "fecha_entrega_ot_desc", label: "Fecha entrega OT (desc)" },
  { value: "fecha_entrada_asc", label: "Fecha entrada depto (asc)" },
  { value: "fecha_entrada_desc", label: "Fecha entrada depto (desc)" },
  { value: "ot_asc", label: "OT (asc)" },
  { value: "ot_desc", label: "OT (desc)" },
];

type Props = {
  rows: ProdEtiquetasHojaRutaRow[];
  loading: boolean;
  togglingMaquina: string | null;
  onToggleMaquina: (
    row: ProdEtiquetasHojaRutaRow,
    field: MaquinaHojaRutaField,
    next: boolean
  ) => void;
  onOpenDetail: (row: ProdEtiquetasHojaRutaRow) => void;
};

function sortRows(list: ProdEtiquetasHojaRutaRow[], orden: string): ProdEtiquetasHojaRutaRow[] {
  const out = [...list];
  const cmpStr = (a: string | null, b: string | null, asc: boolean) => {
    const av = a ?? "";
    const bv = b ?? "";
    const c = av.localeCompare(bv, "es", { numeric: true });
    return asc ? c : -c;
  };
  switch (orden) {
    case "fecha_entrega_ot_desc":
      out.sort((a, b) => cmpStr(a.fecha_entrega_ot, b.fecha_entrega_ot, false));
      break;
    case "fecha_entrada_asc":
      out.sort((a, b) => cmpStr(a.fecha_entrada_depto, b.fecha_entrada_depto, true));
      break;
    case "fecha_entrada_desc":
      out.sort((a, b) => cmpStr(a.fecha_entrada_depto, b.fecha_entrada_depto, false));
      break;
    case "ot_asc":
      out.sort((a, b) =>
        (a.ot_numero ?? "").localeCompare(b.ot_numero ?? "", "es", { numeric: true })
      );
      break;
    case "ot_desc":
      out.sort(
        (a, b) =>
          -((a.ot_numero ?? "").localeCompare(b.ot_numero ?? "", "es", { numeric: true }))
      );
      break;
    default:
      out.sort((a, b) => cmpStr(a.fecha_entrega_ot, b.fecha_entrega_ot, true));
  }
  return out;
}

function trabajoCorto(r: ProdEtiquetasHojaRutaRow): string {
  const t = (r.trabajo ?? "").trim();
  if (t) return t.length > 72 ? `${t.slice(0, 69)}…` : t;
  const c = (r.cliente ?? "").trim();
  return c || "—";
}

export function EtiquetasHojaRutaMuelleView({
  rows,
  loading,
  togglingMaquina,
  onToggleMaquina,
  onOpenDetail,
}: Props) {
  const [buscar, setBuscar] = useState("");
  const [orden, setOrden] = useState("fecha_entrega_ot_asc");
  const [chips, setChips] = useState<Set<ChipId>>(new Set());

  const toggleChip = (id: ChipId) => {
    setChips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activas = useMemo(
    () => rows.filter((r) => !r.finalizado),
    [rows]
  );

  const filtradas = useMemo(() => {
    let list = activas;
    const q = buscar.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const parts = [
          r.ot_numero,
          r.cliente,
          r.trabajo,
          r.papel,
        ].map((x) => String(x ?? "").toLowerCase());
        return parts.some((s) => s.includes(q));
      });
    }
    if (chips.has("sinKon")) list = list.filter((r) => !r.konica);
    if (chips.has("sinTroq")) list = list.filter((r) => !r.troqueladora);
    if (chips.has("sinNum")) list = list.filter((r) => !r.numeradora);
    if (chips.has("urgente")) list = list.filter((r) => r.urgencia === "urgente");
    if (chips.has("plazoRojo")) {
      list = list.filter((r) => entregaPlazoSemaforo(r.fecha_entrega_ot) === "rojo");
    }
    return sortRows(list, orden);
  }, [activas, buscar, chips, orden]);

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white p-8 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        Cargando hoja de ruta…
      </div>
    );
  }

  if (activas.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
        No hay OTs activas en departamento. Las finalizadas no aparecen en esta vista.
      </div>
    );
  }

  return (
    <div className="space-y-3 md:hidden">
      <p className="text-xs text-muted-foreground">
        Vista muelle: solo OTs no finalizadas. Toca una tarjeta para más detalle.
      </p>

      <div className="grid max-w-md gap-2">
        <Label htmlFor="etq-hr-muelle-orden" className="text-xs">
          Ordenar por
        </Label>
        <NativeSelect
          id="etq-hr-muelle-orden"
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          options={ORDEN_OPTIONS}
        />
      </div>

      <div className="relative max-w-md">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-muted-foreground"
          aria-hidden
        >
          🔍
        </span>
        <Input
          id="etq-hr-muelle-buscar"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder="Buscar por OT, cliente, trabajo o papel…"
          className="h-10 pr-10 pl-9"
          autoComplete="off"
        />
        {buscar.trim() ? (
          <button
            type="button"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-slate-100 hover:text-foreground"
            onClick={() => setBuscar("")}
            aria-label="Limpiar búsqueda"
          >
            <X className="size-4 shrink-0" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CHIPS.map(({ id, label }) => {
          const on = chips.has(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggleChip(id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors touch-manipulation",
                on
                  ? "border-[#002147] bg-[#002147] text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-xl border border-slate-200/90 bg-white p-8 text-center text-sm text-muted-foreground shadow-sm">
          Ninguna OT coincide con la búsqueda o los filtros.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtradas.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onOpenDetail(r)}
              className="text-left transition hover:ring-2 hover:ring-[#C69C2B]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002147]/30"
            >
              <Card className="min-h-[11rem] border-slate-200/90 bg-white shadow-sm">
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-lg font-bold text-[#002147]">
                      {r.ot_numero}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {r.urgencia === "urgente" ? (
                        <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800">
                          Urgente
                        </span>
                      ) : null}
                      <EntregaPlazoSemaforo
                        fechaEntregaOt={r.fecha_entrega_ot}
                        urgente={r.urgencia === "urgente"}
                      />
                    </div>
                  </div>
                  <CardTitle className="text-base leading-snug text-[#002147]">
                    {trabajoCorto(r)}
                  </CardTitle>
                  {r.papel?.trim() ? (
                    <CardDescription className="text-xs">{r.papel.trim()}</CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-baseline justify-between gap-2 border-t border-slate-100 pt-2">
                    <span className="text-xs text-muted-foreground">Etiquetas</span>
                    <span className="text-xl font-semibold tabular-nums text-[#002147]">
                      {r.etiquetas != null ? r.etiquetas.toLocaleString("es-ES") : "—"}
                    </span>
                  </div>
                  <EtiquetasHojaRutaMaquinaButtons
                    rowId={r.id}
                    konica={Boolean(r.konica)}
                    troqueladora={Boolean(r.troqueladora)}
                    numeradora={Boolean(r.numeradora)}
                    togglingMaquina={togglingMaquina}
                    onToggle={(field, next) => onToggleMaquina(r, field, next)}
                  />
                  <p className="text-center text-[10px] text-muted-foreground">
                    Toca la tarjeta para editar cantidad o abrir ficha
                  </p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
