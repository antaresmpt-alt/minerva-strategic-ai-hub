"use client";

import {
  ArrowUpDown,
  CheckCircle2,
  Circle,
  Droplet,
  Edit3,
  Eye,
  Loader2,
  Printer,
  Search,
  Send,
} from "lucide-react";
import {
  type FocusEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  COMPRAS_MATERIAL_ESTADOS,
  normalizeCompraEstado,
} from "@/lib/compras-material-estados";
import {
  etiquetaAmbitoPlanificacion,
  fetchProximoPasoDisponiblePorOt,
  getPlanificacionTipoMaquinaFilter,
  PLANIFICACION_TIPOS_MAQUINA,
  type PlanificacionTipoMaquina,
  type ProximoPasoInfo,
} from "@/lib/planificacion-ambito";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_OTS_GENERAL = "prod_ots_general";
const TABLE_COMPRA = "prod_compra_material";
const TABLE_PROVEEDORES = "prod_proveedores";
const TABLE_RECEPCION = "prod_recepciones_material";
const TABLE_TROQUELES = "prod_troqueles";
const TABLE_POOL = "prod_planificacion_pool";
/** Estados de pool que pueden leerse desde despacho; `cerrada` = itinerario completo (se excluye del listado). */
const POOL_ESTADOS_INCLUIDOS = ["pendiente", "enviada_mesa", "en_transito", "cerrada"] as const;
/** Filas de pool que pueden reenviarse a mesa o actualizarse (nunca `cerrada` = itinerario completo). */
const POOL_ESTADOS_PARA_MESA = ["pendiente", "enviada_mesa", "en_transito"] as const;
const TABLE_MESA = "prod_mesa_planificacion_trabajos";
const TABLE_MAQUINAS = "prod_maquinas";
const POOL_UI_STATE_KEY = "produccion.poolOts.uiState.v1";

/** OT con al menos un trabajo en mesa (hueco asignado en el calendario). */
const MESA_ESTADOS_PLANIFICADA = [
  "borrador",
  "confirmado",
  "en_ejecucion",
  "finalizada",
] as const;

type SortKey = "entrega" | "ot" | "cliente";
type TroquelStatus = "ok" | "falta" | "no_aplica" | "sin_informar";
type TroquelModo = "informado" | "no_aplica" | "sin_informar";

type PoolAmbitoFiltroUi = "all" | PlanificacionTipoMaquina;

type PoolUiState = {
  search: string;
  sortBy: SortKey;
  sortDir: "asc" | "desc";
  compraEstadoFilter: string;
  areaTipoFilter: PoolAmbitoFiltroUi;
};

type DespRow = {
  ot_numero: string;
  tintas: string | null;
  material: string | null;
  num_hojas_brutas: number | null;
  horas_entrada: number | null;
  horas_tiraje: number | null;
  troquel: string | null;
  poses: number | null;
  acabado_pral: string | null;
  despachado_at: string | null;
};

type OtRow = {
  num_pedido: string;
  cliente: string | null;
  titulo: string | null;
  fecha_entrega: string | null;
};

type CompraRow = {
  id: string;
  ot_numero: string;
  num_compra: string | null;
  proveedor_id: string | null;
  estado: string | null;
};
type RecepRow = { compra_id: string; hojas_recibidas: number | null };
type PoolPersisted = {
  id: string;
  ot_numero: string;
  estado_pool: string | null;
  troquel_status: string | null;
  acabado_pral_snapshot: string | null;
};

type PoolRow = {
  ot: string;
  cliente: string;
  trabajo: string;
  material: string;
  tintas: string;
  acabadoPral: string;
  fechaEntrega: string | null;
  hojasObjetivo: number;
  hojasRecibidasTotal: number;
  numCompra: string | null;
  compraEstado: string;
  compraProveedor: string | null;
  compraProveedorExtraCount: number;
  hasCompraGenerada: boolean;
  materialStatus: "verde" | "amarillo" | "rojo";
  troquelLabel: string;
  troquelId: string | null;
  cauchoAcrilico: string | null;
  troquelStatus: TroquelStatus;
  troquelModo: TroquelModo;
  poses: number | null;
  horasEntrada: number;
  horasTiraje: number;
  horasTotal: number;
  proximoPasoNombre: string | null;
  proximoPasoSlug: string | null;
  planificacionTipoPaso: PlanificacionTipoMaquina | null;
  /** `estado_pool === enviada_mesa`: en cola para la mesa, aún sin huecos obligatorios. */
  enColaMesa: boolean;
  /** Al menos una fila en `prod_mesa_planificacion_trabajos` en estado de plan ya asignado. */
  planificadaEnMesa: boolean;
  /** `estado_pool === en_transito`: fase anterior cerrada en mesa, itinerario sigue (p. ej. a troquel). */
  poolEnTransitoFase: boolean;
};

type DraftRow = {
  trabajo: string;
  tintas: string;
  troquel: string;
  troquelModo: TroquelModo;
  acabadoPral: string;
  horasEntrada: string;
  horasTiraje: string;
};

function parseNum(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseNonNegative(v: string): number {
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function entregaClass(fechaEntrega: string | null): string {
  if (!fechaEntrega) return "bg-slate-100 text-slate-700";
  const d = new Date(fechaEntrega);
  if (Number.isNaN(d.getTime())) return "bg-slate-100 text-slate-700";
  const diffDays = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (diffDays <= 1) return "bg-red-100 text-red-800";
  if (diffDays <= 3) return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

function resolveTroquelStatus(
  modo: TroquelModo,
  troquel: string,
  troquelesExistentes: Set<string>
): TroquelStatus {
  if (modo === "no_aplica") return "no_aplica";
  if (modo === "sin_informar" || troquel.trim() === "") return "sin_informar";
  return troquelesExistentes.has(troquel.trim()) ? "ok" : "falta";
}

function readErrorFromJsonBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const err = (body as { error?: unknown }).error;
  return typeof err === "string" && err.trim() ? err.trim() : null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };
    const message =
      (typeof candidate.message === "string" && candidate.message.trim()) ||
      (typeof candidate.error === "string" && candidate.error.trim()) ||
      (typeof candidate.details === "string" && candidate.details.trim()) ||
      (typeof candidate.hint === "string" && candidate.hint.trim()) ||
      (typeof candidate.code === "string" && candidate.code.trim()) ||
      "";
    if (message) return message;
  }
  return fallback;
}

function normalizeCauchoFileList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim()) {
      out.push(item.trim());
    } else if (item && typeof item === "object" && "name" in item) {
      const name = (item as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) out.push(name.trim());
    }
  }
  return out;
}

function cauchoAcrilicoShowsViewer(v: string | null): boolean {
  const t = (v ?? "").trim();
  return t !== "" && t.toUpperCase().includes("SI");
}

function compraEstadoRank(estado: string | null | undefined): number {
  const n = normalizeCompraEstado(estado);
  if (n === "recibido") return 5;
  if (n === "recibido parcial") return 4;
  if (n === "confirmado") return 3;
  if (n === "generada") return 2;
  if (n === "pendiente") return 1;
  if (n === "cancelado") return 0;
  return -1;
}

