"use client";

import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Factory,
  FileOutput,
  FileSpreadsheet,
  History,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  PackageSearch,
  Pencil,
  Printer,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReactToPrint } from "react-to-print";
import ReactMarkdown from "react-markdown";
import { addDays, addWeeks, format, startOfDay, startOfWeek } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { GlobalModelSelector } from "@/components/layout/header";
import { OtNumeroSemaforoBadge } from "@/components/produccion/ots/ot-numero-semaforo-badge";
import {
  ExternosDailyGrid,
  type ExternosDailyGridRow,
} from "@/components/produccion/externos/externos-daily-grid";
import {
  ExternosWeeklyBoard,
  type ExternosWeeklyBoardRow,
} from "@/components/produccion/externos/externos-weekly-board";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, type Option } from "@/components/ui/select-native";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ESTADOS_SEGUIMIENTO_EXTERNOS,
  type ExternosImportFormat,
  normalizeOtRawToString,
  otRawToIdPedido,
  OT_PLACEHOLDER_PEDIDO,
  parseExternosImportFile,
} from "@/lib/externos-excel-import";
import {
  compraSemaforoToBgClass,
  fetchCompraMaterialStatusByOt,
  lookupCompraMaterialStatus,
  MATERIAL_COMPRA_TOOLTIP_FALLBACK,
  type OtCompraMaterialInfo,
} from "@/lib/externos-compra-material-status";
import {
  fuzzyMatchAcabadoIdByIncludes,
  fuzzyMatchIdByIncludes,
} from "@/lib/externos-fuzzy-match";
import { useSysParametrosOtsCompras } from "@/hooks/use-sys-parametros-ots-compras";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { useHubStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const ESTADOS_SEGUIMIENTO = ESTADOS_SEGUIMIENTO_EXTERNOS;

type TipoProveedorRow = {
  id: string;
  nombre: string;
  created_at: string;
};

type ProveedorRow = {
  id: string;
  nombre: string;
  tipo_proveedor_id: string;
  email: string | null;
  telefono: string | null;
  /** Columnas en `prod_proveedores` (snake_case en PostgREST). */
  telf_movil: string | null;
  direccion: string | null;
  notas: string | null;
  created_at: string;
};

/**
 * PostgREST devuelve los nombres de columna tal como están en el catálogo.
 * Si en Postgres se crearon como "Telf_Movil" (entre comillas), la clave JSON
 * no será `telf_movil`. Normalizamos aquí para no romper el listado.
 */
function mapProveedorFromApi(raw: unknown): ProveedorRow {
  const r = raw as Record<string, unknown>;
  const pick = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = r[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return null;
  };
  return {
    id: String(r.id ?? ""),
    nombre: String(r.nombre ?? ""),
    tipo_proveedor_id: String(r.tipo_proveedor_id ?? ""),
    email: pick("email"),
    telefono: pick("telefono"),
    telf_movil: pick("telf_movil", "Telf_Movil"),
    direccion: pick("direccion", "Direccion"),
    notas: pick("notas", "Notas"),
    created_at: String(r.created_at ?? ""),
  };
}

type AcabadoRow = {
  id: string;
  tipo_proveedor_id: string;
  nombre: string;
  created_at: string;
};

function normalizeTipoNombreSegment(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * IDs en `prod_cat_tipos_proveedor` para cargar acabados. Si el nombre del tipo
 * del proveedor trae varias categorías con «/», se combinan los acabados de
 * cada categoría que exista en el catálogo. Si solo hay una categoría, equivale
 * al comportamiento anterior (un solo `tipo_proveedor_id`).
 */
function resolveTipoProveedorIdsForAcabados(
  prov: ProveedorRow,
  tipos: TipoProveedorRow[]
): string[] {
  const fallback = prov.tipo_proveedor_id;
  if (!fallback) return [];
  const tipoRow = tipos.find((t) => t.id === fallback);
  if (!tipoRow?.nombre?.trim()) return [fallback];
  const partes = tipoRow.nombre
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
  if (partes.length <= 1) return [fallback];

  const byNombreNorm = new Map<string, string>();
  for (const t of tipos) {
    const k = normalizeTipoNombreSegment(t.nombre);
    if (k && !byNombreNorm.has(k)) byNombreNorm.set(k, t.id);
  }
  const ids: string[] = [];
  for (const p of partes) {
    const id = byNombreNorm.get(normalizeTipoNombreSegment(p));
    if (id) ids.push(id);
  }
  const unique = [...new Set(ids)];
  return unique.length > 0 ? unique : [fallback];
}

function acabadosFiltradosPorProveedor(
  prov: ProveedorRow | undefined,
  tipos: TipoProveedorRow[],
  catalog: AcabadoRow[]
): AcabadoRow[] {
  if (!prov) return [];
  const tipoIds = resolveTipoProveedorIdsForAcabados(prov, tipos);
  const allow = new Set(tipoIds);
  const list = catalog.filter((a) => allow.has(a.tipo_proveedor_id));
  return [...list].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
  );
}

type SeguimientoRow = {
  id: string;
  id_pedido: number;
  /** Columna citada "OT" en Postgres; identificador de orden en fábrica (no único). */
  OT?: string | null;
  cliente_nombre: string;
  trabajo_titulo: string;
  pedido_cliente: string;
  proveedor_id: string;
  acabado_id: string;
  estado: string;
  fecha_envio: string | null;
  fecha_prevista: string | null;
  /** Entrega final pactada con el cliente (OT); manual. */
  f_entrega_ot?: string | null;
  /** Días hasta F. entrega OT (Fecha OT − hoy); persistido al guardar. */
  dias_a_fEntOT?: number | null;
  notas_logistica: string | null;
  created_at: string;
  /** Si existe en BD (trigger / columna), última modificación */
  updated_at?: string | null;
  num_operacion?: number | null;
  unidades?: number | null;
  prioridad?: string | null;
  palets?: number | null;
  /** Opcional en BD; en UI se prefiere cálculo entre fechas */
  dias_en_externo?: number | null;
  observaciones?: string | null;
  /** Orden manual en vista cuadrícula diaria (misma fecha prevista). */
  orden_diario?: number | null;
};

function getOtDisplay(row: SeguimientoRow): string {
  const o = row.OT != null && String(row.OT).trim() !== "" ? String(row.OT).trim() : "";
  if (o) return o;
  return String(row.id_pedido);
}

/** Compatibilidad: filas antiguas en BD con el nombre sustituido por «Muelle Minerva». */
function normalizeSeguimientoRowEstado(row: SeguimientoRow): SeguimientoRow {
  if (row.estado === "En Minerva para salir") {
    return { ...row, estado: "Muelle Minerva" };
  }
  return row;
}

function isEstadoTerminalExternos(estado: string): boolean {
  return estado === "Recibido" || estado === "Terminado";
}

/** Trabajos con `fecha_prevista` en el día local (excluye terminal). */
function rowMatchesPlanDay(row: SeguimientoRow, day: Date): boolean {
  if (isEstadoTerminalExternos(row.estado)) return false;
  if (!row.fecha_prevista) return false;
  const d = new Date(row.fecha_prevista);
  if (Number.isNaN(d.getTime())) return false;
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return (
    format(local, "yyyy-MM-dd") === format(startOfDay(day), "yyyy-MM-dd")
  );
}

/** Orden: OT numérica si aplica, luego num_operacion. */
function compareSeguimientoRows(a: SeguimientoRow, b: SeguimientoRow): number {
  const na = Number(String(getOtDisplay(a)).replace(/\D/g, ""));
  const nb = Number(String(getOtDisplay(b)).replace(/\D/g, ""));
  const aOk = Number.isFinite(na) && na > 0;
  const bOk = Number.isFinite(nb) && nb > 0;
  if (aOk && bOk && na !== nb) return na - nb;
  if (aOk !== bOk) return aOk ? -1 : 1;
  const sa = getOtDisplay(a);
  const sb = getOtDisplay(b);
  if (sa !== sb) return sa.localeCompare(sb, "es", { numeric: true });
  const oa = a.num_operacion ?? 0;
  const ob = b.num_operacion ?? 0;
  return oa - ob;
}

/** Días naturales entre envío y previsto (UI). */
function computeDiasEnExternoUi(
  fecha_envio: string | null | undefined,
  fecha_prevista: string | null | undefined
): number | null {
  if (!fecha_envio || !fecha_prevista) return null;
  const a = new Date(fecha_envio);
  const b = new Date(fecha_prevista);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

type ComunicacionLogRow = {
  id: string;
  created_at: string;
  proveedor_id: string | null;
  cuerpo: string;
  id_pedidos: number[];
};

function buildComunicacionEmailBody(
  rows: SeguimientoRow[],
  acabadoNombreById: Map<string, string>,
  nombreProveedor: string
): string {
  const sorted = [...rows].sort(compareSeguimientoRows);
  const listaOts = sorted
    .map((row) => {
      const tipo = acabadoNombreById.get(row.acabado_id) ?? "—";
      const notas = (row.notas_logistica ?? "").trim() || "—";
      const fp = formatFechaEsCorta(row.fecha_prevista);
      const ud = row.unidades != null ? String(row.unidades) : "—";
      const pr = (row.prioridad ?? "").trim() || "—";
      const pl = row.palets != null ? String(row.palets) : "—";
      return `OT: ${getOtDisplay(row)}\nTrabajo: ${row.trabajo_titulo}\nUnidades: ${ud} | Prioridad: ${pr} | Palets: ${pl}\nTipo: ${tipo}\nNotas: ${notas}\nEntrega prevista: ${fp}`;
    })
    .join("\n\n");

  const nombre = nombreProveedor.trim();
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const intro =
    "Te adjunto los detalles de los nuevos trabajos que te enviamos para gestionar. Por favor, confírmanos la recepción de este correo y las fechas previstas de entrega para cada uno:";
  const cierre =
    "Quedamos a la espera de tus noticias para organizar la logística. Muchas gracias.\nSaludos cordiales,";

  return `${saludo}\n\n${intro}\n\n${listaOts}\n\n${cierre}\n\n`;
}

function dateInputToTimestamptz(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return dt.toISOString();
}

/** Convierte ISO de Supabase a valor de `<input type="date">` (zona local). */
function isoToDateInput(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Fecha en celda de tabla: edición compacta; persiste en `onBlur` si cambió. */
function InlineFechaSeguimientoCell({
  rowId,
  isoValue,
  disabled,
  ariaLabel,
  onCommit,
  inputClassName,
  id,
}: {
  rowId: string;
  isoValue: string | null | undefined;
  disabled?: boolean;
  ariaLabel: string;
  onCommit: (ymd: string) => void | Promise<void>;
  /** p. ej. controles táctiles en vista móvil (tarjetas). */
  inputClassName?: string;
  id?: string;
}) {
  const serverYmd = isoToDateInput(isoValue);
  const [local, setLocal] = useState(serverYmd);
  useEffect(() => {
    setLocal(serverYmd);
  }, [rowId, serverYmd]);
  return (
    <Input
      id={id}
      type="date"
      disabled={disabled}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local === serverYmd) return;
        void onCommit(local);
      }}
      className={cn(
        "touch-manipulation border-slate-200 shadow-xs",
        "h-7 w-full min-w-[6.25rem] max-w-[7rem] px-1 py-0 text-[10px] leading-tight sm:text-xs",
        inputClassName
      )}
      aria-label={ariaLabel}
    />
  );
}

/** Celda seguimiento: prefijo (X) + selector fecha en una sola fila. */
function FEntregaOtTableCell({
  row,
  saving,
  onCommit,
  inputClassName,
  inputId,
}: {
  row: SeguimientoRow;
  saving: boolean;
  onCommit: (ymd: string) => void | Promise<void>;
  /** p. ej. controles táctiles en vista móvil. */
  inputClassName?: string;
  inputId?: string;
}) {
  const d = computeDiasHastaFEntregaOt(row.f_entrega_ot);
  return (
    <div className="flex w-full min-w-[8.25rem] max-w-full flex-row items-center gap-2">
      {d !== null ? (
        <span
          className={cn(
            "shrink-0 text-[11px] tabular-nums leading-none",
            fEntregaOtParenClass(d)
          )}
        >
          ({d})
        </span>
      ) : null}
      <InlineFechaSeguimientoCell
        id={inputId}
        rowId={row.id}
        isoValue={row.f_entrega_ot}
        disabled={saving}
        ariaLabel={`F. entrega OT ${getOtDisplay(row)}`}
        onCommit={onCommit}
        inputClassName={cn(
          "min-w-[6.75rem] max-w-[8rem] flex-1 px-0.5 sm:px-1",
          inputClassName
        )}
      />
    </div>
  );
}

/** Modal / alta manual: `value` en yyyy-mm-dd; prefijo (X) a la izquierda del input. */
function FEntregaOtYmdInputWithUrgencyPrefix({
  id,
  value,
  onChange,
  disabled,
  inputHeightClass,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  inputHeightClass: string;
}) {
  const d =
    value.trim().length === 10
      ? computeDiasHastaFEntregaOt(dateInputToTimestamptz(value.trim()))
      : null;
  return (
    <div className="flex min-w-0 flex-row items-center gap-2">
      {d !== null ? (
        <span
          className={cn(
            "shrink-0 text-[11px] tabular-nums leading-none",
            fEntregaOtParenClass(d)
          )}
        >
          ({d})
        </span>
      ) : null}
      <Input
        id={id}
        type="date"
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={cn(
          inputHeightClass,
          "min-w-0 flex-1 px-1 py-0 text-sm",
          disabled && "cursor-not-allowed opacity-50"
        )}
      />
    </div>
  );
}

type ImportPreviewRow = {
  key: string;
  ot_raw: string;
  id_pedido: number;
  cliente: string;
  ref_cliente: string;
  titulo: string;
  fecha_entrega_excel: string;
  fecha_prevista: string;
  fecha_envio_default: string;
  /** Editable; se persiste en prod_seguimiento_externos.notas_logistica */
  notas: string;
  proveedor_id: string;
  acabado_id: string;
  selected: boolean;
  estado_sugerido: string;
  unidades: number | null;
  prioridad: string | null;
  palets: number | null;
  observaciones: string | null;
  importFormat: ExternosImportFormat;
  /** Texto Excel (Hermano) para referencia si el fuzzy no acertó */
  proveedor_excel: string | null;
  proceso_excel: string | null;
};

function isEnvioRetrasado(
  fechaPrevista: string | null,
  estado: string
): boolean {
  if (estado === "Retrasado") return true;
  if (!fechaPrevista || estado === "Recibido") return false;
  const fp = new Date(fechaPrevista);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fpDay = new Date(fp);
  fpDay.setHours(0, 0, 0, 0);
  return fpDay.getTime() < today.getTime();
}

function NotasTablaCelda({
  texto,
  vacio = "—",
}: {
  texto: string | null | undefined;
  vacio?: string;
}) {
  const t = texto?.trim() ?? "";
  if (!t) {
    return <span className="text-muted-foreground">{vacio}</span>;
  }
  return (
    <span
      className="line-clamp-4 max-h-[5.5rem] cursor-default overflow-hidden break-words whitespace-pre-wrap text-[11px] leading-snug"
      title={t}
    >
      {t}
    </span>
  );
}

