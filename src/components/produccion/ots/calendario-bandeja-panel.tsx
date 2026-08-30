"use client";

import {
  CalendarPlus,
  Loader2,
  Map,
  PanelLeft,
  PanelLeftClose,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchCalendarioBandejaRaw,
  filterBandejaRows,
  type CalendarioBandejaRow,
} from "@/lib/calendario-bandeja";
import type { CalendarioItinerarioOt } from "@/lib/calendario-produccion-progreso";
import {
  labelCalendarioAmbito,
  type CalendarioAmbito,
} from "@/lib/calendario-produccion-ambito";
import { SEMAFORO_PILL_STYLES } from "@/lib/calendario-produccion-progreso";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export type CalendarioBandejaPanelProps = {
  ambito: CalendarioAmbito;
  canEdit: boolean;
  mostrarPruebas: boolean;
  /** Refresco tras colocar OT en calendario. */
  refreshKey?: number;
  onColocada?: () => void;
  onOpenOt?: (otNumero: string) => void;
  onOpenHojaRuta?: (otNumero: string) => void;
  /** Insertar pastilla en fecha (reutiliza lógica del calendario). */
  onColocarEnFecha: (otNumero: string, fechaYmd: string) => Promise<boolean>;
  className?: string;
  /** Desktop: altura alineada al grid del calendario (px). */
  matchHeightPx?: number | null;
};

function bandejaAmbitoHint(ambito: CalendarioAmbito): string {
  if (ambito === "engomado") {
    return "Engomado + manipulados (ámbito E)";
  }
  return labelCalendarioAmbito(ambito);
}

function ymdHoyLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type BandejaRawData = {
  candidatos: Awaited<ReturnType<typeof fetchCalendarioBandejaRaw>>["candidatos"];
  pills: Awaited<ReturnType<typeof fetchCalendarioBandejaRaw>>["pills"];
  itinerarioByOt: Map<string, CalendarioItinerarioOt>;
};