function statusPill(
  status: "verde" | "amarillo" | "rojo" | "gris",
  label: string
): ReactElement {
  const classes =
    status === "verde"
      ? "bg-emerald-100 text-emerald-800"
      : status === "amarillo"
        ? "bg-amber-100 text-amber-800"
        : status === "rojo"
          ? "bg-red-100 text-red-800"
          : "bg-slate-100 text-slate-700";
  const dot =
    status === "verde"
      ? "bg-emerald-600"
      : status === "amarillo"
        ? "bg-amber-500"
        : status === "rojo"
          ? "bg-red-600"
          : "bg-slate-400";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${classes}`}>
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  );
}

export function PlanificacionPoolOtsTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<PoolRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("entrega");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [compraEstadoFilter, setCompraEstadoFilter] = useState<string>("all");
  const [areaTipoFilter, setAreaTipoFilter] = useState<PoolAmbitoFiltroUi>("all");
  const [editingOt, setEditingOt] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [savedRowOt, setSavedRowOt] = useState<string | null>(null);
  const [uiUserId, setUiUserId] = useState<string | null>(null);
  const [uiHydrated, setUiHydrated] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalNum, setPdfModalNum] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const pdfIframeRef = useRef<HTMLIFrameElement>(null);
  const [cauchoModalOpen, setCauchoModalOpen] = useState(false);
  const [cauchoModalNum, setCauchoModalNum] = useState<string | null>(null);
  const [cauchoFiles, setCauchoFiles] = useState<string[]>([]);
  const [cauchoSelected, setCauchoSelected] = useState<string | null>(null);
  const [cauchoListLoading, setCauchoListLoading] = useState(false);
  const [cauchoPreviewLoading, setCauchoPreviewLoading] = useState(false);
  const [cauchoError, setCauchoError] = useState<string | null>(null);
  const [cauchoBlobUrl, setCauchoBlobUrl] = useState<string | null>(null);
  const cauchoIframeRef = useRef<HTMLIFrameElement>(null);
  const skipBlurSaveRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const [planificacionRole, setPlanificacionRole] = useState<string | null>(null);
  const [poolCountPreAmbito, setPoolCountPreAmbito] = useState(0);

  const uiStorageKey = `${POOL_UI_STATE_KEY}:${uiUserId ?? "anon"}`;

  const setSort = useCallback(
    (key: SortKey) => {
      if (sortBy === key) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
        return;
      }
      setSortBy(key);
      setSortDir("asc");
    },
    [sortBy]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      const uid =
        typeof user?.id === "string" && user.id.trim().length > 0
          ? user.id.trim()
          : null;
      setUiUserId(uid);
    })().catch(() => {
      if (mounted) setUiUserId(null);
    });
    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(uiStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PoolUiState>;
        if (typeof parsed.search === "string") setSearch(parsed.search);
        if (
          parsed.sortBy === "entrega" ||
          parsed.sortBy === "ot" ||
          parsed.sortBy === "cliente"
        ) {
          setSortBy(parsed.sortBy);
        }
        if (parsed.sortDir === "asc" || parsed.sortDir === "desc") setSortDir(parsed.sortDir);
        const savedCompraEstadoFilter = parsed.compraEstadoFilter;
        if (typeof savedCompraEstadoFilter === "string") {
          const normalizedCompraEstadoFilter = normalizeCompraEstado(savedCompraEstadoFilter);
          if (
            savedCompraEstadoFilter === "all" ||
            normalizedCompraEstadoFilter === "sin compra" ||
            COMPRAS_MATERIAL_ESTADOS.map((x) => normalizeCompraEstado(x)).includes(
              normalizedCompraEstadoFilter,
            )
          ) {
            setCompraEstadoFilter(savedCompraEstadoFilter);
          }
        }
        const savedArea = parsed.areaTipoFilter;
        if (
          savedArea === "all" ||
          (typeof savedArea === "string" &&
            (PLANIFICACION_TIPOS_MAQUINA as readonly string[]).includes(savedArea))
        ) {
          setAreaTipoFilter(savedArea as PoolAmbitoFiltroUi);
        }
      }
    } catch {
      // fallback silencioso
    } finally {
      setUiHydrated(true);
    }
  }, [uiStorageKey]);

  useEffect(() => {
    if (!uiHydrated) return;
    const payload: PoolUiState = {
      search,
      sortBy,
      sortDir,
      compraEstadoFilter,
      areaTipoFilter,
    };
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(uiStorageKey, JSON.stringify(payload));
      } catch {
        // ignore
      }
    }, 180);
    return () => window.clearTimeout(t);
  }, [search, sortBy, sortDir, compraEstadoFilter, areaTipoFilter, uiHydrated, uiStorageKey]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    let roleRead: string | null = null;
    try {
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

      const { data: despData, error: despErr } = await supabase
        .from(TABLE_DESPACHADAS)
        .select(
          "ot_numero, tintas, material, num_hojas_brutas, horas_entrada, horas_tiraje, troquel, poses, acabado_pral, despachado_at"
        )
        .order("despachado_at", { ascending: false })
        .limit(1500);
      if (despErr) throw despErr;

      const byOt = new Map<string, PoolRow>();
      for (const d of (despData ?? []) as DespRow[]) {
        const ot = String(d.ot_numero ?? "").trim();
        if (!ot) continue;
        const prev = byOt.get(ot);
        const horas = parseNum(d.horas_entrada) + parseNum(d.horas_tiraje);
        const hojasObj = Math.max(0, Math.trunc(parseNum(d.num_hojas_brutas)));
        const troquel = String(d.troquel ?? "").trim();
        if (!prev) {
          byOt.set(ot, {
            ot,
            cliente: "—",
            trabajo: "—",
            material: String(d.material ?? "").trim() || "—",
            tintas: String(d.tintas ?? "").trim() || "—",
            acabadoPral: String(d.acabado_pral ?? "").trim(),
            fechaEntrega: null,
            hojasObjetivo: hojasObj,
            hojasRecibidasTotal: 0,
            numCompra: null,
            compraEstado: "Sin compra",
            compraProveedor: null,
            compraProveedorExtraCount: 0,
            hasCompraGenerada: false,
            materialStatus: "rojo",
            troquelLabel: troquel,
            troquelId: null,
            cauchoAcrilico: null,
            troquelStatus: troquel ? "falta" : "sin_informar",
            troquelModo: troquel ? "informado" : "sin_informar",
            poses: parseNum(d.poses) > 0 ? Math.trunc(parseNum(d.poses)) : null,
            horasEntrada: parseNum(d.horas_entrada),
            horasTiraje: parseNum(d.horas_tiraje),
            horasTotal: horas,
            proximoPasoNombre: null,
            proximoPasoSlug: null,
            planificacionTipoPaso: null,
            enColaMesa: false,
            planificadaEnMesa: false,
            poolEnTransitoFase: false,
          });
          continue;
        }
        prev.horasEntrada += parseNum(d.horas_entrada);
        prev.horasTiraje += parseNum(d.horas_tiraje);
        prev.horasTotal += horas;
        prev.hojasObjetivo = Math.max(prev.hojasObjetivo, hojasObj);
        if (prev.material === "—") prev.material = String(d.material ?? "").trim() || "—";
        if (prev.tintas === "—") prev.tintas = String(d.tintas ?? "").trim() || "—";
        if (!prev.troquelLabel && troquel) {
          prev.troquelLabel = troquel;
          prev.troquelModo = "informado";
        }
        if (!prev.acabadoPral) prev.acabadoPral = String(d.acabado_pral ?? "").trim();
        if (prev.poses == null && parseNum(d.poses) > 0) prev.poses = Math.trunc(parseNum(d.poses));
      }
      const ots = [...byOt.keys()];
      if (ots.length === 0) {
        setPoolCountPreAmbito(0);
        setRows([]);
        setSelected({});
        return;
      }

      let pasoEarlyMap = new Map<string, ProximoPasoInfo>();
      const otsConPlanEnMesa = new Set<string>();
      try {
        const [pasoMapResolved, mesaPlannedRes] = await Promise.all([
          fetchProximoPasoDisponiblePorOt(supabase, ots).catch((e) => {
            console.warn("[Pool OTs] itinerario paso (precarga)", e);
            return new Map<string, ProximoPasoInfo>();
          }),
          supabase
            .from(TABLE_MESA)
            .select("ot_numero")
            .in("ot_numero", ots)
            .in(
              "estado_mesa",
              [...MESA_ESTADOS_PLANIFICADA] as unknown as string[],
            ),
        ]);
        pasoEarlyMap = pasoMapResolved;
        if (mesaPlannedRes.error) throw mesaPlannedRes.error;
        for (const row of (mesaPlannedRes.data ?? []) as Array<{
          ot_numero?: string | null;
        }>) {
          const o = String(row.ot_numero ?? "").trim();
          if (o) otsConPlanEnMesa.add(o);
        }
      } catch (earlyErr) {
        console.warn("[Pool OTs] precarga itinerario / mesa planificada", earlyErr);
      }

      const { data: mesaActiveData, error: mesaErr } = await supabase
        .from(TABLE_MESA)
        .select("ot_numero, maquina_id")
        .in("estado_mesa", ["borrador", "confirmado", "en_ejecucion"]);
      if (mesaErr) throw mesaErr;

      type MesaBlockInfo = {
        hasNullMaquina: boolean;
        tipos: Set<PlanificacionTipoMaquina>;
      };
      const mesaBlockByOt = new Map<string, MesaBlockInfo>();
      const mesaRows = (mesaActiveData ?? []) as Array<{
        ot_numero?: string | null;
        maquina_id?: string | null;
      }>;
      const mqIds = new Set<string>();
      for (const row of mesaRows) {
        const mid = String(row.maquina_id ?? "").trim();
        if (mid) mqIds.add(mid);
      }
      const tipoByMaquinaId = new Map<string, PlanificacionTipoMaquina>();
      if (mqIds.size > 0) {
        const { data: mqData, error: mqErr } = await supabase
          .from(TABLE_MAQUINAS)
          .select("id, tipo_maquina")
          .in("id", [...mqIds]);
        if (mqErr) throw mqErr;
        for (const m of mqData ?? []) {
          const id = String((m as { id?: string | null }).id ?? "").trim();
          const rawTipo = String((m as { tipo_maquina?: string | null }).tipo_maquina ?? "").trim();
          if (!id) continue;
          if ((PLANIFICACION_TIPOS_MAQUINA as readonly string[]).includes(rawTipo)) {
            tipoByMaquinaId.set(id, rawTipo as PlanificacionTipoMaquina);
          }
        }
      }
      for (const row of mesaRows) {
        const ot = String(row.ot_numero ?? "").trim();
        if (!ot) continue;
        let info = mesaBlockByOt.get(ot);
        if (!info) {
          info = { hasNullMaquina: false, tipos: new Set() };
          mesaBlockByOt.set(ot, info);
        }
        const mid = String(row.maquina_id ?? "").trim();
        if (!mid) {
          info.hasNullMaquina = true;
          continue;
        }
        const t = tipoByMaquinaId.get(mid);
        if (t) info.tipos.add(t);
        else info.hasNullMaquina = true;
      }

      function otBlockedFromPoolByMesa(otKey: string): boolean {
        const blk = mesaBlockByOt.get(otKey);
        if (!blk) return false;
        if (blk.hasNullMaquina) return true;
        if (blk.tipos.size === 0) return false;
        const pasoTipo = pasoEarlyMap.get(otKey)?.tipoMaquina ?? null;
        if (!pasoTipo) return true;
        return blk.tipos.has(pasoTipo);
      }

      const { data: otsData, error: otsErr } = await supabase
        .from(TABLE_OTS_GENERAL)
        .select("num_pedido, cliente, titulo, fecha_entrega")
        .in("num_pedido", ots);
      if (otsErr) throw otsErr;
      const otByNum = new Map<string, OtRow>();
      for (const o of (otsData ?? []) as OtRow[]) {
        const ot = String(o.num_pedido ?? "").trim();
        if (ot) otByNum.set(ot, o);
      }

      const { data: compraData, error: compraErr } = await supabase
        .from(TABLE_COMPRA)
        .select("id, ot_numero, num_compra, proveedor_id, estado")
        .in("ot_numero", ots);
      if (compraErr) throw compraErr;
      const compraByOt = new Map<string, string[]>();
      const compraNumByOt = new Map<string, string>();
      const compraEstadoByOt = new Map<string, string>();
      const compraProveedorIdsByOt = new Map<string, Set<string>>();
      const proveedorIds = new Set<string>();
      const compraIds: string[] = [];
      for (const c of (compraData ?? []) as CompraRow[]) {
        const ot = String(c.ot_numero ?? "").trim();
        if (!ot) continue;
        const arr = compraByOt.get(ot) ?? [];
        arr.push(c.id);
        compraByOt.set(ot, arr);
        compraIds.push(c.id);
        if (!compraNumByOt.has(ot)) {
          const nc = String(c.num_compra ?? "").trim();
          if (nc) compraNumByOt.set(ot, nc);
        }
        const estadoRaw = String(c.estado ?? "").trim();
        if (estadoRaw) {
          const prevEstado = compraEstadoByOt.get(ot);
          if (!prevEstado || compraEstadoRank(estadoRaw) > compraEstadoRank(prevEstado)) {
            compraEstadoByOt.set(ot, estadoRaw);
          }
        }
        const provId = String(c.proveedor_id ?? "").trim();
        if (provId) {
          proveedorIds.add(provId);
          const set = compraProveedorIdsByOt.get(ot) ?? new Set<string>();
          set.add(provId);
          compraProveedorIdsByOt.set(ot, set);
        }
      }

      const proveedorNombreById = new Map<string, string>();
      if (proveedorIds.size > 0) {
        const { data: provData, error: provErr } = await supabase
          .from(TABLE_PROVEEDORES)
          .select("id, nombre")
          .in("id", [...proveedorIds]);
        if (provErr) throw provErr;
        for (const p of provData ?? []) {
          const row = p as { id?: string | null; nombre?: string | null };
          const pid = String(row.id ?? "").trim();
          const nombre = String(row.nombre ?? "").trim();
          if (pid && nombre) proveedorNombreById.set(pid, nombre);
        }
      }

      const recepByCompra = new Map<string, number>();
      if (compraIds.length > 0) {
        const { data: recData, error: recErr } = await supabase
          .from(TABLE_RECEPCION)
          .select("compra_id, hojas_recibidas")
          .in("compra_id", compraIds);
        if (recErr) throw recErr;
        for (const r of (recData ?? []) as RecepRow[]) {
          const cid = String(r.compra_id ?? "").trim();
          if (!cid) continue;
          recepByCompra.set(cid, (recepByCompra.get(cid) ?? 0) + parseNum(r.hojas_recibidas));
        }
      }

      const troquelNeedles = [
        ...new Set([...byOt.values()].map((r) => r.troquelLabel.trim()).filter(Boolean)),
      ];
      const troquelesExist = new Set<string>();
      const troquelMetaByNum = new Map<
        string,
        { id: string; cauchoAcrilico: string | null }
      >();
      if (troquelNeedles.length > 0) {
        const { data: troqData, error: troqErr } = await supabase
          .from(TABLE_TROQUELES)
          .select("id, num_troquel, caucho_acrilico")
          .in("num_troquel", troquelNeedles);
        if (troqErr) throw troqErr;
        for (const t of troqData ?? []) {
          const row = t as {
            id?: string | null;
            num_troquel?: string | null;
            caucho_acrilico?: string | null;
          };
          const n = String(row.num_troquel ?? "").trim();
          if (!n) continue;
          troquelesExist.add(n);
          troquelMetaByNum.set(n, {
            id: String(row.id ?? "").trim() || n,
            cauchoAcrilico: row.caucho_acrilico ?? null,
          });
        }
      }

      const { data: poolData, error: poolErr } = await supabase
        .from(TABLE_POOL)
        .select("id, ot_numero, estado_pool, troquel_status, acabado_pral_snapshot")
        .in("ot_numero", ots)
        .in("estado_pool", [...POOL_ESTADOS_INCLUIDOS]);
      if (poolErr) throw poolErr;
      const poolByOt = new Map<string, PoolPersisted>();
      for (const p of (poolData ?? []) as PoolPersisted[]) {
        const ot = String(p.ot_numero ?? "").trim();
        if (ot && !poolByOt.has(ot)) poolByOt.set(ot, p);
      }

      const out: PoolRow[] = [];
      for (const [ot, row] of byOt.entries()) {
        if (otBlockedFromPoolByMesa(ot)) continue;
        const meta = otByNum.get(ot);
        row.cliente = String(meta?.cliente ?? "").trim() || "—";
        row.trabajo = String(meta?.titulo ?? "").trim() || "—";
        row.fechaEntrega = meta?.fecha_entrega ?? null;
        row.numCompra = compraNumByOt.get(ot) ?? null;
        row.compraEstado = compraEstadoByOt.get(ot) ?? "Sin compra";
        const provIdsSet = compraProveedorIdsByOt.get(ot);
        if (provIdsSet && provIdsSet.size > 0) {
          const provs = [...provIdsSet]
            .map((id) => proveedorNombreById.get(id) ?? "")
            .map((x) => x.trim())
            .filter(Boolean);
          const uniqueProvs = [...new Set(provs)];
          if (uniqueProvs.length > 0) {
            row.compraProveedor = uniqueProvs[0] ?? null;
            row.compraProveedorExtraCount = Math.max(0, uniqueProvs.length - 1);
          } else {
            row.compraProveedor = null;
            row.compraProveedorExtraCount = 0;
          }
        } else {
          row.compraProveedor = null;
          row.compraProveedorExtraCount = 0;
        }
        const cids = compraByOt.get(ot) ?? [];
        row.hasCompraGenerada = cids.length > 0;
        row.hojasRecibidasTotal = Math.trunc(
          cids.reduce((acc, id) => acc + (recepByCompra.get(id) ?? 0), 0)
        );
        if (cids.length === 0 || row.hojasRecibidasTotal <= 0) row.materialStatus = "rojo";
        else if (row.hojasRecibidasTotal < row.hojasObjetivo) row.materialStatus = "amarillo";
        else row.materialStatus = "verde";

        const pp = poolByOt.get(ot);
        if (pp && String(pp.estado_pool ?? "").trim().toLowerCase() === "cerrada") {
          continue;
        }
        if (pp) {
          const ac = String(pp.acabado_pral_snapshot ?? "").trim();
          if (ac) row.acabadoPral = ac;
          const st = String(pp.troquel_status ?? "").trim().toLowerCase();
          if (st === "no_aplica") row.troquelModo = "no_aplica";
          else if (row.troquelLabel) row.troquelModo = "informado";
          else row.troquelModo = "sin_informar";
        }
        row.troquelStatus = resolveTroquelStatus(row.troquelModo, row.troquelLabel, troquelesExist);
        if (row.troquelLabel.trim()) {
          const m = troquelMetaByNum.get(row.troquelLabel.trim());
          if (m) {
            row.troquelId = m.id;
            row.cauchoAcrilico = m.cauchoAcrilico;
          }
        }
        row.enColaMesa = Boolean(
          pp && String(pp.estado_pool ?? "").trim().toLowerCase() === "enviada_mesa",
        );
        row.planificadaEnMesa = otsConPlanEnMesa.has(ot);
        row.poolEnTransitoFase = Boolean(
          pp && String(pp.estado_pool ?? "").trim().toLowerCase() === "en_transito",
        );
        out.push(row);
      }

      let enrichedRows: PoolRow[] = out.map((r) => {
        const info = pasoEarlyMap.get(r.ot);
        if (!info) return { ...r };
        return {
          ...r,
          proximoPasoNombre: info.nombre,
          proximoPasoSlug: info.seccionSlug,
          planificacionTipoPaso: info.tipoMaquina,
        };
      });

      setPoolCountPreAmbito(enrichedRows.length);
      const tipoFiltro = getPlanificacionTipoMaquinaFilter(roleRead);
      if (tipoFiltro) {
        enrichedRows = enrichedRows.filter((r) => r.planificacionTipoPaso === tipoFiltro);
      }

      setRows(enrichedRows);
      setSelected((prev) => {
        const next: Record<string, boolean> = {};
        for (const r of enrichedRows) next[r.ot] = prev[r.ot] ?? false;
        return next;
      });
    } catch (e) {
      const message = getErrorMessage(e, "No se pudo cargar el Pool.");
      console.error("[Pool OTs] loadRows error", { error: e, message });
      toast.error(message);
      setRows([]);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filterNorm = normalizeCompraEstado(compraEstadoFilter);
    return rows.filter((r) => {
      const matchesSearch =
        !q ||
        [r.ot, r.cliente, r.trabajo, r.material, r.troquelLabel, r.acabadoPral, r.compraEstado]
          .map((x) => String(x ?? "").toLowerCase())
          .some((s) => s.includes(q));
      if (!matchesSearch) return false;
      if (filterNorm !== "all" && normalizeCompraEstado(r.compraEstado) !== filterNorm) {
        return false;
      }
      if (areaTipoFilter !== "all" && r.planificacionTipoPaso !== areaTipoFilter) {
        return false;
      }
      return true;
    });
  }, [rows, search, compraEstadoFilter, areaTipoFilter]);

  const selectableRows = useMemo(
    () => filteredRows.filter((r) => r.hasCompraGenerada),
    [filteredRows],
  );
  const allChecked =
    selectableRows.length > 0 && selectableRows.every((r) => selected[r.ot]);
  const selectedRows = rows.filter((r) => selected[r.ot]);

  const tipoFiltroPlanificacion = useMemo(
    () => getPlanificacionTipoMaquinaFilter(planificacionRole),
    [planificacionRole],
  );

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "entrega") {
        const da = a.fechaEntrega ? new Date(a.fechaEntrega).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.fechaEntrega ? new Date(b.fechaEntrega).getTime() : Number.MAX_SAFE_INTEGER;
        cmp = da - db;
      } else if (sortBy === "ot") {
        cmp = a.ot.localeCompare(b.ot, "es", { numeric: true, sensitivity: "base" });
      } else {
        cmp = a.cliente.localeCompare(b.cliente, "es", { sensitivity: "base" });
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, sortBy, sortDir]);

  const startEdit = useCallback((r: PoolRow) => {
    setEditingOt(r.ot);
    setDraft({
      trabajo: r.trabajo,
      tintas: r.tintas === "—" ? "" : r.tintas,
      troquel: r.troquelLabel,
      troquelModo: r.troquelModo,
      acabadoPral: r.acabadoPral,
      horasEntrada: r.horasEntrada.toFixed(2),
      horasTiraje: r.horasTiraje.toFixed(2),
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingOt(null);
    setDraft(null);
  }, []);

  const hasDraftChanges = useCallback(() => {
    if (!editingOt || !draft) return false;
    const curr = rows.find((r) => r.ot === editingOt);
    if (!curr) return false;
    const currTintas = curr.tintas === "—" ? "" : curr.tintas;
    const troquelChanged =
      draft.troquelModo === "informado"
        ? draft.troquel.trim() !== curr.troquelLabel.trim()
        : curr.troquelLabel.trim() !== "";
    return (
      draft.trabajo.trim() !== curr.trabajo.trim() ||
      draft.tintas.trim() !== currTintas.trim() ||
      draft.acabadoPral.trim() !== curr.acabadoPral.trim() ||
      parseNonNegative(draft.horasEntrada) !== curr.horasEntrada ||
      parseNonNegative(draft.horasTiraje) !== curr.horasTiraje ||
      draft.troquelModo !== curr.troquelModo ||
      troquelChanged
    );
  }, [draft, editingOt, rows]);

  const saveEdit = useCallback(async () => {
    if (!editingOt || !draft) return;
    if (savingEdit || saveInFlightRef.current) return;
    if (!hasDraftChanges()) {
      cancelEdit();
      return;
    }
    saveInFlightRef.current = true;
    setSavingEdit(true);
    try {
      const troquel = draft.troquelModo === "informado" ? draft.troquel.trim() : "";
      const horasEntrada = parseNonNegative(draft.horasEntrada);
      const horasTiraje = parseNonNegative(draft.horasTiraje);
      const { error: dErr } = await supabase
        .from(TABLE_DESPACHADAS)
        .update({
          tintas: draft.tintas.trim() || null,
          troquel: troquel || null,
          acabado_pral: draft.acabadoPral.trim() || null,
          horas_entrada: horasEntrada,
          horas_tiraje: horasTiraje,
        })
        .eq("ot_numero", editingOt);
      if (dErr) throw dErr;

      const base = rows.find((r) => r.ot === editingOt);
      const troqStatus: TroquelStatus =
        draft.troquelModo === "no_aplica"
          ? "no_aplica"
          : draft.troquelModo === "sin_informar"
            ? "sin_informar"
            : "falta";
      const { data: exPool, error: exErr } = await supabase
        .from(TABLE_POOL)
        .select("id")
        .eq("ot_numero", editingOt)
        .in("estado_pool", [...POOL_ESTADOS_INCLUIDOS])
        .limit(1);
      if (exErr) throw exErr;
      if ((exPool ?? []).length > 0) {
        const pid = String((exPool![0] as { id: string }).id);
        const { error: pErr } = await supabase
          .from(TABLE_POOL)
          .update({
            troquel_status: troqStatus,
            requiere_troquel: draft.troquelModo === "informado",
            acabado_pral_snapshot: draft.acabadoPral.trim() || null,
          })
          .eq("id", pid);
        if (pErr) throw pErr;
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { error: pInsErr } = await supabase.from(TABLE_POOL).insert({
          ot_numero: editingOt,
          estado_pool: "pendiente",
          fecha_entrega_snapshot: base?.fechaEntrega ?? null,
          material_status: base?.materialStatus ?? "rojo",
          troquel_status: troqStatus,
          requiere_troquel: draft.troquelModo === "informado",
          acabado_pral_snapshot: draft.acabadoPral.trim() || null,
          notas: "Ajuste manual desde Pool",
          created_by:
            typeof user?.id === "string" && user.id.trim().length > 0
              ? user.id.trim()
              : null,
          created_by_email:
            typeof user?.email === "string" && user.email.trim().length > 0
              ? user.email.trim()
              : null,
        });
        if (pInsErr) throw pInsErr;
      }
      toast.success("Fila actualizada.");
      setSavedRowOt(editingOt);
      window.setTimeout(() => {
        setSavedRowOt((prev) => (prev === editingOt ? null : prev));
      }, 900);
      cancelEdit();
      await loadRows();
    } catch (e) {
      const errObj =
        e && typeof e === "object"
          ? (e as {
              message?: string;
              details?: string;
              hint?: string;
              code?: string;
            })
          : null;
      const message =
        errObj?.message ??
        (typeof e === "string" && e.trim() ? e : "No se pudo guardar la edición.");
      console.error("[Pool saveEdit]", {
        message: errObj?.message,
        details: errObj?.details,
        hint: errObj?.hint,
        code: errObj?.code,
        raw: e,
      });
      toast.error(message);
    } finally {
      saveInFlightRef.current = false;
      setSavingEdit(false);
    }
  }, [cancelEdit, draft, editingOt, hasDraftChanges, loadRows, rows, savingEdit, supabase]);

  const onDraftKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void saveEdit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
    },
    [cancelEdit, saveEdit]
  );

  const onDraftBlur = useCallback(() => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false;
      return;
    }
    if (!editingOt || !draft) return;
    void saveEdit();
  }, [draft, editingOt, saveEdit]);

  const revokePdfBlob = useCallback(() => {
    setPdfBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const closePdfModal = useCallback(
    (open: boolean) => {
      if (!open) {
        revokePdfBlob();
        setPdfModalNum(null);
        setPdfError(null);
      }
      setPdfModalOpen(open);
    },
    [revokePdfBlob]
  );

  const printPdfInModal = useCallback(() => {
    const w = pdfIframeRef.current?.contentWindow;
    if (w) w.print();
    else toast.info("Espera a que cargue el PDF.");
  }, []);

  const openTroquelPdf = useCallback(
    async (numTroquel: string) => {
      const num = numTroquel.trim();
      if (!num) return;
      setPdfModalNum(num);
      setPdfModalOpen(true);
      setPdfLoading(true);
      setPdfError(null);
      revokePdfBlob();
      try {
        const res = await fetch(`/api/produccion/troquel-pdf?num=${encodeURIComponent(num)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            readErrorFromJsonBody(body) ?? `No se pudo abrir el troquel (${res.status}).`
          );
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setPdfBlobUrl(url);
      } catch (e) {
        setPdfError(e instanceof Error ? e.message : "No se pudo abrir el troquel.");
      } finally {
        setPdfLoading(false);
      }
    },
    [revokePdfBlob]
  );

  const revokeCauchoBlob = useCallback(() => {
    setCauchoBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const loadCauchoPreview = useCallback(
    async (num: string, fileName: string) => {
      revokeCauchoBlob();
      setCauchoPreviewLoading(true);
      setCauchoError(null);
      setCauchoSelected(fileName);
      try {
        const res = await fetch(
          `/api/produccion/caucho-list?num=${encodeURIComponent(num)}&file=${encodeURIComponent(fileName)}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            readErrorFromJsonBody(body) ??
              `No se pudo abrir el caucho (${res.status}).`
          );
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setCauchoBlobUrl(url);
      } catch (e) {
        setCauchoError(e instanceof Error ? e.message : "No se pudo abrir el caucho.");
      } finally {
        setCauchoPreviewLoading(false);
      }
    },
    [revokeCauchoBlob]
  );

  const closeCauchoModal = useCallback(
    (open: boolean) => {
      if (!open) {
        revokeCauchoBlob();
        setCauchoModalNum(null);
        setCauchoFiles([]);
        setCauchoSelected(null);
        setCauchoError(null);
      }
      setCauchoModalOpen(open);
    },
    [revokeCauchoBlob]
  );

  const printCauchoInModal = useCallback(() => {
    const w = cauchoIframeRef.current?.contentWindow;
    if (w) w.print();
    else toast.info("Selecciona un PDF o espera a que cargue.");
  }, []);

  const openCauchoQuick = useCallback(
    async (numTroquel: string) => {
      const num = numTroquel.trim();
      if (!num) return;
      setCauchoModalNum(num);
      setCauchoModalOpen(true);
      setCauchoFiles([]);
      setCauchoSelected(null);
      setCauchoError(null);
      setCauchoListLoading(true);
      revokeCauchoBlob();
      try {
        const listRes = await fetch(`/api/produccion/caucho-list?num=${encodeURIComponent(num)}`);
        const listBody = await listRes.json().catch(() => null);
        if (!listRes.ok) {
          throw new Error(
            readErrorFromJsonBody(listBody) ??
              `No se pudo obtener cauchos (${listRes.status}).`
          );
        }
        const files = normalizeCauchoFileList(
          listBody && typeof listBody === "object"
            ? (listBody as { files?: unknown }).files
            : undefined
        );
        setCauchoFiles(files);
        if (files.length === 0) {
          toast.info("No hay PDF de caucho disponible para este troquel.");
          return;
        }
        if (files.length === 1) {
          await loadCauchoPreview(num, files[0]!);
        }
      } catch (e) {
        setCauchoError(
          e instanceof Error ? e.message : "No se pudo cargar el visor de cauchos."
        );
      } finally {
        setCauchoListLoading(false);
      }
    },
    [loadCauchoPreview, revokeCauchoBlob]
  );

  const onEditRowBlurCapture = useCallback(
    (e: FocusEvent<HTMLTableRowElement>, ot: string) => {
      if (editingOt !== ot) return;
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      onDraftBlur();
    },
    [editingOt, onDraftBlur]
  );

  const pasarAMesa = useCallback(async () => {
    if (selectedRows.length === 0) {
      toast.error("Selecciona al menos una OT para pasar a mesa.");
      return;
    }
    setSaving(true);
    try {
      const sinCompra = selectedRows.filter((r) => !r.hasCompraGenerada).map((r) => r.ot);
      if (sinCompra.length > 0) {
        toast.error(
          `No se puede enviar a mesa sin compra generada: ${sinCompra.join(", ")}.`,
        );
        return;
      }
      const ots = selectedRows.map((r) => r.ot);
      const { data: mesaExist, error: meErr } = await supabase
        .from(TABLE_MESA)
        .select("ot_numero")
        .in("ot_numero", ots)
        .in("estado_mesa", ["borrador", "confirmado", "en_ejecucion"]);
      if (meErr) throw meErr;
      const enMesa = new Set(
        ((mesaExist ?? []) as Array<{ ot_numero: string | null }>)
          .map((x) => String(x.ot_numero ?? "").trim())
          .filter(Boolean)
      );
      const nuevos = selectedRows.filter((r) => !enMesa.has(r.ot));
      if (nuevos.length === 0) {
        toast.message("Todas las OT seleccionadas ya estaban en mesa activa.");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actorId =
        typeof user?.id === "string" && user.id.trim().length > 0 ? user.id.trim() : null;
      const actorEmail =
        typeof user?.email === "string" && user.email.trim().length > 0
          ? user.email.trim()
          : null;

      const { data: poolExist, error: poolErr } = await supabase
        .from(TABLE_POOL)
        .select("id, ot_numero")
        .in("ot_numero", nuevos.map((r) => r.ot))
        .in("estado_pool", [...POOL_ESTADOS_PARA_MESA]);
      if (poolErr) throw poolErr;
      const poolByOt = new Map<string, string>();
      for (const p of (poolExist ?? []) as Array<{ id: string; ot_numero: string }>) {
        const ot = String(p.ot_numero ?? "").trim();
        if (ot) poolByOt.set(ot, p.id);
      }
      const toUpdate = nuevos
        .map((r) => ({ id: poolByOt.get(r.ot), row: r }))
        .filter((x): x is { id: string; row: PoolRow } => !!x.id);
      for (const item of toUpdate) {
        const { error: updErr } = await supabase
          .from(TABLE_POOL)
          .update({
            estado_pool: "enviada_mesa",
            troquel_status: item.row.troquelStatus,
            acabado_pral_snapshot: item.row.acabadoPral || null,
            closed_at: null,
            closed_by: null,
            closed_by_email: null,
            notas: "Enviada desde Pool a Mesa",
          })
          .eq("id", item.id);
        if (updErr) throw updErr;
      }

      const insPool = nuevos.filter((r) => !poolByOt.has(r.ot)).map((r) => ({
        ot_numero: r.ot,
        estado_pool: "enviada_mesa",
        prioridad_snapshot: null,
        fecha_entrega_snapshot: r.fechaEntrega,
        material_status: r.materialStatus,
        troquel_status: r.troquelStatus,
        requiere_troquel: r.troquelModo === "informado",
        acabado_pral_snapshot: r.acabadoPral || null,
        notas: "Enviada desde Pool a Mesa",
        created_by: actorId,
        created_by_email: actorEmail,
      }));
      if (insPool.length > 0) {
        const { error: insPoolErr } = await supabase.from(TABLE_POOL).insert(insPool);
        if (insPoolErr) throw insPoolErr;
      }

      toast.success(`Mesa actualizada: ${nuevos.length} OT(s) enviadas.`);
      await loadRows();
    } catch (e) {
      console.error(e);
      toast.error(getErrorMessage(e, "No se pudo pasar la selección a mesa."));
    } finally {
      setSaving(false);
    }
  }, [loadRows, selectedRows, supabase]);

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg text-[#002147]">Pool de OT&apos;s</CardTitle>
            <CardDescription>
              OTs despachadas pendientes de planificación, con control de material y
              validación de troquel antes de pasar a mesa.
            </CardDescription>
          </div>
          {tipoFiltroPlanificacion ? (
            <span className="shrink-0 rounded-md border border-[#C69C2B]/40 bg-[#C69C2B]/15 px-2 py-1 text-[11px] font-semibold text-[#002147]">
              Ámbito: {etiquetaAmbitoPlanificacion(tipoFiltroPlanificacion)}
            </span>
          ) : (
            <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700">
              Ámbito: {etiquetaAmbitoPlanificacion(null)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-full max-w-3xl flex-wrap items-center gap-2">
            <div className="relative min-w-[18rem] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar OT, cliente, trabajo, material, troquel, acabado..."
                className="pl-8"
              />
            </div>
            <select
              className="h-9 min-w-[12rem] rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
              value={compraEstadoFilter}
              onChange={(e) => setCompraEstadoFilter(e.target.value)}
              aria-label="Filtrar por estado de compra"
              title="Filtrar por estado de compra"
            >
              <option value="all">Compra: todos</option>
              {COMPRAS_MATERIAL_ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {estado}
                </option>
              ))}
              <option value="Sin compra">Sin compra</option>
            </select>
            <select
              className="h-9 min-w-[11rem] rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
              value={areaTipoFilter}
              onChange={(e) =>
                setAreaTipoFilter(
                  e.target.value === "all"
                    ? "all"
                    : (e.target.value as PlanificacionTipoMaquina),
                )
              }
              aria-label="Filtrar por área del próximo paso"
              title="Filtra por tipo de proceso del primer paso disponible (itinerario)."
            >
              <option value="all">Próximo paso: todos</option>
              {PLANIFICACION_TIPOS_MAQUINA.map((t) => (
                <option key={t} value={t}>
                  {etiquetaAmbitoPlanificacion(t)}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            className="bg-[#002147] text-white hover:bg-[#001735]"
            disabled={saving || selectedRows.length === 0}
            onClick={() => void pasarAMesa()}
          >
            {saving ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="mr-1.5 size-4" aria-hidden />
            )}
            Pasar a Mesa de Secuenciación
          </Button>
          <span className="text-xs text-slate-600">
            Seleccionadas:{" "}
            <span className="font-semibold text-[#002147]">{selectedRows.length}</span>
          </span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-6 text-sm text-slate-600">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Cargando pool de OT&apos;s...
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 px-3 py-6 text-sm text-slate-600">
            {tipoFiltroPlanificacion &&
            poolCountPreAmbito > 0 &&
            rows.length === 0 ? (
              <>
                No hay OT&apos;s en el pool que coincidan con tu ámbito (
                {etiquetaAmbitoPlanificacion(tipoFiltroPlanificacion)}). Hay{" "}
                {poolCountPreAmbito} OT(s) en otras fases del itinerario.
              </>
            ) : rows.length > 0 && areaTipoFilter !== "all" ? (
              <>
                Ninguna OT coincide con el filtro de próximo paso (
                {etiquetaAmbitoPlanificacion(areaTipoFilter)}). Prueba &quot;Próximo paso:
                todos&quot; o revisa OTs sin itinerario inferido.
              </>
            ) : (
              <>No hay OT&apos;s despachadas pendientes de planificación.</>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200/90">
            <Table className="min-w-[100rem]">
              <TableHeader>
                <TableRow className="bg-slate-50/90">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => {
                        const next: Record<string, boolean> = {};
                        for (const r of filteredRows) {
                          next[r.ot] = r.hasCompraGenerada ? e.target.checked : false;
                        }
                        setSelected(next);
                      }}
                      aria-label="Seleccionar todas"
                    />
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => setSort("entrega")}
                    >
                      Entrega
                      <ArrowUpDown className="size-3.5 text-slate-500" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => setSort("ot")}
                    >
                      OT
                      <ArrowUpDown className="size-3.5 text-slate-500" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1"
                      onClick={() => setSort("cliente")}
                    >
                      Cliente
                      <ArrowUpDown className="size-3.5 text-slate-500" />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[9rem]">Próximo paso</TableHead>
                  <TableHead
                    className="w-[4.5rem] text-center text-xs font-medium normal-case"
                    title="En cola para la mesa (enviada a planificación). No implica tener ya huecos en el calendario."
                  >
                    Cola mesa
                  </TableHead>
                  <TableHead
                    className="w-[4.5rem] text-center text-xs font-medium normal-case"
                    title="Tiene trabajos en el calendario de mesa (borrador, confirmado, en ejecución o finalizado en mesa)."
                  >
                    En plan
                  </TableHead>
                  <TableHead>Trabajo</TableHead>
                  <TableHead>Tintas</TableHead>
                  <TableHead>Acabado pral</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Troquel</TableHead>
                  <TableHead className="text-right">Tiempos</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((r) => (
                  <TableRow
                    key={r.ot}
                    onBlurCapture={
                      editingOt === r.ot
                        ? (e) => onEditRowBlurCapture(e, r.ot)
                        : undefined
                    }
                    className={
                      savedRowOt === r.ot
                        ? "bg-emerald-50/80 ring-1 ring-emerald-200 transition-colors duration-700"
                        : undefined
                    }
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={!!selected[r.ot]}
                        onChange={(e) =>
                          setSelected((prev) => ({ ...prev, [r.ot]: e.target.checked }))
                        }
                        disabled={!r.hasCompraGenerada}
                        aria-label={`Seleccionar OT ${r.ot}`}
                        title={
                          r.hasCompraGenerada
                            ? `Seleccionar OT ${r.ot}`
                            : `OT ${r.ot} bloqueada: requiere compra generada`
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${entregaClass(
                          r.fechaEntrega
                        )}`}
                      >
                        {r.fechaEntrega ? formatFechaEsCorta(r.fechaEntrega) : "Sin fecha"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-mono text-sm font-semibold text-[#002147]">{r.ot}</p>
                      {r.poolEnTransitoFase ? (
                        <p
                          className="mt-0.5 text-[10px] font-medium text-amber-800"
                          title="Fase anterior finalizada en mesa; el itinerario sigue (p. ej. pendiente de troquel u otra sección)."
                        >
                          Entre fases
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[12rem] truncate text-xs text-slate-700" title={r.cliente}>
                        {r.cliente || "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p
                        className="max-w-[10rem] truncate text-xs font-medium text-[#002147]"
                        title={
                          r.proximoPasoSlug
                            ? `${r.proximoPasoNombre ?? ""} (${r.proximoPasoSlug})`
                            : (r.proximoPasoNombre ?? "")
                        }
                      >
                        {r.proximoPasoNombre ?? "—"}
                      </p>
                      {r.proximoPasoSlug ? (
                        <p className="max-w-[10rem] truncate text-[10px] uppercase text-slate-500">
                          {r.proximoPasoSlug}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-center align-middle">
                      <span
                        className="inline-flex justify-center"
                        title={
                          r.enColaMesa
                            ? "En cola para mesa: enviada a planificación (pool lateral). No implica tener ya huecos en el calendario."
                            : "Aún no enviada a la cola de mesa (pendiente u otro estado)."
                        }
                      >
                        {r.enColaMesa ? (
                          <CheckCircle2
                            className="size-5 shrink-0 text-emerald-600"
                            aria-label="En cola para mesa"
                          />
                        ) : (
                          <Circle
                            className="size-4 shrink-0 text-slate-200"
                            aria-label="No en cola mesa"
                          />
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-center align-middle">
                      <span
                        className="inline-flex justify-center"
                        title={
                          r.planificadaEnMesa
                            ? "Planificada: tiene trabajos en el calendario de mesa (borrador, confirmado, en ejecución o finalizado en mesa)."
                            : "Sin plan en mesa: aún no hay trabajos en el calendario."
                        }
                      >
                        {r.planificadaEnMesa ? (
                          <CheckCircle2
                            className="size-5 shrink-0 text-emerald-600"
                            aria-label="Planificada en mesa"
                          />
                        ) : (
                          <Circle
                            className="size-4 shrink-0 text-slate-200"
                            aria-label="Sin plan en mesa"
                          />
                        )}
                      </span>
                    </TableCell>
                    <TableCell>
                      {editingOt === r.ot && draft ? (
                        <Input
                          value={draft.trabajo}
                          onChange={(e) => setDraft({ ...draft, trabajo: e.target.value })}
                          onKeyDown={onDraftKeyDown}
                          className="h-8 max-w-[14rem]"
                        />
                      ) : (
                        <>
                          <p
                            className="max-w-[14rem] truncate text-sm font-medium text-slate-900"
                            title={r.trabajo}
                          >
                            {r.trabajo || "—"}
                          </p>
                          <p className="max-w-[14rem] truncate text-xs text-slate-600" title={r.material}>
                            {r.material || "—"}
                          </p>
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingOt === r.ot && draft ? (
                        <Input
                          value={draft.tintas}
                          onChange={(e) => setDraft({ ...draft, tintas: e.target.value })}
                          onKeyDown={onDraftKeyDown}
                          className="h-8 w-20"
                        />
                      ) : (
                        <span className="font-mono text-xs">{r.tintas || "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingOt === r.ot && draft ? (
                        <Input
                          value={draft.acabadoPral}
                          onChange={(e) => setDraft({ ...draft, acabadoPral: e.target.value })}
                          onKeyDown={onDraftKeyDown}
                          className="h-8 max-w-[10rem]"
                        />
                      ) : (
                        <p className="max-w-[10rem] truncate text-xs text-slate-700" title={r.acabadoPral}>
                          {r.acabadoPral || "—"}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {r.materialStatus === "verde"
                          ? statusPill("verde", "Material OK")
                          : r.materialStatus === "amarillo"
                            ? statusPill("amarillo", "Material parcial")
                            : statusPill("rojo", "Material crítico")}
                        <p className="text-[11px] text-slate-600">
                          {r.hojasRecibidasTotal}/{r.hojasObjetivo} hojas
                        </p>
                        {r.numCompra ? (
                          <p className="text-[11px] text-slate-500">
                            {r.numCompra} · {r.compraProveedor || "Sin proveedor"}
                            {r.compraProveedorExtraCount > 0
                              ? ` (+${r.compraProveedorExtraCount})`
                              : ""}
                          </p>
                        ) : (
                          <p className="text-[11px] font-medium text-red-600">
                            Sin compra generada (no se puede enviar a mesa)
                          </p>
                        )}
                        <p className="text-[11px] text-slate-500">
                          Estado compra: {r.compraEstado}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {editingOt === r.ot && draft ? (
                        <div className="space-y-1">
                          <select
                            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                            value={draft.troquelModo}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                troquelModo: e.target.value as TroquelModo,
                                troquel: e.target.value === "informado" ? draft.troquel : "",
                              })
                            }
                            onKeyDown={onDraftKeyDown}
                          >
                            <option value="sin_informar">Sin informar</option>
                            <option value="no_aplica">No aplica</option>
                            <option value="informado">Informado</option>
                          </select>
                          {draft.troquelModo === "informado" ? (
                            <Input
                              value={draft.troquel}
                              onChange={(e) => setDraft({ ...draft, troquel: e.target.value })}
                              onKeyDown={onDraftKeyDown}
                              className="h-8"
                              placeholder="Nº troquel"
                            />
                          ) : null}
                        </div>
                      ) : (
                        <>
                          {r.troquelStatus === "ok"
                            ? statusPill("verde", "OK")
                            : r.troquelStatus === "falta"
                              ? statusPill("amarillo", "Falta")
                              : r.troquelStatus === "no_aplica"
                                ? statusPill("gris", "No aplica")
                                : statusPill("gris", "Sin informar")}
                          {r.troquelStatus === "ok" && r.troquelLabel.trim() ? (
                            <div className="mt-1 flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-6 text-[#002147]/85 hover:bg-[#002147]/10 hover:text-[#002147]"
                                title="Ver troquel"
                                onClick={() => void openTroquelPdf(r.troquelLabel)}
                              >
                                <Eye className="size-3.5" aria-hidden />
                              </Button>
                              {cauchoAcrilicoShowsViewer(r.cauchoAcrilico) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 text-[#002147]/85 hover:bg-[#002147]/10 hover:text-[#002147]"
                                  title="Ver caucho"
                                  onClick={() => void openCauchoQuick(r.troquelLabel)}
                                >
                                  <Droplet className="size-3.5" aria-hidden />
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                          {r.troquelLabel ? (
                            <p className="mt-1 font-mono text-[11px] text-slate-600">
                              {r.troquelLabel}
                              {r.poses != null ? (
                                <span className="ml-1 text-[10px] text-slate-500">({r.poses})</span>
                              ) : null}
                            </p>
                          ) : r.poses != null ? (
                            <p className="mt-1 text-[10px] text-slate-500">({r.poses})</p>
                          ) : null}
                        </>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingOt === r.ot && draft ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Input
                            inputMode="decimal"
                            value={draft.horasEntrada}
                            onChange={(e) =>
                              setDraft({ ...draft, horasEntrada: e.target.value })
                            }
                            onKeyDown={onDraftKeyDown}
                            className="h-8 w-20 text-right"
                            title="Horas entrada"
                            placeholder="E"
                          />
                          <Input
                            inputMode="decimal"
                            value={draft.horasTiraje}
                            onChange={(e) =>
                              setDraft({ ...draft, horasTiraje: e.target.value })
                            }
                            onKeyDown={onDraftKeyDown}
                            className="h-8 w-20 text-right"
                            title="Horas tiraje"
                            placeholder="T"
                          />
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-slate-600">
                            E {r.horasEntrada.toFixed(2)}h · T {r.horasTiraje.toFixed(2)}h
                          </p>
                          <span className="font-medium tabular-nums text-slate-900">
                            {r.horasTotal.toFixed(2)} h
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingOt === r.ot ? (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 bg-[#002147] px-2 text-white hover:bg-[#001735]"
                            disabled={savingEdit}
                            onMouseDown={() => {
                              skipBlurSaveRef.current = true;
                            }}
                            onClick={() => void saveEdit()}
                          >
                            {savingEdit ? <Loader2 className="size-3.5 animate-spin" /> : "OK"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            disabled={savingEdit}
                            onMouseDown={() => {
                              skipBlurSaveRef.current = true;
                            }}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-slate-600 hover:text-[#002147]"
                          onClick={() => startEdit(r)}
                          title="Editar fila"
                        >
                          <Edit3 className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <Dialog open={pdfModalOpen} onOpenChange={closePdfModal}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,900px)] w-[calc(100%-1.5rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
        >
          <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4 pr-14">
            <DialogTitle className="text-left text-[#002147]">
              PDF troquel {pdfModalNum ? `· ${pdfModalNum}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 px-3 py-3 sm:px-4">
            {pdfLoading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="size-10 animate-spin text-[#002147]/50" />
              </div>
            ) : pdfError ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {pdfError}
              </div>
            ) : pdfBlobUrl ? (
              <iframe
                ref={pdfIframeRef}
                title={`PDF ${pdfModalNum ?? ""}`}
                src={pdfBlobUrl}
                className="h-[min(65vh,680px)] w-full rounded border border-slate-200 bg-white"
              />
            ) : null}
          </div>
          <DialogFooter className="shrink-0 flex flex-row flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3">
            <Button type="button" variant="outline" onClick={() => closePdfModal(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              className="gap-2 bg-[#C69C2B] font-semibold text-[#002147] hover:bg-[#C69C2B]/90"
              disabled={!pdfBlobUrl}
              onClick={() => printPdfInModal()}
            >
              <Printer className="size-4" aria-hidden />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cauchoModalOpen} onOpenChange={closeCauchoModal}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,920px)] w-[calc(100%-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        >
          <DialogHeader className="shrink-0 border-b border-slate-200 px-6 py-4 pr-14">
            <DialogTitle className="text-left text-[#002147]">
              Visor de cauchos{cauchoModalNum ? ` · ${cauchoModalNum}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 px-3 py-3 sm:px-4">
            {cauchoListLoading ? (
              <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="size-10 animate-spin text-[#002147]/50" />
              </div>
            ) : cauchoError && cauchoFiles.length === 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {cauchoError}
              </div>
            ) : (
              <div className="grid min-h-[min(62vh,680px)] gap-3 md:grid-cols-[minmax(0,15rem)_1fr]">
                <div className="flex max-h-[min(62vh,680px)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  <p className="shrink-0 border-b border-slate-100 px-2 py-1.5 text-[11px] font-semibold text-[#002147]">
                    Archivos ({cauchoFiles.length})
                  </p>
                  <ul className="min-h-0 flex-1 overflow-y-auto p-1.5 [scrollbar-width:thin]">
                    {cauchoFiles.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() =>
                            cauchoModalNum ? void loadCauchoPreview(cauchoModalNum, name) : undefined
                          }
                          className={`w-full rounded px-2 py-1.5 text-left font-mono text-[11px] break-all transition-colors ${
                            cauchoSelected === name
                              ? "bg-[#002147]/12 text-[#002147]"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative flex min-h-[min(58vh,620px)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                  {cauchoPreviewLoading ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/85">
                      <Loader2 className="size-9 animate-spin text-[#002147]/50" />
                    </div>
                  ) : null}
                  {cauchoError && cauchoFiles.length > 0 ? (
                    <div className="m-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {cauchoError}
                    </div>
                  ) : null}
                  {cauchoBlobUrl ? (
                    <iframe
                      ref={cauchoIframeRef}
                      title={`Caucho ${cauchoModalNum ?? ""}`}
                      src={cauchoBlobUrl}
                      className="min-h-[min(54vh,580px)] w-full flex-1 border-0 bg-white"
                    />
                  ) : !cauchoPreviewLoading && cauchoFiles.length > 0 ? (
                    <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
                      Selecciona un archivo en la lista para previsualizarlo.
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                      Sin archivos para este troquel.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 flex flex-row flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3">
            <Button type="button" variant="outline" onClick={() => closeCauchoModal(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              className="gap-2 bg-[#C69C2B] font-semibold text-[#002147] hover:bg-[#C69C2B]/90"
              disabled={!cauchoBlobUrl}
              onClick={() => printCauchoInModal()}
            >
              <Printer className="size-4" aria-hidden />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