/** Días naturales hasta fecha prevista (0 = hoy, 1 = mañana). null si sin fecha. */
function diasHastaFechaPrevista(fechaPrevista: string | null): number | null {
  if (fechaPrevista == null || fechaPrevista === "") return null;
  const fp = new Date(fechaPrevista);
  if (Number.isNaN(fp.getTime())) return null;
  fp.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round(
    (fp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
}

/**
 * Días hasta la fecha de entrega OT pactada con el cliente (zona local).
 * Fecha entrega − hoy: 0 = hoy, negativo = vencido.
 */
function computeDiasHastaFEntregaOt(
  iso: string | null | undefined
): number | null {
  if (iso == null || iso === "") return null;
  const fp = new Date(iso);
  if (Number.isNaN(fp.getTime())) return null;
  fp.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round(
    (fp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
}

/** Estilo del paréntesis (X) según urgencia (>7 días: verde). */
function fEntregaOtParenClass(d: number): string {
  if (d <= 3) return "font-normal text-red-600 dark:text-red-400";
  if (d <= 7) return "text-orange-600 dark:text-orange-400";
  return "text-green-700 dark:text-green-500";
}

type SemaforoInfo = {
  kind:
    | "recibido"
    | "retraso"
    | "urgente"
    | "transito"
    | "pendiente"
    | "listo_recogida";
  tooltip: string;
  excelLabel: string;
};

function computeSemaforo(row: SeguimientoRow): SemaforoInfo {
  if (row.estado === "Recibido") {
    return {
      kind: "recibido",
      tooltip: "Trabajo Recibido y Finalizado",
      excelLabel: "✅ Recibido / Finalizado",
    };
  }
  if (row.estado === "Retrasado") {
    return {
      kind: "retraso",
      tooltip: "Retrasado (estado explícito)",
      excelLabel: "🔴 Retrasado",
    };
  }
  if (isEnvioRetrasado(row.fecha_prevista, row.estado)) {
    return {
      kind: "retraso",
      tooltip: "Retraso: la fecha prevista ya ha pasado",
      excelLabel: "🔴 Retraso",
    };
  }
  const dias = diasHastaFechaPrevista(row.fecha_prevista);
  if (dias !== null && dias <= 1 && dias >= 0) {
    return {
      kind: "urgente",
      tooltip: "Urgente: falta 1 día o menos para la fecha prevista",
      excelLabel: "🟡 Urgente",
    };
  }
  if (row.estado === "Acabado en Proveedor") {
    return {
      kind: "listo_recogida",
      tooltip: "Listo para recoger en proveedor",
      excelLabel: "🔷 Acabado en Proveedor",
    };
  }
  if (
    row.estado === "Enviado" ||
    row.estado === "En Proveedor" ||
    row.estado === "Parcial" ||
    row.estado === "Muelle Minerva"
  ) {
    return {
      kind: "transito",
      tooltip: "En circuito externo / tránsito — dentro de plazo",
      excelLabel: `🔵 ${row.estado}`,
    };
  }
  if (row.estado === "Pendiente") {
    return {
      kind: "pendiente",
      tooltip: "Pendiente de envío",
      excelLabel: "⚪ Pendiente",
    };
  }
  return {
    kind: "transito",
    tooltip: row.estado,
    excelLabel: `🔵 ${row.estado}`,
  };
}

function SemaforoCell({ row }: { row: SeguimientoRow }) {
  const s = computeSemaforo(row);
  if (s.kind === "recibido") {
    return (
      <span className="inline-flex justify-center" title={s.tooltip}>
        <CheckCircle2
          className="size-6 shrink-0"
          style={{ color: "#16a34a" }}
          strokeWidth={2.25}
          aria-hidden
        />
        <span className="sr-only">{s.tooltip}</span>
      </span>
    );
  }
  if (s.kind === "retraso") {
    return (
      <span className="inline-flex justify-center" title={s.tooltip}>
        <span
          className="inline-block size-5 shrink-0 rounded-full bg-[#ef4444]"
          aria-hidden
        />
        <span className="sr-only">{s.tooltip}</span>
      </span>
    );
  }
  if (s.kind === "urgente") {
    return (
      <span className="inline-flex justify-center" title={s.tooltip}>
        <span
          className="inline-block size-5 shrink-0 rounded-full bg-[#eab308]"
          aria-hidden
        />
        <span className="sr-only">{s.tooltip}</span>
      </span>
    );
  }
  if (s.kind === "listo_recogida") {
    return (
      <span className="inline-flex justify-center" title={s.tooltip}>
        <span
          className="inline-block size-5 shrink-0 rounded-full bg-sky-300 ring-2 ring-sky-200/90 dark:bg-sky-400 dark:ring-sky-500/50"
          aria-hidden
        />
        <span className="sr-only">{s.tooltip}</span>
      </span>
    );
  }
  if (s.kind === "transito") {
    return (
      <span className="inline-flex justify-center" title={s.tooltip}>
        <span
          className="inline-block size-5 shrink-0 rounded-full bg-cyan-500"
          aria-hidden
        />
        <span className="sr-only">{s.tooltip}</span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex justify-center"
      title={s.tooltip}
    >
      <span
        className="inline-block size-5 shrink-0 rounded-full border-2 border-slate-400 bg-white dark:border-slate-500 dark:bg-slate-950"
        aria-hidden
      />
      <span className="sr-only">{s.tooltip}</span>
    </span>
  );
}

export function MaterialCompraColumnCell({
  info,
  loading,
}: {
  info: OtCompraMaterialInfo | undefined;
  loading: boolean;
}) {
  const sem = loading ? "gris" : (info?.semaforo ?? "gris");
  const tooltip = loading
    ? "Cargando estado de compra de material…"
    : (info?.tooltip ?? MATERIAL_COMPRA_TOOLTIP_FALLBACK.gris);
  const color = compraSemaforoToBgClass(sem);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex cursor-default items-center justify-center p-0.5"
          tabIndex={0}
          aria-label={tooltip}
        >
          <span
            className={cn(
              "inline-block h-3 w-3 shrink-0 rounded-full",
              color,
              loading && "animate-pulse opacity-80"
            )}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const emptySelect: Option[] = [{ value: "", label: "— Seleccionar —" }];

const PRIORIDAD_MANUAL_OPTIONS: Option[] = [
  { value: "", label: "—" },
  { value: "Urgente", label: "Urgente" },
  { value: "Normal", label: "Normal" },
  { value: "Programado", label: "Programado" },
];

/** Importación: estos estados exigen fecha prevista antes de insertar. */
const ESTADOS_IMPORT_REQUIEREN_FECHA_PREVISTA = new Set([
  "Recibido",
  "Muelle Minerva",
]);

function fechaPrevistaYmdValida(ymd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd.trim());
}

/** Tipos de referencia para poblar `prod_cat_tipos_proveedor` si está vacía (botón temporal). */
const TIPOS_PROVEEDOR_BASE = [
  "Plastificador",
  "Estampador",
  "Barniz UV",
  "Troquelado",
  "Encuadernación",
] as const;

/** `<select>` nativo: evita problemas de portal/valor con Base UI en este flujo. */
function TipoProveedorNativeSelect({
  id,
  label = "Tipo de proveedor",
  value,
  onValueChange,
  tipos,
  disabled,
}: {
  id: string;
  label?: string;
  value: string;
  onValueChange: (v: string) => void;
  tipos: TipoProveedorRow[];
  disabled?: boolean;
}) {
  const list = Array.isArray(tipos) ? tipos : [];
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className={cn(
          "border-input bg-background h-9 w-full min-w-[12rem] rounded-lg border px-3 text-sm shadow-xs outline-none transition-[color,box-shadow]",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">— Seleccionar —</option>
        {list.map((tipo) => (
          <option key={tipo.id} value={tipo.id}>
            {tipo.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Fecha de fila import (YYYY-MM-DD u otros) → DD/MM/AA como el resto de la tabla. */
function fechaExcelRowToCorta(raw: string): string {
  if (raw == null || String(raw).trim() === "") return "—";
  const s = String(raw).trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0, 0);
    if (!Number.isNaN(d.getTime())) return formatFechaEsCorta(d.toISOString());
  }
  const parsed = new Date(s.replace(" ", "T"));
  if (!Number.isNaN(parsed.getTime())) {
    return formatFechaEsCorta(parsed.toISOString());
  }
  return "—";
}

function formatPostgrestError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };
    return [e.message, e.details, e.hint, e.code ? `(${e.code})` : ""]
      .filter((s) => s != null && String(s).length > 0)
      .join(" · ");
  }
  return String(err);
}

export function GestionExternosPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { umbrales: umbralesOtsCompras } = useSysParametrosOtsCompras();

  const [tab, setTab] = useState("seguimiento");

  const [tipos, setTipos] = useState<TipoProveedorRow[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorRow[]>([]);
  const [acabadosCatalogo, setAcabadosCatalogo] = useState<AcabadoRow[]>([]);
  const [seguimientos, setSeguimientos] = useState<SeguimientoRow[]>([]);

  const [acabadosForm, setAcabadosForm] = useState<
    { id: string; nombre: string }[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [provNombre, setProvNombre] = useState("");
  const [provTipoId, setProvTipoId] = useState("");
  const [provEmail, setProvEmail] = useState("");
  const [provTelefono, setProvTelefono] = useState("");
  const [provTelfMovil, setProvTelfMovil] = useState("");
  const [provDireccion, setProvDireccion] = useState("");
  const [provNotas, setProvNotas] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ProveedorRow | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editTipoId, setEditTipoId] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelefono, setEditTelefono] = useState("");
  const [editTelfMovil, setEditTelfMovil] = useState("");
  const [editDireccion, setEditDireccion] = useState("");
  const [editNotas, setEditNotas] = useState("");
  /** Vista completa de notas de proveedor (listado). */
  const [proveedorNotasCompleto, setProveedorNotasCompleto] = useState<
    string | null
  >(null);

  const [envIdPedido, setEnvIdPedido] = useState("");
  const [envCliente, setEnvCliente] = useState("");
  const [envTrabajo, setEnvTrabajo] = useState("");
  const [envPedidoCliente, setEnvPedidoCliente] = useState("");
  const [envProveedorId, setEnvProveedorId] = useState("");
  const [envAcabadoId, setEnvAcabadoId] = useState("");
  const [envFecha, setEnvFecha] = useState("");
  const [envFechaEntregaOt, setEnvFechaEntregaOt] = useState("");
  const [envNotas, setEnvNotas] = useState("");
  const [envUnidades, setEnvUnidades] = useState("");
  const [envPrioridad, setEnvPrioridad] = useState("");
  const [envPalets, setEnvPalets] = useState("");
  const [envObservaciones, setEnvObservaciones] = useState("");
  const [envEstado, setEnvEstado] = useState("Pendiente");
  const [envEntradaMultiple, setEnvEntradaMultiple] = useState(false);

  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>(
    []
  );
  const [bulkImportProv, setBulkImportProv] = useState("");
  const [bulkImportAcab, setBulkImportAcab] = useState("");
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const importMasterCheckboxRef = useRef<HTMLInputElement>(null);

  const [verHistorial, setVerHistorial] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroProveedorId, setFiltroProveedorId] = useState("");
  const [busquedaSeguimiento, setBusquedaSeguimiento] = useState("");
  const [seguimientoVista, setSeguimientoVista] = useState<
    "lista" | "semanal" | "diaria"
  >("lista");
  const [planCursor, setPlanCursor] = useState(() => startOfDay(new Date()));
  const [seguimientoSheetOpen, setSeguimientoSheetOpen] = useState(false);
  const [seguimientoEditing, setSeguimientoEditing] =
    useState<SeguimientoRow | null>(null);
  const [editSegProveedorId, setEditSegProveedorId] = useState("");
  const [editSegAcabadoId, setEditSegAcabadoId] = useState("");
  const [editSegFecha, setEditSegFecha] = useState("");
  const [editSegFechaEntregaOt, setEditSegFechaEntregaOt] = useState("");
  const [editSegNotas, setEditSegNotas] = useState("");
  const [editSegObservaciones, setEditSegObservaciones] = useState("");
  const [editSegUnidades, setEditSegUnidades] = useState("");
  const [editSegPrioridad, setEditSegPrioridad] = useState("");
  const [editSegPalets, setEditSegPalets] = useState("");
  const [editSegFechaEnvio, setEditSegFechaEnvio] = useState("");
  const [editSegEstado, setEditSegEstado] = useState("");
  const [editSegCliente, setEditSegCliente] = useState("");
  const [editSegTrabajo, setEditSegTrabajo] = useState("");

  const [analistaOpen, setAnalistaOpen] = useState(false);
  const [analistaLoading, setAnalistaLoading] = useState(false);
  const [analistaText, setAnalistaText] = useState("");
  const [analistaError, setAnalistaError] = useState<string | null>(null);
  const [analistaPregunta, setAnalistaPregunta] = useState("");
  const abortAnalistaRef = useRef<AbortController | null>(null);
  const globalModel = useHubStore((s) => s.globalModel);
  const analistaDialogTitleId = useId();
  const analistaDialogDescId = useId();
  const comunicacionDialogTitleId = useId();
  const comunicacionDialogDescId = useId();

  const [selectedSeguimientoIds, setSelectedSeguimientoIds] = useState<string[]>(
    []
  );
  const [compraMaterialByOt, setCompraMaterialByOt] = useState<
    Map<string, OtCompraMaterialInfo>
  >(() => new Map());
  const [comunicacionModalOpen, setComunicacionModalOpen] = useState(false);
  const [comunicacionBodyCopied, setComunicacionBodyCopied] = useState(false);
  const copyComunicacionBodyTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [segComunicacionLogs, setSegComunicacionLogs] = useState<
    ComunicacionLogRow[]
  >([]);
  const [segComunicacionLogsLoading, setSegComunicacionLogsLoading] =
    useState(false);
  const seguimientoMasterCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!analistaOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [analistaOpen]);

  useEffect(() => {
    if (!comunicacionModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [comunicacionModalOpen]);

  useEffect(() => {
    if (comunicacionModalOpen) return;
    setComunicacionBodyCopied(false);
    if (copyComunicacionBodyTimeoutRef.current) {
      clearTimeout(copyComunicacionBodyTimeoutRef.current);
      copyComunicacionBodyTimeoutRef.current = null;
    }
  }, [comunicacionModalOpen]);

  useEffect(() => {
    return () => {
      if (copyComunicacionBodyTimeoutRef.current) {
        clearTimeout(copyComunicacionBodyTimeoutRef.current);
      }
    };
  }, []);

  const printListadoRef = useRef<HTMLDivElement>(null);
  const handlePrintListado = useReactToPrint({
    contentRef: printListadoRef,
    documentTitle: `Minerva-Parte-Externos-${new Date().toISOString().slice(0, 10)}`,
    pageStyle: `
      @page { size: A4 landscape; margin: 10mm 12mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `,
  });

  const handlePrintPlanificacion = useCallback(() => {
    document.body.classList.add("print-externos-planificacion");
    window.print();
  }, []);

  useEffect(() => {
    const clear = () =>
      document.body.classList.remove("print-externos-planificacion");
    window.addEventListener("afterprint", clear);
    return () => {
      window.removeEventListener("afterprint", clear);
      clear();
    };
  }, []);

  const proveedorOptions: Option[] = useMemo(() => {
    return [
      ...emptySelect,
      ...proveedores.map((p) => ({ value: p.id, label: p.nombre })),
    ];
  }, [proveedores]);

  const proveedorFiltroOptions: Option[] = useMemo(
    () => [
      { value: "", label: "Todos los proveedores" },
      ...proveedores.map((p) => ({ value: p.id, label: p.nombre })),
    ],
    [proveedores]
  );

  const acabadoFormOptions: Option[] = useMemo(() => {
    return [
      ...emptySelect,
      ...acabadosForm.map((a) => ({ value: a.id, label: a.nombre })),
    ];
  }, [acabadosForm]);

  const tipoById = useMemo(() => {
    const m = new Map<string, string>();
    tipos.forEach((t) => m.set(t.id, t.nombre));
    return m;
  }, [tipos]);

  const proveedorNombreById = useMemo(() => {
    const m = new Map<string, string>();
    proveedores.forEach((p) => m.set(p.id, p.nombre));
    return m;
  }, [proveedores]);

  const acabadoNombreById = useMemo(() => {
    const m = new Map<string, string>();
    acabadosCatalogo.forEach((a) => m.set(a.id, a.nombre));
    return m;
  }, [acabadosCatalogo]);

  const seguimientosOrdenados = useMemo(
    () => [...seguimientos].sort(compareSeguimientoRows),
    [seguimientos]
  );

  const bulkImportAcabadoOptions: Option[] = useMemo(() => {
    if (!bulkImportProv) return emptySelect;
    const prov = proveedores.find((p) => p.id === bulkImportProv);
    if (!prov) return emptySelect;
    const opts = acabadosFiltradosPorProveedor(prov, tipos, acabadosCatalogo);
    return [
      ...emptySelect,
      ...opts.map((a) => ({ value: a.id, label: a.nombre })),
    ];
  }, [bulkImportProv, proveedores, acabadosCatalogo, tipos]);

  const editSeguimientoAcabadoOptions: Option[] = useMemo(() => {
    if (!editSegProveedorId) return emptySelect;
    const prov = proveedores.find((p) => p.id === editSegProveedorId);
    if (!prov) return emptySelect;
    const opts = acabadosFiltradosPorProveedor(prov, tipos, acabadosCatalogo);
    return [
      ...emptySelect,
      ...opts.map((a) => ({ value: a.id, label: a.nombre })),
    ];
  }, [editSegProveedorId, proveedores, acabadosCatalogo, tipos]);

  const importSelectionStats = useMemo(() => {
    const selectable = importPreviewRows;
    const n = selectable.length;
    const selectedCount = selectable.filter((r) => r.selected).length;
    const allSelectableSelected = n > 0 && selectedCount === n;
    const masterIndeterminate = selectedCount > 0 && selectedCount < n;
    return {
      selectableCount: n,
      allSelectableSelected,
      masterIndeterminate,
    };
  }, [importPreviewRows]);

  useEffect(() => {
    const el = importMasterCheckboxRef.current;
    if (!el) return;
    el.indeterminate = importSelectionStats.masterIndeterminate;
  }, [importSelectionStats.masterIndeterminate]);

  const estadoFiltroOptions: Option[] = useMemo(
    () => [
      { value: "", label: "Todos los estados" },
      ...ESTADOS_SEGUIMIENTO.map((s) => ({ value: s, label: s })),
    ],
    []
  );

  /** Selector rápido de estado en la tabla de seguimiento (sin abrir el Sheet). */
  const estadoRapidoOptions: Option[] = useMemo(
    () => ESTADOS_SEGUIMIENTO.map((s) => ({ value: s, label: s })),
    []
  );

  const seguimientosFiltrados = useMemo(() => {
    let list = seguimientosOrdenados;
    if (!verHistorial) {
      list = list.filter((r) => r.estado !== "Recibido");
    }
    if (filtroEstado) {
      list = list.filter((r) => r.estado === filtroEstado);
    }
    if (filtroProveedorId) {
      list = list.filter((r) => r.proveedor_id === filtroProveedorId);
    }
    const q = busquedaSeguimiento.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const ot = `${getOtDisplay(r)} ${r.id_pedido}`;
        const cli = (r.cliente_nombre ?? "").toLowerCase();
        const ped = (r.pedido_cliente ?? "").toLowerCase();
        const trab = (r.trabajo_titulo ?? "").toLowerCase();
        return (
          ot.toLowerCase().includes(q) ||
          cli.includes(q) ||
          ped.includes(q) ||
          trab.includes(q)
        );
      });
    }
    return list;
  }, [
    seguimientosOrdenados,
    verHistorial,
    filtroEstado,
    filtroProveedorId,
    busquedaSeguimiento,
  ]);

  const weekMondayForBoard = useMemo(
    () => startOfWeek(planCursor, { weekStartsOn: 1 }),
    [planCursor]
  );

  const dailyGridRows = useMemo((): SeguimientoRow[] => {
    if (seguimientoVista !== "diaria") return [];
    const day = startOfDay(planCursor);
    return seguimientosFiltrados.filter((r) => rowMatchesPlanDay(r, day));
  }, [seguimientoVista, planCursor, seguimientosFiltrados]);

  const seleccionSeguimientoRows = useMemo(() => {
    if (selectedSeguimientoIds.length === 0) return [];
    const idSet = new Set(selectedSeguimientoIds);
    return seguimientos.filter((r) => idSet.has(r.id));
  }, [seguimientos, selectedSeguimientoIds]);

  const prepararEnvioEnabled = useMemo(() => {
    const rows = seleccionSeguimientoRows;
    if (rows.length === 0) return false;
    const provId = rows[0].proveedor_id;
    return rows.every((r) => r.proveedor_id === provId);
  }, [seleccionSeguimientoRows]);

  const comunicacionPreview = useMemo(() => {
    if (!prepararEnvioEnabled || seleccionSeguimientoRows.length === 0) {
      return null;
    }
    const rows = [...seleccionSeguimientoRows].sort(compareSeguimientoRows);
    const prov = proveedores.find((p) => p.id === rows[0].proveedor_id);
    const body = buildComunicacionEmailBody(
      rows,
      acabadoNombreById,
      prov?.nombre ?? ""
    );
    const ots = rows.map((r) => r.id_pedido);
    const subject = `Envío de trabajos Minerva - OTs: ${ots.join(", ")}`;
    return { rows, prov, body, subject };
  }, [
    prepararEnvioEnabled,
    seleccionSeguimientoRows,
    proveedores,
    acabadoNombreById,
  ]);

  const handleCopyText = useCallback(async () => {
    if (!comunicacionPreview) return;
    try {
      await navigator.clipboard.writeText(comunicacionPreview.body);
      setComunicacionBodyCopied(true);
      if (copyComunicacionBodyTimeoutRef.current) {
        clearTimeout(copyComunicacionBodyTimeoutRef.current);
      }
      copyComunicacionBodyTimeoutRef.current = setTimeout(() => {
        setComunicacionBodyCopied(false);
        copyComunicacionBodyTimeoutRef.current = null;
      }, 2000);
    } catch {
      toast.error("No se pudo copiar al portapapeles.");
    }
  }, [comunicacionPreview]);

  const seguimientoSelectionStats = useMemo(() => {
    const n = seguimientosFiltrados.length;
    const selectedInView = seguimientosFiltrados.filter((r) =>
      selectedSeguimientoIds.includes(r.id)
    ).length;
    const allInViewSelected = n > 0 && selectedInView === n;
    const masterIndeterminate = selectedInView > 0 && selectedInView < n;
    return { selectedInView, allInViewSelected, masterIndeterminate, n };
  }, [seguimientosFiltrados, selectedSeguimientoIds]);

  useEffect(() => {
    const el = seguimientoMasterCheckboxRef.current;
    if (!el) return;
    el.indeterminate = seguimientoSelectionStats.masterIndeterminate;
  }, [seguimientoSelectionStats.masterIndeterminate]);

  const buildAnalistaRowsPayload = useCallback(() => {
    return seguimientosFiltrados.map((r) => ({
      ot: getOtDisplay(r),
      op: r.num_operacion ?? null,
      unidades: r.unidades ?? null,
      prioridad: r.prioridad ?? null,
      palets: r.palets ?? null,
      cliente: r.cliente_nombre,
      trabajo: r.trabajo_titulo,
      proveedor: proveedorNombreById.get(r.proveedor_id) ?? "—",
      acabado: acabadoNombreById.get(r.acabado_id) ?? "—",
      estado: r.estado,
      fechaPrevista: formatFechaEsCorta(r.fecha_prevista),
      fEntregaOt: formatFechaEsCorta(r.f_entrega_ot),
      fechaEnvio: formatFechaEsCorta(r.fecha_envio),
      diasEnExterno: computeDiasEnExternoUi(r.fecha_envio, r.fecha_prevista),
      semaforo: computeSemaforo(r).excelLabel,
      observacionesTaller:
        (r.observaciones ?? "").trim() || null,
    }));
  }, [seguimientosFiltrados, proveedorNombreById, acabadoNombreById]);

  const runAnalistaProduccion = useCallback(async () => {
    abortAnalistaRef.current?.abort();
    const ac = new AbortController();
    abortAnalistaRef.current = ac;
    setAnalistaLoading(true);
    setAnalistaError(null);
    const rows = buildAnalistaRowsPayload();
    try {
      const res = await fetch("/api/gemini/produccion-externos-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: globalModel,
          rows,
          mode: "analyze",
        }),
        signal: ac.signal,
      });
      const data = (await res.json()) as { error?: string; text?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al analizar");
      setAnalistaText(data.text ?? "");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setAnalistaError(
        e instanceof Error ? e.message : "Error desconocido"
      );
      setAnalistaText("");
    } finally {
      setAnalistaLoading(false);
    }
  }, [buildAnalistaRowsPayload, globalModel]);

  const runAnalistaPregunta = useCallback(async () => {
    const q = analistaPregunta.trim();
    if (!q) {
      toast.error("Escribe una pregunta.");
      return;
    }
    abortAnalistaRef.current?.abort();
    const ac = new AbortController();
    abortAnalistaRef.current = ac;
    setAnalistaLoading(true);
    setAnalistaError(null);
    const rows = buildAnalistaRowsPayload();
    try {
      const res = await fetch("/api/gemini/produccion-externos-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: globalModel,
          rows,
          mode: "ask",
          question: q,
        }),
        signal: ac.signal,
      });
      const data = (await res.json()) as { error?: string; text?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al responder");
      setAnalistaText(data.text ?? "");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setAnalistaError(
        e instanceof Error ? e.message : "Error desconocido"
      );
      setAnalistaText("");
    } finally {
      setAnalistaLoading(false);
    }
  }, [analistaPregunta, buildAnalistaRowsPayload, globalModel]);

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      const [tiposRes, provRes, acabRes, segRes] = await Promise.all([
        supabase.from("prod_cat_tipos_proveedor").select("*").order("nombre"),
        supabase.from("prod_proveedores").select("*").order("nombre"),
        supabase
          .from("prod_cat_acabados")
          .select("id, tipo_proveedor_id, nombre, created_at")
          .order("nombre"),
        supabase.from("prod_seguimiento_externos").select("*"),
      ]);

      if (tiposRes.error) {
        console.error("[prod_cat_tipos_proveedor]", tiposRes.error);
        throw tiposRes.error;
      }
      if (provRes.error) {
        console.error("[prod_proveedores]", provRes.error);
        throw provRes.error;
      }
      if (acabRes.error) {
        console.error("[prod_cat_acabados]", acabRes.error);
        throw acabRes.error;
      }
      if (segRes.error) {
        console.error("[prod_seguimiento_externos]", segRes.error);
        throw segRes.error;
      }

      const tiposData = tiposRes.data;
      const tiposNorm: TipoProveedorRow[] = Array.isArray(tiposData)
        ? (tiposData as TipoProveedorRow[])
        : [];
      console.log(
        "[prod_cat_tipos_proveedor] filas cargadas:",
        tiposNorm.length,
        tiposNorm.length === 0 ? "(vacío → estado [])" : ""
      );
      setTipos(tiposNorm);
      const proveedoresList = Array.isArray(provRes.data)
        ? provRes.data.map(mapProveedorFromApi)
        : [];
      const proveedorNombreByIdForCompra = new Map<string, string>();
      for (const p of proveedoresList) {
        proveedorNombreByIdForCompra.set(p.id, p.nombre);
      }
      setProveedores(proveedoresList);
      setAcabadosCatalogo(
        Array.isArray(acabRes.data)
          ? (acabRes.data as AcabadoRow[])
          : []
      );
      const segRowsRaw = Array.isArray(segRes.data)
        ? (segRes.data as SeguimientoRow[]).map(normalizeSeguimientoRowEstado)
        : [];
      const otDisplaysCompra = [
        ...new Set(segRowsRaw.map((r) => getOtDisplay(r))),
      ];
      const compraMap = await fetchCompraMaterialStatusByOt(
        supabase,
        otDisplaysCompra,
        proveedorNombreByIdForCompra
      );
      setSeguimientos(segRowsRaw);
      setCompraMaterialByOt(compraMap);
    } catch (e) {
      console.error(e);
      toast.error(formatPostgrestError(e) || "No se pudieron cargar los datos.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const handleDailyReorder = useCallback(
    async (orderedIds: string[]) => {
      setSeguimientos((prev) =>
        prev.map((r) => {
          const pos = orderedIds.indexOf(r.id);
          if (pos === -1) return r;
          return { ...r, orden_diario: pos };
        })
      );
      const results = await Promise.all(
        orderedIds.map((id, i) =>
          supabase
            .from("prod_seguimiento_externos")
            .update({ orden_diario: i })
            .eq("id", id)
        )
      );
      const firstErr = results.find((r) => r.error);
      if (firstErr?.error) {
        toast.error(firstErr.error.message);
        void loadCore();
      }
    },
    [supabase, loadCore]
  );

  const handleInsertTiposBase = useCallback(async () => {
    setSaving(true);
    /** Solo columna `nombre`; `id` y `created_at` los genera la BD. */
    const rows: { nombre: string }[] = TIPOS_PROVEEDOR_BASE.map((nombre) => ({
      nombre,
    }));
    console.log("[insert tipos base] payload (solo nombre):", rows);
    const { error } = await supabase
      .from("prod_cat_tipos_proveedor")
      .insert(rows);
    setSaving(false);
    if (error) {
      console.error(
        "[insert tipos base prod_cat_tipos_proveedor]",
        error,
        JSON.stringify(error)
      );
      toast.error(
        formatPostgrestError(error) || "Error al insertar tipos (revisa RLS o permisos)."
      );
      return;
    }
    toast.success(
      "Tipos base insertados. Si ya existían filas duplicadas, revisa la tabla en Supabase."
    );
    void loadCore();
  }, [supabase, loadCore]);

  useEffect(() => {
    void loadCore();
  }, [loadCore]);

  useEffect(() => {
    if (!seguimientoSheetOpen || !seguimientoEditing) {
      setSegComunicacionLogs([]);
      setSegComunicacionLogsLoading(false);
      return;
    }
    const idPedido = seguimientoEditing.id_pedido;
    let cancelled = false;
    void (async () => {
      setSegComunicacionLogsLoading(true);
      const { data, error } = await supabase
        .from("prod_comunicacion_logs")
        .select("*")
        .contains("id_pedidos", [idPedido])
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setSegComunicacionLogsLoading(false);
      if (error) {
        console.error("[prod_comunicacion_logs]", error);
        setSegComunicacionLogs([]);
        return;
      }
      setSegComunicacionLogs((data ?? []) as ComunicacionLogRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [seguimientoSheetOpen, seguimientoEditing?.id, supabase]);

  useEffect(() => {
    if (!envProveedorId) {
      setAcabadosForm([]);
      setEnvAcabadoId("");
      return;
    }
    const prov = proveedores.find((p) => p.id === envProveedorId);
    if (!prov) {
      setAcabadosForm([]);
      setEnvAcabadoId("");
      return;
    }
    const tipoIds = resolveTipoProveedorIdsForAcabados(prov, tipos);
    if (tipoIds.length === 0) {
      setAcabadosForm([]);
      setEnvAcabadoId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("prod_cat_acabados")
        .select("id, nombre")
        .in("tipo_proveedor_id", tipoIds)
        .order("nombre");
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setAcabadosForm([]);
        setEnvAcabadoId("");
        return;
      }
      const rows = (data ?? []) as { id: string; nombre: string }[];
      const byId = new Map<string, { id: string; nombre: string }>();
      for (const r of rows) {
        if (!byId.has(r.id)) byId.set(r.id, r);
      }
      const sorted = [...byId.values()].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
      );
      setAcabadosForm(sorted);
      setEnvAcabadoId("");
    })();
    return () => {
      cancelled = true;
    };
  }, [envProveedorId, proveedores, tipos, supabase]);

  async function handleAddProveedor(e: React.FormEvent) {
    e.preventDefault();
    if (!provNombre.trim() || !provTipoId) {
      toast.error("Nombre y tipo son obligatorios.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("prod_proveedores").insert({
      nombre: provNombre.trim(),
      tipo_proveedor_id: provTipoId,
      email: provEmail.trim() || null,
      telefono: provTelefono.trim() || null,
      telf_movil: provTelfMovil.trim() || null,
      direccion: provDireccion.trim() || null,
      notas: provNotas.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Proveedor creado.");
    setProvNombre("");
    setProvTipoId("");
    setProvEmail("");
    setProvTelefono("");
    setProvTelfMovil("");
    setProvDireccion("");
    setProvNotas("");
    void loadCore();
  }

  function openEdit(p: ProveedorRow) {
    setEditing(p);
    setEditNombre(p.nombre);
    setEditTipoId(p.tipo_proveedor_id);
    setEditEmail(p.email ?? "");
    setEditTelefono(p.telefono ?? "");
    setEditTelfMovil(p.telf_movil ?? "");
    setEditDireccion(p.direccion ?? "");
    setEditNotas(p.notas ?? "");
    setEditOpen(true);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editNombre.trim() || !editTipoId) {
      toast.error("Nombre y tipo son obligatorios.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("prod_proveedores")
      .update({
        nombre: editNombre.trim(),
        tipo_proveedor_id: editTipoId,
        email: editEmail.trim() || null,
        telefono: editTelefono.trim() || null,
        telf_movil: editTelfMovil.trim() || null,
        direccion: editDireccion.trim() || null,
        notas: editNotas.trim() || null,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Proveedor actualizado.");
    setEditOpen(false);
    setEditing(null);
    void loadCore();
  }

  async function handleDeleteProveedor(p: ProveedorRow) {
    if (
      !confirm(
        `¿Eliminar el proveedor «${p.nombre}»? No podrá eliminarse si tiene envíos asociados.`
      )
    ) {
      return;
    }
    const { error } = await supabase.from("prod_proveedores").delete().eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Proveedor eliminado.");
    void loadCore();
  }

  async function handleCreateEnvio(e: React.FormEvent) {
    e.preventDefault();
    if (!proveedores.length) {
      toast.error("Primero debes dar de alta un colaborador en Proveedores.");
      setTab("proveedores");
      return;
    }
    const otRaw = normalizeOtRawToString(envIdPedido);
    const id_pedido = otRawToIdPedido(otRaw);
    if (
      !envCliente.trim() ||
      !envTrabajo.trim() ||
    /*!envPedidoCliente.trim() ||  lo quito por que no es obligatorio */
      !envProveedorId ||
      !envAcabadoId ||
      !envFecha
    ) {
      toast.error("Completa todos los campos obligatorios.");
      return;
    }
    setSaving(true);
    const { data: opRows, error: opErr } = await supabase
      .from("prod_seguimiento_externos")
      .select("num_operacion")
      .eq("OT", otRaw);
    if (opErr) {
      setSaving(false);
      toast.error(opErr.message);
      return;
    }
    const nextOp =
      Math.max(0, ...(opRows?.map((x) => x.num_operacion ?? 0) ?? [])) + 1;
    const uRaw = envUnidades.trim().replace(",", ".");
    const pRaw = envPalets.trim().replace(",", ".");
    const unidadesParsed = uRaw ? Number(uRaw) : NaN;
    const paletsParsed = pRaw ? Number(pRaw) : NaN;
    const estadoInsert = (ESTADOS_SEGUIMIENTO as readonly string[]).includes(
      envEstado
    )
      ? envEstado
      : "Pendiente";
    const fEntIso =
      envFechaEntregaOt.trim().length === 10
        ? dateInputToTimestamptz(envFechaEntregaOt.trim())
        : null;
    const { error } = await supabase.from("prod_seguimiento_externos").insert({
      id_pedido,
      OT: otRaw,
      num_operacion: nextOp,
      cliente_nombre: envCliente.trim(),
      trabajo_titulo: envTrabajo.trim(),
      pedido_cliente: envPedidoCliente.trim(),
      proveedor_id: envProveedorId,
      acabado_id: envAcabadoId,
      estado: estadoInsert,
      f_entrega_ot: fEntIso,
      dias_a_fEntOT:
        fEntIso != null ? computeDiasHastaFEntregaOt(fEntIso) : null,
      fecha_prevista: dateInputToTimestamptz(envFecha),
      notas_logistica: envNotas.trim() || null,
      unidades:
        Number.isFinite(unidadesParsed) ? Math.trunc(unidadesParsed) : null,
      prioridad: envPrioridad.trim() || null,
      palets: Number.isFinite(paletsParsed) ? Math.trunc(paletsParsed) : null,
      observaciones: envObservaciones.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Envío registrado.");
    if (envEntradaMultiple) {
      setEnvProveedorId("");
      setEnvAcabadoId("");
      setEnvEstado("Pendiente");
      void loadCore();
      return;
    }
    setEnvIdPedido("");
    setEnvCliente("");
    setEnvTrabajo("");
    setEnvPedidoCliente("");
    setEnvProveedorId("");
    setEnvAcabadoId("");
    setEnvFecha("");
    setEnvFechaEntregaOt("");
    setEnvNotas("");
    setEnvUnidades("");
    setEnvPrioridad("");
    setEnvPalets("");
    setEnvObservaciones("");
    setEnvEstado("Pendiente");
    setTab("seguimiento");
    void loadCore();
  }

  function acabadoOptionsForProveedorId(provId: string): Option[] {
    if (!provId) return emptySelect;
    const prov = proveedores.find((p) => p.id === provId);
    if (!prov) return emptySelect;
    const opts = acabadosFiltradosPorProveedor(prov, tipos, acabadosCatalogo);
    return [
      ...emptySelect,
      ...opts.map((a) => ({ value: a.id, label: a.nombre })),
    ];
  }

  const processImportFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".xlsx") && !lower.endsWith(".csv")) {
        toast.error("Solo se admiten archivos .xlsx o .csv.");
        return;
      }
      try {
        const {
          rows,
          parseWarnings,
          filasOmitidasPorEstado,
          filasLeidas,
          format,
        } = await parseExternosImportFile(file);
        if (rows.length === 0) {
          if (
            format === "optimus" &&
            filasLeidas > 0 &&
            filasOmitidasPorEstado === filasLeidas
          ) {
            toast.error(
              'Optimus: no hay filas en estados incluidos (p. ej. «En producción», «En cola», «Abierto»…).'
            );
          } else if (filasLeidas > 0) {
            toast.error(
              "No hay filas importables: revisa OTs, estados y el formato del archivo."
            );
            if (parseWarnings.length > 0) {
              toast.info(parseWarnings.slice(0, 5).join(" · "));
            }
          } else {
            toast.error(
              parseWarnings[0] ??
                "No se encontraron filas de datos en el archivo."
            );
            if (parseWarnings.length > 1) {
              toast.info(parseWarnings.slice(1, 6).join(" · "));
            }
          }
          return;
        }
        if (parseWarnings.length > 0) {
          toast.info(parseWarnings.slice(0, 5).join(" · "));
        }
        if (filasOmitidasPorEstado > 0 && format === "optimus") {
          toast.info(
            `Se han omitido ${filasOmitidasPorEstado} filas con estados no procesables (Cancelado, Terminado, etc.)`
          );
        }
        setImportPreviewRows(
          rows.map((c) => {
            let proveedor_id = "";
            let acabado_id = "";
            if (c.format === "hermano") {
              const pExcel = c.proveedor_excel?.trim() ?? "";
              const procExcel = c.proceso_excel?.trim() ?? "";
              if (pExcel) {
                proveedor_id = fuzzyMatchIdByIncludes(
                  pExcel,
                  proveedores.map((p) => ({ id: p.id, nombre: p.nombre }))
                );
              }
              const prov = proveedores.find((p) => p.id === proveedor_id);
              if (procExcel && prov) {
                const tipoIds = resolveTipoProveedorIdsForAcabados(prov, tipos);
                acabado_id = fuzzyMatchAcabadoIdByIncludes(
                  procExcel,
                  acabadosCatalogo,
                  tipoIds
                );
              }
            }
            return {
              key: crypto.randomUUID(),
              ot_raw: c.ot_raw,
              id_pedido: c.id_pedido,
              cliente: c.cliente,
              ref_cliente: c.ref_cliente,
              titulo: c.titulo,
              fecha_entrega_excel: c.fecha_entrega_excel,
              fecha_prevista: c.fecha_prevista_default || "",
              fecha_envio_default: c.fecha_envio_default,
              notas: "",
              proveedor_id,
              acabado_id,
              selected: false,
              estado_sugerido: c.estado_sugerido,
              unidades: c.unidades,
              prioridad: c.prioridad,
              palets: c.palets,
              observaciones: c.observaciones,
              importFormat: c.format,
              proveedor_excel: c.proveedor_excel,
              proceso_excel: c.proceso_excel,
            };
          })
        );
        setBulkImportProv("");
        setBulkImportAcab("");
        toast.success(
          `${rows.length} fila(s) · formato ${format === "hermano" ? "Control Externos" : "Optimus"}.`
        );
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "No se pudo leer el Excel."
        );
      }
    },
    [proveedores, acabadosCatalogo, tipos]
  );

  function setImportRowProveedor(key: string, provId: string) {
    setImportPreviewRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const prov = proveedores.find((p) => p.id === provId);
        if (!prov) return { ...r, proveedor_id: provId, acabado_id: "" };
        const opts = acabadosFiltradosPorProveedor(prov, tipos, acabadosCatalogo);
        let acab = r.acabado_id;
        if (!opts.some((o) => o.id === acab)) acab = "";
        return { ...r, proveedor_id: provId, acabado_id: acab };
      })
    );
  }

  function toggleImportSelectAllSelectable() {
    setImportPreviewRows((prev) => {
      if (prev.length === 0) return prev;
      const allSelected = prev.every((r) => r.selected);
      const nextSelect = !allSelected;
      return prev.map((r) => ({ ...r, selected: nextSelect }));
    });
  }

  function clearImportPreviewList() {
    setImportPreviewRows([]);
    setBulkImportProv("");
    setBulkImportAcab("");
  }

  function applyImportBulkAssignment() {
    if (!bulkImportProv) {
      toast.error("Elige un proveedor para la asignación masiva.");
      return;
    }
    const hasTargets = importPreviewRows.some((r) => r.selected);
    if (!hasTargets) {
      toast.error(
        "Selecciona al menos una fila importable para aplicar la asignación."
      );
      return;
    }
    setImportPreviewRows((prev) =>
      prev.map((r) => {
        if (!r.selected) return r;
        const prov = proveedores.find((p) => p.id === bulkImportProv);
        if (!prov) return r;
        const opts = acabadosFiltradosPorProveedor(prov, tipos, acabadosCatalogo);
        let acab = bulkImportAcab;
        if (!acab || !opts.some((o) => o.id === acab)) acab = "";
        return {
          ...r,
          proveedor_id: bulkImportProv,
          acabado_id: acab,
        };
      })
    );
    toast.success("Asignación aplicada a las filas seleccionadas.");
  }

  async function confirmImportSelection() {
    const seleccionadas = importPreviewRows.filter((r) => r.selected);
    if (seleccionadas.length === 0) {
      toast.error(
        "Selecciona al menos una fila importable con la casilla junto a la OT."
      );
      return;
    }
    const toInsert = seleccionadas.filter(
      (r) => r.proveedor_id && r.acabado_id
    );
    if (toInsert.length === 0) {
      toast.error(
        "En las filas seleccionadas, elige proveedor y acabado en cada fila."
      );
      return;
    }
    const sinFechaCuandoObligatoria = toInsert.filter(
      (r) =>
        ESTADOS_IMPORT_REQUIEREN_FECHA_PREVISTA.has(r.estado_sugerido) &&
        !fechaPrevistaYmdValida(r.fecha_prevista)
    );
    if (sinFechaCuandoObligatoria.length > 0) {
      toast.error(
        `Las filas en estado «Recibido» o «Muelle Minerva» requieren fecha prevista (${sinFechaCuandoObligatoria.length} fila(s)).`
      );
      return;
    }
    const otKeys = [...new Set(toInsert.map((r) => String(r.ot_raw)))];
    setSaving(true);
    const { data: existingRows, error: exErr } = await supabase
      .from("prod_seguimiento_externos")
      .select("OT, num_operacion, id_pedido")
      .in("OT", otKeys);
    if (exErr) {
      setSaving(false);
      toast.error(exErr.message);
      return;
    }
    const maxByOt = new Map<string, number>();
    for (const er of existingRows ?? []) {
      const row = er as {
        OT?: string | null;
        num_operacion?: number | null;
        id_pedido?: number;
      };
      const k = String(row.OT ?? row.id_pedido ?? "");
      if (!k) continue;
      const n = row.num_operacion ?? 0;
      maxByOt.set(k, Math.max(maxByOt.get(k) ?? 0, n));
    }
    const payload: Record<string, unknown>[] = [];
    for (const r of importPreviewRows) {
      if (!r.selected || !r.proveedor_id || !r.acabado_id) {
        continue;
      }
      if (!toInsert.some((t) => t.key === r.key)) continue;
      const otKey = String(r.ot_raw);
      const nextOp = (maxByOt.get(otKey) ?? 0) + 1;
      maxByOt.set(otKey, nextOp);
      const ymdEnv = r.fecha_envio_default?.slice?.(0, 10) ?? "";
      const fechaEnv =
        ymdEnv.length === 10 ? dateInputToTimestamptz(ymdEnv) : null;
      const fp = fechaPrevistaYmdValida(r.fecha_prevista)
        ? dateInputToTimestamptz(r.fecha_prevista.trim())
        : null;
      payload.push({
        id_pedido: r.id_pedido,
        OT: otKey,
        num_operacion: nextOp,
        cliente_nombre: r.cliente,
        trabajo_titulo: r.titulo,
        pedido_cliente: r.ref_cliente,
        proveedor_id: r.proveedor_id,
        acabado_id: r.acabado_id,
        estado: r.estado_sugerido,
        fecha_prevista: fp,
        fecha_envio: fechaEnv,
        notas_logistica: r.notas.trim() || null,
        unidades: r.unidades,
        prioridad: r.prioridad,
        palets: r.palets,
        observaciones: r.observaciones?.trim() || null,
      });
    }
    const { error } = await supabase
      .from("prod_seguimiento_externos")
      .insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `Se han importado ${payload.length} trabajos correctamente a Seguimiento`
    );
    const importedKeys = new Set(toInsert.map((r) => r.key));
    const remainingAfter = importPreviewRows.filter(
      (r) => !importedKeys.has(r.key)
    ).length;
    setImportPreviewRows((prev) => prev.filter((r) => !importedKeys.has(r.key)));
    if (remainingAfter === 0) {
      setBulkImportProv("");
      setBulkImportAcab("");
      setTab("seguimiento");
    }
    void loadCore();
  }

  const exportSeguimientoExcel = useCallback(() => {
    const rows = seguimientosFiltrados.map((r) => {
      const sem = computeSemaforo(r);
      const dias = computeDiasEnExternoUi(r.fecha_envio, r.fecha_prevista);
      return {
        Semáforo: sem.excelLabel,
        OT: getOtDisplay(r),
        Op: r.num_operacion ?? "",
        Unidades: r.unidades ?? "",
        Prioridad: r.prioridad ?? "",
        "Días externo": dias ?? "",
        Cliente: r.cliente_nombre,
        Trabajo: r.trabajo_titulo,
        "F. entrega OT": r.f_entrega_ot
          ? formatFechaEsCorta(r.f_entrega_ot)
          : "",
        "Pedido cliente": r.pedido_cliente,
        Proveedor: proveedorNombreById.get(r.proveedor_id) ?? "",
        Acabado: acabadoNombreById.get(r.acabado_id) ?? "",
        Estado: r.estado,
        "Fecha envío": r.fecha_envio ? formatFechaEsCorta(r.fecha_envio) : "",
        "Fecha prevista": r.fecha_prevista
          ? formatFechaEsCorta(r.fecha_prevista)
          : "",
        Palets: r.palets ?? "",
        Alta: formatFechaEsCorta(r.created_at),
        Modif: formatFechaEsCorta(
          r.updated_at != null && r.updated_at !== ""
            ? r.updated_at
            : r.created_at
        ),
        Notas: r.notas_logistica ?? "",
        Observaciones: r.observaciones ?? "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Externos");
    const name = `gestion-externos-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, name);
    toast.success("Excel descargado (vista filtrada actual).");
  }, [seguimientosFiltrados, proveedorNombreById, acabadoNombreById]);

  async function updateEstado(row: SeguimientoRow, nuevo: string) {
    const now = new Date().toISOString();
    const patch: Record<string, string> = {
      estado: nuevo,
      updated_at: now,
    };
    if (nuevo === "Enviado" && row.estado !== "Enviado") {
      patch.fecha_envio = now;
    }
    setSaving(true);
    const { error } = await supabase
      .from("prod_seguimiento_externos")
      .update(patch)
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Estado actualizado.");
    void loadCore();
  }

  async function updateSeguimientoFecha(
    row: SeguimientoRow,
    field: "fecha_envio" | "fecha_prevista" | "f_entrega_ot",
    ymd: string
  ) {
    const currentIso =
      field === "fecha_envio"
        ? row.fecha_envio
        : field === "fecha_prevista"
          ? row.fecha_prevista
          : row.f_entrega_ot;
    const prevYmd = isoToDateInput(currentIso);
    if (ymd === prevYmd) return;

    const now = new Date().toISOString();
    const patch: Record<string, string | number | null> = { updated_at: now };
    if (ymd.trim().length === 10) {
      const iso = dateInputToTimestamptz(ymd.trim());
      patch[field] = iso;
      if (field === "f_entrega_ot") {
        patch.dias_a_fEntOT = computeDiasHastaFEntregaOt(iso);
      }
    } else {
      patch[field] = null;
      if (field === "f_entrega_ot") {
        patch.dias_a_fEntOT = null;
      }
    }

    setSaving(true);
    const { error } = await supabase
      .from("prod_seguimiento_externos")
      .update(patch)
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      void loadCore();
      return;
    }
    void loadCore();
  }

  function openSeguimientoEdit(row: SeguimientoRow) {
    setSeguimientoEditing(row);
    setEditSegCliente(row.cliente_nombre ?? "");
    setEditSegTrabajo(row.trabajo_titulo ?? "");
    setEditSegProveedorId(row.proveedor_id);
    setEditSegAcabadoId(row.acabado_id);
    setEditSegFecha(isoToDateInput(row.fecha_prevista));
    setEditSegFechaEntregaOt(isoToDateInput(row.f_entrega_ot));
    setEditSegNotas(row.notas_logistica ?? "");
    setEditSegObservaciones(row.observaciones ?? "");
    setEditSegUnidades(
      row.unidades != null && row.unidades !== undefined
        ? String(row.unidades)
        : ""
    );
    setEditSegPrioridad(row.prioridad ?? "");
    setEditSegPalets(
      row.palets != null && row.palets !== undefined ? String(row.palets) : ""
    );
    setEditSegFechaEnvio(isoToDateInput(row.fecha_envio));
    setEditSegEstado(row.estado ?? "");
    setSeguimientoSheetOpen(true);
  }

  async function handleUpdateSeguimiento(e: React.FormEvent) {
    e.preventDefault();
    if (!seguimientoEditing) return;
    if (!editSegCliente.trim() || !editSegTrabajo.trim()) {
      toast.error("Cliente y trabajo son obligatorios.");
      return;
    }
    if (!editSegProveedorId || !editSegAcabadoId || !editSegFecha) {
      toast.error("Proveedor, acabado y fecha prevista son obligatorios.");
      return;
    }
    const prov = proveedores.find((p) => p.id === editSegProveedorId);
    if (!prov) {
      toast.error("Proveedor no válido.");
      return;
    }
    const acabOk = acabadosFiltradosPorProveedor(
      prov,
      tipos,
      acabadosCatalogo
    ).some((a) => a.id === editSegAcabadoId);
    if (!acabOk) {
      toast.error("El acabado no corresponde al tipo del proveedor.");
      return;
    }
    if (
      !editSegEstado ||
      !(ESTADOS_SEGUIMIENTO as readonly string[]).includes(editSegEstado)
    ) {
      toast.error("Elige un estado válido.");
      return;
    }
    const now = new Date().toISOString();
    const uStr = editSegUnidades.trim().replace(",", ".");
    const palStr = editSegPalets.trim().replace(",", ".");
    const unidadesNum = uStr ? Number(uStr) : NaN;
    const paletsNum = palStr ? Number(palStr) : NaN;
    let fechaEnvioPatch: string | null =
      editSegFechaEnvio.length === 10
        ? dateInputToTimestamptz(editSegFechaEnvio)
        : null;
    if (
      editSegEstado === "Enviado" &&
      seguimientoEditing.estado !== "Enviado"
    ) {
      fechaEnvioPatch = now;
    }
    const fEntPatchIso =
      editSegFechaEntregaOt.trim().length === 10
        ? dateInputToTimestamptz(editSegFechaEntregaOt.trim())
        : null;
    const patch: Record<string, string | number | null> = {
      cliente_nombre: editSegCliente.trim(),
      trabajo_titulo: editSegTrabajo.trim(),
      proveedor_id: editSegProveedorId,
      acabado_id: editSegAcabadoId,
      f_entrega_ot: fEntPatchIso,
      dias_a_fEntOT:
        fEntPatchIso != null
          ? computeDiasHastaFEntregaOt(fEntPatchIso)
          : null,
      fecha_prevista: dateInputToTimestamptz(editSegFecha),
      fecha_envio: fechaEnvioPatch,
      estado: editSegEstado,
      notas_logistica: editSegNotas.trim() || null,
      observaciones: editSegObservaciones.trim() || null,
      prioridad: editSegPrioridad.trim() || null,
      unidades: Number.isFinite(unidadesNum) ? Math.trunc(unidadesNum) : null,
      palets: Number.isFinite(paletsNum) ? Math.trunc(paletsNum) : null,
      updated_at: now,
    };
    setSaving(true);
    const { error } = await supabase
      .from("prod_seguimiento_externos")
      .update(patch)
      .eq("id", seguimientoEditing.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Envío actualizado correctamente.");
    setSeguimientoSheetOpen(false);
    setSeguimientoEditing(null);
    void loadCore();
  }

  async function handleDeleteSeguimiento() {
    if (!seguimientoEditing) return;
    const rowId = seguimientoEditing.id;
    if (
      !confirm(
        "¿Estás seguro de que quieres eliminar este registro?"
      )
    ) {
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("prod_seguimiento_externos")
      .delete()
      .eq("id", rowId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Registro eliminado.");
    setSeguimientoSheetOpen(false);
    setSeguimientoEditing(null);
    setSelectedSeguimientoIds((prev) => prev.filter((id) => id !== rowId));
    void loadCore();
  }

  function toggleSeguimientoSelected(id: string, checked: boolean) {
    setSelectedSeguimientoIds((prev) =>
      checked
        ? prev.includes(id)
          ? prev
          : [...prev, id]
        : prev.filter((x) => x !== id)
    );
  }

  function toggleSelectAllSeguimientoFiltrados(checked: boolean) {
    if (checked) {
      setSelectedSeguimientoIds((prev) => {
        const set = new Set(prev);
        seguimientosFiltrados.forEach((r) => set.add(r.id));
        return Array.from(set);
      });
    } else {
      const inView = new Set(seguimientosFiltrados.map((r) => r.id));
      setSelectedSeguimientoIds((prev) => prev.filter((id) => !inView.has(id)));
    }
  }

  async function handleComunicacionFinalizar() {
    if (!prepararEnvioEnabled || seleccionSeguimientoRows.length === 0) return;
    const rows = [...seleccionSeguimientoRows].sort(compareSeguimientoRows);
    const prov = proveedores.find((p) => p.id === rows[0].proveedor_id);
    const email = prov?.email?.trim() ?? "";
    const body = buildComunicacionEmailBody(
      rows,
      acabadoNombreById,
      prov?.nombre ?? ""
    );
    const ots = rows.map((r) => r.id_pedido);
    const subject = `Envío de trabajos Minerva - OTs: ${ots.join(", ")}`;
    const now = new Date().toISOString();
    const ids = rows.map((r) => r.id);
    setSaving(true);
    const { error: upErr } = await supabase
      .from("prod_seguimiento_externos")
      .update({
        estado: "Muelle Minerva",
        fecha_envio: now,
        updated_at: now,
      })
      .in("id", ids);
    if (upErr) {
      setSaving(false);
      toast.error(upErr.message);
      return;
    }
    const { error: logErr } = await supabase.from("prod_comunicacion_logs").insert({
      proveedor_id: rows[0].proveedor_id,
      cuerpo: body,
      id_pedidos: ots,
    });
    if (logErr) {
      console.error("[prod_comunicacion_logs]", logErr);
      toast.warning(
        `Estado actualizado, pero no se guardó el historial: ${logErr.message}`
      );
    }
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setComunicacionModalOpen(false);
    setSelectedSeguimientoIds([]);
    setSaving(false);
    toast.success("Envío registrado. Se abrió Gmail en una pestaña nueva.");
    void loadCore();
  }

  const tabTriggerClass =
    "flex h-full min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs data-active:bg-[#C69C2B]/20 data-active:font-semibold data-active:text-[#002147] data-active:shadow-sm data-active:ring-2 data-active:ring-[#C69C2B]/45 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm";

  return (
    <TooltipProvider>
    <div className="w-full min-w-0 max-w-[100vw] space-y-3 overflow-x-hidden">
      <header className="externos-plan-print-hide mb-0">
        <h1 className="font-heading text-xl font-bold leading-tight text-[#002147] md:text-2xl">
          Gestión de Externos
        </h1>
        <p
          className="mt-0.5 max-w-full truncate text-xs text-slate-600 sm:max-w-3xl"
          title="Seguimiento de trabajos fuera, directorio de colaboradores y catálogo de acabados · www.minervaglobal.es"
        >
          Seguimiento de trabajos fuera, directorio de colaboradores y catálogo
          de acabados ·{" "}
          <span className="font-medium text-[#002147]">www.minervaglobal.es</span>
        </p>
      </header>

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="w-full min-w-0 max-w-full overflow-x-hidden"
      >
        <div className="externos-plan-print-hide mb-2 flex w-full justify-start sm:mb-3">
          <TabsList className="box-border inline-flex h-auto min-h-9 w-fit max-w-full flex-wrap items-stretch gap-0 rounded-lg border border-slate-200/90 bg-slate-50/90 p-1 shadow-sm">
            <TabsTrigger value="seguimiento" className={tabTriggerClass}>
              <PackageSearch className="size-4 shrink-0 opacity-90" aria-hidden />
              Seguimiento
            </TabsTrigger>
            <TabsTrigger value="generar-envio" className={tabTriggerClass}>
              <FileOutput className="size-4 shrink-0 opacity-90" aria-hidden />
              Generar Envío OT
            </TabsTrigger>
            <TabsTrigger value="proveedores" className={tabTriggerClass}>
              <Factory className="size-4 shrink-0 opacity-90" aria-hidden />
              Proveedores
            </TabsTrigger>
            <TabsTrigger value="config" className={tabTriggerClass}>
              <Settings2 className="size-4 shrink-0 opacity-90" aria-hidden />
              Configuración
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="seguimiento" className="mt-0 space-y-3 outline-none">
          {!proveedores.length && !loading ? (
            <Alert className="border-amber-200 bg-amber-50/90 text-amber-950">
              <AlertTitle>Sin colaboradores</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Para registrar envíos externos, primero debes dar de alta un
                  colaborador en la pestaña Proveedores.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-amber-300"
                  onClick={() => setTab("proveedores")}
                >
                  Ir a Proveedores
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <Card
            size="sm"
            className="max-w-full min-w-0 overflow-x-hidden border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm print:border-0 print:shadow-none"
          >
            <CardHeader className="externos-plan-print-hide min-w-0 space-y-2 pb-2 pt-0">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <CardTitle className="text-base leading-tight text-[#002147]">
                    Trabajos fuera (seguimiento)
                  </CardTitle>
                  <CardDescription
                    className="line-clamp-1 text-xs leading-snug"
                    title="Por defecto no se listan trabajos «Recibido». Usa «Ver Histórico» para incluirlos. Cambia el estado desde la tabla al instante; el lápiz abre el panel para proveedor, acabado, fecha prevista y notas. Al pasar a «Enviado» se registra la fecha de envío. Tras «Preparar Envío» (correo), las OT pasan a «Muelle Minerva»."
                  >
                    Por defecto no se listan trabajos «Recibido». Usa «Ver
                    Histórico» para incluirlos. Cambia el estado desde la tabla
                    al instante; el lápiz abre el panel para proveedor, acabado,
                    fecha prevista y notas. Al pasar a «Enviado» se registra la
                    fecha de envío. Tras «Preparar Envío» (correo), las OT pasan a
                    «Muelle Minerva».
                  </CardDescription>
                </div>
                <ToggleGroup
                  variant="outline"
                  size="sm"
                  spacing={0}
                  className="w-full shrink-0 justify-end sm:w-auto"
                  value={
                    seguimientoVista === "lista"
                      ? ["lista"]
                      : seguimientoVista === "semanal"
                        ? ["semanal"]
                        : ["diaria"]
                  }
                  onValueChange={(v) => {
                    const next = v[0];
                    if (
                      next == null ||
                      (next !== "lista" &&
                        next !== "semanal" &&
                        next !== "diaria")
                    ) {
                      return;
                    }
                    setSeguimientoVista((prev) => {
                      if (next === "diaria" && prev !== "diaria") {
                        setPlanCursor(startOfDay(new Date()));
                      } else if (next === "semanal" && prev !== "semanal") {
                        setPlanCursor(
                          startOfWeek(new Date(), { weekStartsOn: 1 })
                        );
                      }
                      return next;
                    });
                  }}
                  aria-label="Vista de seguimiento"
                >
                  <ToggleGroupItem value="lista" className="gap-1 px-2.5">
                    <List className="size-3.5 opacity-80" aria-hidden />
                    Lista
                  </ToggleGroupItem>
                  <ToggleGroupItem value="semanal" className="gap-1 px-2.5">
                    <CalendarDays className="size-3.5 opacity-80" aria-hidden />
                    Tablero semanal
                  </ToggleGroupItem>
                  <ToggleGroupItem value="diaria" className="gap-1 px-2.5">
                    <LayoutGrid className="size-3.5 opacity-80" aria-hidden />
                    Cuadrícula diaria
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="hidden flex-wrap items-end gap-x-4 gap-y-2.5 md:flex">
                <div className="w-[12rem] min-w-[11rem] shrink-0">
                  <NativeSelect
                    label="Estado"
                    options={estadoFiltroOptions}
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                  />
                </div>
                <div className="w-[13rem] min-w-[12rem] shrink-0">
                  <NativeSelect
                    label="Proveedor"
                    options={proveedorFiltroOptions}
                    value={filtroProveedorId}
                    onChange={(e) => setFiltroProveedorId(e.target.value)}
                  />
                </div>
                <div className="grid w-full max-w-sm min-w-0 shrink gap-1.5">
                  <Label htmlFor="busq-seg">Buscar (OT, cliente, pedido, trabajo)</Label>
                  <Input
                    id="busq-seg"
                    placeholder="Ej. 24001 o nombre"
                    value={busquedaSeguimiento}
                    onChange={(e) => setBusquedaSeguimiento(e.target.value)}
                    className="h-9 w-full max-w-sm"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Histórico
                  </span>
                  <Toggle
                    variant="outline"
                    size="sm"
                    pressed={verHistorial}
                    onPressedChange={setVerHistorial}
                    className="h-9 w-auto shrink-0 justify-start gap-2 px-3"
                    aria-label="Ver histórico incluyendo trabajos recibidos"
                  >
                    <History className="size-4 shrink-0 opacity-80" aria-hidden />
                    Ver Histórico
                  </Toggle>
                </div>
                <div className="flex flex-wrap items-center gap-2 pb-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || !prepararEnvioEnabled}
                    title={
                      !prepararEnvioEnabled
                        ? seleccionSeguimientoRows.length === 0
                          ? "Selecciona una o más OTs en la tabla"
                          : "Las OTs seleccionadas deben tener el mismo proveedor"
                        : "Preparar borrador de correo y registrar envío"
                    }
                    onClick={() => setComunicacionModalOpen(true)}
                  >
                    <Mail className="mr-1.5 size-4" aria-hidden />
                    Preparar Envío
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || seguimientosFiltrados.length === 0}
                    onClick={exportSeguimientoExcel}
                  >
                    <FileSpreadsheet className="mr-1.5 size-4" aria-hidden />
                    Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || seguimientosFiltrados.length === 0}
                    title="Imprimir listado (PDF)"
                    onClick={() => void handlePrintListado()}
                  >
                    <Printer className="mr-1.5 size-4" aria-hidden />
                    PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="shrink-0 border-[#002147]/15"
                    disabled={loading || seguimientosFiltrados.length === 0}
                    title="Analista de Producción Minerva"
                    aria-label="Abrir Analista de Producción Minerva"
                    onClick={() => {
                      setAnalistaOpen(true);
                      setAnalistaError(null);
                      setAnalistaText("");
                      setAnalistaPregunta("");
                    }}
                  >
                    <Sparkles className="size-4 text-[#002147]/80" aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-2 md:hidden">
                <NativeSelect
                  label="Estado"
                  options={estadoFiltroOptions}
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="min-h-11 text-base"
                />
                <NativeSelect
                  label="Proveedor"
                  options={proveedorFiltroOptions}
                  value={filtroProveedorId}
                  onChange={(e) => setFiltroProveedorId(e.target.value)}
                  className="min-h-11 text-base"
                />
                <div className="grid min-w-0 max-w-sm gap-1.5">
                  <Label htmlFor="busq-seg-m">Buscar (OT, cliente, pedido, trabajo)</Label>
                  <Input
                    id="busq-seg-m"
                    placeholder="Ej. 24001 o nombre"
                    value={busquedaSeguimiento}
                    onChange={(e) => setBusquedaSeguimiento(e.target.value)}
                    className="min-h-11 w-full max-w-sm touch-manipulation text-base"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Histórico
                  </span>
                  <Toggle
                    variant="outline"
                    pressed={verHistorial}
                    onPressedChange={setVerHistorial}
                    className="h-9 w-auto min-w-0 self-start touch-manipulation justify-start gap-2 px-3"
                    aria-label="Ver histórico incluyendo trabajos recibidos"
                  >
                    <History className="size-4 shrink-0 opacity-80" aria-hidden />
                    Ver Histórico
                  </Toggle>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || !prepararEnvioEnabled}
                    title={
                      !prepararEnvioEnabled
                        ? seleccionSeguimientoRows.length === 0
                          ? "Selecciona una o más OTs en la tabla"
                          : "Las OTs seleccionadas deben tener el mismo proveedor"
                        : "Preparar borrador de correo y registrar envío"
                    }
                    onClick={() => setComunicacionModalOpen(true)}
                  >
                    <Mail className="mr-1.5 size-4" aria-hidden />
                    Preparar Envío
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || seguimientosFiltrados.length === 0}
                    onClick={exportSeguimientoExcel}
                  >
                    <FileSpreadsheet className="mr-1.5 size-4" aria-hidden />
                    Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || seguimientosFiltrados.length === 0}
                    title="Imprimir listado (PDF)"
                    onClick={() => void handlePrintListado()}
                  >
                    <Printer className="mr-1.5 size-4" aria-hidden />
                    PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="shrink-0 border-[#002147]/15"
                    disabled={loading || seguimientosFiltrados.length === 0}
                    title="Analista de Producción Minerva"
                    aria-label="Abrir Analista de Producción Minerva"
                    onClick={() => {
                      setAnalistaOpen(true);
                      setAnalistaError(null);
                      setAnalistaText("");
                      setAnalistaPregunta("");
                    }}
                  >
                    <Sparkles className="size-4 text-[#002147]/80" aria-hidden />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="mt-0 p-0 sm:px-4 sm:pb-4 sm:pt-2">
              {loading ? (
                <p className="px-4 py-3 text-sm text-muted-foreground sm:px-4">
                  Cargando…
                </p>
              ) : seguimientosFiltrados.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground sm:px-4">
                  No hay registros que coincidan con los filtros.
                </p>
              ) : (
                <>
                {seguimientoVista === "lista" ? (
                <>
                <div className="hidden max-h-[min(78vh,56rem)] w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-slate-200/80 sm:rounded-xl md:block">
                  <table className="hidden w-full min-w-[144rem] caption-bottom border-collapse text-xs md:table">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="sticky top-0 z-30 w-8 bg-slate-50/95 px-0.5 py-1 text-center font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          <input
                            ref={seguimientoMasterCheckboxRef}
                            type="checkbox"
                            className="size-3.5 rounded border"
                            checked={seguimientoSelectionStats.allInViewSelected}
                            disabled={seguimientoSelectionStats.n === 0}
                            onChange={(e) =>
                              toggleSelectAllSeguimientoFiltrados(
                                e.target.checked
                              )
                            }
                            title="Seleccionar o quitar todas las OTs visibles"
                            aria-label="Seleccionar todas las OTs visibles en la tabla"
                          />
                        </th>
                        <th className="sticky top-0 z-30 w-10 bg-slate-50/95 px-0.5 py-1 text-center font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Ed.
                        </th>
                        <th className="sticky top-0 z-30 w-9 bg-slate-50/95 px-0.5 py-1 text-center font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Sem.
                        </th>
                        <th className="sticky top-0 z-30 w-[4.5rem] min-w-[4.25rem] max-w-[6rem] bg-slate-50/95 px-0.5 py-1 text-left font-medium whitespace-nowrap text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          OT
                        </th>
                        <th className="sticky top-0 z-30 w-8 bg-slate-50/95 px-0.5 py-1 text-center font-medium tabular-nums text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Op
                        </th>
                        <th className="sticky top-0 z-30 w-10 bg-slate-50/95 px-0.5 py-1 text-center font-medium tabular-nums text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Ud.
                        </th>
                        <th className="sticky top-0 z-30 w-16 bg-slate-50/95 px-0.5 py-1 text-left font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Prio.
                        </th>
                        <th className="sticky top-0 z-30 w-8 bg-slate-50/95 px-0.5 py-1 text-center font-medium tabular-nums text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Días
                        </th>
                        <th className="sticky top-0 z-30 w-[7.5rem] min-w-[6rem] max-w-[8rem] bg-slate-50/95 px-1 py-1 text-left font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Cliente
                        </th>
                        <th className="sticky top-0 z-30 w-[10rem] min-w-[8rem] max-w-[11rem] bg-slate-50/95 px-1 py-1 text-left font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Trabajo
                        </th>
                        <th
                          className="sticky top-0 z-30 w-[9rem] min-w-[8.5rem] max-w-[10rem] bg-slate-50/95 py-1 pr-4 pl-0.5 text-center font-medium whitespace-nowrap text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95"
                          title="Fecha entrega final pactada (OT)"
                        >
                          F. ent. OT
                        </th>
                        <th className="sticky top-0 z-30 min-w-[7.5rem] max-w-[9rem] bg-slate-50/95 px-1 py-1 pl-3 text-left font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Prov.
                        </th>
                        <th className="sticky top-0 z-30 min-w-[6.5rem] bg-slate-50/95 px-1 py-1 text-left font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Acab.
                        </th>
                        <th className="sticky top-0 z-30 w-24 min-w-24 max-w-24 bg-slate-50/95 px-0.5 py-1 text-left font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Estado
                        </th>
                        <th className="sticky top-0 z-30 w-[7rem] min-w-[6.5rem] max-w-[7.5rem] bg-slate-50/95 px-0.5 py-1 text-center font-medium whitespace-nowrap text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Env.
                        </th>
                        <th className="sticky top-0 z-30 w-[7rem] min-w-[6.5rem] max-w-[7.5rem] bg-slate-50/95 px-0.5 py-1 text-center font-medium whitespace-nowrap text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Prev.
                        </th>
                        <th
                          className="sticky top-0 z-30 w-7 bg-slate-50/95 px-0.5 py-1 text-center font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95"
                          title="Material (compra)"
                        >
                          M
                        </th>
                        <th className="sticky top-0 z-30 w-8 bg-slate-50/95 px-0.5 py-1 text-center font-medium tabular-nums text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Pal.
                        </th>
                        <th className="sticky top-0 z-30 min-w-[12rem] max-w-[16rem] bg-slate-50/95 px-1 py-1 text-left font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Notas log.
                        </th>
                        <th className="sticky top-0 z-30 min-w-[12rem] max-w-[16rem] bg-slate-50/95 px-1 py-1 text-left font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Obs. taller
                        </th>
                        <th className="sticky top-0 z-30 w-[4.5rem] min-w-[4.5rem] bg-slate-50/95 px-0.5 py-1 text-center font-medium whitespace-nowrap tabular-nums text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Alta
                        </th>
                        <th className="sticky top-0 z-30 w-[4.5rem] min-w-[4.5rem] bg-slate-50/95 px-0.5 py-1 text-center font-medium whitespace-nowrap tabular-nums text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Mod.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {seguimientosFiltrados.map((row) => {
                        const retraso = isEnvioRetrasado(
                          row.fecha_prevista,
                          row.estado
                        );
                        const recibido = row.estado === "Recibido";
                        const diasUi = computeDiasEnExternoUi(
                          row.fecha_envio,
                          row.fecha_prevista
                        );
                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              "border-border border-b transition-colors hover:bg-muted/50",
                              recibido &&
                                "bg-slate-100/90 text-slate-800 dark:bg-slate-800/50 dark:text-slate-200",
                              !recibido &&
                                retraso &&
                                "bg-red-50/90 dark:bg-red-950/30"
                            )}
                          >
                            <td className="w-8 px-0.5 py-0.5 text-center align-middle">
                              <input
                                type="checkbox"
                                className="size-3.5 rounded border"
                                checked={selectedSeguimientoIds.includes(row.id)}
                                onChange={(e) =>
                                  toggleSeguimientoSelected(
                                    row.id,
                                    e.target.checked
                                  )
                                }
                                aria-label={`Seleccionar OT ${getOtDisplay(row)}`}
                              />
                            </td>
                            <td className="w-10 p-0.5 text-center align-middle">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-7 shrink-0"
                                onClick={() => openSeguimientoEdit(row)}
                                aria-label={`Editar OT ${getOtDisplay(row)}`}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </td>
                            <td className="w-9 px-0.5 py-0.5 text-center align-middle">
                              <SemaforoCell row={row} />
                            </td>
                            <td className="w-[4.5rem] min-w-[4.25rem] max-w-[6rem] px-0.5 py-0.5 align-middle">
                              <OtNumeroSemaforoBadge
                                otNumero={getOtDisplay(row)}
                                fechaEntregaIso={row.f_entrega_ot}
                                umbrales={umbralesOtsCompras}
                              />
                            </td>
                            <td className="w-8 px-0.5 py-0.5 text-center tabular-nums">
                              {row.num_operacion ?? "—"}
                            </td>
                            <td className="w-10 px-0.5 py-0.5 text-center tabular-nums">
                              {row.unidades != null ? row.unidades : "—"}
                            </td>
                            <td className="w-16 truncate px-0.5 py-0.5">
                              {row.prioridad?.trim()
                                ? row.prioridad
                                : "—"}
                            </td>
                            <td className="w-8 px-0.5 py-0.5 text-center tabular-nums">
                              {diasUi != null ? diasUi : "—"}
                            </td>
                            <td className="w-[7.5rem] min-w-[6rem] max-w-[8rem] truncate px-1 py-0.5 leading-tight">
                              {row.cliente_nombre}
                            </td>
                            <td className="w-[10rem] min-w-[8rem] max-w-[11rem] px-1 py-0.5 align-top leading-tight">
                              <span
                                className="line-clamp-2 max-w-full break-words whitespace-normal"
                                title={row.trabajo_titulo}
                              >
                                {row.trabajo_titulo}
                              </span>
                            </td>
                            <td className="w-[9rem] min-w-[8.5rem] max-w-[10rem] py-0.5 pr-4 pl-0.5 align-middle">
                              <FEntregaOtTableCell
                                row={row}
                                saving={saving}
                                onCommit={(ymd) =>
                                  void updateSeguimientoFecha(
                                    row,
                                    "f_entrega_ot",
                                    ymd
                                  )
                                }
                              />
                            </td>
                            <td className="max-w-[8.5rem] min-w-[7.5rem] truncate py-0.5 pl-2">
                              {proveedorNombreById.get(row.proveedor_id) ?? "—"}
                            </td>
                            <td className="max-w-[7rem] truncate py-0.5">
                              {acabadoNombreById.get(row.acabado_id) ?? "—"}
                            </td>
                            <td className="w-24 max-w-24 py-0.5 align-middle">
                              <NativeSelect
                                label=""
                                options={estadoRapidoOptions}
                                value={row.estado}
                                onChange={(e) =>
                                  void updateEstado(row, e.target.value)
                                }
                                disabled={saving}
                                className="h-7 min-h-7 w-24 min-w-0 max-w-24 shrink-0 px-0.5 py-0 text-[10px] leading-tight"
                                aria-label={`Estado OT ${getOtDisplay(row)}`}
                              />
                            </td>
                            <td className="w-[7rem] min-w-[6.5rem] max-w-[7.5rem] px-0.5 py-0.5 align-middle">
                              <InlineFechaSeguimientoCell
                                rowId={row.id}
                                isoValue={row.fecha_envio}
                                disabled={saving}
                                ariaLabel={`Fecha envío OT ${getOtDisplay(row)}`}
                                onCommit={(ymd) =>
                                  void updateSeguimientoFecha(
                                    row,
                                    "fecha_envio",
                                    ymd
                                  )
                                }
                              />
                            </td>
                            <td className="w-[7rem] min-w-[6.5rem] max-w-[7.5rem] px-0.5 py-0.5 align-middle">
                              <InlineFechaSeguimientoCell
                                rowId={row.id}
                                isoValue={row.fecha_prevista}
                                disabled={saving}
                                ariaLabel={`Fecha prevista OT ${getOtDisplay(row)}`}
                                onCommit={(ymd) =>
                                  void updateSeguimientoFecha(
                                    row,
                                    "fecha_prevista",
                                    ymd
                                  )
                                }
                              />
                            </td>
                            <td className="w-7 px-0.5 py-0.5 text-center align-middle">
                              <MaterialCompraColumnCell
                                info={lookupCompraMaterialStatus(compraMaterialByOt, getOtDisplay(row))}
                                loading={loading}
                              />
                            </td>
                            <td className="w-8 px-0.5 py-0.5 text-center tabular-nums">
                              {row.palets != null ? row.palets : "—"}
                            </td>
                            <td className="min-w-[12rem] max-w-[16rem] py-0.5 align-top text-muted-foreground">
                              <NotasTablaCelda texto={row.notas_logistica} />
                            </td>
                            <td className="min-w-[12rem] max-w-[16rem] py-0.5 align-top text-muted-foreground">
                              <NotasTablaCelda texto={row.observaciones} />
                            </td>
                            <td className="w-[4.5rem] min-w-[4.5rem] px-0.5 py-0.5 text-center align-middle tabular-nums leading-tight">
                              {formatFechaEsCorta(row.created_at)}
                            </td>
                            <td className="w-[4.5rem] min-w-[4.5rem] px-0.5 py-0.5 text-center align-middle tabular-nums leading-tight">
                              {formatFechaEsCorta(
                                row.updated_at != null && row.updated_at !== ""
                                  ? row.updated_at
                                  : row.created_at
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="grid min-w-0 grid-cols-1 gap-3 px-3 pb-6 pt-2 min-[520px]:grid-cols-2 md:hidden">
                  {seguimientosFiltrados.map((row) => {
                    const retraso = isEnvioRetrasado(
                      row.fecha_prevista,
                      row.estado
                    );
                    const recibido = row.estado === "Recibido";
                    const diasUi = computeDiasEnExternoUi(
                      row.fecha_envio,
                      row.fecha_prevista
                    );
                    return (
                      <Card
                        key={row.id}
                        className={cn(
                          "min-w-0 overflow-hidden border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-200/60",
                          recibido &&
                            "bg-slate-100/90 text-slate-800 dark:bg-slate-800/50 dark:text-slate-200",
                          !recibido &&
                            retraso &&
                            "border-red-200/80 bg-red-50/90 dark:bg-red-950/30"
                        )}
                      >
                        <CardHeader className="space-y-3 pb-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <OtNumeroSemaforoBadge
                                  otNumero={getOtDisplay(row)}
                                  fechaEntregaIso={row.f_entrega_ot}
                                  umbrales={umbralesOtsCompras}
                                />
                                <span className="text-sm font-normal tabular-nums text-muted-foreground">
                                  · Op {row.num_operacion ?? "—"}
                                </span>
                              </div>
                              <p className="text-base font-normal leading-snug text-[#002147]">
                                {row.cliente_nombre?.trim() || "—"}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-start gap-2 pt-0.5">
                              <input
                                type="checkbox"
                                className="size-5 touch-manipulation rounded border"
                                checked={selectedSeguimientoIds.includes(row.id)}
                                onChange={(e) =>
                                  toggleSeguimientoSelected(
                                    row.id,
                                    e.target.checked
                                  )
                                }
                                aria-label={`Seleccionar OT ${getOtDisplay(row)}`}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-11 shrink-0 touch-manipulation"
                                onClick={() => openSeguimientoEdit(row)}
                                aria-label={`Editar OT ${getOtDisplay(row)}`}
                              >
                                <Pencil className="size-5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <SemaforoCell row={row} />
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                  M
                                </span>
                                <MaterialCompraColumnCell
                                  info={lookupCompraMaterialStatus(compraMaterialByOt, getOtDisplay(row))}
                                  loading={loading}
                                />
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Ud. {row.unidades != null ? row.unidades : "—"} · Pal.{" "}
                              {row.palets != null ? row.palets : "—"}
                              {diasUi != null ? ` · ${diasUi} días` : ""}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="min-w-0 space-y-4 pt-0">
                          <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                            <p>
                              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Trabajo
                              </span>
                              <br />
                              <span className="text-foreground/90">
                                {row.trabajo_titulo?.trim() || "—"}
                              </span>
                            </p>
                            <p>
                              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Proveedor
                              </span>
                              <br />
                              {proveedorNombreById.get(row.proveedor_id) ?? "—"}
                            </p>
                            <p>
                              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                Acabado
                              </span>
                              <br />
                              {acabadoNombreById.get(row.acabado_id) ?? "—"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-[#002147]">
                              Estado
                            </Label>
                            <NativeSelect
                              label=""
                              options={estadoRapidoOptions}
                              value={row.estado}
                              onChange={(e) =>
                                void updateEstado(row, e.target.value)
                              }
                              disabled={saving}
                              className="min-h-12 min-w-0 w-full max-w-none text-base"
                              aria-label={`Estado OT ${getOtDisplay(row)}`}
                            />
                          </div>
                          <div className="grid min-w-0 grid-cols-1 gap-4 min-[480px]:grid-cols-2 min-[680px]:grid-cols-3">
                            <div className="space-y-2">
                              <Label
                                htmlFor={`fe-env-${row.id}`}
                                className="text-xs font-medium text-[#002147]"
                              >
                                Fecha envío
                              </Label>
                              <InlineFechaSeguimientoCell
                                id={`fe-env-${row.id}`}
                                rowId={row.id}
                                isoValue={row.fecha_envio}
                                disabled={saving}
                                ariaLabel={`Fecha envío OT ${getOtDisplay(row)}`}
                                onCommit={(ymd) =>
                                  void updateSeguimientoFecha(
                                    row,
                                    "fecha_envio",
                                    ymd
                                  )
                                }
                                inputClassName="min-h-12 w-full max-w-none text-base"
                              />
                            </div>
                            <div className="space-y-2 pr-3 min-[680px]:pr-2">
                              <Label
                                htmlFor={`fe-ot-${row.id}`}
                                className="text-xs font-medium text-[#002147]"
                              >
                                F. entrega OT
                              </Label>
                              <FEntregaOtTableCell
                                row={row}
                                saving={saving}
                                inputId={`fe-ot-${row.id}`}
                                inputClassName="min-h-12 h-12 w-full max-w-none text-base px-1.5"
                                onCommit={(ymd) =>
                                  void updateSeguimientoFecha(
                                    row,
                                    "f_entrega_ot",
                                    ymd
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2 min-[480px]:col-span-2 min-[680px]:col-span-1 pl-1 min-[680px]:pl-2">
                              <Label
                                htmlFor={`fe-prev-${row.id}`}
                                className="text-xs font-medium text-[#002147]"
                              >
                                Fecha prevista
                              </Label>
                              <InlineFechaSeguimientoCell
                                id={`fe-prev-${row.id}`}
                                rowId={row.id}
                                isoValue={row.fecha_prevista}
                                disabled={saving}
                                ariaLabel={`Fecha prevista OT ${getOtDisplay(row)}`}
                                onCommit={(ymd) =>
                                  void updateSeguimientoFecha(
                                    row,
                                    "fecha_prevista",
                                    ymd
                                  )
                                }
                                inputClassName="min-h-12 w-full max-w-none text-base"
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 border-t border-slate-200/80 pt-3 text-xs sm:grid-cols-2">
                            <div>
                              <p className="mb-1 font-medium text-[#002147]">
                                Notas log.
                              </p>
                              <NotasTablaCelda texto={row.notas_logistica} />
                            </div>
                            <div>
                              <p className="mb-1 font-medium text-[#002147]">
                                Obs. taller
                              </p>
                              <NotasTablaCelda texto={row.observaciones} />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                </>
                ) : (
                  <>
                    <div className="externos-plan-print-hide mb-2 flex flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-0">
                      <p
                        className="text-sm font-medium capitalize text-[#002147]"
                        aria-live="polite"
                      >
                        {seguimientoVista === "semanal"
                          ? format(weekMondayForBoard, "MMMM yyyy", {
                              locale: esLocale,
                            })
                          : format(planCursor, "MMMM yyyy", {
                              locale: esLocale,
                            })}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        {seguimientoVista === "semanal" ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-0.5 px-2"
                              onClick={() =>
                                setPlanCursor((c) => addWeeks(c, -1))
                              }
                              aria-label="Semana anterior"
                            >
                              <ChevronLeft className="size-4" aria-hidden />
                              Semana anterior
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() =>
                                setPlanCursor(
                                  startOfWeek(new Date(), { weekStartsOn: 1 })
                                )
                              }
                            >
                              Hoy
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-0.5 px-2"
                              onClick={() =>
                                setPlanCursor((c) => addWeeks(c, 1))
                              }
                              aria-label="Semana siguiente"
                            >
                              Semana siguiente
                              <ChevronRight className="size-4" aria-hidden />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-0.5 px-2"
                              onClick={() =>
                                setPlanCursor((c) =>
                                  addDays(startOfDay(c), -1)
                                )
                              }
                              aria-label="Día anterior"
                            >
                              <ChevronLeft className="size-4" aria-hidden />
                              Día anterior
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() =>
                                setPlanCursor(startOfDay(new Date()))
                              }
                            >
                              Hoy
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-0.5 px-2"
                              onClick={() =>
                                setPlanCursor((c) =>
                                  addDays(startOfDay(c), 1)
                                )
                              }
                              aria-label="Día siguiente"
                            >
                              Día siguiente
                              <ChevronRight className="size-4" aria-hidden />
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 px-2.5"
                          onClick={handlePrintPlanificacion}
                          aria-label="Imprimir planificación"
                        >
                          <Printer className="size-3.5" aria-hidden />
                          Imprimir planificación
                        </Button>
                      </div>
                    </div>

                    {seguimientoVista === "semanal" ? (
                      <div className="px-4 pb-6 pt-2 print:px-3 print:pb-4 print:pt-1 sm:px-0">
                        <ExternosWeeklyBoard
                          weekMonday={weekMondayForBoard}
                          rows={
                            seguimientosFiltrados as ExternosWeeklyBoardRow[]
                          }
                          proveedorNombreById={proveedorNombreById}
                          acabadoNombreById={acabadoNombreById}
                          saving={saving}
                          otEntregaUmbrales={umbralesOtsCompras}
                          renderMrp={(r) => (
                            <MaterialCompraColumnCell
                              info={lookupCompraMaterialStatus(
                                compraMaterialByOt,
                                getOtDisplay(r as SeguimientoRow)
                              )}
                              loading={loading}
                            />
                          )}
                          onCardClick={(r) => {
                            const full = seguimientos.find(
                              (x) => x.id === r.id
                            );
                            if (full) openSeguimientoEdit(full);
                          }}
                          onMoveToDate={async (r, ymd) => {
                            const full = seguimientos.find(
                              (x) => x.id === r.id
                            );
                            if (!full) return;
                            await updateSeguimientoFecha(
                              full,
                              "fecha_prevista",
                              ymd ?? ""
                            );
                          }}
                        />
                      </div>
                    ) : (
                      <div className="px-4 pb-6 pt-2 print:px-3 print:pb-4 print:pt-1 sm:px-0">
                        <ExternosDailyGrid
                          day={startOfDay(planCursor)}
                          rows={dailyGridRows as ExternosDailyGridRow[]}
                          proveedorNombreById={proveedorNombreById}
                          acabadoNombreById={acabadoNombreById}
                          saving={saving}
                          otEntregaUmbrales={umbralesOtsCompras}
                          onCardClick={(r) => {
                            const full = seguimientos.find(
                              (x) => x.id === r.id
                            );
                            if (full) openSeguimientoEdit(full);
                          }}
                          onReorder={handleDailyReorder}
                          renderMrp={(r) => (
                            <MaterialCompraColumnCell
                              info={lookupCompraMaterialStatus(
                                compraMaterialByOt,
                                getOtDisplay(r as SeguimientoRow)
                              )}
                              loading={loading}
                            />
                          )}
                        />
                      </div>
                    )}
                  </>
                )}
                </>
              )}
            </CardContent>
          </Card>

          <div
            ref={printListadoRef}
            className="externos-print-parte pointer-events-none fixed top-0 -left-[9999px] z-[-5] w-[297mm] max-w-[100vw] bg-white p-10 text-[11pt] leading-snug text-black opacity-0 print:pointer-events-auto print:static print:left-0 print:z-0 print:max-w-none print:opacity-100"
            aria-hidden
          >
            <header className="mb-6 border-b-2 border-[#002147] pb-4">
              <div className="flex items-end justify-between gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/minerva-logo.svg"
                  alt="Minerva Global"
                  className="h-12 w-auto object-contain object-left"
                />
                <div className="text-right text-[9pt] text-slate-600">
                  <p className="font-semibold text-[#002147]">
                    Parte de trabajo — Externos
                  </p>
                  <p>
                    Documento para reunión ·{" "}
                    {formatFechaEsCorta(new Date().toISOString())}
                  </p>
                  <p>{seguimientosFiltrados.length} línea(s) · vista filtrada</p>
                </div>
              </div>
            </header>
            <table className="w-full border-collapse text-[8.5pt]">
              <thead>
                <tr className="bg-[#002147] text-white">
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Sem.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    OT
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Op
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Ud.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Cliente
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Trabajo
                  </th>
                  <th className="border border-[#002147] py-1.5 pr-4 pl-1 text-left font-semibold whitespace-nowrap">
                    F. ent. OT
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 pl-3 text-left font-semibold">
                    Prov.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Acab.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Est.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Envío
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Prev.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-center font-semibold">
                    M
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Pal.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Notas log.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Obs. taller
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Alta
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Mod.
                  </th>
                </tr>
              </thead>
              <tbody>
                {seguimientosFiltrados.map((row) => {
                  const sem = computeSemaforo(row);
                  const diasFentOt = computeDiasHastaFEntregaOt(row.f_entrega_ot);
                  const compraSem = lookupCompraMaterialStatus(
                    compraMaterialByOt,
                    getOtDisplay(row)
                  )?.semaforo;
                  const compraDotClass = compraSemaforoToBgClass(compraSem);
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-200 odd:bg-slate-50/80"
                    >
                      <td className="border border-slate-200 px-1 py-1">
                        {sem.excelLabel}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 align-middle">
                        <OtNumeroSemaforoBadge
                          otNumero={getOtDisplay(row)}
                          fechaEntregaIso={row.f_entrega_ot}
                          umbrales={umbralesOtsCompras}
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-1 tabular-nums">
                        {row.num_operacion ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 tabular-nums">
                        {row.unidades ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        {row.cliente_nombre}
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        {row.trabajo_titulo}
                      </td>
                      <td className="border border-slate-200 py-1 pr-4 pl-1 whitespace-nowrap">
                        {row.f_entrega_ot ? (
                          <span className="inline-flex items-center gap-2">
                            {diasFentOt != null ? (
                              <span
                                className={cn(
                                  "shrink-0 text-[8pt] tabular-nums leading-none",
                                  fEntregaOtParenClass(diasFentOt)
                                )}
                              >
                                ({diasFentOt})
                              </span>
                            ) : null}
                            <span className="text-[8.5pt] tabular-nums">
                              {formatFechaEsCorta(row.f_entrega_ot)}
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="border border-slate-200 py-1 pr-1 pl-3">
                        {proveedorNombreById.get(row.proveedor_id) ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        {acabadoNombreById.get(row.acabado_id) ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        {row.estado}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 whitespace-nowrap">
                        {formatFechaEsCorta(row.fecha_envio)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 whitespace-nowrap">
                        {formatFechaEsCorta(row.fecha_prevista)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 text-center align-middle">
                        <span
                          className={cn(
                            "inline-block h-3 w-3 rounded-full",
                            compraDotClass
                          )}
                          style={{
                            WebkitPrintColorAdjust: "exact",
                            printColorAdjust: "exact",
                          }}
                          title={
                            lookupCompraMaterialStatus(
                              compraMaterialByOt,
                              getOtDisplay(row)
                            )?.tooltip
                          }
                          aria-hidden
                        />
                      </td>
                      <td className="border border-slate-200 px-1 py-1 tabular-nums">
                        {row.palets ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 align-top text-[7.5pt]">
                        {row.notas_logistica?.trim()
                          ? row.notas_logistica
                          : "—"}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 align-top text-[7.5pt]">
                        {row.observaciones?.trim() ? row.observaciones : "—"}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 whitespace-nowrap">
                        {formatFechaEsCorta(row.created_at)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 whitespace-nowrap">
                        {formatFechaEsCorta(
                          row.updated_at != null && row.updated_at !== ""
                            ? row.updated_at
                            : row.created_at
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-6 text-center text-[8pt] text-slate-500">
              Minerva Strategic AI Hub · Gestión de producción. No imprime menús
              ni navegación: solo este parte.
            </p>
          </div>
        </TabsContent>

        <TabsContent
          value="generar-envio"
          className="mt-0 space-y-3 outline-none"
        >
          {!proveedores.length && !loading ? (
            <Alert className="border-amber-200 bg-amber-50/90 text-amber-950">
              <AlertTitle>Sin colaboradores</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Primero debes dar de alta un colaborador en la pestaña
                  Proveedores.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 border-amber-300"
                  onClick={() => setTab("proveedores")}
                >
                  Ir a Proveedores
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
            <CardHeader className="space-y-2 pb-3">
              <CardTitle className="text-lg text-[#002147]">
                Importación inteligente (doble formato)
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                <strong>Control Externos</strong> (hoja «Control Externos» o
                cabeceras OT / CLIENTE / TRABAJO): mapea columnas de fábrica.
                <strong className="mx-1">Optimus</strong>
                (pedidos): «Nº Pedido» → OT, «Título» → trabajo, «Cantidad
                pedida» → unidades; estados incluidos p. ej. «En producción»,
                «En cola» (se registra como Pendiente). La misma OT puede
                repetirse: se crean filas con <code className="text-xs">num_operacion</code>{" "}
                1, 2, 3… Asigna proveedor y acabado antes de confirmar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx,.csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void processImportFile(f);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={() => importFileInputRef.current?.click()}
              >
                <Upload className="mr-2 size-4" aria-hidden />
                Importar Excel
              </Button>

              {importPreviewRows.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#002147]">
                        Sala de validación
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {importPreviewRows.length} fila(s) cargadas · marca las
                        que quieras importar
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={clearImportPreviewList}
                    >
                      <Trash2 className="mr-2 size-4" aria-hidden />
                      Limpiar listado
                    </Button>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-4">
                    <p className="mb-3 text-sm font-medium text-[#002147]">
                      Asignación masiva (solo filas seleccionadas)
                    </p>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                        <NativeSelect
                          label="Proveedor"
                          options={proveedorOptions}
                          value={bulkImportProv}
                          onChange={(e) => {
                            setBulkImportProv(e.target.value);
                            setBulkImportAcab("");
                          }}
                        />
                        <NativeSelect
                          label="Acabado"
                          options={bulkImportAcabadoOptions}
                          value={bulkImportAcab}
                          onChange={(e) => setBulkImportAcab(e.target.value)}
                          disabled={!bulkImportProv}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="shrink-0"
                        onClick={applyImportBulkAssignment}
                      >
                        Aplicar a seleccionadas
                      </Button>
                    </div>
                  </div>

                  <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-slate-200 [-webkit-overflow-scrolling:touch]">
                    <Table className="w-full min-w-[96rem] text-xs">
                      <TableHeader>
                        <TableRow className="bg-slate-50/90">
                          <TableHead className="w-8 px-1">
                            <input
                              ref={importMasterCheckboxRef}
                              type="checkbox"
                              className="size-3.5 rounded border"
                              checked={importSelectionStats.allSelectableSelected}
                              disabled={
                                importSelectionStats.selectableCount === 0
                              }
                              onChange={toggleImportSelectAllSelectable}
                              title="Seleccionar o quitar todas las filas"
                              aria-label="Seleccionar todas las filas importables"
                            />
                          </TableHead>
                          <TableHead className="whitespace-nowrap px-1">
                            OT
                          </TableHead>
                          <TableHead className="px-1">Ud.</TableHead>
                          <TableHead className="px-1">Prio.</TableHead>
                          <TableHead className="px-1">Pal.</TableHead>
                          <TableHead className="max-w-[6rem] px-1">Estado</TableHead>
                          <TableHead className="max-w-[7rem] px-1">Cliente</TableHead>
                          <TableHead className="min-w-[14rem] max-w-[24rem] px-1">
                            Trabajo
                          </TableHead>
                          <TableHead className="max-w-[6rem] px-1">
                            Ped. cli.
                          </TableHead>
                          <TableHead className="whitespace-nowrap px-1">
                            Entrega
                          </TableHead>
                          <TableHead className="whitespace-nowrap px-1">
                            Prevista
                          </TableHead>
                          <TableHead className="min-w-[9rem] px-1">Proveedor</TableHead>
                          <TableHead className="min-w-[9rem] px-1">Acabado</TableHead>
                          <TableHead className="min-w-[12rem] max-w-[18rem] px-1">
                            Notas
                          </TableHead>
                          <TableHead className="min-w-[10rem] px-1">Observ.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreviewRows.map((row) => (
                          <TableRow key={row.key}>
                            <TableCell className="px-1 py-1">
                              <input
                                type="checkbox"
                                className="size-3.5 rounded border"
                                checked={row.selected}
                                onChange={(e) =>
                                  setImportPreviewRows((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key
                                        ? { ...r, selected: e.target.checked }
                                        : r
                                    )
                                  )
                                }
                                aria-label={`Incluir OT ${row.ot_raw}`}
                              />
                            </TableCell>
                            <TableCell className="px-1 py-1 font-medium whitespace-nowrap tabular-nums">
                              {row.ot_raw}
                            </TableCell>
                            <TableCell className="px-1 py-1 tabular-nums">
                              {row.unidades ?? "—"}
                            </TableCell>
                            <TableCell className="max-w-[5rem] truncate px-1 py-1">
                              {row.prioridad ?? "—"}
                            </TableCell>
                            <TableCell className="px-1 py-1 tabular-nums">
                              {row.palets ?? "—"}
                            </TableCell>
                            <TableCell className="max-w-[6rem] truncate px-1 py-1">
                              {row.estado_sugerido}
                            </TableCell>
                            <TableCell className="max-w-[7rem] truncate py-1">
                              {row.cliente || "—"}
                            </TableCell>
                            <TableCell className="min-w-0 whitespace-normal break-words py-1 leading-snug">
                              {row.titulo || "—"}
                            </TableCell>
                            <TableCell className="max-w-[6rem] truncate py-1">
                              {row.ref_cliente || "—"}
                            </TableCell>
                            <TableCell className="max-w-[90px] truncate py-1 text-muted-foreground">
                              {fechaExcelRowToCorta(row.fecha_entrega_excel)}
                            </TableCell>
                            <TableCell className="px-1 py-1">
                              <Input
                                type="date"
                                className="h-7 min-w-[8.5rem] text-[11px]"
                                value={row.fecha_prevista}
                                onChange={(e) =>
                                  setImportPreviewRows((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key
                                        ? {
                                            ...r,
                                            fecha_prevista: e.target.value,
                                          }
                                        : r
                                    )
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="min-w-[9rem] px-1 py-1">
                              <select
                                className="border-input bg-background h-7 w-full max-w-[10rem] rounded-md border px-1.5 text-[11px]"
                                value={row.proveedor_id}
                                onChange={(e) =>
                                  setImportRowProveedor(row.key, e.target.value)
                                }
                                disabled={!proveedores.length}
                              >
                                <option value="">—</option>
                                {proveedores.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nombre}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell className="min-w-[9rem] px-1 py-1">
                              <select
                                className="border-input bg-background h-7 w-full max-w-[10rem] rounded-md border px-1.5 text-[11px]"
                                value={row.acabado_id}
                                onChange={(e) =>
                                  setImportPreviewRows((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key
                                        ? {
                                            ...r,
                                            acabado_id: e.target.value,
                                          }
                                        : r
                                    )
                                  )
                                }
                                disabled={!row.proveedor_id}
                              >
                                {acabadoOptionsForProveedorId(
                                  row.proveedor_id
                                ).map((o) => (
                                  <option key={o.value || "empty"} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell className="min-w-0 align-top p-1">
                              <Textarea
                                className="min-h-[2.25rem] resize-y text-[11px] leading-snug"
                                rows={2}
                                placeholder="Notas logística…"
                                value={row.notas}
                                onChange={(e) =>
                                  setImportPreviewRows((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key
                                        ? { ...r, notas: e.target.value }
                                        : r
                                    )
                                  )
                                }
                                aria-label={`Notas OT ${row.ot_raw}`}
                              />
                            </TableCell>
                            <TableCell className="min-w-0 align-top p-1">
                              <Textarea
                                className="min-h-[2.25rem] resize-y text-[11px] leading-snug"
                                rows={2}
                                placeholder="—"
                                value={row.observaciones ?? ""}
                                onChange={(e) =>
                                  setImportPreviewRows((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key
                                        ? {
                                            ...r,
                                            observaciones: e.target.value,
                                          }
                                        : r
                                    )
                                  )
                                }
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={saving}
                      onClick={() => void confirmImportSelection()}
                    >
                      Confirmar e importar selección
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearImportPreviewList}
                    >
                      Limpiar listado
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg text-[#002147]">
                Nuevo envío externo (OT) — manual
              </CardTitle>
              <CardDescription>
                Los acabados se filtran por el tipo del proveedor; si el tipo
                incluye varias categorías separadas por «/», se combinan todas.
                Fecha prevista en calendario (zona horaria en Supabase). El estado
                inicial suele ser Pendiente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleCreateEnvio}
                className="grid gap-3"
              >
                {/* Fila 1: OT + Cliente + Pedido cliente */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
                  <div className="grid min-w-0 gap-1.5 sm:col-span-3">
                    <Label htmlFor="ot" className="text-xs">
                      OT{" "}
                      <span className="text-muted-foreground font-normal">
                        (vacío → {OT_PLACEHOLDER_PEDIDO})
                      </span>
                    </Label>
                    <Input
                      id="ot"
                      inputMode="numeric"
                      placeholder="Ej. 24001"
                      value={envIdPedido}
                      onChange={(e) => setEnvIdPedido(e.target.value)}
                      disabled={!proveedores.length}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5 sm:col-span-5">
                    <Label htmlFor="cli" className="text-xs">
                      Cliente
                    </Label>
                    <Input
                      id="cli"
                      value={envCliente}
                      onChange={(e) => setEnvCliente(e.target.value)}
                      disabled={!proveedores.length}
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5 sm:col-span-4">
                    <Label htmlFor="pc" className="text-xs">
                      Pedido cliente
                    </Label>
                    <Input
                      id="pc"
                      value={envPedidoCliente}
                      onChange={(e) => setEnvPedidoCliente(e.target.value)}
                      disabled={!proveedores.length}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                {/* Fila 2: Título trabajo */}
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="tit" className="text-xs">
                    Título del trabajo
                  </Label>
                  <Input
                    id="tit"
                    value={envTrabajo}
                    onChange={(e) => setEnvTrabajo(e.target.value)}
                    disabled={!proveedores.length}
                  />
                </div>

                {/* Fila 3: Proveedor + Acabado */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
                  <NativeSelect
                    label="Proveedor"
                    options={proveedorOptions}
                    value={envProveedorId}
                    onChange={(e) => setEnvProveedorId(e.target.value)}
                    disabled={!proveedores.length}
                    className="min-w-0 w-full"
                  />
                  <NativeSelect
                    label="Acabado"
                    options={acabadoFormOptions}
                    value={envAcabadoId}
                    onChange={(e) => setEnvAcabadoId(e.target.value)}
                    disabled={!envProveedorId}
                    className="min-w-0 w-full"
                  />
                </div>

                {/* Fila 4: Unidades, prioridad, palets */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:items-end sm:gap-3">
                  <div className="grid min-w-0 content-start gap-1.5 sm:col-span-4">
                    <Label htmlFor="env-u" className="text-xs leading-none">
                      Unidades
                    </Label>
                    <Input
                      id="env-u"
                      inputMode="numeric"
                      placeholder="—"
                      value={envUnidades}
                      onChange={(e) => setEnvUnidades(e.target.value)}
                      disabled={!proveedores.length}
                      className="h-9 max-w-full sm:max-w-[5.5rem]"
                    />
                  </div>
                  <div className="grid min-w-0 content-start gap-1.5 sm:col-span-4">
                    <Label
                      htmlFor="env-prio"
                      className="text-xs leading-none"
                    >
                      Prioridad
                    </Label>
                    <select
                      id="env-prio"
                      value={envPrioridad}
                      onChange={(e) => setEnvPrioridad(e.target.value)}
                      disabled={!proveedores.length}
                      className={cn(
                        "border-input bg-background h-9 w-full min-w-0 rounded-lg border px-2 text-xs shadow-xs outline-none transition-[color,box-shadow] sm:px-3 sm:text-sm",
                        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                        "disabled:cursor-not-allowed disabled:opacity-50"
                      )}
                    >
                      {PRIORIDAD_MANUAL_OPTIONS.map((o) => (
                        <option key={o.value || "empty"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid min-w-0 content-start gap-1.5 sm:col-span-4">
                    <Label htmlFor="env-pal" className="text-xs leading-none">
                      Nº palets
                    </Label>
                    <Input
                      id="env-pal"
                      inputMode="numeric"
                      placeholder="—"
                      value={envPalets}
                      onChange={(e) => setEnvPalets(e.target.value)}
                      disabled={!proveedores.length}
                      className="h-9 max-w-full sm:max-w-[5.5rem]"
                    />
                  </div>
                </div>
                {/* Fila 5: F. entrega OT (cliente) y fecha prevista (proveedor) + estado */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:items-end sm:gap-3">
                  <div className="grid min-w-0 content-start gap-1.5 sm:col-span-4">
                    <Label
                      htmlFor="env-f-entrega-ot"
                      className="text-xs leading-none"
                    >
                      F. entrega OT
                    </Label>
                    <FEntregaOtYmdInputWithUrgencyPrefix
                      id="env-f-entrega-ot"
                      value={envFechaEntregaOt}
                      onChange={(e) => setEnvFechaEntregaOt(e.target.value)}
                      disabled={!proveedores.length}
                      inputHeightClass="h-9 min-h-9"
                    />
                  </div>
                  <div className="grid min-w-0 content-start gap-1.5 sm:col-span-4">
                    <Label htmlFor="fp" className="text-xs leading-none">
                      Fecha prevista
                    </Label>
                    <Input
                      id="fp"
                      type="date"
                      value={envFecha}
                      onChange={(e) => setEnvFecha(e.target.value)}
                      disabled={!proveedores.length}
                      className="h-9 w-full min-w-0"
                    />
                  </div>
                  <div className="grid min-w-0 content-start gap-1.5 sm:col-span-4">
                    <Label htmlFor="env-estado" className="text-xs leading-none">
                      Estado
                    </Label>
                    <select
                      id="env-estado"
                      value={envEstado}
                      onChange={(e) => setEnvEstado(e.target.value)}
                      disabled={!proveedores.length}
                      className={cn(
                        "border-input bg-background h-9 w-full min-w-0 rounded-lg border px-2 text-xs shadow-xs outline-none transition-[color,box-shadow] sm:px-3 sm:text-sm",
                        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                        "disabled:cursor-not-allowed disabled:opacity-50"
                      )}
                    >
                      {estadoRapidoOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Observaciones + Notas logística (misma línea) */}
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="env-obs" className="text-xs leading-none">
                      Observaciones
                    </Label>
                    <Textarea
                      id="env-obs"
                      rows={3}
                      placeholder="Opcional"
                      value={envObservaciones}
                      onChange={(e) => setEnvObservaciones(e.target.value)}
                      disabled={!proveedores.length}
                      className="resize-none text-sm leading-snug"
                    />
                  </div>
                  <div className="grid min-w-0 gap-1.5">
                    <Label htmlFor="notas" className="text-xs leading-none">
                      Notas de logística
                    </Label>
                    <Textarea
                      id="notas"
                      rows={3}
                      placeholder="Opcional"
                      value={envNotas}
                      onChange={(e) => setEnvNotas(e.target.value)}
                      disabled={!proveedores.length}
                      className="resize-none text-sm leading-snug"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2.5">
                  <input
                    id="env-entrada-multiple"
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 rounded border-input"
                    checked={envEntradaMultiple}
                    onChange={(e) => setEnvEntradaMultiple(e.target.checked)}
                    disabled={!proveedores.length}
                  />
                  <Label
                    htmlFor="env-entrada-multiple"
                    className="cursor-pointer text-sm leading-snug font-normal"
                  >
                    <span className="font-medium text-[#002147]">
                      Entrada múltiple
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">
                      Tras guardar, el formulario permanece abierto y solo se limpia
                      el campo OT para registrar otra OT seguida.
                    </span>
                  </Label>
                </div>
                <div className="pt-1">
                  <Button
                    type="submit"
                    disabled={saving || !proveedores.length || loading}
                  >
                    Registrar envío
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proveedores" className="mt-0 space-y-3 outline-none">
          <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle className="text-lg text-[#002147]">
                  Alta de colaborador
                </CardTitle>
                <CardDescription>
                  Asigna un tipo de proveedor; servirá para filtrar acabados en
                  seguimiento.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 border-dashed"
                disabled={saving || loading}
                onClick={() => void handleInsertTiposBase()}
              >
                Insertar Tipos Base
              </Button>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleAddProveedor}
                className="grid gap-4 sm:grid-cols-2"
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="pn">Nombre</Label>
                  <Input
                    id="pn"
                    value={provNombre}
                    onChange={(e) => setProvNombre(e.target.value)}
                    required
                  />
                </div>
                <TipoProveedorNativeSelect
                  id="prov-tipo"
                  value={provTipoId}
                  onValueChange={setProvTipoId}
                  tipos={tipos}
                  disabled={loading}
                />
                <div className="grid gap-1.5">
                  <Label htmlFor="pe">Email</Label>
                  <Input
                    id="pe"
                    type="email"
                    value={provEmail}
                    onChange={(e) => setProvEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pt">Teléfono</Label>
                  <Input
                    id="pt"
                    type="tel"
                    value={provTelefono}
                    onChange={(e) => setProvTelefono(e.target.value)}
                  />
                </div>
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="ptm">Teléfono móvil</Label>
                    <Input
                      id="ptm"
                      type="tel"
                      value={provTelfMovil}
                      onChange={(e) => setProvTelfMovil(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="pdir">Dirección</Label>
                    <Input
                      id="pdir"
                      value={provDireccion}
                      onChange={(e) => setProvDireccion(e.target.value)}
                      placeholder="Opcional"
                    />
                  </div>
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="pnot">Notas</Label>
                  <Textarea
                    id="pnot"
                    rows={6}
                    className="min-h-[8rem] resize-y text-sm"
                    placeholder="Horarios, correos, instrucciones de entrega…"
                    value={provNotas}
                    onChange={(e) => setProvNotas(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={saving || loading}>
                    Añadir proveedor
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg text-[#002147]">
                Directorio
              </CardTitle>
              <CardDescription>
                Edita o elimina colaboradores del listado.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loading ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              ) : proveedores.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay proveedores.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Tel. móvil</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead className="min-w-[10rem]">Notas</TableHead>
                      <TableHead className="w-[100px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proveedores.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.nombre}</TableCell>
                        <TableCell>
                          {tipoById.get(p.tipo_proveedor_id) ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">
                          {p.email ?? "—"}
                        </TableCell>
                        <TableCell className="max-w-[7rem] truncate text-sm">
                          {p.telefono?.trim() ? p.telefono : "—"}
                        </TableCell>
                        <TableCell className="max-w-[7rem] truncate text-sm">
                          {p.telf_movil?.trim() ? p.telf_movil : "—"}
                        </TableCell>
                        <TableCell className="max-w-[10rem]">
                          {p.direccion?.trim() ? (
                            <span
                              className="line-clamp-2 break-words text-sm leading-snug"
                              title={p.direccion}
                            >
                              {p.direccion}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[14rem] align-top">
                          {(() => {
                            const n = p.notas?.trim() ?? "";
                            if (!n) {
                              return (
                                <span className="text-muted-foreground">—</span>
                              );
                            }
                            const largo = n.length > 96;
                            return (
                              <div className="flex items-start gap-1.5">
                                <span
                                  className={cn(
                                    "min-w-0 flex-1 text-left text-sm leading-snug",
                                    largo ? "line-clamp-2 break-words" : "break-words"
                                  )}
                                  title={n}
                                >
                                  {n}
                                </span>
                                {largo ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 shrink-0 px-2 text-xs"
                                    onClick={() =>
                                      setProveedorNotasCompleto(n)
                                    }
                                  >
                                    Ver
                                  </Button>
                                ) : null}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar ${p.nombre}`}
                              onClick={() => openEdit(p)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
                              aria-label={`Eliminar ${p.nombre}`}
                              onClick={() => void handleDeleteProveedor(p)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-0 outline-none">
          <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg text-[#002147]">
                Acabados (catálogo)
              </CardTitle>
              <CardDescription>
                Listado de referencias por tipo de proveedor. La edición de
                catálogos se gestiona en Supabase si necesitas cambios masivos.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loading ? (
                <p className="text-sm text-muted-foreground">Cargando…</p>
              ) : acabadosCatalogo.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay acabados en catálogo.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo de proveedor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acabadosCatalogo.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.nombre}</TableCell>
                        <TableCell>
                          {tipoById.get(a.tipo_proveedor_id) ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={seguimientoSheetOpen}
        onOpenChange={(o) => {
          setSeguimientoSheetOpen(o);
          if (!o) setSeguimientoEditing(null);
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,880px)] w-[calc(100%-1.5rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <form
            onSubmit={handleUpdateSeguimiento}
            className="flex max-h-[inherit] flex-col"
          >
            <DialogHeader className="shrink-0 space-y-1 pr-10">
              <DialogTitle className="text-base leading-snug">
                Modificar envío
                {seguimientoEditing ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · OT {getOtDisplay(seguimientoEditing)}
                    {seguimientoEditing.num_operacion != null
                      ? ` · Op ${seguimientoEditing.num_operacion}`
                      : ""}
                  </span>
                ) : null}
              </DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[min(52vh,420px)] flex-1 gap-3 overflow-y-auto px-6 py-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] sm:items-end">
                <div className="grid min-w-0 gap-1.5">
                  <Label
                    htmlFor="edit-seg-cli"
                    className="text-xs font-medium text-slate-700"
                  >
                    Cliente
                  </Label>
                  <Input
                    id="edit-seg-cli"
                    required
                    value={editSegCliente}
                    onChange={(e) => setEditSegCliente(e.target.value)}
                    className="h-8 min-h-8 w-full min-w-0 text-sm px-2 py-1"
                    autoComplete="off"
                  />
                </div>
                <div className="grid min-w-0 gap-1.5">
                  <Label
                    htmlFor="edit-seg-f-entrega-ot"
                    className="text-xs font-medium text-slate-700"
                  >
                    F. entrega OT
                  </Label>
                  <FEntregaOtYmdInputWithUrgencyPrefix
                    id="edit-seg-f-entrega-ot"
                    value={editSegFechaEntregaOt}
                    onChange={(e) => setEditSegFechaEntregaOt(e.target.value)}
                    inputHeightClass="h-8 min-h-8"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="edit-seg-trab"
                  className="text-xs font-medium text-slate-700"
                >
                  Trabajo
                </Label>
                <Input
                  id="edit-seg-trab"
                  required
                  value={editSegTrabajo}
                  onChange={(e) => setEditSegTrabajo(e.target.value)}
                  className="h-8 min-h-8 w-full text-sm px-2 py-1"
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <NativeSelect
                    label="Proveedor"
                    options={proveedorOptions}
                    value={editSegProveedorId}
                    onChange={(e) => {
                      setEditSegProveedorId(e.target.value);
                      setEditSegAcabadoId("");
                    }}
                    disabled={!proveedores.length}
                    className="h-8 min-h-8 min-w-0 w-full rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="min-w-0">
                  <NativeSelect
                    label="Acabado"
                    options={editSeguimientoAcabadoOptions}
                    value={editSegAcabadoId}
                    onChange={(e) => setEditSegAcabadoId(e.target.value)}
                    disabled={!editSegProveedorId}
                    className="h-8 min-h-8 min-w-0 w-full rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="min-w-0">
                  <NativeSelect
                    label="Estado"
                    options={estadoRapidoOptions}
                    value={editSegEstado}
                    onChange={(e) => setEditSegEstado(e.target.value)}
                    className="h-8 min-h-8 min-w-0 w-full rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div className="grid min-w-0 gap-1.5">
                  <Label
                    htmlFor="edit-seg-fp"
                    className="text-xs font-medium text-slate-700"
                  >
                    Fecha prevista
                  </Label>
                  <Input
                    id="edit-seg-fp"
                    type="date"
                    value={editSegFecha}
                    onChange={(e) => setEditSegFecha(e.target.value)}
                    required
                    className="h-8 min-h-8 w-full max-w-full text-sm px-2 py-1"
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,8.5rem)_minmax(0,5rem)_minmax(0,1fr)] sm:items-end">
                <div className="grid min-w-0 gap-1.5">
                  <Label
                    htmlFor="edit-seg-ud"
                    className="text-xs font-medium text-slate-700"
                  >
                    Unidades
                  </Label>
                  <Input
                    id="edit-seg-ud"
                    inputMode="numeric"
                    value={editSegUnidades}
                    onChange={(e) => setEditSegUnidades(e.target.value)}
                    placeholder="—"
                    className="h-8 min-h-8 text-sm px-2 py-1"
                  />
                </div>
                <NativeSelect
                  label="Prioridad"
                  options={PRIORIDAD_MANUAL_OPTIONS}
                  value={editSegPrioridad}
                  onChange={(e) => setEditSegPrioridad(e.target.value)}
                  className="h-8 min-h-8 min-w-0 w-full max-w-[8.5rem] px-2 py-1.5 text-sm"
                />
                <div className="grid min-w-0 gap-1.5">
                  <Label
                    htmlFor="edit-seg-pal"
                    className="text-xs font-medium text-slate-700"
                  >
                    Palets
                  </Label>
                  <Input
                    id="edit-seg-pal"
                    inputMode="numeric"
                    value={editSegPalets}
                    onChange={(e) => setEditSegPalets(e.target.value)}
                    placeholder="—"
                    className="h-8 min-h-8 max-w-[5rem] text-sm px-2 py-1"
                  />
                </div>
                <div className="grid min-w-0 gap-1.5">
                  <Label
                    htmlFor="edit-seg-fe"
                    className="text-xs font-medium text-slate-700"
                  >
                    Fecha de envío
                  </Label>
                  <Input
                    id="edit-seg-fe"
                    type="date"
                    value={editSegFechaEnvio}
                    onChange={(e) => setEditSegFechaEnvio(e.target.value)}
                    className="h-8 min-h-8 w-full text-sm px-2 py-1"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="edit-seg-notas"
                  className="text-xs font-medium text-slate-700"
                >
                  Notas de logística
                </Label>
                <Textarea
                  id="edit-seg-notas"
                  className="min-h-[6.5rem] resize-y p-2 text-sm leading-snug"
                  placeholder="Instrucciones, incidencias, referencias…"
                  value={editSegNotas}
                  onChange={(e) => setEditSegNotas(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="edit-seg-obs"
                  className="text-xs font-medium text-slate-700"
                >
                  Observaciones (taller / interno)
                </Label>
                <Textarea
                  id="edit-seg-obs"
                  className="min-h-[6.5rem] resize-y p-2 text-sm leading-snug"
                  placeholder="Notas internas de taller…"
                  value={editSegObservaciones}
                  onChange={(e) => setEditSegObservaciones(e.target.value)}
                />
              </div>
            </div>
            <div className="border-t px-6 py-3">
              <Separator className="mb-3" />
              <h3 className="text-sm font-semibold text-[#002147]">
                Historial de comunicación
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Envíos registrados desde Comunicación Pro que incluyen esta OT.
              </p>
              {segComunicacionLogsLoading ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Cargando historial…
                </p>
              ) : segComunicacionLogs.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  No hay envíos registrados para esta OT.
                </p>
              ) : (
                <ul className="mt-3 max-h-56 space-y-3 overflow-y-auto text-xs">
                  {segComunicacionLogs.map((log) => (
                    <li
                      key={log.id}
                      className="rounded-md border border-slate-200/90 bg-slate-50/80 p-2.5"
                    >
                      <p className="font-medium text-[#002147]">
                        {formatFechaEsCorta(log.created_at)}
                        {log.id_pedidos.length > 0 ? (
                          <span className="font-normal text-slate-600">
                            {" "}
                            · OTs en el envío: {log.id_pedidos.join(", ")}
                          </span>
                        ) : null}
                      </p>
                      <pre className="mt-1.5 max-h-28 overflow-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-snug text-slate-700">
                        {log.cuerpo}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <DialogFooter className="flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={saving || !seguimientoEditing}
                onClick={() => void handleDeleteSeguimiento()}
              >
                Eliminar
              </Button>
              <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-[7rem]"
                  onClick={() => setSeguimientoSheetOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !seguimientoEditing}
                  className="min-w-[10rem] bg-[#C69C2B] font-semibold text-[#002147] shadow-sm hover:bg-[#b58d26] hover:text-[#002147]"
                >
                  Guardar cambios
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,880px)] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <form
            onSubmit={handleSaveEdit}
            className="flex max-h-[inherit] flex-col"
          >
            <DialogHeader>
              <DialogTitle>Editar proveedor</DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[min(70vh,560px)] flex-1 gap-4 overflow-y-auto px-6 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="en">Nombre</Label>
                <Input
                  id="en"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  required
                />
              </div>
              <TipoProveedorNativeSelect
                id="edit-tipo"
                label="Tipo"
                value={editTipoId}
                onValueChange={setEditTipoId}
                tipos={tipos}
                disabled={loading}
              />
              <div className="grid gap-1.5">
                <Label htmlFor="ee">Email</Label>
                <Input
                  id="ee"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="et">Teléfono</Label>
                <Input
                  id="et"
                  type="tel"
                  value={editTelefono}
                  onChange={(e) => setEditTelefono(e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="etm">Teléfono móvil</Label>
                  <Input
                    id="etm"
                    type="tel"
                    value={editTelfMovil}
                    onChange={(e) => setEditTelfMovil(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edir">Dirección</Label>
                  <Input
                    id="edir"
                    value={editDireccion}
                    onChange={(e) => setEditDireccion(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="enot">Notas</Label>
                <Textarea
                  id="enot"
                  rows={8}
                  className="min-h-[10rem] resize-y text-sm"
                  placeholder="Horarios, correos, instrucciones de entrega…"
                  value={editNotas}
                  onChange={(e) => setEditNotas(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 border-t border-slate-100 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={proveedorNotasCompleto != null}
        onOpenChange={(o) => {
          if (!o) setProveedorNotasCompleto(null);
        }}
      >
        <DialogContent className="max-h-[min(90vh,640px)] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Notas del proveedor</DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(60vh,28rem)] overflow-y-auto px-6 pb-2">
            <pre className="font-sans whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
              {proveedorNotasCompleto ?? ""}
            </pre>
          </div>
          <DialogFooter className="border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setProveedorNotasCompleto(null)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {comunicacionModalOpen && comunicacionPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#002147]/40 backdrop-blur-[2px] transition-opacity"
            aria-label="Cerrar"
            onClick={() => setComunicacionModalOpen(false)}
          />
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby={comunicacionDialogTitleId}
            aria-describedby={comunicacionDialogDescId}
            className="relative z-10 flex max-h-[min(92vh,760px)] w-full max-w-lg flex-col overflow-hidden border-slate-200/90 bg-white shadow-xl sm:max-w-xl"
          >
            <CardHeader className="shrink-0 space-y-1 border-b border-slate-200/80 bg-slate-50/90 pb-4">
              <CardTitle
                id={comunicacionDialogTitleId}
                className="text-lg font-semibold text-[#002147]"
              >
                Preparar envío (Comunicación Pro)
              </CardTitle>
              <CardDescription id={comunicacionDialogDescId}>
                Revisa destinatario, asunto y cuerpo. Al finalizar se actualizarán
                las OTs, se registrará el historial y se abrirá Gmail.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
              <div className="grid gap-1.5 text-sm">
                <span className="font-medium text-[#002147]">Destinatario</span>
                <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-slate-800">
                  {comunicacionPreview.prov?.email?.trim()
                    ? comunicacionPreview.prov.email.trim()
                    : "— (sin email en el proveedor)"}
                </p>
              </div>
              <div className="grid gap-1.5 text-sm">
                <span className="font-medium text-[#002147]">Asunto</span>
                <p className="rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 break-words">
                  {comunicacionPreview.subject}
                </p>
              </div>
              <div className="grid min-h-0 flex-1 gap-1.5 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 font-medium text-[#002147]">
                    Cuerpo (vista previa)
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-0 text-slate-600 hover:text-slate-800"
                        aria-label="Copiar texto para albarán"
                        onClick={() => void handleCopyText()}
                      >
                        {comunicacionBodyCopied ? (
                          <Check
                            className="size-3.5 text-emerald-600"
                            aria-hidden
                          />
                        ) : (
                          <Copy className="size-3.5" aria-hidden />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Copiar texto para albarán
                    </TooltipContent>
                  </Tooltip>
                </div>
                <pre className="max-h-[min(42vh,22rem)] overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50/90 px-3 py-2 font-sans text-xs text-slate-800">
                  {comunicacionPreview.body}
                </pre>
              </div>
            </CardContent>
            <CardFooter className="shrink-0 flex-col gap-2 border-t border-slate-200/80 bg-white/95 px-4 py-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setComunicacionModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={saving}
                className="bg-[#C69C2B] font-semibold text-[#002147] shadow-sm hover:bg-[#b58d26] hover:text-[#002147]"
                onClick={() => void handleComunicacionFinalizar()}
              >
                Abrir Gmail y finalizar
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : null}

      {analistaOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#002147]/40 backdrop-blur-[2px] transition-opacity"
            aria-label="Cerrar analista"
            onClick={() => {
              abortAnalistaRef.current?.abort();
              setAnalistaOpen(false);
              setAnalistaPregunta("");
            }}
          />
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby={analistaDialogTitleId}
            aria-describedby={analistaDialogDescId}
            className="relative z-10 flex max-h-[min(90vh,760px)] w-full max-w-2xl flex-col overflow-hidden border-slate-200/90 bg-white shadow-xl"
          >
            <CardHeader className="shrink-0 space-y-3 border-b border-slate-200/80 bg-slate-50/90 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle
                    id={analistaDialogTitleId}
                    className="text-lg font-semibold text-[#002147]"
                  >
                    Analista de Producción Minerva
                  </CardTitle>
                  <CardDescription id={analistaDialogDescId}>
                    Usa la vista filtrada actual como contexto.{" "}
                    <strong>Analizar</strong> genera un informe;{" "}
                    <strong>Preguntar</strong> responde solo con los datos del
                    listado.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-slate-600"
                  onClick={() => {
                    abortAnalistaRef.current?.abort();
                    setAnalistaOpen(false);
                    setAnalistaPregunta("");
                  }}
                  aria-label="Cerrar"
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <span className="text-xs font-medium text-slate-600 sm:mr-1">
                    Modelo
                  </span>
                  <GlobalModelSelector
                    layout="row"
                    className="w-full min-w-0 sm:w-auto sm:max-w-[min(100%,14rem)] sm:shrink-0"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 bg-[#C69C2B] font-semibold text-[#002147] hover:bg-[#b58d26] hover:text-[#002147] sm:ml-1"
                    disabled={
                      analistaLoading || seguimientosFiltrados.length === 0
                    }
                    onClick={() => void runAnalistaProduccion()}
                  >
                    {analistaLoading ? (
                      <>
                        <Loader2
                          className="mr-2 size-4 animate-spin"
                          aria-hidden
                        />
                        Analizando…
                      </>
                    ) : (
                      "Analizar"
                    )}
                  </Button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="grid min-w-0 flex-1 gap-1.5">
                    <Label htmlFor="analista-pregunta" className="text-xs">
                      Pregunta sobre el listado
                    </Label>
                    <Input
                      id="analista-pregunta"
                      placeholder="Ej. ¿Qué trabajos hay para Llobregat con prioridad Urgente?"
                      value={analistaPregunta}
                      onChange={(e) => setAnalistaPregunta(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void runAnalistaPregunta();
                        }
                      }}
                      disabled={analistaLoading || seguimientosFiltrados.length === 0}
                      className="h-9 text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 sm:mb-0.5"
                    disabled={
                      analistaLoading || seguimientosFiltrados.length === 0
                    }
                    onClick={() => void runAnalistaPregunta()}
                  >
                    Preguntar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-[12rem] flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
              {analistaLoading ? (
                <div
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  aria-busy="true"
                  aria-live="polite"
                >
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
                  Generando respuesta…
                </div>
              ) : null}
              {analistaError ? (
                <Alert className="border-red-200 bg-red-50/95 text-red-950">
                  <AlertTitle className="text-red-900">
                    No se pudo completar la operación
                  </AlertTitle>
                  <AlertDescription className="text-red-800">
                    {analistaError}
                  </AlertDescription>
                </Alert>
              ) : null}
              {!analistaLoading && analistaText.trim() ? (
                <div className="prose prose-sm prose-slate max-w-none dark:prose-invert [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[#002147] [&_p]:my-2 [&_ul]:my-2">
                  <ReactMarkdown>{analistaText}</ReactMarkdown>
                </div>
              ) : null}
              {!analistaLoading &&
              !analistaError &&
              !analistaText.trim() &&
              seguimientosFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay filas en la vista actual para usar como contexto.
                </p>
              ) : null}
              {!analistaLoading &&
              !analistaError &&
              !analistaText.trim() &&
              seguimientosFiltrados.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Pulsa <strong>Analizar</strong> para un informe o escribe una
                  pregunta y <strong>Preguntar</strong>.
                </p>
              ) : null}
            </CardContent>
            <CardFooter className="shrink-0 flex-col gap-2 border-t border-slate-200/80 bg-white/95 px-4 py-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  abortAnalistaRef.current?.abort();
                  setAnalistaOpen(false);
                  setAnalistaPregunta("");
                }}
              >
                Cerrar
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : null}
    </div>
    </TooltipProvider>
  );
}