export function CalendarioBandejaPanel({
  ambito,
  canEdit,
  mostrarPruebas,
  refreshKey = 0,
  onColocada,
  onOpenOt,
  onOpenHojaRuta,
  onColocarEnFecha,
  className,
  matchHeightPx = null,
}: CalendarioBandejaPanelProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState<BandejaRawData | null>(null);
  const [filtro, setFiltro] = useState("");
  const [verTodas, setVerTodas] = useState(false);
  const [colocarOt, setColocarOt] = useState<string | null>(null);
  const [colocarFecha, setColocarFecha] = useState(ymdHoyLocal());
  const [colocando, setColocando] = useState(false);

  const loadRaw = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCalendarioBandejaRaw(supabase);
      setRaw(data);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo cargar la bandeja."));
      setRaw(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadRaw();
  }, [loadRaw, refreshKey]);

  const rows = useMemo((): CalendarioBandejaRow[] => {
    if (!raw) return [];
    return filterBandejaRows({
      ambito,
      verTodas,
      mostrarPruebas,
      filtroTexto: filtro,
      pills: raw.pills,
      itinerarioByOt: raw.itinerarioByOt,
      candidatos: raw.candidatos,
    });
  }, [raw, ambito, verTodas, mostrarPruebas, filtro]);

  const openColocar = (ot: string) => {
    setColocarOt(ot);
    setColocarFecha(ymdHoyLocal());
  };

  const confirmColocar = async () => {
    if (!colocarOt || !colocarFecha) return;
    setColocando(true);
    try {
      const ok = await onColocarEnFecha(colocarOt, colocarFecha);
      if (ok) {
        toast.success(`OT ${colocarOt} colocada en ${formatFechaEsCorta(colocarFecha)}.`);
        setColocarOt(null);
        onColocada?.();
      }
    } finally {
      setColocando(false);
    }
  };

  return (
    <aside
      className={cn(
        "flex w-[min(100%,17.5rem)] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
        // Móvil: tope fijo. Desktop: altura = grid (matchHeightPx), sin sticky.
        matchHeightPx == null ? "max-h-[min(70vh,42rem)]" : "lg:max-h-none",
        className,
      )}
      style={
        matchHeightPx != null && matchHeightPx > 0
          ? { height: matchHeightPx }
          : undefined
      }
    >
      <div className="shrink-0 border-b border-slate-100 px-3 py-2.5">
        <h3 className="text-sm font-semibold text-[#002147]">Bandeja</h3>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
          Despachadas sin pastilla · {bandejaAmbitoHint(ambito)}
        </p>
      </div>

      <div className="shrink-0 space-y-2 border-b border-slate-100 px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Filtrar OT, cliente…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-700">
          <input
            type="checkbox"
            className="size-3.5 accent-[#002147]"
            checked={verTodas}
            onChange={(e) => setVerTodas(e.target.checked)}
          />
          Ver todas (sin filtro cadena)
        </label>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            {loading ? "Cargando…" : `${rows.length} OT${rows.length === 1 ? "" : "s"}`}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5"
            disabled={loading}
            onClick={() => void loadRaw()}
            title="Recargar bandeja"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Cargando…
          </div>
        ) : rows.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-slate-500">
            {filtro.trim()
              ? "Ninguna OT coincide con el filtro."
              : "No hay OTs pendientes de colocar en este ámbito."}
          </p>
        ) : (
          <ul className="space-y-1">
            {rows.map((row) => (
              <li
                key={row.otNumero}
                className="group rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5 transition hover:border-slate-200 hover:bg-white"
              >
                <div className="flex items-start gap-1.5">
                  <span
                    className={cn(
                      "mt-1 size-1.5 shrink-0 rounded-full",
                      SEMAFORO_PILL_STYLES[row.semaforo].dot,
                    )}
                    title={SEMAFORO_PILL_STYLES[row.semaforo].title}
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="text-left text-xs font-semibold text-[#002147] hover:underline"
                      onClick={() => onOpenOt?.(row.otNumero)}
                    >
                      OT {row.otNumero}
                    </button>
                    <p className="line-clamp-2 text-[10px] leading-snug text-slate-600">
                      {row.cliente ?? "—"}
                      {row.trabajo ? ` · ${row.trabajo}` : ""}
                    </p>
                    {row.fechaEntrega ? (
                      <p className="text-[10px] text-slate-500">
                        Entrega {formatFechaEsCorta(row.fechaEntrega.slice(0, 10))}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-0.5 opacity-80 group-hover:opacity-100">
                    {onOpenHojaRuta ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        title="Hoja de ruta"
                        onClick={() => onOpenHojaRuta(row.otNumero)}
                      >
                        <Map className="size-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1.5 h-7 w-full text-[11px]"
                    onClick={() => openColocar(row.otNumero)}
                  >
                    <CalendarPlus className="mr-1 size-3.5" />
                    Colocar en calendario…
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={colocarOt != null}
        onOpenChange={(open) => {
          if (!open) setColocarOt(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Colocar en calendario</DialogTitle>
            <DialogDescription>
              OT {colocarOt} · {labelCalendarioAmbito(ambito)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="bandeja-fecha">Fecha</Label>
            <Input
              id="bandeja-fecha"
              type="date"
              value={colocarFecha}
              onChange={(e) => setColocarFecha(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={colocando}
              onClick={() => setColocarOt(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={colocando || !colocarFecha}
              onClick={() => void confirmColocar()}
            >
              {colocando ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Colocar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

export function CalendarioBandejaToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1 px-2 text-xs"
      onClick={onToggle}
      title={open ? "Ocultar bandeja" : "Mostrar bandeja"}
    >
      {open ? (
        <PanelLeftClose className="size-3.5" />
      ) : (
        <PanelLeft className="size-3.5" />
      )}
      Bandeja
    </Button>
  );
}
