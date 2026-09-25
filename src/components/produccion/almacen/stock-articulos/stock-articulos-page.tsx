"use client";

import {
  AlertTriangle,
  Download,
  FileDown,
  FileSpreadsheet,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { StockArticulosAiDialog } from "@/components/produccion/almacen/stock-articulos/stock-articulos-ai-dialog";
import { StockArticulosImportDialog } from "@/components/produccion/almacen/stock-articulos/stock-articulos-import-dialog";
import { StockArticulosReservasPanel } from "@/components/produccion/almacen/stock-articulos/stock-articulos-reservas-panel";
import { OtDestinoSearchInput } from "@/components/produccion/almacen/ot-destino-search-input";
import {
  ReferenciaMinervaPicker,
  type ReferenciaMinervaValue,
} from "@/components/produccion/ots/referencia-minerva-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  downloadStockArticulosPlantilla,
  parseStockImportInt,
  parseStockImportNum,
} from "@/lib/stock-articulos-excel-import";
import {
  exportStockArticulosExcel,
  exportStockArticulosPdf,
} from "@/lib/stock-articulos-export";
import {
  canWriteStockArticulosClient,
  fetchProfileCapacidades,
} from "@/lib/stock-articulos-permissions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ProdStockArticuloMovimientoRow,
  StockArticuloAtpRow,
  StockArticuloEstadoDerivado,
  StockArticuloEstadoProceso,
  StockArticuloUnidad,
} from "@/types/prod-stock-articulos";

const supabase = createSupabaseBrowserClient();

const LIST_LIMIT = 800;

function friendlyStockError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("sin cambios en datos")) {
    return "No hay cambios que guardar en los datos del lote.";
  }
  if (m.includes("sin permiso") || m.includes("stock_articulos_write")) {
    return "No tienes permiso para modificar stock de artículos.";
  }
  if (m.includes("p_notas obligatorio")) {
    return "La nota es obligatoria en un ajuste (auditoría).";
  }
  if (m.includes("bajo lo comprometido") || m.includes("p_forzar")) {
    return "El ajuste dejaría el físico por debajo de lo reservado. Libera reservas o marca «Forzar».";
  }
  if (m.includes("lote no encontrado")) {
    return "No se encontró el lote.";
  }
  if (m.includes("referencia no encontrada")) {
    return "No se encontró la referencia.";
  }
  if (m.includes("p_cantidad debe ser > 0") || m.includes("p_cantidad_nueva")) {
    return "La cantidad indicada no es válida.";
  }
  if (m.includes("físico insuficiente")) {
    return "No hay cantidad física suficiente.";
  }
  if (m.includes("no hay reserva viva") || m.includes("no hay reserva")) {
    return "No hay una reserva activa para esa OT en este lote.";
  }
  if (m.includes("libera o consume reservas")) {
    return "Libera o consume las reservas vivas antes de continuar.";
  }
  if (
    m.includes("no está en minerva") ||
    m.includes("prod_ots_general") ||
    m.includes("impórtala desde optimus") ||
    m.includes("importala desde optimus")
  ) {
    return "Esa OT aún no está en Minerva. Impórtala desde Optimus antes de reservar.";
  }
  return msg;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (
    e &&
    typeof e === "object" &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    return (e as { message: string }).message;
  }
  return String(e);
}

const ESTADO_BADGE: Record<StockArticuloEstadoDerivado, string> = {
  disponible: "bg-emerald-100 text-emerald-800 border-emerald-200",
  parcial: "bg-amber-100 text-amber-900 border-amber-200",
  reservado: "bg-blue-100 text-blue-800 border-blue-200",
  agotado: "bg-slate-200 text-slate-700 border-slate-300",
};

const ESTADO_LABEL: Record<StockArticuloEstadoDerivado, string> = {
  disponible: "Disponible",
  parcial: "Parcial",
  reservado: "Reservado",
  agotado: "Agotado",
};

const PROCESO_LABEL: Record<StockArticuloEstadoProceso, string> = {
  terminado: "Terminado",
  impreso: "Impreso",
  troquelado: "Troquelado",
  otro: "Otro",
};

type EstadoFiltro = "todos" | StockArticuloEstadoDerivado | "critico";
type ProcesoFiltro = "todos" | StockArticuloEstadoProceso;

