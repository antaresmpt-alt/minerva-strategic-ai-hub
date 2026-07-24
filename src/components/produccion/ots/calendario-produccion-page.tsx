"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardPaste,
  FileDown,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

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
  buildSemanaLaboral,
  buildSemanasLaboralesMes,
  entradasPorDia,
  fechaDiaLabel,
  filtrarEntradasPorTexto,
  mesAnioLabel,
  mondayOfWeek,
  monthRangeYmd,
  numColumnasCalendario,
  semanaLabelEs,
  weekRangeYmd,
  type CalendarioProduccionLinea,
} from "@/lib/calendario-produccion";
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
  fetchItinerarioCalendarioByOtNumeros,
  fetchPasosResumenOt,
  SEMAFORO_PILL_STYLES,
  semaforoForAmbito,
  type CalendarioItinerarioOt,
} from "@/lib/calendario-produccion-progreso";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { resolveEstadoOtLabel } from "@/lib/hoja-ruta/hoja-ruta-query";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
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

function DiaCelda({
  dayNum,
  lineas,
  notas,
  onEditDay,
  onOpenOt,
  itinerarioByOt,
  duplicatedOtSet,
  ambitoActivo,
  canEditActivo,
  variant = "mes",
}: {
  dayNum: number;
  lineas: CalendarioProduccionLinea[];
  notas: ProdCalendarioProduccionNotaRow[];
  onEditDay: () => void;
  onOpenOt: (otNumero: string) => void;
  itinerarioByOt: Map<string, CalendarioItinerarioOt>;
  duplicatedOtSet: Set<string>;
  ambitoActivo: CalendarioAmbito;
  canEditActivo: boolean;
  /** Semana: tipografía mayor y más altura de celda. */
  variant?: "mes" | "semana";
}) {
  const isSemana = variant === "semana";
  const hasContenido = lineas.length > 0 || notas.length > 0;

  return (
    <div
      className={
        isSemana
          ? "group relative flex min-h-[min(70vh,42rem)] flex-col border border-slate-200/90 bg-white"
          : "group relative flex min-h-[11rem] flex-col border border-slate-200/90 bg-white"
      }
    >
      <div className="flex shrink-0 items-center justify-between bg-[#002147] px-2 py-1.5">
        <button
          type="button"
          className="rounded px-1 text-[10px] font-medium text-white/80 opacity-0 transition group-hover:opacity-100 hover:bg-white/10"
          onClick={onEditDay}
          title="Añadir / editar OTs del día"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          className={
            isSemana
              ? "shrink-0 text-base font-bold tabular-nums text-white hover:underline"
              : "shrink-0 text-sm font-bold tabular-nums text-white hover:underline"
          }
          onClick={onEditDay}
          title="Editar día"
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
          onClick={onEditDay}
        >
          {canEditActivo ? "+ OT" : "Ver día"}
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
            const isDuplicada = duplicatedOtSet.has(`${l.ambito}:${l.otNumero}`);
            const isForeign = l.ambito !== ambitoActivo;
            const ambitoPill = CALENDARIO_AMBITO_PILL[l.ambito];
            return (
              <button
                key={l.id}
                type="button"
                title={`${l.label} — ${labelCalendarioAmbito(l.ambito)}: ${styles.title}${
                  isForeign ? " · solo lectura" : ""
                }`}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md border border-slate-200/90 bg-white text-left shadow-xs",
                  "border-l-[3px] transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#002147]/40",
                  styles.border,
                  ambitoPill.borderTint,
                  isForeign && "opacity-75",
                  isSemana ? "px-2 py-1.5" : "px-1.5 py-1",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenOt(l.otNumero);
                }}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    styles.dot,
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "shrink-0 rounded px-1 py-0.5 text-[10px] font-bold leading-none",
                    ambitoPill.letraBadge,
                  )}
                  aria-label={labelCalendarioAmbito(l.ambito)}
                >
                  {CALENDARIO_AMBITO_LETRA[l.ambito]}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 font-mono font-bold tabular-nums",
                    isDuplicada ? "bg-pink-100 text-pink-900" : styles.otBadge,
                    isSemana ? "text-[13px]" : "text-[12px]",
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
                  )}
                >
                  {l.trabajo?.trim() || "—"}
                </span>
              </button>
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
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<ProdCalendarioProduccionOtRow[]>([]);
  const [notasRows, setNotasRows] = useState<ProdCalendarioProduccionNotaRow[]>([]);
  const [tituloByOt, setTituloByOt] = useState<Map<string, string | null>>(
    () => new Map(),
  );
  const [filtro, setFiltro] = useState("");
  const [saving, setSaving] = useState(false);
  const [portapapeles, setPortapapeles] = useState<PortapapelesOt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [ambitoActivo, setAmbitoActivo] = useState<CalendarioAmbito>("impresion");
  const [ambitoVisibility, setAmbitoVisibility] =
    useState<CalendarioAmbitoVisibility>(() => allCalendarioAmbitoVisibilityOn());
  const ambitoInitDone = useRef(false);

  const [dayOpen, setDayOpen] = useState(false);
  const [dayYmd, setDayYmd] = useState<string | null>(null);
  const [otQuery, setOtQuery] = useState("");
  const [notaTexto, setNotaTexto] = useState("");
  const [otHits, setOtHits] = useState<OtSearchHit[]>([]);
  const [searchingOt, setSearchingOt] = useState(false);

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalle, setDetalle] = useState<CalendarioProduccionOtDetalle | null>(
    null,
  );
  const [itinerarioByOt, setItinerarioByOt] = useState<
    Map<string, CalendarioItinerarioOt>
  >(() => new Map());
  const [hojaRutaOt, setHojaRutaOt] = useState<string | null>(null);
  const [hojaRutaOpen, setHojaRutaOpen] = useState(false);
  const [cafeOpen, setCafeOpen] = useState(false);
  const [cafePending, setCafePending] = useState<{
    hit: OtSearchHit;
    otherYmd: string;
  } | null>(null);

  const canEditActivo = canEditCalendarioAmbito(userRole, ambitoActivo);

  useEffect(() => {
    try {
      setShowSaturday(localStorage.getItem(STORAGE_SHOW_SATURDAY) === "1");
      const v = localStorage.getItem(STORAGE_VISTA);
      if (v === "semana" || v === "mes") setVista(v);
      const vis = parseCalendarioAmbitoVisibility(
        localStorage.getItem(STORAGE_AMBITO_VIS),
      );
      if (vis) setAmbitoVisibility(vis);
    } catch {
      /* ignore */
    }
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
      return ambitoVisibility[a];
    });
  }, [rows, ambitoVisibility]);

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
    return filtrarEntradasPorTexto(all, filtro);
  }, [rowsVisibles, tituloByOt, filtro]);

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
              "id, fecha, ot_numero, ambito, orden, notas, created_by, created_at, updated_at",
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
      }));
      setRows(list);
      setNotasRows((notasData ?? []) as ProdCalendarioProduccionNotaRow[]);

      const ots = [
        ...new Set(list.map((r) => String(r.ot_numero ?? "").trim()).filter(Boolean)),
      ];
      if (ots.length === 0) {
        setTituloByOt(new Map());
        setItinerarioByOt(new Map());
        return;
      }

      const { data: maestros, error: mErr } = await supabase
        .from(TABLE_MAESTRO)
        .select("num_pedido, titulo")
        .in("num_pedido", ots);
      if (mErr) throw mErr;

      const map = new Map<string, string | null>();
      for (const m of maestros ?? []) {
        const n = String((m as { num_pedido?: string }).num_pedido ?? "").trim();
        if (n) map.set(n, (m as { titulo?: string | null }).titulo ?? null);
      }
      setTituloByOt(map);

      try {
        const itinerario = await fetchItinerarioCalendarioByOtNumeros(
          supabase,
          ots,
        );
        setItinerarioByOt(itinerario);
      } catch (progErr) {
        console.warn("[calendario] itinerario semáforo", progErr);
        setItinerarioByOt(new Map());
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

  const openDay = (ymd: string) => {
    setDayYmd(ymd);
    setOtQuery("");
    setNotaTexto("");
    setOtHits([]);
    setDayOpen(true);
  };

  const searchOts = useCallback(
    async (q: string) => {
      const needle = q.trim().replace(/[%_,]/g, " ").trim();
      if (needle.length < 2) {
        setOtHits([]);
        return;
      }
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
        setOtHits(
          ((data ?? []) as OtSearchHit[]).filter((h) =>
            String(h.num_pedido ?? "").trim(),
          ),
        );
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, "No se pudo buscar la OT."));
        setOtHits([]);
      } finally {
        setSearchingOt(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (!dayOpen) return;
    const t = window.setTimeout(() => void searchOts(otQuery), 280);
    return () => window.clearTimeout(t);
  }, [otQuery, dayOpen, searchOts]);

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
        const existing = rows.filter(
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
        setOtQuery("");
        setOtHits([]);
        await load();
      } catch (e) {
        toast.error(errorMessageFromUnknown(e, "No se pudo añadir la OT."));
      } finally {
        setSaving(false);
      }
    },
    [ambitoActivo, dayYmd, load, rows, supabase, userRole],
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
      rows.some(
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

    const otherRow = rows.find(
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

  const addNotaToDay = async () => {
    if (!dayYmd) return;
    const texto = notaTexto.trim();
    if (!texto) return;
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
        texto,
        orden: nextOrden,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      setNotaTexto("");
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
      const existing = rows.filter(
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
            Mapa mental por ámbito (I/D/T/E). Semáforo = estado del paso en
            Minerva (no mueve fechas).
            {canEditActivo
              ? ` Editando ${labelCalendarioAmbito(ambitoActivo)}.`
              : ` Solo lectura en ${labelCalendarioAmbito(ambitoActivo)}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Input
            className="h-8 pl-8 text-sm"
            placeholder="Filtrar OT / trabajo / cliente…"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
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
          title="Color del nº OT según el paso del ámbito de la pastilla en el itinerario"
        >
          <span className="font-medium text-slate-600">Semáforo:</span>
          {(
            [
              ["esperando", "Esperando"],
              ["listo", "Listo"],
              ["hecho", "Hecho"],
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
                    <DiaCelda
                      key={celda.ymd}
                      dayNum={celda.dayNum}
                      lineas={entradasByDay.get(celda.ymd) ?? []}
                      notas={notasByDay.get(celda.ymd) ?? []}
                      onEditDay={() => openDay(celda.ymd)}
                      onOpenOt={(ot) => void openDetalle(ot)}
                      variant="semana"
                      itinerarioByOt={itinerarioByOt}
                      duplicatedOtSet={duplicatedOtSet}
                      ambitoActivo={ambitoActivo}
                      canEditActivo={canEditActivo}
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
                      <DiaCelda
                        key={celda.ymd}
                        dayNum={celda.dayNum}
                        lineas={entradasByDay.get(celda.ymd) ?? []}
                        notas={notasByDay.get(celda.ymd) ?? []}
                        onEditDay={() => openDay(celda.ymd)}
                        onOpenOt={(ot) => void openDetalle(ot)}
                        variant="mes"
                        itinerarioByOt={itinerarioByOt}
                        duplicatedOtSet={duplicatedOtSet}
                        ambitoActivo={ambitoActivo}
                        canEditActivo={canEditActivo}
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

            <div>
              <Label className="text-xs">
                Añadir OT ({labelCalendarioAmbito(ambitoActivo)})
              </Label>
              <Input
                className="mt-1"
                placeholder="Buscar nº OT, cliente o trabajo…"
                value={otQuery}
                onChange={(e) => setOtQuery(e.target.value)}
                disabled={!canEditActivo}
              />
              {!canEditActivo ? (
                <p className="mt-1 text-xs text-amber-800">
                  No puedes añadir OTs en este ámbito. Cambia el desplegable o
                  pide a admin/gerencia.
                </p>
              ) : null}
              {searchingOt ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <Loader2 className="size-3 animate-spin" /> Buscando…
                </p>
              ) : null}
              {otHits.length > 0 && canEditActivo ? (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200">
                  {otHits.map((h) => (
                    <li key={h.num_pedido}>
                      <button
                        type="button"
                        className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
                        disabled={saving}
                        onClick={() => void addOtToDay(h)}
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
                  onClick={() => void addNotaToDay()}
                >
                  Añadir
                </Button>
              </div>
            </div>

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
                    return (
                    <li
                      key={l.id}
                      className={`flex items-start justify-between gap-2 rounded-md border bg-white px-2 py-1.5 ${
                        portapapeles?.id === l.id
                          ? "border-amber-400 bg-amber-50/80"
                          : l.ambito !== ambitoActivo
                            ? "border-slate-200 opacity-80"
                            : "border-slate-200"
                      }`}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left text-sm hover:underline"
                        onClick={() => void openDetalle(l.otNumero)}
                      >
                        <span className="font-semibold text-[#002147]">
                          <span
                            className={cn(
                              "mr-1 inline-block rounded px-1 py-0.5 text-[10px] font-bold text-white",
                              CALENDARIO_AMBITO_PILL[l.ambito].letraBadge,
                            )}
                          >
                            {CALENDARIO_AMBITO_LETRA[l.ambito]}
                          </span>
                          {l.otNumero}
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
    </div>
  );
}
