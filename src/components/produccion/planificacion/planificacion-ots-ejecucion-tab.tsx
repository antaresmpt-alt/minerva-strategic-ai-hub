"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  ChevronDown,
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
import {
  etiquetaAmbitoPlanificacion,
  getPlanificacionTipoMaquinaFilter,
  PLANIFICACION_TIPOS_MAQUINA,
} from "@/lib/planificacion-ambito";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { getCamposConfigByProcesoId, PROCESO_CAMPOS_CONFIG } from "@/lib/hoja-ruta-campos-config";
import type { DatosProcesoGenerico } from "@/lib/hoja-ruta-campos-config";
import { DatosProcesoForm } from "@/components/produccion/hoja-ruta/datos-proceso-form";
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
const TABLE_OT_PASOS = "prod_ot_pasos";
const TABLE_DESPACHO = "produccion_ot_despachadas";
const TABLE_OTS_GENERAL = "prod_ots_general";
const TABLE_TROQUELES = "prod_troqueles";

type DespachoInfo = {
  cliente: string | null;
  cantidad: number | null;
  titulo: string | null;
  material: string | null;
  gramaje: number | null;
  tamanoHoja: string | null;
  hojasBrutas: number | null;
  hojasNetas: number | null;
  tintas: string | null;
  acabadoPral: string | null;
  troquel: string | null;
  poses: number | null;
  tamanoCorte: string | null;
  pinza: number | null;
  expulsor: "mascle" | "femella" | "completo" | null;
  cauchoAcrilico: string | null;
  horasEntrada: number | null;
  horasTiraje: number | null;
  horasTroquelado: number | null;
  horasEngomado: number | null;
  fechaEntrega: string | null;
};

type TroquelInfoRow = {
  num_troquel: string | null;
  mides: string | null;
  num_figuras: number | string | null;
  figuras_hoja: number | string | null;
  pinza: number | string | null;
  expulsion: string | null;
  num_expulsion: string | null;
  caucho_acrilico: string | null;
};

type EjecucionRow = {
  id: string;
  mesa_trabajo_id: string | null;
  ot_paso_id: string | null;
  ot_numero: string;
  maquina_id: string;
  prod_maquinas?: { nombre: string | null; tipo_maquina: string | null } | null;
  prod_ot_pasos?: { proceso_id: number | null; datos_proceso: Record<string, unknown> | null } | null;
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
  horas_reales_entrada: number | string | null;
  horas_reales_tiraje: number | string | null;
  horas_reales_troquelado: number | string | null;
  horas_reales_engomado: number | string | null;
  num_hojas_producidas: number | string | null;
  cantidad_unidades: number | string | null;
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

function normalizeTroquelKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function mapExpulsor(value: unknown): DespachoInfo["expulsor"] {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("complet")) return "completo";
  if (raw.includes("mascle") || raw.includes("macho")) return "mascle";
  if (raw.includes("femella") || raw.includes("hembra")) return "femella";
  return null;
}

function parseMeasurementNumber(value: unknown): number | null {
  const raw = String(value ?? "").trim().replace(",", ".");
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  return parseNum(match[0]);
}

