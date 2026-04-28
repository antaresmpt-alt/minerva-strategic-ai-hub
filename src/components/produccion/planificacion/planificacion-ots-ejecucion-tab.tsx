"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pause,
  Play,
  RefreshCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  exportEjecucionesExcel,
  exportEjecucionesPdf,
} from "@/lib/planificacion-ejecucion-export";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import type {
  EstadoEjecucionMesa,
  MesaEjecucion,
  MesaEjecucionPausa,
  MotivoPausa,
  MotivoPausaCategoria,
} from "@/types/planificacion-mesa";

const TABLE_EJECUCIONES = "prod_mesa_ejecuciones";
const TABLE_EJECUCIONES_PAUSAS = "prod_mesa_ejecuciones_pausas";
const TABLE_MOTIVOS_PAUSA = "sys_motivos_pausa";
const TABLE_MAQUINAS = "prod_maquinas";
const TABLE_MESA = "prod_mesa_planificacion_trabajos";

type EjecucionRow = {
  id: string;
  mesa_trabajo_id: string | null;
  ot_numero: string;
  maquina_id: string;
  prod_maquinas?: { nombre: string | null } | null;
  fecha_planificada: string | null;
  turno: string | null;
  slot_orden: number | null;
  liberada_at: string | null;
  inicio_real_at: string | null;
  fin_real_at: string | null;
  estado_ejecucion: EstadoEjecucionMesa;
  ha_estado_pausada: boolean | null;
  num_pausas: number | string | null;
  minutos_pausada_acum: number | string | null;
  horas_planificadas_snapshot: number | string | null;
  horas_reales: number | string | null;
  incidencia: string | null;
  accion_correctiva: string | null;
  maquinista: string | null;
  densidades_json: Record<string, unknown> | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
};

type MotivoPausaRow = {
  id: string;
  slug: string;
  label: string;
  categoria: MotivoPausaCategoria;
  color_hex: string;
  activo: boolean;
  orden: number | string | null;
};

type PausaRow = {
  id: string;
  ejecucion_id: string;
  paused_at: string;
  resumed_at: string | null;
  motivo_id: string;
  observaciones_pausa: string | null;
  minutos_pausa: number | string | null;
  created_at: string | null;
  sys_motivos_pausa?: MotivoPausaRow | MotivoPausaRow[] | null;
};

function parseNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapMotivoRow(row: MotivoPausaRow): MotivoPausa {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    categoria: row.categoria,
    colorHex: row.color_hex,
    activo: Boolean(row.activo),
    orden: Math.trunc(parseNum(row.orden) ?? 0),
  };
}

