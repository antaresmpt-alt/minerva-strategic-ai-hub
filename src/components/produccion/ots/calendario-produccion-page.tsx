"use client";

import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ArrowRightLeft,
  ClipboardPaste,
  FileDown,
  ListOrdered,
  Loader2,
  Plus,
  RefreshCw,
  Route,
  Scissors,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useDeferredValue, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  CalendarioBandejaPanel,
  CalendarioBandejaToggle,
} from "@/components/produccion/ots/calendario-bandeja-panel";
import { CalendarioDetalleDiaDialog } from "@/components/produccion/ots/calendario-detalle-dia-mesa-dialog";
import { HojaRutaOtDialog } from "@/components/produccion/hoja-ruta/hoja-ruta-ot-dialog";
import { STEP_BADGE_STYLES } from "@/components/produccion/hoja-ruta/hoja-ruta-step-styles";
import {
  CALENDARIO_CAFE_EASTER_EGG_EMAIL,
  CalendarioCafeEasterEggDialog,
} from "@/components/produccion/ots/calendario-cafe-easter-egg-dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildSemanaLaboral,
  buildSemanasLaboralesMes,
  collectEntradasAtrasadas,
  enrichEntradasHechoVisual,
  entradasPorDia,
  fechaDiaLabel,
  filtrarEntradasPorTexto,
  filtrarEntradasSoloPendientes,
  mesAnioLabel,
  mondayOfWeek,
  monthRangeYmd,
  numColumnasCalendario,
  semanaLabelEs,
  weekRangeYmd,
  idsEditablesCalendarioDia,
  planMoverCalendarioLote,
  type CalendarioProduccionLinea,
} from "@/lib/calendario-produccion";
import { appendDetalleSlotAfterCalendarMove } from "@/lib/calendario-detalle-dia";
import {
  calendarioMaterialPipClass,
  fetchCalendarioMaterialByOtNumeros,
  type CalendarioMaterialInfo,
} from "@/lib/calendario-material-status";
import {
  allCalendarioAmbitoVisibilityOn,
  CALENDARIO_AMBITOS,
  CALENDARIO_AMBITO_LETRA,
  CALENDARIO_AMBITO_PILL,
  canEditCalendarioAmbito,
  defaultCalendarioAmbitoFromRole,
  defaultCalendarioAmbitoVisibility,
  isCalendarioAmbito,
  labelCalendarioAmbito,
  parseCalendarioAmbito,
  parseCalendarioAmbitoVisibility,
  serializeCalendarioAmbitoVisibility,
  type CalendarioAmbito,
  type CalendarioAmbitoVisibility,
} from "@/lib/calendario-produccion-ambito";
import {
  exportCalendarioProduccionDiaPdf,
  exportCalendarioProduccionListadoPdf,
  exportCalendarioProduccionMensualPdf,
  exportCalendarioProduccionSemanaPdf,
} from "@/lib/calendario-produccion-export";
import { parseProgramacioPlanificadorExcel } from "@/lib/calendario-produccion-import";
import {
  derivePastillaEspejo,
  ESPEJO_FASE_STYLES,
  fetchCalendarioEspejoByOtNumeros,
  labelPasoDisponible,
  type CalendarioEspejoOt,
} from "@/lib/calendario-mesa-espejo";
import {
  fetchItinerarioCalendarioByOtNumeros,
  fetchPasosResumenOt,
  guillotinaTooltipLine,
  guillotinaStatusFromPasos,
  SEMAFORO_PILL_STYLES,
  semaforoForAmbito,
  type CalendarioItinerarioOt,
} from "@/lib/calendario-produccion-progreso";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { resolveEstadoOtLabel } from "@/lib/hoja-ruta/hoja-ruta-query";
import { isOtNumeroPrueba } from "@/lib/ot-prueba";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";
import { cn } from "@/lib/utils";
import type {
  CalendarioProduccionOtDetalle,
  ProdCalendarioProduccionOtRow,
} from "@/types/prod-calendario-produccion-ot";
import type { ProdCalendarioProduccionNotaRow } from "@/types/prod-calendario-produccion-nota";

const TABLE = "prod_calendario_produccion_ot";
const TABLE_NOTAS = "prod_calendario_produccion_nota";
const TABLE_MAESTRO = "prod_ots_general";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";

const MIGRATION_HINT =
  "Ejecuta la migración 20260724140000_prod_calendario_produccion_ot_ambito.sql en Supabase.";
const MIGRATION_HINT_NOTAS =
  "Ejecuta la migración 20260721120000_prod_calendario_produccion_nota.sql en Supabase.";

const STORAGE_SHOW_SATURDAY = "cal-prod-show-saturday";
const STORAGE_VISTA = "cal-prod-vista";
const STORAGE_AMBITO_VIS = "cal-prod-ambito-vis";
const STORAGE_MOSTRAR_PRUEBAS = "cal-prod-mostrar-pruebas";
const STORAGE_BANDEJA = "cal-prod-bandeja-open";

type VistaCalendario = "mes" | "semana";

type PortapapelesOt = {
  id: string;
  otNumero: string;
  ambito: CalendarioAmbito;
  fromFecha: string;
  label: string;
};

function isMissingTable(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("schema cache") && m.includes("prod_calendario_produccion_ot");
}

function isMissingNotasTable(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("schema cache") && m.includes("prod_calendario_produccion_nota");
}

type OtSearchHit = {
  num_pedido: string;
  cliente: string | null;
  titulo: string | null;
  cantidad: number | null;
};

const EMPTY_CALENDARIO_LINEAS: CalendarioProduccionLinea[] = [];
const EMPTY_CALENDARIO_NOTAS: ProdCalendarioProduccionNotaRow[] = [];

/** Filtro local: no re-renderiza el grid en cada tecla. */
function CalendarioFiltroInput({
  className,
  onDebouncedChange,
}: {
  className?: string;
  onDebouncedChange: (q: string) => void;
}) {
  const [value, setValue] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => onDebouncedChange(value.trim()), 250);
    return () => window.clearTimeout(t);
  }, [value, onDebouncedChange]);
  return (
    <Input
      className={className}
      placeholder="Filtrar OT / trabajo / cliente…"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      aria-label="Filtrar calendario"
    />
  );
}