function mapTroquelRow(row: TroquelInfoRow) {
  const poses = parseNum(row.num_figuras) ?? parseNum(row.figuras_hoja);
  return {
    tamanoCorte: row.mides?.trim() || null,
    poses,
    pinza: parseMeasurementNumber(row.pinza),
    expulsor: mapExpulsor(row.expulsion ?? row.num_expulsion),
    cauchoAcrilico: row.caucho_acrilico?.trim() || null,
  };
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

type SalidaAnteriorInfo = {
  procesoAnteriorId: number;
  salida: number;
  nombre: string;
};

function mapRow(
  r: EjecucionRow,
  pausesByExecutionId: Map<string, MesaEjecucionPausa[]>,
  salidaAnteriorByOt: Map<string, SalidaAnteriorInfo>,
): MesaEjecucion {
  const pauses = pausesByExecutionId.get(r.id) ?? [];
  const openPause = pauses.find((p) => p.resumedAt == null) ?? null;
  const pasoJoin = r.prod_ot_pasos;
  const pid = pasoJoin?.proceso_id;
  const salidaAnterior = salidaAnteriorByOt.get(r.ot_numero.trim()) ?? null;
  return {
    id: r.id,
    mesaTrabajoId: r.mesa_trabajo_id,
    otPasoId: r.ot_paso_id,
    procesoId: typeof pid === "number" && Number.isFinite(pid) ? pid : null,
    datosProcesoJson: pasoJoin?.datos_proceso ?? null,
    procesoAnteriorId: salidaAnterior?.procesoAnteriorId ?? null,
    salidaProcesoAnterior: salidaAnterior?.salida ?? null,
    salidaProcesoAnteriorNombre: salidaAnterior?.nombre ?? null,
    ot: r.ot_numero,
    maquinaId: r.maquina_id,
    maquinaNombre: r.prod_maquinas?.nombre ?? "—",
    maquinaTipo: r.prod_maquinas?.tipo_maquina ?? null,
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
    horasRealesEntrada: parseNum(r.horas_reales_entrada),
    horasRealesTiraje: parseNum(r.horas_reales_tiraje),
    horasRealesTroquelado: parseNum(r.horas_reales_troquelado),
    horasRealesEngomado: parseNum(r.horas_reales_engomado),
    numHojasProducidas: parseNum(r.num_hojas_producidas),
    cantidadUnidades: parseNum(r.cantidad_unidades),
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

export function PlanificacionOtsEjecucionTab({
  tabletMode = false,
}: {
  tabletMode?: boolean;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<MesaEjecucion[]>([]);
  const [pausesByExecutionId, setPausesByExecutionId] = useState<Record<string, MesaEjecucionPausa[]>>({});
  const [despachoByOt, setDespachoByOt] = useState<Record<string, DespachoInfo>>({});
  const [motivosPausa, setMotivosPausa] = useState<MotivoPausa[]>([]);
  const [maquinas, setMaquinas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [selectedMaquina, setSelectedMaquina] = useState<string>("all");
  const [estado, setEstado] = useState<"activas" | EstadoEjecucionMesa | "all">("activas");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [planificacionRole, setPlanificacionRole] = useState<string | null>(null);

  const etiquetaAmbitoEjecucion = useMemo(
    () => etiquetaAmbitoPlanificacion(getPlanificacionTipoMaquinaFilter(planificacionRole)),
    [planificacionRole],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let roleRead: string | null = null;
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const uid =
        typeof authUser?.id === "string" && authUser.id.trim().length > 0
          ? authUser.id.trim()
          : null;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        roleRead =
          prof && typeof (prof as { role?: unknown }).role === "string"
            ? String((prof as { role: string }).role).trim() || null
            : null;
      }
      setPlanificacionRole(roleRead);
      const tipoFiltro = getPlanificacionTipoMaquinaFilter(roleRead);

      let maqQuery = supabase
        .from(TABLE_MAQUINAS)
        .select("id, nombre, tipo_maquina, activa")
        .eq("activa", true)
        .order("nombre");
      if (tipoFiltro) {
        maqQuery = maqQuery.eq("tipo_maquina", tipoFiltro);
      } else {
        maqQuery = maqQuery.in("tipo_maquina", PLANIFICACION_TIPOS_MAQUINA);
      }

      const [execRes, maqRes, motivosRes] = await Promise.all([
        supabase
          .from(TABLE_EJECUCIONES)
          .select("*, prod_maquinas(nombre,tipo_maquina), prod_ot_pasos(proceso_id,datos_proceso)")
          .order("updated_at", { ascending: false }),
        maqQuery,
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
      const maqRowsRaw = (maqRes.data ?? []) as Array<{
        id: string;
        nombre: string;
        tipo_maquina: string | null;
      }>;
      const tiposPlan = new Set<string>(PLANIFICACION_TIPOS_MAQUINA);
      const maqRows = maqRowsRaw.filter((m) =>
        tiposPlan.has(String(m.tipo_maquina ?? "").trim()),
      );
      const allowedMaquinaIds = new Set(maqRows.map((m) => m.id));
      const execRows = ((execRes.data ?? []) as unknown as EjecucionRow[]).filter(
        (r) => allowedMaquinaIds.has(String(r.maquina_id ?? "").trim()),
      );
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
      const otNumeros = [...new Set(execRows.map((r) => r.ot_numero.trim()).filter(Boolean))];
      const despachoMap: Record<string, DespachoInfo> = {};
      if (otNumeros.length > 0) {
        const { data: despData } = await supabase
          .from(TABLE_DESPACHO)
          .select(`
            ot_numero,
            material,
            gramaje,
            tamano_hoja,
            num_hojas_brutas,
            num_hojas_netas,
            tintas,
            acabado_pral,
            troquel,
            poses,
            horas_entrada,
            horas_tiraje,
            horas_estimadas_troquelado,
            horas_estimadas_engomado
          `)
          .in("ot_numero", otNumeros);
        const { data: generalData } = await supabase
          .from(TABLE_OTS_GENERAL)
          .select("num_pedido, cliente, cantidad, titulo, fecha_entrega")
          .in("num_pedido", otNumeros);
        const generalMap = new Map<string, { cliente: string | null; cantidad: number | null; titulo: string | null; fechaEntrega: string | null }>();
        for (const g of (generalData ?? []) as Array<{ num_pedido?: string; cliente?: string | null; cantidad?: number | null; titulo?: string | null; fecha_entrega?: string | null }>) {
          const ot = String(g.num_pedido ?? "").trim();
          if (ot) {
            generalMap.set(ot, {
              cliente: g.cliente ?? null,
              cantidad: typeof g.cantidad === "number" ? g.cantidad : null,
              titulo: g.titulo ?? null,
              fechaEntrega: g.fecha_entrega ?? null,
            });
          }
        }
        const troquelNums = [
          ...new Set(
            ((despData ?? []) as Array<{ troquel?: string | null }>)
              .map((d) => String(d.troquel ?? "").trim())
              .filter(Boolean),
          ),
        ];
        const troquelMap = new Map<string, ReturnType<typeof mapTroquelRow>>();
        if (troquelNums.length > 0) {
          const { data: troqData, error: troqErr } = await supabase
            .from(TABLE_TROQUELES)
            .select("num_troquel,mides,num_figuras,figuras_hoja,pinza,expulsion,num_expulsion,caucho_acrilico")
            .in("num_troquel", troquelNums);
          if (troqErr) throw troqErr;
          for (const t of (troqData ?? []) as TroquelInfoRow[]) {
            const key = normalizeTroquelKey(t.num_troquel);
            if (key) troquelMap.set(key, mapTroquelRow(t));
          }
        }
        for (const d of (despData ?? []) as Array<{
          ot_numero?: string;
          material?: string | null;
          gramaje?: number | null;
          tamano_hoja?: string | null;
          num_hojas_brutas?: number | null;
          num_hojas_netas?: number | null;
          tintas?: string | null;
          acabado_pral?: string | null;
          troquel?: string | null;
          poses?: number | null;
          horas_entrada?: number | null;
          horas_tiraje?: number | null;
          horas_estimadas_troquelado?: number | null;
          horas_estimadas_engomado?: number | null;
        }>) {
          const ot = String(d.ot_numero ?? "").trim();
          if (!ot) continue;
          const gen = generalMap.get(ot);
          const troq = troquelMap.get(normalizeTroquelKey(d.troquel));
          despachoMap[ot] = {
            cliente: gen?.cliente ?? null,
            cantidad: gen?.cantidad ?? null,
            titulo: gen?.titulo ?? null,
            material: d.material ?? null,
            gramaje: typeof d.gramaje === "number" ? d.gramaje : null,
            tamanoHoja: d.tamano_hoja ?? null,
            hojasBrutas: typeof d.num_hojas_brutas === "number" ? d.num_hojas_brutas : null,
            hojasNetas: typeof d.num_hojas_netas === "number" ? d.num_hojas_netas : null,
            tintas: d.tintas ?? null,
            acabadoPral: d.acabado_pral ?? null,
            troquel: d.troquel ?? null,
            poses: parseNum(d.poses) ?? troq?.poses ?? null,
            tamanoCorte: troq?.tamanoCorte ?? null,
            pinza: troq?.pinza ?? null,
            expulsor: troq?.expulsor ?? null,
            cauchoAcrilico: troq?.cauchoAcrilico ?? null,
            horasEntrada: typeof d.horas_entrada === "number" ? d.horas_entrada : null,
            horasTiraje: typeof d.horas_tiraje === "number" ? d.horas_tiraje : null,
            horasTroquelado: typeof d.horas_estimadas_troquelado === "number" ? d.horas_estimadas_troquelado : null,
            horasEngomado: typeof d.horas_estimadas_engomado === "number" ? d.horas_estimadas_engomado : null,
            fechaEntrega: gen?.fechaEntrega ?? null,
          };
        }
      }

      // Cargar salidas del paso anterior para el encadenado (Bloque 2.5)
      const salidaAnteriorByOt = new Map<string, SalidaAnteriorInfo>();
      if (otNumeros.length > 0) {
        // Para cada ejecución activa, buscamos el último paso completado de la misma OT
        // cuyo proceso_id sea compatible como entrada (inputFromProcessIds del proceso actual)
        const { data: pasosData } = await supabase
          .from(TABLE_OT_PASOS)
          .select("ot_numero, proceso_id, estado, datos_proceso, orden")
          .in("ot_numero", otNumeros)
          .eq("estado", "finalizado")
          .order("ot_numero")
          .order("orden", { ascending: false });

        const pasosPorOt = new Map<string, Array<{ proceso_id: number | null; datos_proceso: Record<string, unknown> | null; orden: number | null }>>();
        for (const p of (pasosData ?? []) as Array<{ ot_numero: string; proceso_id: number | null; estado: string; datos_proceso: Record<string, unknown> | null; orden: number | null }>) {
          const ot = String(p.ot_numero ?? "").trim();
          if (!ot) continue;
          const list = pasosPorOt.get(ot) ?? [];
          list.push({ proceso_id: p.proceso_id, datos_proceso: p.datos_proceso, orden: p.orden });
          pasosPorOt.set(ot, list);
        }

        for (const execRow of execRows) {
          const ot = execRow.ot_numero.trim();
          const pid = execRow.prod_ot_pasos?.proceso_id;
          if (!pid) continue;
          const procesoConfig = PROCESO_CAMPOS_CONFIG[pid];
          const inputIds = procesoConfig?.inputFromProcessIds;
          if (!inputIds || inputIds.length === 0) continue;

          const pasosOt = pasosPorOt.get(ot) ?? [];
          // Busca el paso finalizado más reciente cuyo proceso sea compatible
          for (const candidatePid of inputIds) {
            const paso = pasosOt.find((p) => p.proceso_id === candidatePid);
            if (!paso?.datos_proceso) continue;
            const candidateConfig = PROCESO_CAMPOS_CONFIG[candidatePid];
            if (!candidateConfig?.outputField) continue;
            const rawVal = paso.datos_proceso[candidateConfig.outputField];
            const val = typeof rawVal === "number" ? rawVal : (typeof rawVal === "string" ? Number(rawVal) : null);
            if (val == null || !Number.isFinite(val)) continue;
            salidaAnteriorByOt.set(ot, {
              procesoAnteriorId: candidatePid,
              salida: val,
              nombre: candidateConfig.procesoNombre,
            });
            break;
          }
        }
      }

      setPausesByExecutionId(
        Object.fromEntries(Array.from(pauseMap.entries()).map(([k, v]) => [k, v] as const)),
      );
      setDespachoByOt(despachoMap);
      setRows(execRows.map((r) => mapRow(r, pauseMap, salidaAnteriorByOt)));
      setMotivosPausa(motivos);
      setMaquinas(
        maqRows.map((m) => ({
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
    async (row: MesaEjecucion, patch: Record<string, unknown>, datosProcesoUpdate?: DatosProcesoGenerico | null) => {
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
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        const updatedBy =
          typeof authUser?.id === "string" && authUser.id.trim().length > 0
            ? authUser.id.trim()
            : null;
        const updatedByEmail =
          typeof authUser?.email === "string" && authUser.email.trim().length > 0
            ? authUser.email.trim()
            : null;
        const { error } = await supabase
          .from(TABLE_EJECUCIONES)
          .update({
            ...nextPatch,
            updated_at: new Date().toISOString(),
            updated_by: updatedBy,
            updated_by_email: updatedByEmail,
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
        if (datosProcesoUpdate && row.otPasoId) {
          const { error: dpErr } = await supabase
            .from(TABLE_OT_PASOS)
            .update({ datos_proceso: datosProcesoUpdate })
            .eq("id", row.otPasoId);
          if (dpErr) throw dpErr;
        }
        /* prod_planificacion_pool: sincronizado por trigger prod_trg_mesa_ejecucion_itinerario_finaliza
           (en_transito si quedan pasos; cerrada solo con itinerario completo; sin ot_paso_id -> cerrada). */
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
            {!tabletMode && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={handleExportExcel} disabled={loading}>
                  <FileSpreadsheet className="mr-1 size-4" />
                  Excel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleExportPdf} disabled={loading}>
                  <FileText className="mr-1 size-4" />
                  PDF
                </Button>
              </>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
              <RefreshCcw className={cn("mr-1 size-4", loading && "animate-spin")} />
              Recargar
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700">
            Ámbito: {etiquetaAmbitoEjecucion}
          </span>
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
                      despacho={despachoByOt[row.ot] ?? null}
                      pauses={pausesByExecutionId[row.id] ?? []}
                      motivosPausa={motivosPausa}
                      desviacion={desviacion}
                      saving={savingId === row.id}
                      onPatch={(patch, dp) => void patchExecution(row, patch, dp)}
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
  despacho,
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
  despacho: DespachoInfo | null;
  pauses: MesaEjecucionPausa[];
  motivosPausa: MotivoPausa[];
  desviacion: number | null;
  saving: boolean;
  onPatch: (patch: Record<string, unknown>, datosProcesoUpdate?: DatosProcesoGenerico | null) => void;
  onBegin: () => void;
  onPause: (motivo: MotivoPausa | null) => void;
  onResume: (pauses: MesaEjecucionPausa[]) => void;
}) {
  const [incidencia, setIncidencia] = useState(row.incidencia ?? "");
  const [accion, setAccion] = useState(row.accionCorrectiva ?? "");
  const [maquinista, setMaquinista] = useState(row.maquinista ?? "");
  const [observaciones, setObservaciones] = useState(row.observaciones ?? "");
  const [pausePickerOpen, setPausePickerOpen] = useState(false);
  const [selectedMotivoId, setSelectedMotivoId] = useState("");
  const [datosProcesoOpen, setDatosProcesoOpen] = useState(false);

  const [datosProcesoLocal, setDatosProcesoLocal] = useState<DatosProcesoGenerico>(() => {
    const existing = (row.datosProcesoJson as DatosProcesoGenerico) ?? {};
    if (Object.keys(existing).length > 0) return existing;
    if (!despacho || !row.procesoId) return {};
    const pid = row.procesoId;
    const base: DatosProcesoGenerico = {};
    if (pid === 1 || pid === 2) {
      if (despacho.hojasBrutas != null) base.hojas_brutas = despacho.hojasBrutas;
      if (despacho.hojasNetas != null) base.hojas_netas = despacho.hojasNetas;
      if (despacho.tamanoHoja) base.formato_hojas = despacho.tamanoHoja;
      if (despacho.tintas) base.tintas_cara = despacho.tintas;
      if (despacho.acabadoPral) base.acabado_principal = despacho.acabadoPral;
      if (despacho.horasEntrada != null) base.horas_entrada_previsto = despacho.horasEntrada;
      if (despacho.horasTiraje != null) base.horas_impresion_previsto = despacho.horasTiraje;
    }
    if (pid === 10) {
      if (despacho.troquel) base.troquel = despacho.troquel;
      if (despacho.poses != null) base.poses = despacho.poses;
      if (despacho.tamanoCorte) base.tamano_corte = despacho.tamanoCorte;
      if (despacho.pinza != null) base.pinza = despacho.pinza;
      if (despacho.expulsor) base.expulsor = despacho.expulsor;
      if (despacho.cauchoAcrilico) base.codigo_caucho = despacho.cauchoAcrilico;
      if (despacho.hojasBrutas != null) base.hojas_troquelar = despacho.hojasBrutas;
      if (despacho.horasTroquelado != null) {
        base.horas_preparacion_previsto = Math.round(despacho.horasTroquelado * 0.3 * 10) / 10;
        base.horas_tiraje_previsto = Math.round(despacho.horasTroquelado * 0.7 * 10) / 10;
      }
    }
    if (pid === 12) {
      if (despacho.cantidad != null) base.estuches_realizar = despacho.cantidad;
      if (despacho.horasEngomado != null) base.tiempo_previsto = despacho.horasEngomado;
    }
    return base;
  });

  const hasCamposConfig = useMemo(
    () => row.procesoId != null && getCamposConfigByProcesoId(row.procesoId) != null,
    [row.procesoId],
  );

  const isPendingStart = row.estadoEjecucion === "pendiente_inicio";
  const canEdit = row.estadoEjecucion !== "finalizada" && row.estadoEjecucion !== "cancelada";

  const buildSyncPatch = useCallback((): Record<string, unknown> => {
    const sync: Record<string, unknown> = {};
    const dp = datosProcesoLocal;
    const pid = row.procesoId;
    if (!pid) return sync;
    if (pid === 1 || pid === 2) {
      const horasImpReal = parseNum(dp.horas_impresion_real);
      if (horasImpReal != null) sync.horas_reales = horasImpReal;
      const horasEntReal = parseNum(dp.horas_entrada_real);
      if (horasEntReal != null) sync.horas_reales_entrada = horasEntReal;
      const horasTirReal = parseNum(dp.horas_impresion_real);
      if (horasTirReal != null) sync.horas_reales_tiraje = horasTirReal;
      const hojasImp = parseNum(dp.hojas_impresas);
      if (hojasImp != null) sync.num_hojas_producidas = hojasImp;
    }
    if (pid === 10) {
      const hPrep = parseNum(dp.horas_preparacion_real);
      const hTir = parseNum(dp.horas_tiraje_real);
      const totalTroq = (hPrep ?? 0) + (hTir ?? 0);
      if (totalTroq > 0) sync.horas_reales_troquelado = totalTroq;
      const hojasTroq = parseNum(dp.hojas_troqueladas);
      if (hojasTroq != null) sync.num_hojas_producidas = hojasTroq;
    }
    if (pid === 12) {
      const tReal = parseNum(dp.tiempo_real);
      if (tReal != null) sync.horas_reales_engomado = tReal;
      const estEng = parseNum(dp.estuches_engomados);
      if (estEng != null) sync.cantidad_unidades = estEng;
    }
    return sync;
  }, [datosProcesoLocal, row.procesoId]);

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

      {despacho ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 rounded border border-slate-200 bg-slate-50/70 px-2 py-1.5 text-[10px] text-slate-600">
          {despacho.cliente ? <span><b>Cliente:</b> {despacho.cliente}</span> : null}
          {despacho.cantidad != null ? <span><b>Cant:</b> {despacho.cantidad.toLocaleString("es-ES")}</span> : null}
          {despacho.titulo ? <span className="max-w-[200px] truncate" title={despacho.titulo}><b>Trabajo:</b> {despacho.titulo}</span> : null}
          {despacho.fechaEntrega ? <span><b>Entrega:</b> {format(new Date(despacho.fechaEntrega), "dd/MM/yy", { locale: es })}</span> : null}
          {despacho.material ? <span><b>Mat:</b> {despacho.material} {despacho.gramaje ? `${despacho.gramaje}g` : ""}</span> : null}
          {despacho.tamanoHoja ? <span><b>Formato:</b> {despacho.tamanoHoja}</span> : null}
          {despacho.hojasBrutas != null ? <span><b>H.brutas:</b> {despacho.hojasBrutas.toLocaleString("es-ES")}</span> : null}
          {despacho.hojasNetas != null ? <span><b>H.netas:</b> {despacho.hojasNetas.toLocaleString("es-ES")}</span> : null}
          {despacho.tintas ? <span><b>Tintas:</b> {despacho.tintas}</span> : null}
          {despacho.acabadoPral ? <span><b>Acabado:</b> {despacho.acabadoPral}</span> : null}
          {despacho.troquel ? <span><b>Troquel:</b> {despacho.troquel}</span> : null}
          {despacho.poses != null ? <span><b>Poses:</b> {despacho.poses}</span> : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Maquinista</Label>
          <Input value={maquinista} onChange={(e) => setMaquinista(e.target.value)} disabled={!canEdit || saving} />
        </div>
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
        <Label className="text-xs">Observaciones</Label>
        <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} disabled={!canEdit || saving} />
      </div>

      {row.salidaProcesoAnterior != null && row.procesoId != null ? (() => {
        const procesoConfig = PROCESO_CAMPOS_CONFIG[row.procesoId];
        const outputUnit = procesoConfig?.inputFromProcessIds
          ? (PROCESO_CAMPOS_CONFIG[row.procesoAnteriorId ?? 0]?.outputUnit ?? "uds")
          : "uds";
        const cantidad = despacho?.cantidad ?? null;
        const poses = (datosProcesoLocal.poses as number | undefined) ?? null;
        const salidaRaw = row.salidaProcesoAnterior;

        let proyeccion: number | null = null;
        let proyeccionLabel = "";
        if (row.procesoId === 10) {
          proyeccion = salidaRaw;
          proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} hojas → sin datos de poses aún`;
          if (poses != null && poses > 0) {
            const est = Math.floor(salidaRaw * poses);
            proyeccion = est;
            proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} hojas × ${poses} poses = ${est.toLocaleString("es-ES")} estuches est.`;
          }
        } else if (row.procesoId === 12) {
          proyeccion = salidaRaw;
          proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} hojas troqueladas de entrada`;
          if (poses != null && poses > 0) {
            const est = Math.floor(salidaRaw * poses);
            proyeccion = est;
            proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} hojas × ${poses} poses = ${est.toLocaleString("es-ES")} estuches est.`;
          }
        } else {
          proyeccion = salidaRaw;
          proyeccionLabel = `${salidaRaw.toLocaleString("es-ES")} ${outputUnit}`;
        }

        const MARGEN_PCT = 0.05;
        let semaforoColor = "";
        let semaforoIcon = "";
        let semaforoTexto = "";
        if (cantidad != null && proyeccion != null) {
          if (proyeccion >= cantidad) {
            semaforoColor = "bg-emerald-50 border-emerald-300 text-emerald-800";
            semaforoIcon = "🟢";
            semaforoTexto = `OK — proyección (${proyeccion.toLocaleString("es-ES")}) ≥ pedido (${cantidad.toLocaleString("es-ES")})`;
          } else if (proyeccion >= cantidad * (1 - MARGEN_PCT)) {
            semaforoColor = "bg-amber-50 border-amber-300 text-amber-800";
            semaforoIcon = "🟡";
            semaforoTexto = `AJUSTADO — proyección (${proyeccion.toLocaleString("es-ES")}) dentro del ±5% del pedido (${cantidad.toLocaleString("es-ES")})`;
          } else {
            semaforoColor = "bg-red-50 border-red-300 text-red-800";
            semaforoIcon = "🔴";
            semaforoTexto = `DÉFICIT — proyección (${proyeccion.toLocaleString("es-ES")}) por debajo del pedido (${cantidad.toLocaleString("es-ES")})`;
          }
        }

        return (
          <div className={cn("mt-3 rounded-lg border px-3 py-2 text-[11px]", semaforoColor || "bg-slate-50 border-slate-200 text-slate-700")}>
            <p className="font-semibold text-[10px] uppercase tracking-wide opacity-70 mb-1">
              Entrada desde proceso anterior · {row.salidaProcesoAnteriorNombre}
            </p>
            <p className="font-mono font-bold text-sm">
              {semaforoIcon} {salidaRaw.toLocaleString("es-ES")} {outputUnit}
            </p>
            <p className="mt-0.5 opacity-80">{proyeccionLabel}</p>
            {semaforoTexto ? <p className="mt-1 font-semibold">{semaforoTexto}</p> : null}
          </div>
        );
      })() : null}

      {hasCamposConfig && row.procesoId != null ? (
        <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/40">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-100/60"
            onClick={() => setDatosProcesoOpen((o) => !o)}
          >
            <span>Datos del proceso</span>
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                datosProcesoOpen && "rotate-180",
              )}
            />
          </button>
          {datosProcesoOpen ? (
            <div className="border-t border-indigo-200 px-3 py-3">
              <DatosProcesoForm
                procesoId={row.procesoId}
                datosInicial={datosProcesoLocal}
                onChange={setDatosProcesoLocal}
                readonly={!canEdit}
              />
            </div>
          ) : null}
        </div>
      ) : null}

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
                onPatch(
                  {
                    maquinista: maquinista.trim() || null,
                    incidencia: incidencia.trim() || null,
                    accion_correctiva: accion.trim() || null,
                    observaciones: observaciones.trim() || null,
                    ...buildSyncPatch(),
                  },
                  hasCamposConfig ? datosProcesoLocal : null,
                )
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
                onPatch(
                  {
                    estado_ejecucion: "finalizada",
                    fin_real_at: new Date().toISOString(),
                    maquinista: maquinista.trim() || null,
                    incidencia: incidencia.trim() || null,
                    accion_correctiva: accion.trim() || null,
                    observaciones: observaciones.trim() || null,
                    ...buildSyncPatch(),
                  },
                  hasCamposConfig ? datosProcesoLocal : null,
                );
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