function pickMotivoJoin(value: PausaRow["sys_motivos_pausa"]): MotivoPausaRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapRow(
  r: EjecucionRow,
  pausesByExecutionId: Map<string, MesaEjecucionPausa[]>,
): MesaEjecucion {
  const pauses = pausesByExecutionId.get(r.id) ?? [];
  const openPause = pauses.find((p) => p.resumedAt == null) ?? null;
  return {
    id: r.id,
    mesaTrabajoId: r.mesa_trabajo_id,
    ot: r.ot_numero,
    maquinaId: r.maquina_id,
    maquinaNombre: r.prod_maquinas?.nombre ?? "—",
    fechaPlanificada: r.fecha_planificada,
    turno: r.turno === "manana" || r.turno === "tarde" ? r.turno : null,
    slotOrden: r.slot_orden,
    liberadaAt: r.liberada_at,
    inicioRealAt: r.inicio_real_at,
    finRealAt: r.fin_real_at,
    estadoEjecucion: r.estado_ejecucion,
    pausaActivaDesde: openPause?.pausedAt ?? null,
    motivoPausaActiva: openPause?.motivoLabel ?? null,
    motivoPausaCategoriaActiva: openPause?.motivoCategoria ?? null,
    motivoPausaColorHexActiva: openPause?.motivoColorHex ?? null,
    haEstadoPausada: Boolean(r.ha_estado_pausada) || pauses.length > 0,
    numPausas: Math.max(0, Math.trunc(parseNum(r.num_pausas) ?? pauses.length)),
    minutosPausadaAcum: Number(parseNum(r.minutos_pausada_acum) ?? 0),
    horasPlanificadasSnapshot: parseNum(r.horas_planificadas_snapshot),
    horasReales: parseNum(r.horas_reales),
    incidencia: r.incidencia,
    accionCorrectiva: r.accion_correctiva,
    maquinista: r.maquinista,
    densidadesJson: r.densidades_json,
    observaciones: r.observaciones,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function estadoLabel(e: EstadoEjecucionMesa): string {
  if (e === "pendiente_inicio") return "Pendiente inicio";
  if (e === "en_curso") return "En curso";
  if (e === "pausada") return "Pausada";
  if (e === "finalizada") return "Finalizada";
  return "Cancelada";
}

export function PlanificacionOtsEjecucionTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<MesaEjecucion[]>([]);
  const [pausesByExecutionId, setPausesByExecutionId] = useState<Record<string, MesaEjecucionPausa[]>>({});
  const [motivosPausa, setMotivosPausa] = useState<MotivoPausa[]>([]);
  const [maquinas, setMaquinas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [selectedMaquina, setSelectedMaquina] = useState<string>("all");
  const [estado, setEstado] = useState<"activas" | EstadoEjecucionMesa | "all">("activas");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [execRes, maqRes, motivosRes] = await Promise.all([
        supabase
          .from(TABLE_EJECUCIONES)
          .select("*, prod_maquinas(nombre)")
          .order("updated_at", { ascending: false }),
        supabase
          .from(TABLE_MAQUINAS)
          .select("id, nombre, tipo_maquina, activa")
          .eq("tipo_maquina", "impresion")
          .eq("activa", true)
          .order("nombre"),
        supabase
          .from(TABLE_MOTIVOS_PAUSA)
          .select("id, slug, label, categoria, color_hex, activo, orden")
          .eq("activo", true)
          .order("categoria", { ascending: true })
          .order("orden", { ascending: true }),
      ]);
      if (execRes.error) throw execRes.error;
      if (maqRes.error) throw maqRes.error;
      if (motivosRes.error) throw motivosRes.error;
      const motivos = ((motivosRes.data ?? []) as MotivoPausaRow[]).map(mapMotivoRow);
      const execRows = ((execRes.data ?? []) as unknown as EjecucionRow[]);
      const executionIds = execRows.map((r) => r.id);
      const pauseMap = new Map<string, MesaEjecucionPausa[]>();
      if (executionIds.length > 0) {
        const { data: pauseData, error: pauseErr } = await supabase
          .from(TABLE_EJECUCIONES_PAUSAS)
          .select("id, ejecucion_id, paused_at, resumed_at, motivo_id, observaciones_pausa, minutos_pausa, created_at, sys_motivos_pausa(slug,label,categoria,color_hex)")
          .in("ejecucion_id", executionIds)
          .order("paused_at", { ascending: false });
        if (pauseErr) throw pauseErr;
        for (const p of (pauseData ?? []) as unknown as PausaRow[]) {
          const executionId = String(p.ejecucion_id ?? "").trim();
          if (!executionId) continue;
          const motivo = pickMotivoJoin(p.sys_motivos_pausa);
          const fallbackMotivo = motivos.find((m) => m.id === p.motivo_id);
          const entry: MesaEjecucionPausa = {
            id: String(p.id),
            ejecucionId: executionId,
            pausedAt: String(p.paused_at),
            resumedAt: p.resumed_at ?? null,
            motivoId: p.motivo_id,
            motivoLabel: motivo?.label ?? fallbackMotivo?.label ?? "Sin motivo",
            motivoCategoria: motivo?.categoria ?? fallbackMotivo?.categoria ?? "operativos",
            motivoColorHex: motivo?.color_hex ?? fallbackMotivo?.colorHex ?? "#64748B",
            observacionesPausa: p.observaciones_pausa ?? null,
            minutosPausa: parseNum(p.minutos_pausa),
            createdAt: String(p.created_at ?? ""),
          };
          const list = pauseMap.get(executionId) ?? [];
          list.push(entry);
          pauseMap.set(executionId, list);
        }
      }
      setPausesByExecutionId(
        Object.fromEntries(Array.from(pauseMap.entries()).map(([k, v]) => [k, v] as const)),
      );
      setRows(execRows.map((r) => mapRow(r, pauseMap)));
      setMotivosPausa(motivos);
      setMaquinas(
        ((maqRes.data ?? []) as Array<{ id: string; nombre: string }>).map((m) => ({
          id: m.id,
          nombre: m.nombre,
        })),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudieron cargar las OTs en ejecución.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (selectedMaquina !== "all" && r.maquinaId !== selectedMaquina) return false;
      if (estado === "activas") {
        return (
          r.estadoEjecucion === "pendiente_inicio" ||
          r.estadoEjecucion === "en_curso" ||
          r.estadoEjecucion === "pausada"
        );
      }
      if (estado === "all") return true;
      return r.estadoEjecucion === estado;
    });
  }, [rows, selectedMaquina, estado]);

  const filteredSections = useMemo(() => {
    const pending = filtered.filter((r) => r.estadoEjecucion === "pendiente_inicio");
    const active = filtered.filter((r) => r.estadoEjecucion === "en_curso" || r.estadoEjecucion === "pausada");
    const finished = filtered.filter((r) => r.estadoEjecucion === "finalizada" || r.estadoEjecucion === "cancelada");
    const sections = [
      { key: "pending", title: "Pendientes de iniciar", rows: pending },
      { key: "active", title: "En curso / pausadas", rows: active },
      { key: "finished", title: "Finalizadas / canceladas", rows: finished },
    ];
    if (estado === "activas") return sections.filter((s) => s.key !== "finished" && s.rows.length > 0);
    return sections.filter((s) => s.rows.length > 0);
  }, [estado, filtered]);

  const patchExecution = useCallback(
    async (row: MesaEjecucion, patch: Record<string, unknown>) => {
      if (row.estadoEjecucion === "pendiente_inicio" && patch.estado_ejecucion === "finalizada") {
        toast.error("Inicia la OT antes de finalizarla.");
        return;
      }
      setSavingId(row.id);
      try {
        const nextPatch = { ...patch };
        if (patch.estado_ejecucion === "finalizada" && row.estadoEjecucion === "pausada") {
          const pauses = pausesByExecutionId[row.id] ?? [];
          const openPause = pauses.find((p) => p.resumedAt == null);
          if (openPause) {
            const now = new Date();
            const pausedAtMs = new Date(openPause.pausedAt).getTime();
            const deltaMin = Number.isFinite(pausedAtMs)
              ? Math.max(0, Math.round((now.getTime() - pausedAtMs) / 60000))
              : 0;
            const nowIso = now.toISOString();
            const { error: pauseUpdErr } = await supabase
              .from(TABLE_EJECUCIONES_PAUSAS)
              .update({
                resumed_at: nowIso,
                minutos_pausa: deltaMin,
                updated_at: nowIso,
              })
              .eq("id", openPause.id);
            if (pauseUpdErr) throw pauseUpdErr;
            nextPatch.minutos_pausada_acum = Math.max(0, row.minutosPausadaAcum) + deltaMin;
          }
        }
        const { error } = await supabase
          .from(TABLE_EJECUCIONES)
          .update({
            ...nextPatch,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (error) throw error;
        if (nextPatch.estado_ejecucion === "finalizada" && row.mesaTrabajoId) {
          const { error: mesaError } = await supabase
            .from(TABLE_MESA)
            .update({ estado_mesa: "finalizada" })
            .eq("id", row.mesaTrabajoId);
          if (mesaError) throw mesaError;
        }
        toast.success("Ejecución actualizada.");
        await loadData();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo actualizar la ejecución.";
        toast.error(msg);
      } finally {
        setSavingId(null);
      }
    },
    [supabase, loadData, pausesByExecutionId],
  );

  const beginExecution = useCallback(
    async (row: MesaEjecucion) => {
      if (row.estadoEjecucion !== "pendiente_inicio") {
        toast.error("Solo se pueden iniciar OTs pendientes.");
        return;
      }
      setSavingId(row.id);
      try {
        const nowIso = new Date().toISOString();
        const { error } = await supabase
          .from(TABLE_EJECUCIONES)
          .update({
            inicio_real_at: nowIso,
            estado_ejecucion: "en_curso",
            updated_at: nowIso,
          })
          .eq("id", row.id);
        if (error) throw error;
        toast.success(`OT ${row.ot} iniciada en máquina.`);
        await loadData();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo iniciar la OT.";
        toast.error(msg);
      } finally {
        setSavingId(null);
      }
    },
    [loadData, supabase],
  );

  const pauseExecution = useCallback(
    async (row: MesaEjecucion, motivo: MotivoPausa | null) => {
      if (row.estadoEjecucion !== "en_curso") {
        toast.warning("Solo se pueden pausar OTs en curso.");
        return;
      }
      if (!motivo) {
        toast.warning("Selecciona un motivo antes de pausar la OT.");
        return;
      }
      setSavingId(row.id);
      try {
        const nowIso = new Date().toISOString();
        const { error: insErr } = await supabase.from(TABLE_EJECUCIONES_PAUSAS).insert({
          ejecucion_id: row.id,
          paused_at: nowIso,
          motivo_id: motivo.id,
          motivo: motivo.label,
        });
        if (insErr) throw insErr;
        const { error: updErr } = await supabase
          .from(TABLE_EJECUCIONES)
          .update({
            estado_ejecucion: "pausada",
            ha_estado_pausada: true,
            num_pausas: Math.max(0, row.numPausas) + 1,
            updated_at: nowIso,
          })
          .eq("id", row.id);
        if (updErr) throw updErr;
        toast.success("OT pausada.");
        await loadData();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo pausar la OT.";
        toast.error(msg);
      } finally {
        setSavingId(null);
      }
    },
    [supabase, loadData],
  );

  const resumeExecution = useCallback(
    async (row: MesaEjecucion, pauses: MesaEjecucionPausa[]) => {
      const openPause = pauses.find((p) => p.resumedAt == null);
      if (!openPause) {
        toast.error("No se encontró una pausa activa para reanudar.");
        return;
      }
      setSavingId(row.id);
      try {
        const now = new Date();
        const pausedAtMs = new Date(openPause.pausedAt).getTime();
        const deltaMin = Number.isFinite(pausedAtMs)
          ? Math.max(0, Math.round((now.getTime() - pausedAtMs) / 60000))
          : 0;
        const nowIso = now.toISOString();
        const { error: pauseUpdErr } = await supabase
          .from(TABLE_EJECUCIONES_PAUSAS)
          .update({
            resumed_at: nowIso,
            minutos_pausa: deltaMin,
            updated_at: nowIso,
          })
          .eq("id", openPause.id);
        if (pauseUpdErr) throw pauseUpdErr;
        const { error: execUpdErr } = await supabase
          .from(TABLE_EJECUCIONES)
          .update({
            estado_ejecucion: "en_curso",
            minutos_pausada_acum: Math.max(0, row.minutosPausadaAcum) + deltaMin,
            updated_at: nowIso,
          })
          .eq("id", row.id);
        if (execUpdErr) throw execUpdErr;
        toast.success("OT reanudada.");
        await loadData();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo reanudar la OT.";
        toast.error(msg);
      } finally {
        setSavingId(null);
      }
    },
    [supabase, loadData],
  );

  const selectedMaquinaLabel = useMemo(() => {
    if (selectedMaquina === "all") return "Todas";
    return maquinas.find((m) => m.id === selectedMaquina)?.nombre ?? selectedMaquina;
  }, [maquinas, selectedMaquina]);

  const estadoLabelFiltro = useMemo(() => {
    if (estado === "all") return "Todas";
    if (estado === "activas") return "Activas";
    return estadoLabel(estado);
  }, [estado]);

  const handleExportExcel = useCallback(() => {
    try {
      exportEjecucionesExcel(filtered, {
        maquina: selectedMaquinaLabel,
        estado: estadoLabelFiltro,
      }, pausesByExecutionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar Excel.");
    }
  }, [filtered, selectedMaquinaLabel, estadoLabelFiltro, pausesByExecutionId]);

  const handleExportPdf = useCallback(() => {
    try {
      exportEjecucionesPdf(filtered, {
        maquina: selectedMaquinaLabel,
        estado: estadoLabelFiltro,
      }, pausesByExecutionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar PDF.");
    }
  }, [filtered, selectedMaquinaLabel, estadoLabelFiltro, pausesByExecutionId]);

  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg text-[#002147]">OTs en ejecución</CardTitle>
            <CardDescription>
              Cola de trabajos liberados a máquina y seguimiento del inicio real, pausas y cierre.
            </CardDescription>
          </div>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={handleExportExcel} disabled={loading}>
              <FileSpreadsheet className="mr-1 size-4" />
              Excel
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleExportPdf} disabled={loading}>
              <FileText className="mr-1 size-4" />
              PDF
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
              <RefreshCcw className={cn("mr-1 size-4", loading && "animate-spin")} />
              Recargar
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <select
            className="h-8 rounded-md border border-slate-300 bg-white px-2"
            value={selectedMaquina}
            onChange={(e) => setSelectedMaquina(e.target.value)}
          >
            <option value="all">Todas las máquinas</option>
            {maquinas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border border-slate-300 bg-white px-2"
            value={estado}
            onChange={(e) => setEstado(e.target.value as typeof estado)}
          >
            <option value="activas">Activas</option>
            <option value="pendiente_inicio">Pendientes de iniciar</option>
            <option value="en_curso">En curso</option>
            <option value="pausada">Pausadas</option>
            <option value="finalizada">Finalizadas</option>
            <option value="all">Todas</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            Cargando ejecuciones...
          </div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
            No hay OTs en ejecución para los filtros actuales.
          </p>
        ) : null}

        <div className="space-y-4">
          {filteredSections.map((section) => (
            <section key={section.key} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {section.title} · {section.rows.length}
              </h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {section.rows.map((row) => {
                  const desviacion =
                    row.horasReales != null && row.horasPlanificadasSnapshot != null
                      ? row.horasReales - row.horasPlanificadasSnapshot
                      : null;
                  return (
                    <ExecutionCard
                      key={`${row.id}-${row.updatedAt}`}
                      row={row}
                      pauses={pausesByExecutionId[row.id] ?? []}
                      motivosPausa={motivosPausa}
                      desviacion={desviacion}
                      saving={savingId === row.id}
                      onPatch={(patch) => void patchExecution(row, patch)}
                      onBegin={() => void beginExecution(row)}
                      onPause={(motivo) => void pauseExecution(row, motivo)}
                      onResume={(pauses) => void resumeExecution(row, pauses)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionCard({
  row,
  pauses,
  motivosPausa,
  desviacion,
  saving,
  onPatch,
  onBegin,
  onPause,
  onResume,
}: {
  row: MesaEjecucion;
  pauses: MesaEjecucionPausa[];
  motivosPausa: MotivoPausa[];
  desviacion: number | null;
  saving: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
  onBegin: () => void;
  onPause: (motivo: MotivoPausa | null) => void;
  onResume: (pauses: MesaEjecucionPausa[]) => void;
}) {
  const [horas, setHoras] = useState(row.horasReales != null ? String(row.horasReales) : "");
  const [incidencia, setIncidencia] = useState(row.incidencia ?? "");
  const [accion, setAccion] = useState(row.accionCorrectiva ?? "");
  const [maquinista, setMaquinista] = useState(row.maquinista ?? "");
  const [observaciones, setObservaciones] = useState(row.observaciones ?? "");
  const [pausePickerOpen, setPausePickerOpen] = useState(false);
  const [selectedMotivoId, setSelectedMotivoId] = useState("");

  const isPendingStart = row.estadoEjecucion === "pendiente_inicio";
  const canEdit = row.estadoEjecucion !== "finalizada" && row.estadoEjecucion !== "cancelada";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-bold text-[#002147]">OT {row.ot}</p>
          <p className="text-xs text-slate-600">
            {row.maquinaNombre} · {row.fechaPlanificada ?? "sin fecha"} · {row.turno ?? "sin turno"}
          </p>
          <p className="text-[11px] text-slate-500">
            {row.inicioRealAt
              ? `Inicio: ${format(new Date(row.inicioRealAt), "dd/MM/yyyy HH:mm", { locale: es })}`
              : `Liberada: ${
                  row.liberadaAt
                    ? format(new Date(row.liberadaAt), "dd/MM/yyyy HH:mm", { locale: es })
                    : "pendiente"
                }`}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-[11px] font-semibold",
            row.estadoEjecucion === "pendiente_inicio" && "bg-sky-100 text-sky-800",
            row.estadoEjecucion === "en_curso" && "bg-emerald-100 text-emerald-800",
            row.estadoEjecucion === "pausada" && "bg-amber-100 text-amber-800",
            row.estadoEjecucion === "finalizada" && "bg-slate-100 text-slate-700",
          )}
        >
          {estadoLabel(row.estadoEjecucion)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Horas reales</Label>
          <Input value={horas} onChange={(e) => setHoras(e.target.value)} disabled={!canEdit || saving} />
        </div>
        <div>
          <Label className="text-xs">Maquinista</Label>
          <Input value={maquinista} onChange={(e) => setMaquinista(e.target.value)} disabled={!canEdit || saving} />
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Incidencia</Label>
          <Input value={incidencia} onChange={(e) => setIncidencia(e.target.value)} disabled={!canEdit || saving} />
        </div>
        <div>
          <Label className="text-xs">Acción correctiva</Label>
          <Input value={accion} onChange={(e) => setAccion(e.target.value)} disabled={!canEdit || saving} />
        </div>
      </div>

      <div className="mt-2">
        <Label className="text-xs">Observaciones / densidades</Label>
        <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} disabled={!canEdit || saving} />
      </div>

      {pausePickerOpen && row.estadoEjecucion === "en_curso" ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-2">
          <div className="mb-2 flex items-center justify-between gap-2">
            <Label className="text-xs font-semibold text-amber-900">
              Selecciona motivo de pausa
            </Label>
            <button
              type="button"
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
              onClick={() => {
                setPausePickerOpen(false);
                setSelectedMotivoId("");
              }}
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {motivosPausa.map((motivo) => {
              const selected = selectedMotivoId === motivo.id;
              return (
                <button
                  key={motivo.id}
                  type="button"
                  disabled={saving}
                  onClick={() => setSelectedMotivoId(motivo.id)}
                  className={cn(
                    "min-h-14 rounded-lg border px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-white shadow-xs transition-transform",
                    "hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002147]",
                    selected ? "border-[#002147] ring-2 ring-[#002147]" : "border-white/50",
                  )}
                  style={{ backgroundColor: motivo.colorHex }}
                  title={`${motivo.label} · ${motivo.categoria}`}
                >
                  <span className="block leading-tight">{motivo.label}</span>
                  <span className="mt-1 block text-[9px] font-semibold opacity-80">
                    {motivo.categoria}
                  </span>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            className="mt-2 w-full bg-[#002147] text-white hover:bg-[#001735]"
            disabled={saving || !selectedMotivoId}
            onClick={() => {
              const motivo = motivosPausa.find((m) => m.id === selectedMotivoId) ?? null;
              onPause(motivo);
              setPausePickerOpen(false);
              setSelectedMotivoId("");
            }}
          >
            Confirmar pausa
          </Button>
        </div>
      ) : null}

      {row.estadoEjecucion === "pausada" ? (
        <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          Pausada {row.pausaActivaDesde ? `desde ${format(new Date(row.pausaActivaDesde), "dd/MM/yyyy HH:mm", { locale: es })}` : ""}.
          {row.motivoPausaActiva ? (
            <>
              {" Motivo: "}
              <span
                className="inline-flex rounded px-1 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: row.motivoPausaColorHexActiva ?? "#64748B" }}
              >
                {row.motivoPausaActiva}
              </span>
              .
            </>
          ) : ""}
          {row.minutosPausadaAcum > 0 ? ` Acumulado: ${row.minutosPausadaAcum} min.` : ""}
        </p>
      ) : null}
      {row.haEstadoPausada && pauses.length > 0 ? (
        <details className="mt-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
          <summary className="cursor-pointer font-medium">
            Historial pausas ({row.numPausas})
          </summary>
          <div className="mt-1 space-y-1">
            {pauses.slice(0, 5).map((p) => (
              <div key={p.id} className="rounded border border-slate-200 bg-white px-2 py-1">
                <div>
                  {format(new Date(p.pausedAt), "dd/MM HH:mm", { locale: es })}
                  {" → "}
                  {p.resumedAt
                    ? format(new Date(p.resumedAt), "dd/MM HH:mm", { locale: es })
                    : "abierta"}
                  {typeof p.minutosPausa === "number" && p.minutosPausa >= 0
                    ? ` · ${p.minutosPausa} min`
                    : ""}
                </div>
                <div className="flex flex-wrap items-center gap-1 text-slate-600">
                  <span
                    className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: p.motivoColorHex }}
                  >
                    {p.motivoLabel}
                  </span>
                  <span className="text-[10px] uppercase text-slate-500">
                    {p.motivoCategoria}
                  </span>
                  {p.observacionesPausa ? (
                    <span className="text-slate-500">· {p.observacionesPausa}</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          Plan: {row.horasPlanificadasSnapshot ?? "—"}h · Real: {row.horasReales ?? "—"}h
          {desviacion != null ? (
            <span className={cn("ml-2 font-semibold", desviacion > 0 ? "text-red-700" : "text-emerald-700")}>
              Desv. {desviacion >= 0 ? "+" : ""}{desviacion.toFixed(1)}h
            </span>
          ) : null}
        </p>
        <div className="flex gap-1.5">
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() =>
                onPatch({
                  horas_reales: Number(horas.replace(",", ".")) || null,
                  maquinista: maquinista.trim() || null,
                  incidencia: incidencia.trim() || null,
                  accion_correctiva: accion.trim() || null,
                  observaciones: observaciones.trim() || null,
                })
              }
            >
              {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Guardar
            </Button>
          ) : null}
          {row.estadoEjecucion === "en_curso" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setPausePickerOpen(true);
              }}
            >
              <Pause className="mr-1 size-4" /> Pausar
            </Button>
          ) : null}
          {isPendingStart ? (
            <Button
              type="button"
              size="sm"
              className="bg-emerald-700 text-white hover:bg-emerald-800"
              disabled={saving}
              onClick={onBegin}
            >
              <Play className="mr-1 size-4" /> Iniciar
            </Button>
          ) : null}
          {row.estadoEjecucion === "pausada" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                onResume(pauses);
                setPausePickerOpen(false);
                setSelectedMotivoId("");
              }}
            >
              <Play className="mr-1 size-4" /> Reanudar
            </Button>
          ) : null}
          {canEdit && !isPendingStart ? (
            <Button
              type="button"
              size="sm"
              className="bg-[#002147] text-white hover:bg-[#001735]"
              disabled={saving}
              onClick={() => {
                  onPatch({
                  estado_ejecucion: "finalizada",
                  fin_real_at: new Date().toISOString(),
                  horas_reales: Number(horas.replace(",", ".")) || null,
                  maquinista: maquinista.trim() || null,
                  incidencia: incidencia.trim() || null,
                  accion_correctiva: accion.trim() || null,
                  observaciones: observaciones.trim() || null,
                });
              }}
            >
              <CheckCircle2 className="mr-1 size-4" /> Finalizar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