/** Búsqueda OT del modal día — estado local, no re-renderiza el mes. */
function CalendarioDiaOtBuscar({
  supabase,
  canEdit,
  ambitoLabel,
  saving,
  onSelect,
}: {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  canEdit: boolean;
  ambitoLabel: string;
  saving: boolean;
  onSelect: (hit: OtSearchHit) => void | Promise<void>;
}) {
  const [otQuery, setOtQuery] = useState("");
  const [otHits, setOtHits] = useState<OtSearchHit[]>([]);
  const [searchingOt, setSearchingOt] = useState(false);

  useEffect(() => {
    const needle = otQuery.trim().replace(/[%_,]/g, " ").trim();
    if (needle.length < 2) {
      setOtHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        setSearchingOt(true);
        try {
          const { data, error } = await supabase
            .from(TABLE_MAESTRO)
            .select("num_pedido, cliente, titulo, cantidad")
            .or(
              `num_pedido.ilike.%${needle}%,titulo.ilike.%${needle}%,cliente.ilike.%${needle}%`,
            )
            .order("num_pedido", { ascending: false })
            .limit(12);
          if (error) throw error;
          if (!cancelled) {
            setOtHits(
              ((data ?? []) as OtSearchHit[]).filter((h) =>
                String(h.num_pedido ?? "").trim(),
              ),
            );
          }
        } catch (e) {
          if (!cancelled) {
            toast.error(errorMessageFromUnknown(e, "No se pudo buscar la OT."));
            setOtHits([]);
          }
        } finally {
          if (!cancelled) setSearchingOt(false);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [otQuery, supabase]);

  return (
    <div>
      <Label className="text-xs">Añadir OT ({ambitoLabel})</Label>
      <Input
        className="mt-1"
        placeholder="Buscar nº OT, cliente o trabajo…"
        value={otQuery}
        onChange={(e) => setOtQuery(e.target.value)}
        disabled={!canEdit}
      />
      {!canEdit ? (
        <p className="mt-1 text-xs text-amber-800">
          No puedes añadir OTs en este ámbito. Cambia el desplegable o pide a
          admin/gerencia.
        </p>
      ) : null}
      {searchingOt ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <Loader2 className="size-3 animate-spin" /> Buscando…
        </p>
      ) : null}
      {otHits.length > 0 && canEdit ? (
        <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200">
          {otHits.map((h) => (
            <li key={h.num_pedido}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
                disabled={saving}
                onClick={() => {
                  void (async () => {
                    await onSelect(h);
                    setOtQuery("");
                    setOtHits([]);
                  })();
                }}
              >
                <span className="font-semibold text-[#002147]">
                  {h.num_pedido}
                </span>
                <span className="line-clamp-1 text-xs text-slate-600">
                  {h.cliente ?? "—"} · {h.titulo ?? "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CalendarioDiaNotaInput({
  saving,
  onAdd,
}: {
  saving: boolean;
  onAdd: (texto: string) => void | Promise<void>;
}) {
  const [notaTexto, setNotaTexto] = useState("");
  return (
    <div>
      <Label className="text-xs">Añadir nota libre</Label>
      <div className="mt-1 flex items-start gap-2">
        <Textarea
          className="min-h-[2.5rem] text-sm"
          placeholder="Ej: Priorizar cambios de troquel, reunión cliente, etc."
          value={notaTexto}
          onChange={(e) => setNotaTexto(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          disabled={saving || notaTexto.trim().length === 0}
          onClick={() => {
            const texto = notaTexto.trim();
            if (!texto) return;
            void (async () => {
              await onAdd(texto);
              setNotaTexto("");
            })();
          }}
        >
          Añadir
        </Button>
      </div>
    </div>
  );
}

/**
 * Badge ámbito I/D/T/E con pip de material (patrón Linear/GitHub):
 * - Gris / N/A → sin pip (no ocupa ancho).
 * - Rojo/ámbar/verde → punto en esquina del badge + tooltip compra.
 * No bloquea clics de la pastilla.
 */
function AmbitoBadgeWithMaterial({
  ambito,
  material,
  compact,
}: {
  ambito: CalendarioAmbito;
  material: CalendarioMaterialInfo | undefined;
  compact?: boolean;
}) {
  const ambitoPill = CALENDARIO_AMBITO_PILL[ambito];
  const status = material?.status ?? "gris";
  const showPip = status === "verde" || status === "amarillo" || status === "rojo";
  const tip = material?.tooltip;

  const badge = (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded font-bold leading-none",
        ambitoPill.letraBadge,
        compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]",
      )}
      aria-label={labelCalendarioAmbito(ambito)}
    >
      {CALENDARIO_AMBITO_LETRA[ambito]}
      {showPip ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-white",
            calendarioMaterialPipClass(status),
          )}
          aria-hidden
        />
      ) : null}
    </span>
  );

  if (!showPip || !tip) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex shrink-0"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          title={tip}
        >
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[16rem] text-[11px] leading-snug">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

function DiaCelda({
  dayYmd,
  dayNum,
  lineas,
  notas,
  onEditDay,
  onOpenOt,
  onToggleMarcadoHecho,
  itinerarioByOt,
  espejoByOt,
  materialByOt,
  duplicatedOtSet,
  ambitoActivo,
  canEditActivo,
  variant = "mes",
  moverFromFecha,
  moverSelectedIds,
  moverBusy,
  onStartMover,
  onToggleMoverOt,
  onPickDestino,
}: {
  dayYmd: string;
  dayNum: number;
  lineas: CalendarioProduccionLinea[];
  notas: ProdCalendarioProduccionNotaRow[];
  onEditDay: (ymd: string) => void;
  onOpenOt: (otNumero: string) => void;
  onToggleMarcadoHecho: (linea: CalendarioProduccionLinea) => void;
  itinerarioByOt: Map<string, CalendarioItinerarioOt>;
  espejoByOt: Map<string, CalendarioEspejoOt>;
  materialByOt: Map<string, CalendarioMaterialInfo>;
  duplicatedOtSet: Set<string>;
  ambitoActivo: CalendarioAmbito;
  canEditActivo: boolean;
  /** Semana: tipografía mayor y más altura de celda. */
  variant?: "mes" | "semana";
  moverFromFecha: string | null;
  moverSelectedIds: readonly string[];
  moverBusy: boolean;
  onStartMover: (ymd: string) => void;
  onToggleMoverOt: (id: string) => void;
  onPickDestino: (ymd: string) => void;
}) {
  const isSemana = variant === "semana";
  const hasContenido = lineas.length > 0 || notas.length > 0;
  const moverActivo = moverFromFecha != null;
  const isMoverOrigen = moverFromFecha === dayYmd;
  const isMoverDestino = moverActivo && !isMoverOrigen;
  const editableCount = lineas.filter((l) => l.ambito === ambitoActivo).length;
  const showMoverBtn =
    canEditActivo && (editableCount > 0 || isMoverDestino);
  const selectedSet = isMoverOrigen ? new Set(moverSelectedIds) : null;

  const handleDayNumberClick = () => {
    if (moverBusy) return;
    if (isMoverDestino) {
      onPickDestino(dayYmd);
      return;
    }
    if (isMoverOrigen) return;
    onEditDay(dayYmd);
  };

  const handleEmptyOrPlusClick = () => {
    if (moverBusy) return;
    if (isMoverDestino) {
      onPickDestino(dayYmd);
      return;
    }
    if (isMoverOrigen) return;
    onEditDay(dayYmd);
  };

  return (
    <div
      className={cn(
        isSemana
          ? "group relative flex min-h-[min(70vh,42rem)] flex-col border border-slate-200/90 bg-white"
          : "group relative flex min-h-[11rem] flex-col border border-slate-200/90 bg-white",
        isMoverOrigen && "ring-2 ring-amber-500 ring-inset",
        isMoverDestino && "ring-1 ring-amber-200 ring-inset",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between px-2 py-1.5",
          isMoverOrigen ? "bg-amber-700" : "bg-[#002147]",
        )}
      >
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={cn(
              "rounded px-1 text-[10px] font-medium text-white/80 transition hover:bg-white/10",
              moverActivo
                ? "pointer-events-none opacity-0"
                : "opacity-0 group-hover:opacity-100",
            )}
            onClick={handleEmptyOrPlusClick}
            title="Añadir / editar OTs del día"
          >
            <Plus className="size-3.5" />
          </button>
          {showMoverBtn ? (
            <button
              type="button"
              className={cn(
                "rounded px-1 text-white/90 transition hover:bg-white/10",
                isMoverOrigen
                  ? "bg-white/20 text-white"
                  : "opacity-80 group-hover:opacity-100",
              )}
              disabled={moverBusy}
              aria-pressed={isMoverOrigen}
              title={
                isMoverOrigen
                  ? "Cancelar mover OTs"
                  : isMoverDestino
                    ? "Mover aquí las OTs seleccionadas"
                    : "Seleccionar OTs de este día y pasarlas a otro"
              }
              onClick={(e) => {
                e.stopPropagation();
                if (moverBusy) return;
                if (isMoverDestino) {
                  onPickDestino(dayYmd);
                  return;
                }
                onStartMover(dayYmd);
              }}
            >
              <ArrowRightLeft className="size-3.5" />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className={
            isSemana
              ? "shrink-0 text-base font-bold tabular-nums text-white hover:underline"
              : "shrink-0 text-sm font-bold tabular-nums text-white hover:underline"
          }
          onClick={handleDayNumberClick}
          title={
            isMoverDestino
              ? "Mover aquí las OTs seleccionadas"
              : isMoverOrigen
                ? "Día origen — pulsa el número de otro día"
                : "Editar día"
          }
        >
          {dayNum}
        </button>
      </div>
      {!hasContenido ? (
        <button
          type="button"
          className={
            isSemana
              ? "min-h-[3rem] flex-1 p-2.5 text-left text-sm text-slate-400 hover:bg-slate-50"
              : "min-h-[2rem] flex-1 p-1.5 text-left text-[10px] text-slate-400 hover:bg-slate-50"
          }
          onClick={handleEmptyOrPlusClick}
        >
          {isMoverDestino
            ? "Mover aquí"
            : canEditActivo
              ? "+ OT"
              : "Ver día"}
        </button>
      ) : (
        <div
          className={
            isSemana
              ? "min-h-0 flex-1 space-y-2 overflow-y-auto p-2"
              : "min-h-0 flex-1 space-y-1.5 overflow-y-auto p-1.5"
          }
        >
          {lineas.map((l) => {
            const info = itinerarioByOt.get(l.otNumero);
            const semaforo = semaforoForAmbito(info?.pasos ?? [], l.ambito);
            const styles = SEMAFORO_PILL_STYLES[semaforo];
            const hechoVisual =
              l.hechoVisual ??
              (l.marcadoHecho || semaforo === "hecho");
            const isDuplicada = duplicatedOtSet.has(`${l.ambito}:${l.otNumero}`);
            const isForeign = l.ambito !== ambitoActivo;
            const canToggle = canEditActivo && !isForeign;
            const canSelectMover = isMoverOrigen && canToggle;
            const isSelectedMover = Boolean(selectedSet?.has(l.id));
            const pasoLabel = labelPasoDisponible(info?.pasos ?? []);
            const espejo = derivePastillaEspejo({
              ambito: l.ambito,
              fechaCalendario: dayYmd,
              itinerario: info,
              espejo: espejoByOt.get(l.otNumero),
            });
            const material = materialByOt.get(l.otNumero);
            const ambitoPill = CALENDARIO_AMBITO_PILL[l.ambito];
            const guilloStatus =
              l.ambito === "impresion" || l.ambito === "digital"
                ? guillotinaStatusFromPasos(info?.pasos ?? [])
                : "sin_paso";
            const guilloTip = guillotinaTooltipLine(guilloStatus);
            return (
              <div
                key={l.id}
                title={`${l.label} — ${labelCalendarioAmbito(l.ambito)}: ${styles.title}${
                  isForeign ? " · solo lectura" : ""
                }${
                  hechoVisual
                    ? l.marcadoHecho && semaforo !== "hecho"
                      ? " · Hecho (marca manual)"
                      : semaforo === "hecho"
                        ? " · Hecho (paso finalizado)"
                        : " · Hecho"
                    : ""
                }${espejo.title ? ` · ${espejo.title}` : ""}${
                  pasoLabel ? ` · Paso: ${pasoLabel}` : ""
                }${guilloTip ? ` · ${guilloTip}` : ""}${
                  material?.tooltip ? ` · ${material.tooltip}` : ""
                }`}
                className={cn(
                  "flex w-full items-center gap-1 rounded-md border border-slate-200/90 bg-white text-left shadow-xs",
                  "border-l-[3px] transition-colors",
                  hechoVisual ? "border-l-slate-400" : styles.border,
                  !hechoVisual && ambitoPill.borderTint,
                  isForeign && "opacity-75",
                  hechoVisual && "bg-slate-50/90 opacity-60",
                  espejo.fechaDifiere && !hechoVisual && "ring-1 ring-amber-400/70",
                  isSelectedMover && "bg-amber-50 ring-2 ring-amber-500",
                  isSemana ? "px-1.5 py-1.5" : "px-1 py-1",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left",
                    "hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#002147]/40",
                  )}
                  aria-pressed={canSelectMover ? isSelectedMover : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (canSelectMover) {
                      onToggleMoverOt(l.id);
                      return;
                    }
                    if (moverActivo) return;
                    onOpenOt(l.otNumero);
                  }}
                >
                  {canSelectMover ? (
                    <span
                      className={cn(
                        "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                        isSelectedMover
                          ? "border-amber-700 bg-amber-600 text-white"
                          : "border-slate-400 bg-white text-transparent",
                      )}
                      aria-hidden
                    >
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        hechoVisual ? "bg-slate-400" : styles.dot,
                      )}
                      aria-hidden
                    />
                  )}
                  <AmbitoBadgeWithMaterial
                    ambito={l.ambito}
                    material={material}
                    compact={!isSemana}
                  />
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 font-mono font-bold tabular-nums",
                      isDuplicada
                        ? "bg-pink-100 text-pink-900"
                        : hechoVisual
                          ? "bg-slate-200 text-slate-600"
                          : styles.otBadge,
                      isSemana ? "text-[13px]" : "text-[12px]",
                      hechoVisual && "line-through decoration-slate-400",
                    )}
                  >
                    {l.otNumero}
                  </span>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate font-medium text-[#002147]",
                      isSemana
                        ? "text-[13px] leading-snug"
                        : "text-[11px] leading-tight",
                      hechoVisual && "text-slate-500",
                    )}
                  >
                    {l.trabajo?.trim() || "—"}
                    {pasoLabel ? (
                      <span className="ml-1 font-normal text-slate-500">
                        · {pasoLabel}
                      </span>
                    ) : null}
                  </span>
                  {hechoVisual ? (
                    <span className="shrink-0 rounded bg-slate-200 px-1 py-0.5 text-[9px] font-semibold leading-none text-slate-600">
                      Hecha
                    </span>
                  ) : espejo.badge ? (
                    <span
                      className={cn(
                        "shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold leading-none",
                        ESPEJO_FASE_STYLES[espejo.fase].chip,
                        espejo.fechaDifiere &&
                          "bg-amber-100 text-amber-950 ring-1 ring-amber-400",
                      )}
                    >
                      {espejo.badge}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  disabled={!canToggle || moverActivo}
                  title={
                    moverActivo
                      ? "Termina de mover OTs para marcar hecho"
                      : canToggle
                      ? l.marcadoHecho
                        ? "Quitar marca hecho (manual)"
                        : semaforo === "hecho"
                          ? "Ya cerrada en HR — marca manual opcional"
                          : "Marcar hecho (manual)"
                      : "Solo lectura en este ámbito"
                  }
                  aria-label={
                    l.marcadoHecho ? "Quitar marca hecho" : "Marcar hecho"
                  }
                  aria-pressed={l.marcadoHecho}
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                    l.marcadoHecho
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white text-transparent hover:border-emerald-500 hover:text-emerald-500",
                    !canToggle || moverActivo
                      ? "cursor-not-allowed opacity-40"
                      : null,
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!canToggle || moverActivo) return;
                    onToggleMarcadoHecho(l);
                  }}
                >
                  <Check className="size-3" strokeWidth={3} />
                </button>
              </div>
            );
          })}
          {notas.map((n) => (
            <div
              key={n.id}
              title={n.texto}
              className={cn(
                "rounded-md border border-amber-200/80 bg-amber-50 px-2 py-1 text-slate-700",
                isSemana ? "text-[12px] leading-snug" : "text-[10px] leading-tight",
              )}
            >
              📝 {n.texto}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DiaCeldaMemo = memo(DiaCelda);

export function CalendarioProduccionPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [monthIndex, setMonthIndex] = useState(now.getMonth());
  const [weekMonday, setWeekMonday] = useState(() => mondayOfWeek(now));
  const [vista, setVista] = useState<VistaCalendario>("mes");
  const [showSaturday, setShowSaturday] = useState(false);
  const [mostrarPruebas, setMostrarPruebas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<ProdCalendarioProduccionOtRow[]>([]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [notasRows, setNotasRows] = useState<ProdCalendarioProduccionNotaRow[]>([]);
  const [tituloByOt, setTituloByOt] = useState<Map<string, string | null>>(
    () => new Map(),
  );
  const [filtro, setFiltro] = useState("");
  const deferredFiltro = useDeferredValue(filtro);
  const handleFiltroDebounced = useCallback((q: string) => {
    setFiltro(q);
  }, []);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [atrasadasModalOpen, setAtrasadasModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [portapapeles, setPortapapeles] = useState<PortapapelesOt | null>(null);
  const [moverFromFecha, setMoverFromFecha] = useState<string | null>(null);
  const [moverSelectedIds, setMoverSelectedIds] = useState<string[]>([]);
  const moverInFlightRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [ambitoActivo, setAmbitoActivo] = useState<CalendarioAmbito>("impresion");
  const [ambitoVisibility, setAmbitoVisibility] =
    useState<CalendarioAmbitoVisibility>(() => allCalendarioAmbitoVisibilityOn());
  const ambitoInitDone = useRef(false);

  const [dayOpen, setDayOpen] = useState(false);
  const [dayYmd, setDayYmd] = useState<string | null>(null);
  const [detalleDiaOpen, setDetalleDiaOpen] = useState(false);

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalle, setDetalle] = useState<CalendarioProduccionOtDetalle | null>(
    null,
  );
  const [itinerarioByOt, setItinerarioByOt] = useState<
    Map<string, CalendarioItinerarioOt>
  >(() => new Map());
  const [espejoByOt, setEspejoByOt] = useState<Map<string, CalendarioEspejoOt>>(
    () => new Map(),
  );
  const [materialByOt, setMaterialByOt] = useState<
    Map<string, CalendarioMaterialInfo>
  >(() => new Map());
  const [hojaRutaOt, setHojaRutaOt] = useState<string | null>(null);
  const [hojaRutaOpen, setHojaRutaOpen] = useState(false);
  const [cafeOpen, setCafeOpen] = useState(false);
  const [cafePending, setCafePending] = useState<{
    hit: OtSearchHit;
    otherYmd: string;
  } | null>(null);
  const [bandejaOpen, setBandejaOpen] = useState(true);
  const [bandejaRefreshKey, setBandejaRefreshKey] = useState(0);
  const [bandejaMatchHeight, setBandejaMatchHeight] = useState<number | null>(
    null,
  );
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const openDetalleRef = useRef<(otNumero: string) => Promise<void>>(async () => {});

  const canEditActivo = canEditCalendarioAmbito(userRole, ambitoActivo);

  useEffect(() => {
    try {
      setShowSaturday(localStorage.getItem(STORAGE_SHOW_SATURDAY) === "1");
      setMostrarPruebas(localStorage.getItem(STORAGE_MOSTRAR_PRUEBAS) === "1");
      const v = localStorage.getItem(STORAGE_VISTA);
      if (v === "semana" || v === "mes") setVista(v);
      const vis = parseCalendarioAmbitoVisibility(
        localStorage.getItem(STORAGE_AMBITO_VIS),
      );
      if (vis) setAmbitoVisibility(vis);
      const bandejaStored = localStorage.getItem(STORAGE_BANDEJA);
      if (bandejaStored === "0") setBandejaOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleBandeja = useCallback(() => {
    setBandejaOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_BANDEJA, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const uid =
        typeof user?.id === "string" && user.id.trim() ? user.id.trim() : null;
      let role: string | null = null;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        role =
          prof && typeof (prof as { role?: unknown }).role === "string"
            ? String((prof as { role: string }).role).trim() || null
            : null;
      }
      if (!mounted) return;
      setUserRole(role);
      if (!ambitoInitDone.current) {
        const fromUrl = parseCalendarioAmbito(searchParams.get("ambito"));
        const next = fromUrl ?? defaultCalendarioAmbitoFromRole(role);
        setAmbitoActivo(next);
        ambitoInitDone.current = true;
      }
    })().catch(() => {
      if (mounted) setUserRole(null);
    });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar / supabase
  }, [supabase]);

  useEffect(() => {
    if (!ambitoInitDone.current) return;
    const next = new URLSearchParams(searchParams.toString());
    if (ambitoActivo === "impresion") next.delete("ambito");
    else next.set("ambito", ambitoActivo);
    const qs = next.toString();
    const cur = searchParams.toString();
    if (qs === cur) return;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [ambitoActivo, pathname, router, searchParams]);

  const semanasMes = useMemo(
    () => buildSemanasLaboralesMes(year, monthIndex, { includeSaturday: showSaturday }),
    [year, monthIndex, showSaturday],
  );
  const semanaActual = useMemo(
    () => buildSemanaLaboral(weekMonday, { includeSaturday: showSaturday }),
    [weekMonday, showSaturday],
  );
  const cols = numColumnasCalendario(showSaturday);
  const range = useMemo(() => {
    if (vista === "semana") {
      return weekRangeYmd(weekMonday, showSaturday);
    }
    return monthRangeYmd(year, monthIndex);
  }, [vista, weekMonday, showSaturday, year, monthIndex]);

  const rowsVisibles = useMemo(() => {
    return rows.filter((r) => {
      const a = isCalendarioAmbito(r.ambito) ? r.ambito : "impresion";
      if (!ambitoVisibility[a]) return false;
      if (!mostrarPruebas && isOtNumeroPrueba(r.ot_numero)) return false;
      return true;
    });
  }, [rows, ambitoVisibility, mostrarPruebas]);

  const otsPruebaOcultas = useMemo(() => {
    if (mostrarPruebas) return 0;
    return rows.filter((r) => {
      const a = isCalendarioAmbito(r.ambito) ? r.ambito : "impresion";
      return ambitoVisibility[a] && isOtNumeroPrueba(r.ot_numero);
    }).length;
  }, [rows, ambitoVisibility, mostrarPruebas]);

  const visibilidadLabel = useMemo(() => {
    const letras = CALENDARIO_AMBITOS.filter((a) => ambitoVisibility[a]).map(
      (a) => CALENDARIO_AMBITO_LETRA[a],
    );
    return letras.length === CALENDARIO_AMBITOS.length
      ? "todos los ámbitos"
      : letras.length === 0
        ? "ningún ámbito"
        : `ámbitos ${letras.join("+")}`;
  }, [ambitoVisibility]);

  const entradasByDay = useMemo(() => {
    const all = entradasPorDia(rowsVisibles, tituloByOt);
    const byTexto = filtrarEntradasPorTexto(all, deferredFiltro);
    const enriched = enrichEntradasHechoVisual(byTexto, (ot, ambito) =>
      semaforoForAmbito(itinerarioByOt.get(ot)?.pasos ?? [], ambito),
    );
    return filtrarEntradasSoloPendientes(enriched, soloPendientes);
  }, [
    rowsVisibles,
    tituloByOt,
    deferredFiltro,
    soloPendientes,
    itinerarioByOt,
  ]);

  const hoyYmdLocal = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }, []);

  const atrasadas = useMemo(
    () => collectEntradasAtrasadas(entradasByDay, hoyYmdLocal),
    [entradasByDay, hoyYmdLocal],
  );

  const notasByDay = useMemo(() => {
    const map = new Map<string, ProdCalendarioProduccionNotaRow[]>();
    for (const n of notasRows) {
      const key = String(n.fecha ?? "").slice(0, 10);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(n);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.orden - b.orden);
    }
    return map;
  }, [notasRows]);

  /** Duplicada = misma OT en 2+ días dentro del mismo ámbito (rango cargado). */
  const duplicatedOtSet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rowsVisibles) {
      const ot = String(r.ot_numero ?? "").trim();
      if (!ot) continue;
      const a = isCalendarioAmbito(r.ambito) ? r.ambito : "impresion";
      const key = `${a}:${ot}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k),
    );
  }, [rowsVisibles]);

  const dayLineas = useMemo(() => {
    if (!dayYmd) return [];
    return entradasByDay.get(dayYmd) ?? [];
  }, [dayYmd, entradasByDay]);

  const dayLineasEditables = useMemo(
    () => dayLineas.filter((l) => l.ambito === ambitoActivo),
    [dayLineas, ambitoActivo],
  );

  /** Todas las pastillas del día/ámbito (sin filtro «Solo pendientes») para el detalle. */
  const dayLineasParaDetalle = useMemo(() => {
    if (!dayYmd) return [];
    const dayRows = rowsVisibles.filter(
      (r) =>
        r.fecha.slice(0, 10) === dayYmd && r.ambito === ambitoActivo,
    );
    return entradasPorDia(dayRows, tituloByOt).get(dayYmd) ?? [];
  }, [dayYmd, rowsVisibles, ambitoActivo, tituloByOt]);

  const dayNotas = useMemo(() => {
    if (!dayYmd) return [];
    return notasByDay.get(dayYmd) ?? [];
  }, [dayYmd, notasByDay]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data, error }, { data: notasData, error: notasErr }] =
        await Promise.all([
          supabase
            .from(TABLE)
            .select(
              "id, fecha, ot_numero, ambito, orden, notas, marcado_hecho, marcado_hecho_at, marcado_hecho_por, created_by, created_at, updated_at",
            )
            .gte("fecha", range.start)
            .lte("fecha", range.end)
            .order("fecha", { ascending: true })
            .order("orden", { ascending: true }),
          supabase
            .from(TABLE_NOTAS)
            .select("id, fecha, texto, orden, created_by, created_at, updated_at")
            .gte("fecha", range.start)
            .lte("fecha", range.end)
            .order("fecha", { ascending: true })
            .order("orden", { ascending: true }),
        ]);

      if (error) {
        if (isMissingTable(error.message)) {
          toast.error(MIGRATION_HINT);
          setRows([]);
          return;
        }
        throw error;
      }
      if (notasErr) {
        if (isMissingNotasTable(notasErr.message)) {
          toast.error(MIGRATION_HINT_NOTAS);
          setNotasRows([]);
        } else {
          throw notasErr;
        }
      }

      const list = ((data ?? []) as ProdCalendarioProduccionOtRow[]).map((r) => ({
        ...r,
        ambito: isCalendarioAmbito(r.ambito) ? r.ambito : ("impresion" as const),
        marcado_hecho: Boolean(r.marcado_hecho),
        marcado_hecho_at: r.marcado_hecho_at ?? null,
        marcado_hecho_por: r.marcado_hecho_por ?? null,
      }));
      setRows(list);
      setNotasRows((notasData ?? []) as ProdCalendarioProduccionNotaRow[]);

      const ots = [
        ...new Set(list.map((r) => String(r.ot_numero ?? "").trim()).filter(Boolean)),
      ];
      if (ots.length === 0) {
        setTituloByOt(new Map());
        setItinerarioByOt(new Map());
        setEspejoByOt(new Map());
        setMaterialByOt(new Map());
        return;
      }

      const maestroRows = await fetchAllInChunks(ots, 100, async (chunk) => {
        const { data, error } = await supabase
          .from(TABLE_MAESTRO)
          .select("num_pedido, titulo")
          .in("num_pedido", chunk);
        if (error) throw error;
        return (data ?? []) as Array<{
          num_pedido?: string;
          titulo?: string | null;
        }>;
      });

      const map = new Map<string, string | null>();
      for (const m of maestroRows) {
        const n = String(m.num_pedido ?? "").trim();
        if (n) map.set(n, m.titulo ?? null);
      }
      setTituloByOt(map);

      try {
        const [itinerario, espejo] = await Promise.all([
          fetchItinerarioCalendarioByOtNumeros(supabase, ots),
          fetchCalendarioEspejoByOtNumeros(supabase, ots),
        ]);
        setItinerarioByOt(itinerario);
        setEspejoByOt(espejo);
      } catch (progErr) {
        console.warn("[calendario] itinerario / espejo mesa", progErr);
        setItinerarioByOt(new Map());
        setEspejoByOt(new Map());
      }

      try {
        const material = await fetchCalendarioMaterialByOtNumeros(supabase, ots);
        setMaterialByOt(material);
      } catch (matErr) {
        console.warn("[calendario] material status", matErr);
        setMaterialByOt(new Map());
      }
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo cargar el calendario."));
      setRows([]);
      setNotasRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, range.start, range.end]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Desktop: bandeja = misma altura que el grid (crece/encoge a la par). */
  useEffect(() => {
    if (!bandejaOpen || loading) {
      setBandejaMatchHeight(null);
      return;
    }
    const grid = calendarGridRef.current;
    if (!grid) return;

    const sync = () => {
      if (typeof window === "undefined") return;
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setBandejaMatchHeight(null);
        return;
      }
      const h = Math.round(grid.getBoundingClientRect().height);
      setBandejaMatchHeight(h > 0 ? Math.max(h, 240) : null);
    };

    const ro = new ResizeObserver(() => sync());
    ro.observe(grid);
    window.addEventListener("resize", sync);
    const t = window.setTimeout(sync, 0);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [bandejaOpen, loading]);

  const setVistaPersist = (v: VistaCalendario) => {
    setVista(v);
    try {
      localStorage.setItem(STORAGE_VISTA, v);
    } catch {
      /* ignore */
    }
    if (v === "semana") {
      setWeekMonday(mondayOfWeek(new Date(year, monthIndex, 15)));
    } else {
      setYear(weekMonday.getFullYear());
      setMonthIndex(weekMonday.getMonth());
    }
  };

  const shiftPeriod = (delta: number) => {
    if (vista === "semana") {
      const d = new Date(weekMonday);
      d.setDate(d.getDate() + delta * 7);
      setWeekMonday(mondayOfWeek(d));
      setYear(d.getFullYear());
      setMonthIndex(d.getMonth());
      return;
    }
    const d = new Date(year, monthIndex + delta, 1);
    setYear(d.getFullYear());
    setMonthIndex(d.getMonth());
  };

  const goHoy = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonthIndex(t.getMonth());
    setWeekMonday(mondayOfWeek(t));
  };

  const importExcel = async (file: File) => {
    if (!canEditActivo) {
      toast.error(
        `No puedes importar en ámbito ${labelCalendarioAmbito(ambitoActivo)}.`,
      );
      return;
    }
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseProgramacioPlanificadorExcel(buffer);
      if (parsed.length === 0) {
        toast.message(
          "No se encontraron OTs en la pestaña «planificador».",
        );
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const chunkSize = 80;
      for (let i = 0; i < parsed.length; i += chunkSize) {
        const chunk = parsed.slice(i, i + chunkSize).map((r) => ({
          fecha: r.fecha,
          ot_numero: r.ot_numero,
          ambito: ambitoActivo,
          orden: r.orden,
          created_by: user?.id ?? null,
        }));
        const { error } = await supabase.from(TABLE).upsert(chunk, {
          onConflict: "fecha,ot_numero,ambito",
        });
        if (error) throw error;
      }

      const first = parsed[0]!;
      const [y, m] = first.fecha.split("-").map(Number);
      const anchor = new Date(y!, (m ?? 1) - 1, Number(first.fecha.slice(8, 10)), 12);
      setYear(anchor.getFullYear());
      setMonthIndex(anchor.getMonth());
      setWeekMonday(mondayOfWeek(anchor));
      setVista("semana");
      try {
        localStorage.setItem(STORAGE_VISTA, "semana");
      } catch {
        /* ignore */
      }

      toast.success(
        `${parsed.length} OTs importadas en ${labelCalendarioAmbito(ambitoActivo)}.`,
      );
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo importar el Excel."));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openDay = useCallback((ymd: string) => {
    setDayYmd(ymd);
    setDayOpen(true);
  }, []);

  const insertOtToDay = useCallback(
    async (hit: OtSearchHit) => {
      if (!dayYmd) return;
      if (!canEditCalendarioAmbito(userRole, ambitoActivo)) {
        toast.error(
          `No puedes añadir OTs en ${labelCalendarioAmbito(ambitoActivo)}.`,
        );
        return;
      }
      const ot = String(hit.num_pedido ?? "").trim();
      if (!ot) return;
      setSaving(true);
      try {
        const existing = rowsRef.current.filter(
          (r) =>
            r.fecha.slice(0, 10) === dayYmd &&
            (isCalendarioAmbito(r.ambito) ? r.ambito : "impresion") ===
              ambitoActivo,
        );
        const nextOrden =
          existing.length === 0
            ? 0
            : Math.max(...existing.map((r) => r.orden)) + 1;

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { error } = await supabase.from(TABLE).insert({
          fecha: dayYmd,
          ot_numero: ot,
          ambito: ambitoActivo,
          orden: nextOrden,
          created_by: user?.id ?? null,
        });
        if (error) {
          if (error.code === "23505") {
            toast.message(
              `La OT ${ot} ya está en este día (${labelCalendarioAmbito(ambitoActivo)}).`,
            );
            return;
          }
          throw error;
        }

        setTituloByOt((prev) => {
          const next = new Map(prev);
          next.set(ot, hit.titulo ?? null);
          return next;
        });
        toast.success(`OT ${ot} añadida (${labelCalendarioAmbito(ambitoActivo)}).`);
        if (isOtNumeroPrueba(ot) && !mostrarPruebas) {
          toast.message(
            `OT ${ot} es de prueba (≥98000). Activa «Mostrar OTs prueba» si no la ves.`,
          );
        }
        await load();
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, "No se pudo añadir la OT."));
      } finally {
        setSaving(false);
      }
    },
    [ambitoActivo, dayYmd, load, mostrarPruebas, supabase, userRole],
  );

  const addOtToDay = async (hit: OtSearchHit) => {
    if (!dayYmd) return;
    if (!canEditActivo) {
      toast.error(
        `No puedes añadir OTs en ${labelCalendarioAmbito(ambitoActivo)}.`,
      );
      return;
    }
    const ot = String(hit.num_pedido ?? "").trim();
    if (!ot) return;

    if (
      rowsRef.current.some(
        (r) =>
          r.fecha.slice(0, 10) === dayYmd &&
          String(r.ot_numero ?? "").trim() === ot &&
          (isCalendarioAmbito(r.ambito) ? r.ambito : "impresion") ===
            ambitoActivo,
      )
    ) {
      toast.message(
        `La OT ${ot} ya está en este día (${labelCalendarioAmbito(ambitoActivo)}).`,
      );
      return;
    }

    const otherRow = rowsRef.current.find(
      (r) =>
        String(r.ot_numero ?? "").trim() === ot &&
        r.fecha.slice(0, 10) !== dayYmd &&
        (isCalendarioAmbito(r.ambito) ? r.ambito : "impresion") === ambitoActivo,
    );

    if (otherRow) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email?.trim().toLowerCase() ?? "";
      const otherYmd = otherRow.fecha.slice(0, 10);

      if (email === CALENDARIO_CAFE_EASTER_EGG_EMAIL) {
        setCafePending({ hit, otherYmd });
        setCafeOpen(true);
        return;
      }

      toast.message(
        `La OT ${ot} ya está planificada el ${fechaDiaLabel(otherYmd)} (${labelCalendarioAmbito(ambitoActivo)}).`,
      );
    }

    await insertOtToDay(hit);
  };

  /** Bandeja §5 — colocar OT despachada en calendario (sin drag). */
  const colocarOtEnCalendario = useCallback(
    async (otNumero: string, fechaYmd: string): Promise<boolean> => {
      const ot = String(otNumero ?? "").trim();
      const ymd = String(fechaYmd ?? "").slice(0, 10);
      if (!ot || !ymd) return false;
      if (!canEditCalendarioAmbito(userRole, ambitoActivo)) {
        toast.error(
          `No puedes colocar OTs en ${labelCalendarioAmbito(ambitoActivo)}.`,
        );
        return false;
      }

      const yaEnDia = rowsRef.current.some(
        (r) =>
          r.fecha.slice(0, 10) === ymd &&
          String(r.ot_numero ?? "").trim() === ot &&
          (isCalendarioAmbito(r.ambito) ? r.ambito : "impresion") === ambitoActivo,
      );
      if (yaEnDia) {
        toast.message(
          `La OT ${ot} ya está en ${fechaDiaLabel(ymd)} (${labelCalendarioAmbito(ambitoActivo)}).`,
        );
        return false;
      }

      const otraFecha = rowsRef.current.find(
        (r) =>
          String(r.ot_numero ?? "").trim() === ot &&
          r.fecha.slice(0, 10) !== ymd &&
          (isCalendarioAmbito(r.ambito) ? r.ambito : "impresion") === ambitoActivo,
      );
      if (otraFecha) {
        toast.message(
          `La OT ${ot} ya está planificada el ${fechaDiaLabel(otraFecha.fecha.slice(0, 10))}. Muévela desde el calendario si quieres cambiarla.`,
        );
        return false;
      }

      setSaving(true);
      try {
        const existing = rowsRef.current.filter(
          (r) =>
            r.fecha.slice(0, 10) === ymd &&
            (isCalendarioAmbito(r.ambito) ? r.ambito : "impresion") === ambitoActivo,
        );
        const nextOrden =
          existing.length === 0
            ? 0
            : Math.max(...existing.map((r) => r.orden)) + 1;

        const {
          data: { user },
        } = await supabase.auth.getUser();

        const { error } = await supabase.from(TABLE).insert({
          fecha: ymd,
          ot_numero: ot,
          ambito: ambitoActivo,
          orden: nextOrden,
          created_by: user?.id ?? null,
        });
        if (error) {
          if (error.code === "23505") {
            toast.message(`La OT ${ot} ya está en el calendario (${labelCalendarioAmbito(ambitoActivo)}).`);
            return false;
          }
          throw error;
        }

        const { data: maestro } = await supabase
          .from(TABLE_MAESTRO)
          .select("titulo")
          .eq("num_pedido", ot)
          .maybeSingle();
        if (maestro) {
          setTituloByOt((prev) => {
            const next = new Map(prev);
            next.set(ot, (maestro as { titulo?: string | null }).titulo ?? null);
            return next;
          });
        }

        if (isOtNumeroPrueba(ot) && !mostrarPruebas) {
          toast.message(
            `OT ${ot} es de prueba (≥98000). Activa «Mostrar OTs prueba» si no la ves en el grid.`,
          );
        }

        await load();
        setBandejaRefreshKey((k) => k + 1);
        return true;
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, "No se pudo colocar la OT."));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [ambitoActivo, load, mostrarPruebas, supabase, userRole],
  );

  const addNotaToDay = async (texto: string) => {
    if (!dayYmd) return;
    const t = texto.trim();
    if (!t) return;
    setSaving(true);
    try {
      const existing = notasRows.filter((n) => n.fecha.slice(0, 10) === dayYmd);
      const nextOrden =
        existing.length === 0 ? 0 : Math.max(...existing.map((n) => n.orden)) + 1;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase.from(TABLE_NOTAS).insert({
        fecha: dayYmd,
        texto: t,
        orden: nextOrden,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Nota añadida al día.");
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo añadir la nota."));
    } finally {
      setSaving(false);
    }
  };

  const removeNota = async (id: string) => {
    setSaving(true);
    try {
      const { error, count } = await supabase
        .from(TABLE_NOTAS)
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) throw error;
      if (count === 0) {
        toast.error("No se pudo quitar la nota (ya no existe).");
        return;
      }
      toast.success("Nota quitada del día.");
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo quitar la nota."));
    } finally {
      setSaving(false);
    }
  };

  /** Subir/bajar nota dentro del mismo día (campo `orden`). */
  const moverNotaEnDia = async (id: string, direction: -1 | 1) => {
    if (!dayYmd) return;
    const list = dayNotas;
    const idx = list.findIndex((n) => n.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;

    const reordered = [...list];
    const a = reordered[idx]!;
    reordered[idx] = reordered[swapIdx]!;
    reordered[swapIdx] = a;

    const ordenById = new Map(reordered.map((n, i) => [n.id, i] as const));
    setNotasRows((prev) =>
      prev.map((r) => {
        const nextOrden = ordenById.get(r.id);
        return nextOrden === undefined ? r : { ...r, orden: nextOrden };
      }),
    );

    setSaving(true);
    try {
      const results = await Promise.all(
        reordered.map((n, i) =>
          supabase.from(TABLE_NOTAS).update({ orden: i }).eq("id", n.id),
        ),
      );
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo reordenar la nota."));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const removeEntrada = async (id: string) => {
    const row = rows.find((r) => r.id === id);
    const ambitoRow = row
      ? isCalendarioAmbito(row.ambito)
        ? row.ambito
        : "impresion"
      : null;
    if (ambitoRow && !canEditCalendarioAmbito(userRole, ambitoRow)) {
      toast.error("No puedes quitar pastillas de otro ámbito.");
      return;
    }
    setSaving(true);
    try {
      const { error, count } = await supabase
        .from(TABLE)
        .delete({ count: "exact" })
        .eq("id", id);
      if (error) throw error;
      if (count === 0) {
        toast.error(
          "No se pudo quitar (permiso o ya no existe). Recarga e inténtalo.",
        );
        return;
      }
      if (portapapeles?.id === id) setPortapapeles(null);
      toast.success("OT quitada del planificador.");
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo quitar la OT."));
    } finally {
      setSaving(false);
    }
  };

  const cortarEntrada = (linea: CalendarioProduccionLinea) => {
    if (!dayYmd) return;
    if (!canEditCalendarioAmbito(userRole, linea.ambito)) {
      toast.error("No puedes cortar pastillas de otro ámbito.");
      return;
    }
    setPortapapeles({
      id: linea.id,
      otNumero: linea.otNumero,
      ambito: linea.ambito,
      fromFecha: dayYmd,
      label: linea.label,
    });
    setMoverFromFecha(null);
    setMoverSelectedIds([]);
    toast.message(`OT ${linea.otNumero} cortada. Abre otro día y pega.`);
  };

  /** Subir/bajar OT dentro del mismo día (solo ámbito activo editable). */
  const moverEntradaEnDia = async (id: string, direction: -1 | 1) => {
    if (!dayYmd || !canEditActivo) return;
    const list = dayLineasEditables;
    const idx = list.findIndex((l) => l.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;

    const reordered = [...list];
    const a = reordered[idx]!;
    reordered[idx] = reordered[swapIdx]!;
    reordered[swapIdx] = a;

    const ordenById = new Map(reordered.map((l, i) => [l.id, i] as const));
    setRows((prev) =>
      prev.map((r) => {
        const nextOrden = ordenById.get(r.id);
        return nextOrden === undefined ? r : { ...r, orden: nextOrden };
      }),
    );

    setSaving(true);
    try {
      const results = await Promise.all(
        reordered.map((l, i) =>
          supabase.from(TABLE).update({ orden: i }).eq("id", l.id),
        ),
      );
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo reordenar."));
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleMarcadoHecho = useCallback(
    async (linea: CalendarioProduccionLinea) => {
      if (!canEditActivo || linea.ambito !== ambitoActivo) {
        toast.error("No puedes marcar pastillas de otro ámbito.");
        return;
      }
      const next = !linea.marcadoHecho;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const uid =
        typeof user?.id === "string" && user.id.trim() ? user.id.trim() : null;

      setRows((prev) =>
        prev.map((r) =>
          r.id === linea.id
            ? {
                ...r,
                marcado_hecho: next,
                marcado_hecho_at: next ? new Date().toISOString() : null,
                marcado_hecho_por: next ? uid : null,
              }
            : r,
        ),
      );

      const { error } = await supabase
        .from(TABLE)
        .update({
          marcado_hecho: next,
          marcado_hecho_at: next ? new Date().toISOString() : null,
          marcado_hecho_por: next ? uid : null,
        })
        .eq("id", linea.id);
      if (error) {
        toast.error(errorMessageFromUnknown(error, "No se pudo marcar la OT."));
        await load();
        return;
      }
      toast.success(
        next
          ? `OT ${linea.otNumero} marcada como hecha`
          : `OT ${linea.otNumero}: marca hecha quitada`,
      );
    },
    [ambitoActivo, canEditActivo, load, supabase],
  );

  const pegarEnDia = async () => {
    if (!dayYmd || !portapapeles) return;
    if (!canEditCalendarioAmbito(userRole, portapapeles.ambito)) {
      toast.error("No puedes pegar pastillas de otro ámbito.");
      return;
    }
    if (portapapeles.ambito !== ambitoActivo) {
      toast.message(
        `Cambia el ámbito a ${labelCalendarioAmbito(portapapeles.ambito)} para pegar.`,
      );
      return;
    }
    if (portapapeles.fromFecha === dayYmd) {
      toast.message("Ya está en este día.");
      setPortapapeles(null);
      return;
    }
    setSaving(true);
    try {
      const existing = rowsRef.current.filter(
        (r) =>
          r.fecha.slice(0, 10) === dayYmd &&
          (isCalendarioAmbito(r.ambito) ? r.ambito : "impresion") ===
            portapapeles.ambito,
      );
      const nextOrden =
        existing.length === 0
          ? 0
          : Math.max(...existing.map((r) => r.orden)) + 1;

      const { error } = await supabase
        .from(TABLE)
        .update({ fecha: dayYmd, orden: nextOrden })
        .eq("id", portapapeles.id);
      if (error) {
        if (error.code === "23505") {
          toast.error(
            `La OT ${portapapeles.otNumero} ya está en este día. Quítala del origen o elige otro.`,
          );
          return;
        }
        throw error;
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await appendDetalleSlotAfterCalendarMove(supabase, {
          calendarioOtId: portapapeles.id,
          otNumero: portapapeles.otNumero,
          ambito: portapapeles.ambito,
          fechaDestinoYmd: dayYmd,
          createdBy: user?.id ?? null,
        });
      } catch (detErr) {
        console.warn("[calendario] append detalle tras pegar", detErr);
      }
      toast.success(
        `OT ${portapapeles.otNumero} movida a ${fechaDiaLabel(dayYmd)}.`,
      );
      setPortapapeles(null);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo pegar la OT."));
    } finally {
      setSaving(false);
    }
  };

  const cancelarMoverLote = useCallback(() => {
    setMoverFromFecha(null);
    setMoverSelectedIds([]);
  }, []);

  const startMoverDia = useCallback(
    (ymd: string) => {
      if (!canEditActivo) return;
      setPortapapeles(null);
      setDayOpen(false);
      if (moverFromFecha === ymd) {
        cancelarMoverLote();
        toast.message("Movimiento cancelado.");
        return;
      }
      const ids = idsEditablesCalendarioDia(
        entradasByDay.get(ymd) ?? [],
        ambitoActivo,
      );
      if (ids.length === 0) {
        toast.message("No hay OTs de tu ámbito en este día.");
        return;
      }
      setMoverFromFecha(ymd);
      setMoverSelectedIds([]);
      toast.message(
        "Selecciona las OTs (o «Todas») y pulsa el número de otro día.",
      );
    },
    [
      ambitoActivo,
      canEditActivo,
      cancelarMoverLote,
      entradasByDay,
      moverFromFecha,
    ],
  );

  const toggleMoverOt = useCallback((id: string) => {
    setMoverSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const seleccionarTodasMover = useCallback(() => {
    if (!moverFromFecha) return;
    const ids = idsEditablesCalendarioDia(
      entradasByDay.get(moverFromFecha) ?? [],
      ambitoActivo,
    );
    setMoverSelectedIds((prev) =>
      prev.length === ids.length && ids.every((id) => prev.includes(id))
        ? []
        : ids,
    );
  }, [ambitoActivo, entradasByDay, moverFromFecha]);

  const moverLoteADia = useCallback(
    async (destYmd: string) => {
      if (!canEditActivo || !moverFromFecha || moverInFlightRef.current) return;
      if (destYmd === moverFromFecha) {
        toast.message("Elige otro día.");
        return;
      }
      if (moverSelectedIds.length === 0) {
        toast.message(
          "Selecciona las OTs que quieres mover (o pulsa «Todas»).",
        );
        return;
      }
      const sourceLineas = rowsRef.current
        .filter((r) => {
          if (r.fecha.slice(0, 10) !== moverFromFecha) return false;
          const a = isCalendarioAmbito(r.ambito) ? r.ambito : "impresion";
          return a === ambitoActivo;
        })
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((r) => ({
          id: r.id,
          otNumero: String(r.ot_numero ?? "").trim(),
          ambito: ambitoActivo,
          label: "",
          trabajo: null as string | null,
          orden: r.orden,
          marcadoHecho: Boolean(r.marcado_hecho),
        }));
      const destRows = rowsRef.current.filter(
        (r) =>
          r.fecha.slice(0, 10) === destYmd &&
          (isCalendarioAmbito(r.ambito) ? r.ambito : "impresion") ===
            ambitoActivo,
      );
      const destOtNumerosMismoAmbito = new Set(
        destRows.map((r) => String(r.ot_numero ?? "").trim()).filter(Boolean),
      );
      const startOrden =
        destRows.length === 0
          ? 0
          : Math.max(...destRows.map((r) => r.orden)) + 1;
      const plan = planMoverCalendarioLote({
        selectedIds: moverSelectedIds,
        fromFecha: moverFromFecha,
        destFecha: destYmd,
        ambito: ambitoActivo,
        sourceLineas,
        destOtNumerosMismoAmbito,
        startOrden,
      });
      if (plan.toMove.length === 0) {
        if (plan.skippedAlreadyThere.length > 0) {
          toast.error(
            `Ya están en ${fechaDiaLabel(destYmd)}: ${plan.skippedAlreadyThere.join(", ")}`,
          );
        } else {
          toast.message("Nada que mover.");
        }
        return;
      }
      moverInFlightRef.current = true;
      setSaving(true);
      try {
        const results = await Promise.all(
          plan.toMove.map((m) =>
            supabase
              .from(TABLE)
              .update({ fecha: destYmd, orden: m.orden })
              .eq("id", m.id),
          ),
        );
        const dup = results.find((r) => r.error?.code === "23505");
        if (dup?.error) {
          toast.error(
            "Alguna OT ya está en ese día. Recarga e inténtalo.",
          );
          await load();
          return;
        }
        const err = results.find((r) => r.error)?.error;
        if (err) throw err;

        const {
          data: { user },
        } = await supabase.auth.getUser();
        await Promise.all(
          plan.toMove.map((m) =>
            appendDetalleSlotAfterCalendarMove(supabase, {
              calendarioOtId: m.id,
              otNumero: m.otNumero,
              ambito: ambitoActivo,
              fechaDestinoYmd: destYmd,
              createdBy: user?.id ?? null,
            }).catch((detErr) => {
              console.warn("[calendario] append detalle tras mover lote", detErr);
            }),
          ),
        );

        const n = plan.toMove.length;
        toast.success(
          n === 1
            ? `OT ${plan.toMove[0]!.otNumero} movida a ${fechaDiaLabel(destYmd)}.`
            : `${n} OTs movidas a ${fechaDiaLabel(destYmd)}.`,
        );
        if (plan.skippedAlreadyThere.length > 0) {
          toast.message(
            `No movidas (ya estaban): ${plan.skippedAlreadyThere.join(", ")}`,
          );
        }
        cancelarMoverLote();
        await load();
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, "No se pudo mover las OTs."));
      } finally {
        moverInFlightRef.current = false;
        setSaving(false);
      }
    },
    [
      ambitoActivo,
      canEditActivo,
      cancelarMoverLote,
      load,
      moverFromFecha,
      moverSelectedIds,
      supabase,
    ],
  );

  useEffect(() => {
    cancelarMoverLote();
  }, [ambitoActivo, year, monthIndex, vista, weekMonday, cancelarMoverLote]);

  const openDetalle = async (otNumero: string) => {
    setDetalleOpen(true);
    setDetalle(null);
    setDetalleLoading(true);
    try {
      const ot = otNumero.trim();
      const [
        { data: maestro, error: mErr },
        { data: despacho, error: dErr },
        pasos,
      ] = await Promise.all([
        supabase
          .from(TABLE_MAESTRO)
          .select(
            "num_pedido, cliente, titulo, cantidad, fecha_entrega, despachado, estado_desc",
          )
          .eq("num_pedido", ot)
          .maybeSingle(),
        supabase
          .from(TABLE_DESPACHADAS)
          .select(
            "material, gramaje, tamano_hoja, tintas, acabado_pral, troquel, poses, num_hojas_brutas, num_hojas_netas",
          )
          .eq("ot_numero", ot)
          .maybeSingle(),
        fetchPasosResumenOt(supabase, ot).catch(() => []),
      ]);
      if (mErr) throw mErr;
      if (dErr) throw dErr;

      const m = maestro as {
        cliente?: string | null;
        titulo?: string | null;
        cantidad?: number | null;
        fecha_entrega?: string | null;
        despachado?: boolean | null;
        estado_desc?: string | null;
      } | null;
      const d = despacho as {
        material?: string | null;
        gramaje?: number | null;
        tamano_hoja?: string | null;
        tintas?: string | null;
        acabado_pral?: string | null;
        troquel?: string | null;
        poses?: number | null;
        num_hojas_brutas?: number | null;
        num_hojas_netas?: number | null;
      } | null;

      setDetalle({
        otNumero: ot,
        cliente: m?.cliente ?? null,
        trabajo: m?.titulo ?? null,
        cantidad: m?.cantidad ?? null,
        fechaEntrega: m?.fecha_entrega ?? null,
        despachado: Boolean(m?.despachado),
        estadoOt: resolveEstadoOtLabel(m?.estado_desc ?? null, pasos),
        material: d?.material ?? null,
        gramaje: d?.gramaje ?? null,
        tamanoHoja: d?.tamano_hoja ?? null,
        tintas: d?.tintas ?? null,
        acabadoPral: d?.acabado_pral ?? null,
        troquel: d?.troquel ?? null,
        poses: d?.poses ?? null,
        hojasBrutas: d?.num_hojas_brutas ?? null,
        hojasNetas: d?.num_hojas_netas ?? null,
        pasos,
      });
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo cargar el detalle."));
      setDetalleOpen(false);
    } finally {
      setDetalleLoading(false);
    }
  };
  openDetalleRef.current = openDetalle;

  const handleOpenOtFromGrid = useCallback((otNumero: string) => {
    void openDetalleRef.current(otNumero);
  }, []);

  const exportMes = () => {
    exportCalendarioProduccionMensualPdf({
      year,
      monthIndex,
      semanas: semanasMes,
      entradasByDay,
      notasByDay,
      includeSaturday: showSaturday,
      filtroTexto: [
        labelCalendarioAmbito(ambitoActivo),
        visibilidadLabel,
        soloPendientes ? "solo pendientes" : "",
        filtro.trim(),
      ]
        .filter(Boolean)
        .join(" · "),
    });
  };

  const exportSemana = () => {
    exportCalendarioProduccionSemanaPdf({
      weekMonday,
      semana: semanaActual,
      entradasByDay,
      notasByDay,
      includeSaturday: showSaturday,
      filtroTexto: [
        labelCalendarioAmbito(ambitoActivo),
        visibilidadLabel,
        soloPendientes ? "solo pendientes" : "",
        filtro.trim(),
      ]
        .filter(Boolean)
        .join(" · "),
      tituloSemana: semanaLabelEs(weekMonday, showSaturday),
    });
  };

  const exportListado = () => {
    const ambitoTag = labelCalendarioAmbito(ambitoActivo);
    if (vista === "semana") {
      const dias = semanaActual
        .filter((c): c is { ymd: string; dayNum: number } => c != null)
        .map((c) => ({ ymd: c.ymd, titulo: fechaDiaLabel(c.ymd) }));
      const ymd = `${weekMonday.getFullYear()}-${String(weekMonday.getMonth() + 1).padStart(2, "0")}-${String(weekMonday.getDate()).padStart(2, "0")}`;
      exportCalendarioProduccionListadoPdf({
        titulo: `Calendario Producción — ${ambitoTag} — Listado semana`,
        subtitulo: semanaLabelEs(weekMonday, showSaturday),
        dias,
        entradasByDay,
        notasByDay,
        filtroTexto: filtro,
        filenameStem: `calendario-produccion-${ambitoActivo}-semana-${ymd}`,
      });
      return;
    }
    const dias: { ymd: string; titulo: string }[] = [];
    for (const semana of semanasMes) {
      for (const celda of semana) {
        if (!celda) continue;
        dias.push({ ymd: celda.ymd, titulo: fechaDiaLabel(celda.ymd) });
      }
    }
    exportCalendarioProduccionListadoPdf({
      titulo: `Calendario Producción — ${ambitoTag} — Listado mes`,
      subtitulo: mesAnioLabel(year, monthIndex),
      dias,
      entradasByDay,
      notasByDay,
      filtroTexto: filtro,
      filenameStem: `calendario-produccion-${ambitoActivo}-${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    });
  };

  const exportDia = () => {
    if (!dayYmd) return;
    exportCalendarioProduccionDiaPdf({
      ymd: dayYmd,
      tituloDia: `${fechaDiaLabel(dayYmd)} · ${labelCalendarioAmbito(ambitoActivo)}`,
      lineas: dayLineas,
      notas: dayNotas,
    });
  };

  const setAmbitoVisibilityPersist = (next: CalendarioAmbitoVisibility) => {
    if (!CALENDARIO_AMBITOS.some((a) => next[a])) return;
    setAmbitoVisibility(next);
    try {
      localStorage.setItem(
        STORAGE_AMBITO_VIS,
        serializeCalendarioAmbitoVisibility(next),
      );
    } catch {
      /* ignore */
    }
  };

  const toggleAmbitoVisible = (a: CalendarioAmbito, checked: boolean) => {
    const next = { ...ambitoVisibility, [a]: checked };
    if (!CALENDARIO_AMBITOS.some((x) => next[x])) return;
    setAmbitoVisibilityPersist(next);
  };

  const cabecera = useMemo(() => {
    const base = ["Lun", "Mar", "Mié", "Jue", "Vie"];
    return showSaturday ? [...base, "Sáb"] : base;
  }, [showSaturday]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#002147]">
            Calendario Producción
          </h2>
          <p className="text-xs text-slate-600">
            Mapa mental por ámbito (I/D/T/E). Bandeja = despachadas sin pastilla.
            Semáforo = estado del paso en Minerva (no mueve fechas).
            {canEditActivo
              ? ` Editando ${labelCalendarioAmbito(ambitoActivo)}.`
              : ` Solo lectura en ${labelCalendarioAmbito(ambitoActivo)}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarioBandejaToggle open={bandejaOpen} onToggle={toggleBandeja} />
          <label className="flex items-center gap-1.5 text-xs text-slate-700">
            <span className="font-medium">Ámbito</span>
            <select
              className="h-7 rounded-md border border-slate-300 bg-white px-2 text-xs"
              value={ambitoActivo}
              onChange={(e) => {
                const v = parseCalendarioAmbito(e.target.value);
                if (v) setAmbitoActivo(v);
              }}
              aria-label="Ámbito del calendario"
            >
              {CALENDARIO_AMBITOS.map((a) => (
                <option key={a} value={a}>
                  {CALENDARIO_AMBITO_LETRA[a]} · {labelCalendarioAmbito(a)}
                  {canEditCalendarioAmbito(userRole, a) ? "" : " (ver)"}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
            <span className="mr-0.5 font-medium text-slate-600">Ver</span>
            {CALENDARIO_AMBITOS.map((a) => (
              <label
                key={a}
                className="inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-50"
                title={labelCalendarioAmbito(a)}
              >
                <input
                  type="checkbox"
                  className="size-3.5 accent-[#002147]"
                  checked={ambitoVisibility[a]}
                  onChange={(e) => toggleAmbitoVisible(a, e.target.checked)}
                />
                <span
                  className={cn(
                    "rounded px-1 py-px text-[10px] font-bold leading-none",
                    CALENDARIO_AMBITO_PILL[a].letraBadge,
                  )}
                >
                  {CALENDARIO_AMBITO_LETRA[a]}
                </span>
              </label>
            ))}
            <button
              type="button"
              className="ml-0.5 text-[10px] font-medium text-slate-500 underline-offset-2 hover:text-[#002147] hover:underline"
              onClick={() =>
                setAmbitoVisibilityPersist(
                  defaultCalendarioAmbitoVisibility(ambitoActivo),
                )
              }
              title="Mostrar solo el ámbito activo"
            >
              Solo
            </button>
            <button
              type="button"
              className="text-[10px] font-medium text-slate-500 underline-offset-2 hover:text-[#002147] hover:underline"
              onClick={() =>
                setAmbitoVisibilityPersist(allCalendarioAmbitoVisibilityOn())
              }
              title="Mostrar I+D+T+E"
            >
              Todos
            </button>
          </div>
          <div className="inline-flex rounded-md border border-slate-200 p-0.5">
            <Button
              type="button"
              variant={vista === "mes" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setVistaPersist("mes")}
            >
              Mes
            </Button>
            <Button
              type="button"
              variant={vista === "semana" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setVistaPersist("semana")}
            >
              Semana
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => shiftPeriod(-1)}
            aria-label={vista === "semana" ? "Semana anterior" : "Mes anterior"}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[11rem] text-center text-sm font-semibold text-[#002147]">
            {vista === "semana"
              ? semanaLabelEs(weekMonday, showSaturday)
              : mesAnioLabel(year, monthIndex)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => shiftPeriod(1)}
            aria-label={vista === "semana" ? "Semana siguiente" : "Mes siguiente"}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={goHoy}>
            Hoy
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importExcel(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={importing || !canEditActivo}
            onClick={() => fileInputRef.current?.click()}
            title={
              canEditActivo
                ? `Importar pestaña planificador → ${labelCalendarioAmbito(ambitoActivo)}`
                : "Sin permiso de escritura en este ámbito"
            }
          >
            {importing ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Upload className="mr-1 size-4" />
            )}
            Importar Excel
          </Button>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={
                vista === "mes"
                  ? "PDF grid del mes (como pantalla)"
                  : "PDF grid de la semana (como pantalla)"
              }
              onClick={() => {
                if (vista === "mes") exportMes();
                else exportSemana();
              }}
            >
              <FileDown className="mr-1 size-4" />
              PDF grid
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              title="PDF listado por día (legible en papel)"
              onClick={exportListado}
            >
              <FileDown className="mr-1 size-4" />
              PDF listado
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <CalendarioFiltroInput
            className="h-8 pl-8 text-sm"
            onDebouncedChange={handleFiltroDebounced}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="size-3.5 rounded border-slate-300"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />
          Solo pendientes
          <span className="text-[10px] text-slate-400">
            (oculta hechas HR o ✓)
          </span>
        </label>
        {atrasadas.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-amber-300/80 bg-amber-50/50 text-xs text-amber-950 hover:bg-amber-100/80"
            onClick={() => setAtrasadasModalOpen(true)}
          >
            Atrasadas ({atrasadas.length})
          </Button>
        ) : null}
        <label
          className="flex cursor-pointer items-center gap-2 text-xs text-slate-600"
          title="OTs de laboratorio Minerva (número ≥ 98000). Por defecto ocultas para no mezclar con el plan de planta."
        >
          <input
            type="checkbox"
            className="size-3.5 rounded border-slate-300"
            checked={mostrarPruebas}
            onChange={(e) => {
              const v = e.target.checked;
              setMostrarPruebas(v);
              try {
                localStorage.setItem(STORAGE_MOSTRAR_PRUEBAS, v ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
          />
          Mostrar OTs prueba (≥98.000)
          {otsPruebaOcultas > 0 ? (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
              {otsPruebaOcultas} oculta{otsPruebaOcultas !== 1 ? "s" : ""}
            </span>
          ) : null}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="size-3.5 rounded border-slate-300"
            checked={showSaturday}
            onChange={(e) => {
              const v = e.target.checked;
              setShowSaturday(v);
              try {
                localStorage.setItem(STORAGE_SHOW_SATURDAY, v ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
          />
          Mostrar sábado
        </label>
        <div
          className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500"
          title="Semáforo = itinerario HR. Check verde = marca manual de Carlos/área (independiente)."
        >
          <span className="font-medium text-slate-600">Semáforo:</span>
          {(
            [
              ["esperando", "Esperando"],
              ["listo", "Listo"],
              ["hecho", "Hecho HR"],
              ["sin_paso", "Sin paso"],
            ] as const
          ).map(([key, label]) => (
            <span key={key} className="inline-flex items-center gap-1">
              <span
                className={cn("size-1.5 rounded-full", SEMAFORO_PILL_STYLES[key].dot)}
              />
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 border-l border-slate-200 pl-2">
            <span className="flex size-3.5 items-center justify-center rounded border border-emerald-600 bg-emerald-600 text-white">
              <Check className="size-2.5" strokeWidth={3} />
            </span>
            Hecho manual
          </span>
          <span
            className="inline-flex items-center gap-1 border-l border-slate-200 pl-2"
            title="Pip en la letra I/D/T/E = material Pool. Sin pip = N/A / sin despachar (no bloquea)."
          >
            <span className="relative inline-flex size-3.5 items-center justify-center rounded bg-sky-600 text-[8px] font-bold text-white">
              I
              <span className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-amber-500 ring-1 ring-white" />
            </span>
            Material
          </span>
        </div>
      </div>

      {portapapeles ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300/80 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="min-w-0">
            <span className="font-semibold">Cortada:</span> OT{" "}
            {portapapeles.otNumero} · de {fechaDiaLabel(portapapeles.fromFecha)}.
            Abre otro día y pulsa Pegar.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2"
            onClick={() => setPortapapeles(null)}
          >
            <X className="mr-1 size-3.5" />
            Cancelar
          </Button>
        </div>
      ) : null}

      {moverFromFecha ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="min-w-0">
            <span className="font-semibold">Mover OTs</span> de{" "}
            {fechaDiaLabel(moverFromFecha)}: {moverSelectedIds.length}{" "}
            seleccionada{moverSelectedIds.length === 1 ? "" : "s"}. Pulsa el{" "}
            <span className="font-semibold">número de otro día</span>.
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-amber-400 bg-white px-2"
              disabled={saving}
              onClick={seleccionarTodasMover}
            >
              {moverSelectedIds.length > 0 &&
              moverSelectedIds.length ===
                idsEditablesCalendarioDia(
                  entradasByDay.get(moverFromFecha) ?? [],
                  ambitoActivo,
                ).length
                ? "Ninguna"
                : "Todas"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              disabled={saving}
              onClick={() => {
                cancelarMoverLote();
                toast.message("Movimiento cancelado.");
              }}
            >
              <X className="mr-1 size-3.5" />
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={atrasadasModalOpen} onOpenChange={setAtrasadasModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#002147]">
              Atrasadas ({atrasadas.length})
            </DialogTitle>
            <DialogDescription>
              Fecha anterior a hoy · no hechas · no se auto-mueven. Pulsa una OT
              para abrir detalle.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[min(50vh,320px)] space-y-1 overflow-y-auto pr-1">
            {atrasadas.map((a) => (
              <li key={`${a.fechaYmd}:${a.id}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm hover:border-amber-200 hover:bg-amber-50"
                  onClick={() => {
                    setAtrasadasModalOpen(false);
                    void openDetalle(a.otNumero);
                  }}
                >
                  <span className="font-mono font-bold text-[#002147]">
                    {a.otNumero}
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    {CALENDARIO_AMBITO_LETRA[a.ambito]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {a.trabajo?.trim() || "—"}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-amber-900/90">
                    {fechaDiaLabel(a.fechaYmd)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {bandejaOpen ? (
          <CalendarioBandejaPanel
            ambito={ambitoActivo}
            canEdit={canEditActivo}
            mostrarPruebas={mostrarPruebas}
            refreshKey={bandejaRefreshKey}
            matchHeightPx={bandejaMatchHeight}
            onColocada={() => setBandejaRefreshKey((k) => k + 1)}
            onOpenOt={(ot) => void openDetalle(ot)}
            onOpenHojaRuta={(ot) => {
              setHojaRutaOt(ot);
              setHojaRutaOpen(true);
            }}
            onColocarEnFecha={colocarOtEnCalendario}
          />
        ) : null}

        <div ref={calendarGridRef} className="min-w-0 flex-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" />
              Cargando calendario…
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50">
              <div
                className="grid min-w-[640px] gap-px bg-slate-200"
                style={{
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                }}
              >
                {cabecera.map((d) => (
                  <div
                    key={d}
                    className="bg-slate-100 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {d}
                  </div>
                ))}
                {vista === "semana"
                  ? semanaActual.map((celda, ci) =>
                      celda ? (
                        <DiaCeldaMemo
                          key={celda.ymd}
                          dayYmd={celda.ymd}
                          dayNum={celda.dayNum}
                          lineas={
                            entradasByDay.get(celda.ymd) ??
                            EMPTY_CALENDARIO_LINEAS
                          }
                          notas={
                            notasByDay.get(celda.ymd) ?? EMPTY_CALENDARIO_NOTAS
                          }
                          onEditDay={openDay}
                          onOpenOt={handleOpenOtFromGrid}
                          onToggleMarcadoHecho={toggleMarcadoHecho}
                          variant="semana"
                          itinerarioByOt={itinerarioByOt}
                          espejoByOt={espejoByOt}
                          materialByOt={materialByOt}
                          duplicatedOtSet={duplicatedOtSet}
                          ambitoActivo={ambitoActivo}
                          canEditActivo={canEditActivo}
                          moverFromFecha={moverFromFecha}
                          moverSelectedIds={moverSelectedIds}
                          moverBusy={saving}
                          onStartMover={startMoverDia}
                          onToggleMoverOt={toggleMoverOt}
                          onPickDestino={moverLoteADia}
                        />
                      ) : (
                        <div
                          key={`empty-w-${ci}`}
                          className="min-h-[min(70vh,42rem)] bg-slate-100/60"
                        />
                      ),
                    )
                  : semanasMes.map((semana, si) =>
                      semana.map((celda, ci) =>
                        celda ? (
                          <DiaCeldaMemo
                            key={celda.ymd}
                            dayYmd={celda.ymd}
                            dayNum={celda.dayNum}
                            lineas={
                              entradasByDay.get(celda.ymd) ??
                              EMPTY_CALENDARIO_LINEAS
                            }
                            notas={
                              notasByDay.get(celda.ymd) ??
                              EMPTY_CALENDARIO_NOTAS
                            }
                            onEditDay={openDay}
                            onOpenOt={handleOpenOtFromGrid}
                            onToggleMarcadoHecho={toggleMarcadoHecho}
                            variant="mes"
                            itinerarioByOt={itinerarioByOt}
                            espejoByOt={espejoByOt}
                            materialByOt={materialByOt}
                            duplicatedOtSet={duplicatedOtSet}
                            ambitoActivo={ambitoActivo}
                            canEditActivo={canEditActivo}
                            moverFromFecha={moverFromFecha}
                            moverSelectedIds={moverSelectedIds}
                            moverBusy={saving}
                            onStartMover={startMoverDia}
                            onToggleMoverOt={toggleMoverOt}
                            onPickDestino={moverLoteADia}
                          />
                        ) : (
                          <div
                            key={`empty-${si}-${ci}`}
                            className="min-h-[11rem] bg-slate-100/60"
                          />
                        ),
                      ),
                    )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={dayOpen} onOpenChange={setDayOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>OTs y notas del día</DialogTitle>
            <DialogDescription>
              {dayYmd ? fechaDiaLabel(dayYmd) : ""} ·{" "}
              {labelCalendarioAmbito(ambitoActivo)}
              {!canEditActivo ? " (solo lectura de pastillas)" : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {portapapeles &&
            dayYmd &&
            portapapeles.fromFecha !== dayYmd &&
            canEditActivo &&
            portapapeles.ambito === ambitoActivo ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="w-full"
                disabled={saving}
                onClick={() => void pegarEnDia()}
              >
                <ClipboardPaste className="mr-1.5 size-4" />
                Pegar OT {portapapeles.otNumero} aquí
              </Button>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-[#002147]/30 text-[#002147]"
              disabled={!dayYmd || dayLineasParaDetalle.length === 0}
              onClick={() => setDetalleDiaOpen(true)}
            >
              <ListOrdered className="mr-1.5 size-4" />
              Organizar detalle del día
              {!canEditActivo ? " (ver)" : ""}
            </Button>

            <CalendarioDiaOtBuscar
              key={dayYmd ?? "day"}
              supabase={supabase}
              canEdit={canEditActivo}
              ambitoLabel={labelCalendarioAmbito(ambitoActivo)}
              saving={saving}
              onSelect={addOtToDay}
            />

            <CalendarioDiaNotaInput
              saving={saving}
              onAdd={addNotaToDay}
            />

            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">
                En este día ({dayLineas.length} OTs · {dayNotas.length} notas) —
                ↑↓ ordenar OTs y notas, cortar para mover de día, papelera para quitar
              </p>
              {dayLineas.length === 0 && dayNotas.length === 0 ? (
                <p className="text-sm text-slate-500">Sin OTs ni notas todavía.</p>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {dayNotas.length > 0 ? (
                    <ul className="space-y-1">
                      {dayNotas.map((n, idx) => (
                        <li
                          key={n.id}
                          className="flex items-start justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5"
                        >
                          <p className="min-w-0 flex-1 break-words text-xs text-amber-950">
                            📝 {n.texto}
                          </p>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#8a2b2b]"
                              disabled={saving || idx === 0}
                              title="Subir nota"
                              onClick={() => void moverNotaEnDia(n.id, -1)}
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#8a2b2b]"
                              disabled={saving || idx === dayNotas.length - 1}
                              title="Bajar nota"
                              onClick={() => void moverNotaEnDia(n.id, 1)}
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-700"
                              disabled={saving}
                              title="Quitar nota"
                              onClick={() => void removeNota(n.id)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <ul className="space-y-1">
                  {dayLineas.map((l) => {
                    const editable =
                      canEditActivo && l.ambito === ambitoActivo;
                    const editIdx = dayLineasEditables.findIndex(
                      (x) => x.id === l.id,
                    );
                    const hechoVisual = Boolean(
                      l.hechoVisual ?? l.marcadoHecho,
                    );
                    return (
                    <li
                      key={l.id}
                      className={`flex items-start justify-between gap-2 rounded-md border bg-white px-2 py-1.5 ${
                        portapapeles?.id === l.id
                          ? "border-amber-400 bg-amber-50/80"
                          : l.ambito !== ambitoActivo
                            ? "border-slate-200 opacity-80"
                            : "border-slate-200"
                      }${hechoVisual ? " bg-slate-50/90 opacity-70" : ""}`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-sm hover:underline"
                        onClick={() => void openDetalle(l.otNumero)}
                      >
                        <span
                          className={cn(
                            "font-semibold text-[#002147]",
                            hechoVisual && "text-slate-500 line-through",
                          )}
                        >
                          <AmbitoBadgeWithMaterial
                            ambito={l.ambito}
                            material={materialByOt.get(l.otNumero)}
                            compact
                          />
                          <span className="ml-1">{l.otNumero}</span>
                          {l.ambito !== ambitoActivo ? (
                            <span className="ml-1 text-[10px] font-normal text-slate-500">
                              (ref.)
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-600">
                          {l.trabajo ?? "—"}
                        </span>
                      </button>
                      {editable ? (
                      <div className="flex shrink-0 items-center gap-0.5">
                        {(() => {
                          const espejo = derivePastillaEspejo({
                            ambito: l.ambito,
                            fechaCalendario: dayYmd ?? l.id,
                            itinerario: itinerarioByOt.get(l.otNumero),
                            espejo: espejoByOt.get(l.otNumero),
                          });
                          const pasoLabel = labelPasoDisponible(
                            itinerarioByOt.get(l.otNumero)?.pasos ?? [],
                          );
                          return (
                            <>
                              {pasoLabel || espejo.badge ? (
                                <span
                                  className="mr-1 max-w-[7rem] truncate text-[10px] text-slate-500"
                                  title={espejo.title || pasoLabel || undefined}
                                >
                                  {pasoLabel}
                                  {pasoLabel && espejo.badge ? " · " : ""}
                                  {espejo.badge}
                                </span>
                              ) : null}
                            </>
                          );
                        })()}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-7 w-7 p-0",
                            l.marcadoHecho
                              ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                              : "text-[#002147]",
                          )}
                          disabled={saving}
                          title={
                            l.marcadoHecho
                              ? "Quitar marca hecho (manual)"
                              : "Marcar hecho (manual)"
                          }
                          onClick={() => void toggleMarcadoHecho(l)}
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-[#002147]"
                          disabled={saving || editIdx <= 0}
                          title="Subir"
                          onClick={() => void moverEntradaEnDia(l.id, -1)}
                        >
                          <ChevronUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-[#002147]"
                          disabled={
                            saving ||
                            editIdx < 0 ||
                            editIdx >= dayLineasEditables.length - 1
                          }
                          title="Bajar"
                          onClick={() => void moverEntradaEnDia(l.id, 1)}
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-[#002147]"
                          disabled={saving}
                          title="Cortar (mover a otro día)"
                          onClick={() => cortarEntrada(l)}
                        >
                          <Scissors className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-700"
                          disabled={saving}
                          title="Quitar del planificador"
                          onClick={() => void removeEntrada(l.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      ) : null}
                    </li>
                    );
                  })}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!dayYmd}
              onClick={exportDia}
            >
              <FileDown className="mr-1 size-4" />
              PDF día
            </Button>
            <Button type="button" size="sm" onClick={() => setDayOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              OT{" "}
              <span className="font-mono text-[#002147]">
                {detalle?.otNumero ?? "…"}
              </span>
            </DialogTitle>
            <DialogDescription>
              Resumen rápido · itinerario con colores de estado.
            </DialogDescription>
          </DialogHeader>
          {detalleLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="size-4 animate-spin" /> Cargando…
            </div>
          ) : detalle ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="text-sm font-semibold text-slate-800">
                  {detalle.cliente ?? "—"} · {detalle.trabajo ?? "—"}
                </div>
                <div className="mt-1.5 grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
                  <div>
                    <span className="font-medium">Cantidad:</span>{" "}
                    {detalle.cantidad != null
                      ? detalle.cantidad.toLocaleString("es-ES")
                      : "—"}
                  </div>
                  <div>
                    <span className="font-medium">Entrega:</span>{" "}
                    {detalle.fechaEntrega
                      ? formatFechaEsCorta(detalle.fechaEntrega)
                      : "—"}
                  </div>
                  <div>
                    <span className="font-medium">Estado OT:</span>{" "}
                    {detalle.estadoOt ?? "—"}
                  </div>
                </div>
                {(detalle.material || detalle.tamanoHoja) && (
                  <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-600">
                    {detalle.material ? (
                      <span>
                        <span className="font-medium">Material:</span>{" "}
                        {detalle.material}
                        {detalle.gramaje != null
                          ? ` ${detalle.gramaje}g`
                          : ""}
                      </span>
                    ) : null}
                    {detalle.tamanoHoja ? (
                      <span className={detalle.material ? " ml-3" : undefined}>
                        <span className="font-medium">Formato:</span>{" "}
                        {detalle.tamanoHoja}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              {detalle.pasos.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Itinerario
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {detalle.pasos.map((p, i) => (
                      <span
                        key={`${p.orden}-${i}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
                          STEP_BADGE_STYLES[p.estado] ??
                            STEP_BADGE_STYLES.pendiente,
                        )}
                        title={`${p.orden} · ${p.nombre} · ${p.estado}`}
                      >
                        <Route className="size-3" />
                        {p.orden} · {p.nombre}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Sin itinerario en Minerva (OT no despachada o sin pasos).
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin datos.</p>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!detalle?.otNumero}
                onClick={() => {
                  if (!detalle?.otNumero) return;
                  setHojaRutaOt(detalle.otNumero);
                  setDetalleOpen(false);
                  setHojaRutaOpen(true);
                }}
              >
                Ver hoja de ruta
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setDetalleOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HojaRutaOtDialog
        otNumero={hojaRutaOt}
        open={hojaRutaOpen}
        onOpenChange={setHojaRutaOpen}
      />

      <CalendarioCafeEasterEggDialog
        open={cafeOpen}
        onOpenChange={(open) => {
          setCafeOpen(open);
          if (!open) setCafePending(null);
        }}
        otNumero={String(cafePending?.hit.num_pedido ?? "").trim()}
        otherDayLabel={
          cafePending ? fechaDiaLabel(cafePending.otherYmd) : ""
        }
        onAddAnyway={() => {
          if (cafePending) void insertOtToDay(cafePending.hit);
          setCafePending(null);
        }}
      />

      {dayYmd ? (
        <CalendarioDetalleDiaDialog
          open={detalleDiaOpen}
          onOpenChange={setDetalleDiaOpen}
          dayYmd={dayYmd}
          dayLabel={fechaDiaLabel(dayYmd)}
          ambito={ambitoActivo}
          lineas={dayLineasParaDetalle}
          canEdit={canEditActivo}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}
