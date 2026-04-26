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
} from "@/types/planificacion-mesa";

const TABLE_EJECUCIONES = "prod_mesa_ejecuciones";
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
  inicio_real_at: string;
  fin_real_at: string | null;
  estado_ejecucion: EstadoEjecucionMesa;
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

function parseNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(r: EjecucionRow): MesaEjecucion {
  return {
    id: r.id,
    mesaTrabajoId: r.mesa_trabajo_id,
    ot: r.ot_numero,
    maquinaId: r.maquina_id,
    maquinaNombre: r.prod_maquinas?.nombre ?? "—",
    fechaPlanificada: r.fecha_planificada,
    turno: r.turno === "manana" || r.turno === "tarde" ? r.turno : null,
    slotOrden: r.slot_orden,
    inicioRealAt: r.inicio_real_at,
    finRealAt: r.fin_real_at,
    estadoEjecucion: r.estado_ejecucion,
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
  if (e === "en_curso") return "En curso";
  if (e === "pausada") return "Pausada";
  if (e === "finalizada") return "Finalizada";
  return "Cancelada";
}

export function PlanificacionOtsEjecucionTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<MesaEjecucion[]>([]);
  const [maquinas, setMaquinas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [selectedMaquina, setSelectedMaquina] = useState<string>("all");
  const [estado, setEstado] = useState<"activas" | EstadoEjecucionMesa | "all">("activas");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [execRes, maqRes] = await Promise.all([
        supabase
          .from(TABLE_EJECUCIONES)
          .select("*, prod_maquinas(nombre)")
          .order("inicio_real_at", { ascending: false }),
        supabase
          .from(TABLE_MAQUINAS)
          .select("id, nombre, tipo_maquina, activa")
          .eq("tipo_maquina", "impresion")
          .eq("activa", true)
          .order("nombre"),
      ]);
      if (execRes.error) throw execRes.error;
      if (maqRes.error) throw maqRes.error;
      setRows(((execRes.data ?? []) as unknown as EjecucionRow[]).map(mapRow));
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
      if (estado === "activas") return r.estadoEjecucion === "en_curso" || r.estadoEjecucion === "pausada";
      if (estado === "all") return true;
      return r.estadoEjecucion === estado;
    });
  }, [rows, selectedMaquina, estado]);

  const patchExecution = useCallback(
    async (row: MesaEjecucion, patch: Record<string, unknown>) => {
      setSavingId(row.id);
      try {
        const { error } = await supabase
          .from(TABLE_EJECUCIONES)
          .update({
            ...patch,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        if (error) throw error;
        if (patch.estado_ejecucion === "finalizada" && row.mesaTrabajoId) {
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
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar Excel.");
    }
  }, [filtered, selectedMaquinaLabel, estadoLabelFiltro]);

  const handleExportPdf = useCallback(() => {
    try {
      exportEjecucionesPdf(filtered, {
        maquina: selectedMaquinaLabel,
        estado: estadoLabelFiltro,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar PDF.");
    }
  }, [filtered, selectedMaquinaLabel, estadoLabelFiltro]);

  return (
    <Card className="border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-sm">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg text-[#002147]">OTs en ejecución</CardTitle>
            <CardDescription>
              Seguimiento manual de trabajos iniciados en máquina, sin integración directa con Optimus.
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

        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((row) => {
            const desviacion =
              row.horasReales != null && row.horasPlanificadasSnapshot != null
                ? row.horasReales - row.horasPlanificadasSnapshot
                : null;
            return (
              <ExecutionCard
                key={row.id}
                row={row}
                desviacion={desviacion}
                saving={savingId === row.id}
                onPatch={(patch) => void patchExecution(row, patch)}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutionCard({
  row,
  desviacion,
  saving,
  onPatch,
}: {
  row: MesaEjecucion;
  desviacion: number | null;
  saving: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const [horas, setHoras] = useState(row.horasReales != null ? String(row.horasReales) : "");
  const [incidencia, setIncidencia] = useState(row.incidencia ?? "");
  const [accion, setAccion] = useState(row.accionCorrectiva ?? "");
  const [maquinista, setMaquinista] = useState(row.maquinista ?? "");
  const [observaciones, setObservaciones] = useState(row.observaciones ?? "");

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
            Inicio: {format(new Date(row.inicioRealAt), "dd/MM/yyyy HH:mm", { locale: es })}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-1 text-[11px] font-semibold",
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
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => onPatch({ estado_ejecucion: "pausada" })}>
              <Pause className="mr-1 size-4" /> Pausar
            </Button>
          ) : null}
          {row.estadoEjecucion === "pausada" ? (
            <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => onPatch({ estado_ejecucion: "en_curso" })}>
              <Play className="mr-1 size-4" /> Reanudar
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              className="bg-[#002147] text-white hover:bg-[#001735]"
              disabled={saving}
              onClick={() =>
                onPatch({
                  estado_ejecucion: "finalizada",
                  fin_real_at: new Date().toISOString(),
                  horas_reales: Number(horas.replace(",", ".")) || null,
                  maquinista: maquinista.trim() || null,
                  incidencia: incidencia.trim() || null,
                  accion_correctiva: accion.trim() || null,
                  observaciones: observaciones.trim() || null,
                })
              }
            >
              <CheckCircle2 className="mr-1 size-4" /> Finalizar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