type AtpConCritico = StockArticuloAtpRow & { es_critico: boolean };

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${accent ?? "text-[#002147]"}`}>
        {value}
      </p>
    </div>
  );
}

function criticoKey(
  referenciaId: string | null | undefined,
  clienteNorm: string | null | undefined
): string {
  return `${referenciaId ?? ""}|${clienteNorm ?? ""}`;
}

export function StockArticulosPage() {
  const [rows, setRows] = useState<AtpConCritico[]>([]);
  const [loading, setLoading] = useState(true);
  const [hitLimit, setHitLimit] = useState(false);
  /** Conteo global desde la vista (incluye refs con solo lotes a 0). */
  const [criticosCount, setCriticosCount] = useState(0);
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [procesoFiltro, setProcesoFiltro] = useState<ProcesoFiltro>("todos");
  const [role, setRole] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState<string>("");
  const [canWrite, setCanWrite] = useState(false);
  const [detalle, setDetalle] = useState<AtpConCritico | null>(null);
  const [altaOpen, setAltaOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [stockAiOpen, setStockAiOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: criticoRaw, error: criticoError } = await supabase
        .from("stock_articulos_critico_por_ref")
        .select("referencia_id, cliente_norm, es_critico")
        .eq("es_critico", true);
      if (criticoError) throw criticoError;

      const criticoKeys = new Set(
        (criticoRaw ?? [])
          .filter((c) => c && c.es_critico === true)
          .map((c) =>
            criticoKey(
              typeof c.referencia_id === "string" ? c.referencia_id : null,
              typeof c.cliente_norm === "string" ? c.cliente_norm : null
            )
          )
          .filter((k) => k !== "|")
      );
      setCriticosCount(criticoKeys.size);

      let atpQuery = supabase
        .from("stock_articulos_atp")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);

      if (estadoFiltro === "agotado") {
        atpQuery = atpQuery.eq("estado_derivado", "agotado");
      } else if (estadoFiltro === "critico") {
        // Incluye lotes a 0: la rotura total también debe verse.
        const refIds = [
          ...new Set(
            (criticoRaw ?? [])
              .map((c) =>
                typeof c.referencia_id === "string" ? c.referencia_id : ""
              )
              .filter(Boolean)
          ),
        ];
        if (refIds.length === 0) {
          setRows([]);
          setHitLimit(false);
          return;
        }
        atpQuery = atpQuery.in("referencia_id", refIds);
      } else {
        atpQuery = atpQuery.gt("cantidad_fisica", 0);
      }

      const { data: viewRaw, error } = await atpQuery;
      if (error) throw error;
      const view = (viewRaw ?? []) as StockArticuloAtpRow[];
      setHitLimit(view.length >= LIST_LIMIT);
      setRows(
        view.map((r) => {
          const key = criticoKey(r.referencia_id, r.cliente_norm);
          const es_critico =
            r.unidad === "uds" &&
            r.estado_proceso === "terminado" &&
            criticoKeys.has(key);
          return { ...r, es_critico };
        })
      );
    } catch (e) {
      toast.error(
        `Error al cargar stock artículos: ${friendlyStockError(errorMessage(e))}`
      );
    } finally {
      setLoading(false);
    }
  }, [estadoFiltro]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      setUserLabel(user.email?.trim() || user.id);
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      const r =
        prof && typeof (prof as { role?: unknown }).role === "string"
          ? String((prof as { role: string }).role)
          : null;
      let caps = new Set<string>();
      try {
        caps = await fetchProfileCapacidades(supabase, user.id);
      } catch {
        caps = new Set();
      }
      if (!mounted) return;
      setRole(r);
      setCanWrite(canWriteStockArticulosClient(r, caps));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let list = rows;
    if (estadoFiltro === "critico") {
      list = list.filter((r) => r.es_critico);
    } else if (estadoFiltro !== "todos") {
      list = list.filter((r) => r.estado_derivado === estadoFiltro);
    }
    if (procesoFiltro !== "todos") {
      list = list.filter((r) => r.estado_proceso === procesoFiltro);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.cliente?.toLowerCase().includes(q) ?? false) ||
          (r.referencia_cliente?.toLowerCase().includes(q) ?? false) ||
          r.referencia_codigo.toLowerCase().includes(q) ||
          (r.referencia_descripcion?.toLowerCase().includes(q) ?? false) ||
          (r.ubicacion_fisica?.toLowerCase().includes(q) ?? false) ||
          (r.ot_origen?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [rows, estadoFiltro, procesoFiltro, search]);

  const totales = useMemo(() => {
    let librePt = 0;
    let libreWip = 0;
    let reservado = 0;
    for (const r of filtered) {
      if (r.estado_proceso === "terminado" && r.unidad === "uds") {
        librePt += r.cantidad_libre;
        reservado += r.cantidad_reservada_total;
      }
      if (r.unidad === "hojas") {
        libreWip += r.cantidad_libre;
      }
    }
    return {
      lotes: filtered.length,
      librePt,
      libreWip,
      reservado,
      /** Vista critica_por_ref, no los lotes cargados (incluye rotura total). */
      criticos: criticosCount,
    };
  }, [filtered, criticosCount]);

  const stockAiContextHint = useMemo(() => {
    const parts: string[] = [];
    if (search.trim()) parts.push(`búsqueda texto: «${search.trim()}»`);
    if (estadoFiltro !== "todos") parts.push(`filtro estado: ${estadoFiltro}`);
    if (procesoFiltro !== "todos") parts.push(`proceso: ${procesoFiltro}`);
    parts.push(`${filtered.length} lotes visibles en pantalla`);
    parts.push(`${criticosCount} refs críticas (vista)`);
    return parts.join(" · ");
  }, [search, estadoFiltro, procesoFiltro, filtered.length, criticosCount]);

  /** Detalle siempre con ATP fresco tras load() (reservas/ajustes). */
  const detalleLive = useMemo(() => {
    if (!detalle) return null;
    return rows.find((r) => r.id === detalle.id) ?? detalle;
  }, [rows, detalle]);

  const exportFiltrosLabel = useMemo(() => {
    const parts: string[] = [];
    if (search.trim()) parts.push(`texto «${search.trim()}»`);
    if (estadoFiltro !== "todos") parts.push(`estado=${estadoFiltro}`);
    if (procesoFiltro !== "todos") parts.push(`proceso=${procesoFiltro}`);
    if (parts.length === 0) return "todos (sin filtros)";
    return parts.join(" · ");
  }, [search, estadoFiltro, procesoFiltro]);

  function handleExportExcel() {
    if (filtered.length === 0) {
      toast.error("No hay filas para exportar con los filtros actuales.");
      return;
    }
    exportStockArticulosExcel(filtered, {
      filtrosLabel: exportFiltrosLabel,
      usuario: userLabel,
    });
    toast.success(
      `Excel descargado (${filtered.length} lote(s) de la vista actual).`
    );
  }

  function handleExportPdf() {
    if (filtered.length === 0) {
      toast.error("No hay filas para exportar con los filtros actuales.");
      return;
    }
    exportStockArticulosPdf(filtered, {
      filtrosLabel: exportFiltrosLabel,
      usuario: userLabel,
    });
    toast.success(
      `PDF descargado (${filtered.length} lote(s) de la vista actual).`
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[#002147]">Stock de artículos</h1>
          <p className="text-sm text-slate-600">
            Producto terminado y WIP · distinto del stock de material (palets).
            {role ? (
              <>
                {" "}
                · Rol <span className="font-medium">{role}</span>
                {canWrite ? " · escritura" : " · solo lectura"}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStockAiOpen(true)}
            disabled={loading}
          >
            <Sparkles className="size-4 mr-2 text-[#C69C2B]" />
            Asistente IA
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`size-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={loading || filtered.length === 0}
          >
            <FileSpreadsheet className="size-4 mr-1.5" />
            Excel ({filtered.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={loading || filtered.length === 0}
          >
            <FileDown className="size-4 mr-1.5" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadStockArticulosPlantilla()}
          >
            <Download className="size-4 mr-1.5" />
            Plantilla
          </Button>
          {canWrite ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(true)}
              >
                <FileSpreadsheet className="size-4 mr-1.5" />
                Importar Excel
              </Button>
              <Button size="sm" onClick={() => setAltaOpen(true)}>
                <Plus className="size-4 mr-1.5" />
                Alta lote
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Lotes" value={totales.lotes.toLocaleString("es-ES")} />
        <KpiCard
          label="Libre PT (uds)"
          value={totales.librePt.toLocaleString("es-ES")}
          accent="text-emerald-700"
        />
        <KpiCard
          label="Libre WIP (hojas)"
          value={totales.libreWip.toLocaleString("es-ES")}
          accent="text-emerald-700"
        />
        <KpiCard
          label="Reservado PT"
          value={totales.reservado.toLocaleString("es-ES")}
          accent="text-blue-700"
        />
        <KpiCard
          label="Refs críticas"
          value={totales.criticos.toLocaleString("es-ES")}
          accent="text-amber-700"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
          <Input
            placeholder="Cliente, ref. cliente, Minerva, descripción, ubicación…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-9 text-sm"
          />
        </div>

        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
          {(
            [
              ["todos", "Todos"],
              ["disponible", "Libre"],
              ["parcial", "Parcial"],
              ["reservado", "Reservado"],
              ["agotado", "Agotado"],
              ["critico", "Crítico"],
            ] as [EstadoFiltro, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setEstadoFiltro(val)}
              className={`px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                estadoFiltro === val
                  ? "bg-[#002147] text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <Select
          value={procesoFiltro}
          onValueChange={(v) => setProcesoFiltro(v as ProcesoFiltro)}
        >
          <SelectTrigger className="h-9 text-sm w-[160px]">
            <SelectValue placeholder="Proceso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo proceso</SelectItem>
            {(
              ["terminado", "impreso", "troquelado", "otro"] as StockArticuloEstadoProceso[]
            ).map((p) => (
              <SelectItem key={p} value={p}>
                {PROCESO_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-slate-400">
          {loading
            ? "Cargando…"
            : `${filtered.length} lote${filtered.length !== 1 ? "s" : ""}`}
        </p>
        {!loading && hitLimit ? (
          <p className="text-xs text-amber-700">
            Se alcanzó el límite de {LIST_LIMIT} filas; afina filtros o búsqueda
            para ver el resto.
          </p>
        ) : null}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Package className="size-8 mx-auto mb-2" />
          <p>
            {rows.length === 0
              ? canWrite
                ? "No hay lotes todavía. Usa «Alta lote» para el primer inventario."
                : "No hay lotes de stock de artículos."
              : "Sin resultados con los filtros actuales."}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="rounded-lg border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Ref. cliente</TableHead>
                <TableHead>Minerva</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Proceso</TableHead>
                <TableHead className="text-right">Físico</TableHead>
                <TableHead className="text-right">Libre</TableHead>
                <TableHead className="text-right">Bultos</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setDetalle(r)}
                >
                  <TableCell className="text-sm font-medium max-w-[140px] truncate">
                    {r.cliente ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs max-w-[120px] truncate">
                    {r.referencia_cliente ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[#002147]">
                    {r.referencia_codigo}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {r.referencia_descripcion ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {PROCESO_LABEL[r.estado_proceso] ?? r.estado_proceso}
                    <span className="text-slate-400"> · {r.unidad}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.cantidad_fisica.toLocaleString("es-ES")}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700 tabular-nums">
                    {r.cantidad_libre.toLocaleString("es-ES")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-600">
                    {r.bultos != null ? r.bultos.toLocaleString("es-ES") : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 max-w-[100px] truncate">
                    {r.ubicacion_fisica ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge
                        variant="outline"
                        className={ESTADO_BADGE[r.estado_derivado]}
                      >
                        {ESTADO_LABEL[r.estado_derivado]}
                      </Badge>
                      {r.es_critico ? (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-800 border-amber-200 gap-0.5"
                        >
                          <AlertTriangle className="size-3" />
                          Crítico
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StockArticuloDetalleDialog
        row={detalleLive}
        canWrite={canWrite}
        onClose={() => setDetalle(null)}
        onChanged={async () => {
          await load();
        }}
      />

      <AltaLoteDialog
        open={altaOpen}
        onOpenChange={setAltaOpen}
        onCreated={async () => {
          setAltaOpen(false);
          await load();
        }}
      />

      <StockArticulosImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={async () => {
          await load();
        }}
      />

      <StockArticulosAiDialog
        open={stockAiOpen}
        onOpenChange={setStockAiOpen}
        contextHint={stockAiContextHint}
        loadingStock={loading}
      />
    </div>
  );
}

function AltaLoteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [refValue, setRefValue] = useState<ReferenciaMinervaValue>({
    id: null,
    codigo: "",
  });
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState<StockArticuloUnidad>("uds");
  const [proceso, setProceso] =
    useState<StockArticuloEstadoProceso>("terminado");
  const [poses, setPoses] = useState("");
  const [bultos, setBultos] = useState("");
  const [unidadesPorBulto, setUnidadesPorBulto] = useState("");
  const [pico, setPico] = useState("");
  const [palets, setPalets] = useState("");
  const [cajaEmbalaje, setCajaEmbalaje] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [otOrigen, setOtOrigen] = useState("");
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRefValue({ id: null, codigo: "" });
    setCantidad("");
    setUnidad("uds");
    setProceso("terminado");
    setPoses("");
    setBultos("");
    setUnidadesPorBulto("");
    setPico("");
    setPalets("");
    setCajaEmbalaje("");
    setUbicacion("");
    setOtOrigen("");
    setNotas("");
  }, [open]);

  async function submit() {
    if (!refValue.id) {
      toast.error("Elige una referencia Minerva.");
      return;
    }
    const qty = parseStockImportInt(cantidad);
    if (qty == null || !Number.isFinite(qty) || Number.isNaN(qty) || qty <= 0) {
      toast.error("La cantidad debe ser un entero > 0 (admite 1.000 / 35.900).");
      return;
    }
    const posesN = poses.trim() ? parseStockImportInt(poses) : undefined;
    if (unidad === "hojas") {
      if (
        posesN == null ||
        !Number.isFinite(posesN) ||
        Number.isNaN(posesN) ||
        posesN <= 0
      ) {
        toast.error("Con unidad hojas, poses debe ser un entero > 0.");
        return;
      }
    } else if (
      posesN != null &&
      (!Number.isFinite(posesN) || Number.isNaN(posesN) || posesN <= 0)
    ) {
      toast.error("Poses debe ser un entero > 0.");
      return;
    }
    const bultosN = bultos.trim() ? parseStockImportInt(bultos) : undefined;
    if (
      bultosN != null &&
      (!Number.isFinite(bultosN) || Number.isNaN(bultosN) || bultosN < 0)
    ) {
      toast.error("Bultos debe ser un entero >= 0.");
      return;
    }
    const udsBultoN = unidadesPorBulto.trim()
      ? parseStockImportInt(unidadesPorBulto)
      : undefined;
    if (
      udsBultoN != null &&
      (!Number.isFinite(udsBultoN) || Number.isNaN(udsBultoN) || udsBultoN <= 0)
    ) {
      toast.error("Uds/bulto debe ser un entero > 0.");
      return;
    }
    const picoN = pico.trim() ? parseStockImportInt(pico) : undefined;
    if (
      picoN != null &&
      (!Number.isFinite(picoN) || Number.isNaN(picoN) || picoN < 0)
    ) {
      toast.error("Pico debe ser un entero >= 0.");
      return;
    }
    const paletsN = palets.trim() ? parseStockImportNum(palets) : undefined;
    if (
      paletsN != null &&
      (!Number.isFinite(paletsN) || Number.isNaN(paletsN) || paletsN < 0)
    ) {
      toast.error("Palets debe ser un número >= 0.");
      return;
    }

    // Aviso si embalaje no cuadra con cantidad (uds): no bloquea.
    if (
      unidad === "uds" &&
      bultosN != null &&
      udsBultoN != null &&
      Number.isFinite(bultosN) &&
      Number.isFinite(udsBultoN)
    ) {
      const picoVal = picoN ?? 0;
      const embalajeTotal = bultosN * udsBultoN + picoVal;
      if (embalajeTotal !== qty) {
        const ok = window.confirm(
          `Bultos × uds/bulto + pico = ${embalajeTotal.toLocaleString("es-ES")} ≠ ${qty.toLocaleString("es-ES")} uds.\n¿Guardar igualmente?`
        );
        if (!ok) return;
      }
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("prod_stock_articulos_alta_lote", {
        p_referencia_id: refValue.id,
        p_cantidad: qty,
        p_unidad: unidad,
        p_estado_proceso: proceso,
        p_ot_origen: otOrigen.trim() || undefined,
        p_poses: posesN,
        p_bultos: bultosN,
        p_palets: paletsN,
        p_unidades_por_bulto: udsBultoN,
        p_pico: picoN,
        p_caja_embalaje: cajaEmbalaje.trim() || undefined,
        p_ubicacion_fisica: ubicacion.trim() || undefined,
        p_notas: notas.trim() || undefined,
      });
      if (error) throw error;
      toast.success(
        `Lote dado de alta: ${refValue.codigo} · ${qty.toLocaleString("es-ES")} ${unidad}`
      );
      await onCreated();
    } catch (e) {
      toast.error(
        `No se pudo dar de alta: ${friendlyStockError(errorMessage(e))}`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alta de lote</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <ReferenciaMinervaPicker
            label="Referencia (código, cliente o descripción)"
            value={refValue}
            onChange={setRefValue}
            allowCreate={false}
            onReferenciaPicked={(row) => {
              if (row.caja_embalaje_habitual && !cajaEmbalaje.trim()) {
                setCajaEmbalaje(String(row.caja_embalaje_habitual));
              }
              if (
                row.unidades_por_embalaje_habitual != null &&
                !unidadesPorBulto.trim()
              ) {
                setUnidadesPorBulto(String(row.unidades_por_embalaje_habitual));
              }
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Cantidad</Label>
              <Input
                inputMode="numeric"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="Ej. 1.000"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Unidad</Label>
              <Select
                value={unidad}
                onValueChange={(v) => setUnidad(v as StockArticuloUnidad)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uds">uds</SelectItem>
                  <SelectItem value="hojas">hojas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Proceso</Label>
              <Select
                value={proceso}
                onValueChange={(v) => {
                  const next = v as StockArticuloEstadoProceso;
                  setProceso(next);
                  if (next === "terminado") {
                    setUnidad("uds");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "terminado",
                      "impreso",
                      "troquelado",
                      "otro",
                    ] as StockArticuloEstadoProceso[]
                  ).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROCESO_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">
                Poses{unidad === "hojas" ? " *" : " (si hojas)"}
              </Label>
              <Input
                inputMode="numeric"
                value={poses}
                onChange={(e) => setPoses(e.target.value)}
                placeholder={unidad === "hojas" ? "Obligatorio" : "Opcional"}
              />
            </div>
          </div>

          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 pt-1">
            Embalaje (opcional)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Bultos</Label>
              <Input
                inputMode="numeric"
                value={bultos}
                onChange={(e) => setBultos(e.target.value)}
                placeholder="Cajas completas"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Uds / bulto</Label>
              <Input
                inputMode="numeric"
                value={unidadesPorBulto}
                onChange={(e) => setUnidadesPorBulto(e.target.value)}
                placeholder="Ej. 50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Pico</Label>
              <Input
                inputMode="numeric"
                value={pico}
                onChange={(e) => setPico(e.target.value)}
                placeholder="Uds sueltas"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Palets</Label>
              <Input
                inputMode="decimal"
                value={palets}
                onChange={(e) => setPalets(e.target.value)}
                placeholder="Ej. 1,5"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Tipo embalaje</Label>
              <Input
                value={cajaEmbalaje}
                onChange={(e) => setCajaEmbalaje(e.target.value)}
                placeholder="MN2L, BP1N…"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Ubicación</Label>
              <Input
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">OT origen</Label>
            <OtDestinoSearchInput
              value={otOrigen}
              onChange={setOtOrigen}
              placeholder="Buscar OT en maestro (FABRICACION / origen)…"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500">Notas</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
            Guardar alta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockArticuloDetalleDialog({
  row,
  canWrite,
  onClose,
  onChanged,
}: {
  row: AtpConCritico | null;
  canWrite: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [movs, setMovs] = useState<ProdStockArticuloMovimientoRow[]>([]);
  const [loadingMovs, setLoadingMovs] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [ajusteCantidad, setAjusteCantidad] = useState("");
  const [ajusteBultos, setAjusteBultos] = useState("");
  const [ajusteNotas, setAjusteNotas] = useState("");
  const [ajusteForzar, setAjusteForzar] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUbicacion, setEditUbicacion] = useState("");
  const [editBultos, setEditBultos] = useState("");
  const [editUdsBulto, setEditUdsBulto] = useState("");
  const [editPico, setEditPico] = useState("");
  const [editPalets, setEditPalets] = useState("");
  const [editCaja, setEditCaja] = useState("");
  const [editNotas, setEditNotas] = useState("");
  const [editCondicion, setEditCondicion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function openEditForm(r: AtpConCritico) {
    setEditUbicacion(r.ubicacion_fisica ?? "");
    setEditBultos(r.bultos != null ? String(r.bultos) : "");
    setEditUdsBulto(r.unidades_por_bulto != null ? String(r.unidades_por_bulto) : "");
    setEditPico(r.pico != null ? String(r.pico) : "");
    setEditPalets(r.palets != null ? String(r.palets) : "");
    setEditCaja(r.caja_embalaje ?? "");
    setEditNotas(r.notas ?? "");
    setEditCondicion(r.condicion ?? "");
    setEditOpen(true);
  }

  const editHasChanges = useMemo(() => {
    if (!row) return false;
    const norm = (s: string) => s.trim();
    const numEq = (form: string, cur: number | null) => {
      if (!form.trim() && cur == null) return true;
      if (!form.trim() && cur != null) return false;
      const n = Number(form.replace(",", "."));
      return Number.isFinite(n) && n === Number(cur);
    };
    return !(
      norm(editUbicacion) === norm(row.ubicacion_fisica ?? "") &&
      numEq(editBultos, row.bultos) &&
      numEq(editUdsBulto, row.unidades_por_bulto) &&
      numEq(editPico, row.pico) &&
      numEq(editPalets, row.palets != null ? Number(row.palets) : null) &&
      norm(editCaja) === norm(row.caja_embalaje ?? "") &&
      norm(editNotas) === norm(row.notas ?? "") &&
      norm(editCondicion) === norm(row.condicion ?? "")
    );
  }, [
    row,
    editUbicacion,
    editBultos,
    editUdsBulto,
    editPico,
    editPalets,
    editCaja,
    editNotas,
    editCondicion,
  ]);

  useEffect(() => {
    if (!row) {
      setMovs([]);
      return;
    }
    let cancelled = false;
    setLoadingMovs(true);
    void (async () => {
      const { data } = await supabase
        .from("prod_stock_articulos_movimientos")
        .select("*")
        .eq("stock_articulo_id", row.id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (!cancelled) {
        setMovs((data ?? []) as ProdStockArticuloMovimientoRow[]);
        setLoadingMovs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row]);

  async function submitAjuste() {
    if (!row) return;
    const nota = ajusteNotas.trim();
    if (!nota) {
      toast.error("La nota es obligatoria en un ajuste.");
      return;
    }
    const nueva = parseStockImportInt(ajusteCantidad);
    if (
      nueva == null ||
      !Number.isFinite(nueva) ||
      Number.isNaN(nueva) ||
      nueva < 0
    ) {
      toast.error(
        "La nueva cantidad debe ser un entero >= 0 (admite 1.000 / 35.900)."
      );
      return;
    }
    const bultosN = ajusteBultos.trim()
      ? parseStockImportInt(ajusteBultos)
      : null;
    if (
      ajusteBultos.trim() &&
      (bultosN == null ||
        !Number.isFinite(bultosN) ||
        Number.isNaN(bultosN) ||
        bultosN < 0)
    ) {
      toast.error("Bultos debe ser un entero >= 0.");
      return;
    }
    const bultosUnchanged =
      bultosN === null || bultosN === row.bultos;
    if (nueva === row.cantidad_fisica && bultosUnchanged) {
      toast.info("La cantidad y los bultos no cambiaron.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("prod_stock_articulos_ajustar", {
        p_stock_id: row.id,
        p_cantidad_nueva: nueva,
        p_bultos: bultosN === null ? undefined : bultosN,
        p_notas: nota,
        p_forzar: ajusteForzar || undefined,
      });
      if (error) throw error;
      toast.success(
        `Ajuste: ${row.cantidad_fisica.toLocaleString("es-ES")} → ${nueva.toLocaleString("es-ES")} ${row.unidad}`
      );
      setAjusteOpen(false);
      onClose();
      await onChanged();
    } catch (e) {
      toast.error(
        `No se pudo ajustar: ${friendlyStockError(errorMessage(e))}`
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitEditar() {
    if (!row || !editHasChanges) return;

    const args: Record<string, unknown> = { p_stock_id: row.id };

    const setText = (
      form: string,
      cur: string | null,
      pKey: string,
      clearKey: string
    ) => {
      const f = form.trim();
      const c = (cur ?? "").trim();
      if (f === c) return;
      if (!f && c) args[clearKey] = true;
      else args[pKey] = f;
    };

    const setNum = (
      form: string,
      cur: number | null,
      pKey: string,
      clearKey: string,
      asInt: boolean
    ) => {
      const empty = !form.trim();
      if (empty && cur == null) return;
      if (empty && cur != null) {
        args[clearKey] = true;
        return;
      }
      const n = asInt
        ? parseStockImportInt(form)
        : parseStockImportNum(form);
      if (n == null || !Number.isFinite(n) || Number.isNaN(n) || n < 0) {
        toast.error("Hay un valor numérico no válido.");
        throw new Error("invalid");
      }
      if (pKey === "p_unidades_por_bulto" && n <= 0) {
        toast.error("Uds/bulto debe ser > 0 (o vacío para borrar).");
        throw new Error("invalid");
      }
      if (cur != null && n === Number(cur)) return;
      args[pKey] = n;
    };

    try {
      setText(editUbicacion, row.ubicacion_fisica, "p_ubicacion_fisica", "p_clear_ubicacion");
      setText(editCaja, row.caja_embalaje, "p_caja_embalaje", "p_clear_caja_embalaje");
      setText(editNotas, row.notas, "p_notas", "p_clear_notas");
      setText(editCondicion, row.condicion, "p_condicion", "p_clear_condicion");
      setNum(editBultos, row.bultos, "p_bultos", "p_clear_bultos", true);
      setNum(
        editUdsBulto,
        row.unidades_por_bulto,
        "p_unidades_por_bulto",
        "p_clear_unidades_por_bulto",
        true
      );
      setNum(editPico, row.pico, "p_pico", "p_clear_pico", true);
      setNum(
        editPalets,
        row.palets != null ? Number(row.palets) : null,
        "p_palets",
        "p_clear_palets",
        false
      );
    } catch {
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc(
        "prod_stock_articulos_editar_datos",
        args as {
          p_stock_id: string;
          p_ubicacion_fisica?: string;
          p_bultos?: number;
          p_unidades_por_bulto?: number;
          p_pico?: number;
          p_palets?: number;
          p_caja_embalaje?: string;
          p_notas?: string;
          p_condicion?: string;
          p_clear_ubicacion?: boolean;
          p_clear_caja_embalaje?: boolean;
          p_clear_notas?: boolean;
          p_clear_condicion?: boolean;
          p_clear_unidades_por_bulto?: boolean;
          p_clear_bultos?: boolean;
          p_clear_pico?: boolean;
          p_clear_palets?: boolean;
        }
      );
      if (error) throw error;
      toast.success("Datos del lote actualizados.");
      setEditOpen(false);
      onClose();
      await onChanged();
    } catch (e) {
      toast.error(
        `No se pudo editar: ${friendlyStockError(errorMessage(e))}`
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog
        open={!!row}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          {row ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{row.referencia_codigo}</span>
                  <Badge
                    variant="outline"
                    className={ESTADO_BADGE[row.estado_derivado]}
                  >
                    {ESTADO_LABEL[row.estado_derivado]}
                  </Badge>
                  {row.es_critico ? (
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-800 border-amber-200"
                    >
                      Crítico
                    </Badge>
                  ) : null}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Campo label="Cliente" value={row.cliente} />
                <Campo label="Ref. cliente" value={row.referencia_cliente} />
                <Campo
                  label="Descripción"
                  value={row.referencia_descripcion}
                />
                <Campo
                  label="Proceso"
                  value={`${PROCESO_LABEL[row.estado_proceso]} · ${row.unidad}`}
                />
                <Campo
                  label="Físico"
                  value={row.cantidad_fisica.toLocaleString("es-ES")}
                />
                <Campo
                  label="Libre"
                  value={row.cantidad_libre.toLocaleString("es-ES")}
                />
                <Campo
                  label="Reservado"
                  value={row.cantidad_reservada_total.toLocaleString("es-ES")}
                />
                <Campo
                  label="Bultos"
                  value={
                    row.bultos != null
                      ? row.bultos.toLocaleString("es-ES")
                      : null
                  }
                />
                <Campo
                  label="Uds/bulto"
                  value={
                    row.unidades_por_bulto != null
                      ? row.unidades_por_bulto.toLocaleString("es-ES")
                      : null
                  }
                />
                <Campo
                  label="Pico"
                  value={
                    row.pico != null ? row.pico.toLocaleString("es-ES") : null
                  }
                />
                <Campo
                  label="Palets"
                  value={
                    row.palets != null
                      ? Number(row.palets).toLocaleString("es-ES")
                      : null
                  }
                />
                <Campo label="Embalaje" value={row.caja_embalaje} />
                <Campo label="Ubicación" value={row.ubicacion_fisica} />
                <Campo label="OT origen" value={row.ot_origen} />
                <Campo label="Condición" value={row.condicion} />
                <Campo label="Notas" value={row.notas} />
              </div>

              {canWrite ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditForm(row)}
                  >
                    Editar datos
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAjusteCantidad(String(row.cantidad_fisica));
                      setAjusteBultos(
                        row.bultos != null ? String(row.bultos) : ""
                      );
                      setAjusteNotas("");
                      setAjusteForzar(false);
                      setAjusteOpen(true);
                    }}
                  >
                    Ajustar cantidad
                  </Button>
                </div>
              ) : null}

              <StockArticulosReservasPanel
                stockId={row.id}
                referenciaCodigo={row.referencia_codigo}
                loteCliente={row.cliente}
                unidad={row.unidad}
                libre={row.cantidad_libre}
                canWrite={canWrite}
                onChanged={onChanged}
              />

              <div className="pt-3 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Movimientos recientes
                </p>
                {loadingMovs ? (
                  <Loader2 className="size-4 animate-spin text-slate-400" />
                ) : movs.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin movimientos.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {movs.map((m) => {
                      const esEdicionDatos =
                        m.tipo === "ajuste" &&
                        typeof m.notas === "string" &&
                        m.notas.startsWith("Edición datos");
                      const ajusteRango =
                        !esEdicionDatos &&
                        m.tipo === "ajuste" &&
                        m.cantidad_antes != null &&
                        m.cantidad_despues != null
                          ? `${m.cantidad_antes.toLocaleString("es-ES")} → ${m.cantidad_despues.toLocaleString("es-ES")}`
                          : null;
                      const label = esEdicionDatos
                        ? "edición"
                        : m.tipo;
                      const detalle = esEdicionDatos
                        ? (m.notas ?? "").replace(/^Edición datos:\s*/i, "")
                        : ajusteRango ?? m.cantidad.toLocaleString("es-ES");
                      return (
                        <li
                          key={m.id}
                          className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-1"
                        >
                          <span>
                            <span className="font-medium">{label}</span>
                            {" · "}
                            {detalle}
                            {!esEdicionDatos &&
                            m.cantidad_merma != null &&
                            m.cantidad_merma > 0
                              ? ` (merma ${m.cantidad_merma})`
                              : ""}
            {!esEdicionDatos && m.ot_numero
                              ? ` · OT ${m.ot_numero}`
                              : ""}
                            {!esEdicionDatos && m.notas
                              ? ` · ${m.notas}`
                              : ""}
                          </span>
                          <span className="text-slate-400 tabular-nums">
                            {new Date(m.created_at).toLocaleString("es-ES")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Ajustar · {row?.referencia_codigo ?? ""}
            </DialogTitle>
          </DialogHeader>
          {row ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Físico actual:{" "}
                <strong>
                  {row.cantidad_fisica.toLocaleString("es-ES")} {row.unidad}
                </strong>
                {" · "}
                Comprometido:{" "}
                <strong>
                  {row.cantidad_reservada_total.toLocaleString("es-ES")}
                </strong>
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Nueva cantidad</Label>
                <Input
                  inputMode="numeric"
                  value={ajusteCantidad}
                  onChange={(e) => setAjusteCantidad(e.target.value)}
                  placeholder="Ej. 1.000"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Bultos (opcional)</Label>
                <Input
                  inputMode="numeric"
                  value={ajusteBultos}
                  onChange={(e) => setAjusteBultos(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Nota *</Label>
                <Input
                  value={ajusteNotas}
                  onChange={(e) => setAjusteNotas(e.target.value)}
                  placeholder="Obligatoria (auditoría)"
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={ajusteForzar}
                  onChange={(e) => setAjusteForzar(e.target.checked)}
                />
                Forzar aunque quede por debajo de lo reservado
              </label>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAjusteOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void submitAjuste()}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : null}
                  Guardar ajuste
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar datos · {row?.referencia_codigo ?? ""}
            </DialogTitle>
          </DialogHeader>
          {row ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                No cambia la cantidad física (
                <strong>
                  {row.cantidad_fisica.toLocaleString("es-ES")} {row.unidad}
                </strong>
                ). Vaciar un campo lo borra del lote.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Ubicación</Label>
                  <Input
                    value={editUbicacion}
                    onChange={(e) => setEditUbicacion(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Tipo embalaje</Label>
                  <Input
                    value={editCaja}
                    onChange={(e) => setEditCaja(e.target.value)}
                    placeholder="MN2L, BP1N…"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Bultos</Label>
                  <Input
                    inputMode="numeric"
                    value={editBultos}
                    onChange={(e) => setEditBultos(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Uds / bulto</Label>
                  <Input
                    inputMode="numeric"
                    value={editUdsBulto}
                    onChange={(e) => setEditUdsBulto(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Pico</Label>
                  <Input
                    inputMode="numeric"
                    value={editPico}
                    onChange={(e) => setEditPico(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Palets</Label>
                  <Input
                    inputMode="decimal"
                    value={editPalets}
                    onChange={(e) => setEditPalets(e.target.value)}
                    placeholder="Ej. 1,5"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Condición</Label>
                <Input
                  value={editCondicion}
                  onChange={(e) => setEditCondicion(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Notas</Label>
                <Textarea
                  value={editNotas}
                  onChange={(e) => setEditNotas(e.target.value)}
                  rows={2}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => void submitEditar()}
                  disabled={submitting || !editHasChanges}
                >
                  {submitting ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : null}
                  Guardar datos
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Campo({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="text-sm text-slate-800 break-words">{value?.trim() || "—"}</p>
    </div>
  );
}
