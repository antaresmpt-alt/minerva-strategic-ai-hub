"use client";

import {
  CheckCircle2,
  Factory,
  FileOutput,
  FileSpreadsheet,
  History,
  PackageSearch,
  Pencil,
  Printer,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { NativeSelect, type Option } from "@/components/ui/select-native";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import {
  formatEntregaClienteSoloFecha,
  parseExternosImportFile,
} from "@/lib/externos-excel-import";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const ESTADOS_SEGUIMIENTO = [
  "Pendiente",
  "Enviado",
  "En Proveedor",
  "Recibido",
] as const;

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
  created_at: string;
};

type AcabadoRow = {
  id: string;
  tipo_proveedor_id: string;
  nombre: string;
  created_at: string;
};

type SeguimientoRow = {
  id: string;
  id_pedido: number;
  cliente_nombre: string;
  trabajo_titulo: string;
  pedido_cliente: string;
  proveedor_id: string;
  acabado_id: string;
  estado: string;
  fecha_envio: string | null;
  fecha_prevista: string | null;
  notas_logistica: string | null;
  created_at: string;
  /** Si existe en BD (trigger / columna), última modificación */
  updated_at?: string | null;
};

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

function defaultYmdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ImportPreviewRow = {
  key: string;
  id_pedido: number;
  cliente: string;
  ref_cliente: string;
  titulo: string;
  fecha_entrega_excel: string;
  fecha_prevista: string;
  /** Editable; se persiste en prod_seguimiento_externos.notas_logistica */
  notas: string;
  proveedor_id: string;
  acabado_id: string;
  selected: boolean;
  duplicate: boolean;
};

function isEnvioRetrasado(
  fechaPrevista: string | null,
  estado: string
): boolean {
  if (!fechaPrevista || estado === "Recibido") return false;
  const fp = new Date(fechaPrevista);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fpDay = new Date(fp);
  fpDay.setHours(0, 0, 0, 0);
  return fpDay.getTime() < today.getTime();
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

type SemaforoInfo = {
  kind: "recibido" | "retraso" | "urgente" | "transito" | "pendiente";
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
  if (row.estado === "Enviado" || row.estado === "En Proveedor") {
    return {
      kind: "transito",
      tooltip: "En tránsito o en proveedor — dentro de plazo",
      excelLabel: "🔵 En plazo (envío/proveedor)",
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

const emptySelect: Option[] = [{ value: "", label: "— Seleccionar —" }];

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

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ProveedorRow | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editTipoId, setEditTipoId] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelefono, setEditTelefono] = useState("");

  const [envIdPedido, setEnvIdPedido] = useState("");
  const [envCliente, setEnvCliente] = useState("");
  const [envTrabajo, setEnvTrabajo] = useState("");
  const [envPedidoCliente, setEnvPedidoCliente] = useState("");
  const [envProveedorId, setEnvProveedorId] = useState("");
  const [envAcabadoId, setEnvAcabadoId] = useState("");
  const [envFecha, setEnvFecha] = useState("");
  const [envNotas, setEnvNotas] = useState("");

  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>(
    []
  );
  const [importDragOver, setImportDragOver] = useState(false);
  const [bulkImportProv, setBulkImportProv] = useState("");
  const [bulkImportAcab, setBulkImportAcab] = useState("");
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const importMasterCheckboxRef = useRef<HTMLInputElement>(null);

  const [verHistorial, setVerHistorial] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroProveedorId, setFiltroProveedorId] = useState("");
  const [busquedaSeguimiento, setBusquedaSeguimiento] = useState("");

  const [seguimientoSheetOpen, setSeguimientoSheetOpen] = useState(false);
  const [seguimientoEditing, setSeguimientoEditing] =
    useState<SeguimientoRow | null>(null);
  const [editSegProveedorId, setEditSegProveedorId] = useState("");
  const [editSegAcabadoId, setEditSegAcabadoId] = useState("");
  const [editSegFecha, setEditSegFecha] = useState("");
  const [editSegNotas, setEditSegNotas] = useState("");

  const printListadoRef = useRef<HTMLDivElement>(null);
  const handlePrintListado = useReactToPrint({
    contentRef: printListadoRef,
    documentTitle: `Minerva-Parte-Externos-${new Date().toISOString().slice(0, 10)}`,
    pageStyle: `
      @page { size: A4 landscape; margin: 10mm 12mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `,
  });

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

  const otEnSeguimiento = useMemo(
    () => new Set(seguimientos.map((s) => s.id_pedido)),
    [seguimientos]
  );

  const bulkImportAcabadoOptions: Option[] = useMemo(() => {
    if (!bulkImportProv) return emptySelect;
    const prov = proveedores.find((p) => p.id === bulkImportProv);
    if (!prov) return emptySelect;
    const opts = acabadosCatalogo.filter(
      (a) => a.tipo_proveedor_id === prov.tipo_proveedor_id
    );
    return [
      ...emptySelect,
      ...opts.map((a) => ({ value: a.id, label: a.nombre })),
    ];
  }, [bulkImportProv, proveedores, acabadosCatalogo]);

  const editSeguimientoAcabadoOptions: Option[] = useMemo(() => {
    if (!editSegProveedorId) return emptySelect;
    const prov = proveedores.find((p) => p.id === editSegProveedorId);
    if (!prov) return emptySelect;
    const opts = acabadosCatalogo.filter(
      (a) => a.tipo_proveedor_id === prov.tipo_proveedor_id
    );
    return [
      ...emptySelect,
      ...opts.map((a) => ({ value: a.id, label: a.nombre })),
    ];
  }, [editSegProveedorId, proveedores, acabadosCatalogo]);

  const importSelectionStats = useMemo(() => {
    const selectable = importPreviewRows.filter((r) => !r.duplicate);
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
    let list = seguimientos;
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
        const ot = String(r.id_pedido);
        const cli = (r.cliente_nombre ?? "").toLowerCase();
        const ped = (r.pedido_cliente ?? "").toLowerCase();
        const trab = (r.trabajo_titulo ?? "").toLowerCase();
        return (
          ot.includes(q) ||
          cli.includes(q) ||
          ped.includes(q) ||
          trab.includes(q)
        );
      });
    }
    return list;
  }, [
    seguimientos,
    verHistorial,
    filtroEstado,
    filtroProveedorId,
    busquedaSeguimiento,
  ]);

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      const [tiposRes, provRes, acabRes, segRes] = await Promise.all([
        supabase.from("prod_cat_tipos_proveedor").select("*").order("nombre"),
        supabase
          .from("prod_proveedores")
          .select("id, nombre, tipo_proveedor_id, email, telefono, created_at")
          .order("nombre"),
        supabase
          .from("prod_cat_acabados")
          .select("id, tipo_proveedor_id, nombre, created_at")
          .order("nombre"),
        supabase
          .from("prod_seguimiento_externos")
          .select("*")
          .order("created_at", { ascending: false }),
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
      setProveedores(
        Array.isArray(provRes.data)
          ? (provRes.data as ProveedorRow[])
          : []
      );
      setAcabadosCatalogo(
        Array.isArray(acabRes.data)
          ? (acabRes.data as AcabadoRow[])
          : []
      );
      setSeguimientos(
        Array.isArray(segRes.data)
          ? (segRes.data as SeguimientoRow[])
          : []
      );
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "No se pudieron cargar los datos."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

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
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("prod_cat_acabados")
        .select("id, nombre")
        .eq("tipo_proveedor_id", prov.tipo_proveedor_id)
        .order("nombre");
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        setAcabadosForm([]);
        setEnvAcabadoId("");
        return;
      }
      setAcabadosForm((data ?? []) as { id: string; nombre: string }[]);
      setEnvAcabadoId("");
    })();
    return () => {
      cancelled = true;
    };
  }, [envProveedorId, proveedores, supabase]);

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
    void loadCore();
  }

  function openEdit(p: ProveedorRow) {
    setEditing(p);
    setEditNombre(p.nombre);
    setEditTipoId(p.tipo_proveedor_id);
    setEditEmail(p.email ?? "");
    setEditTelefono(p.telefono ?? "");
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
    const ot = Number(envIdPedido);
    if (!Number.isFinite(ot) || ot <= 0) {
      toast.error("Número de OT no válido.");
      return;
    }
    if (
      !envCliente.trim() ||
      !envTrabajo.trim() ||
      !envPedidoCliente.trim() ||
      !envProveedorId ||
      !envAcabadoId ||
      !envFecha
    ) {
      toast.error("Completa todos los campos obligatorios.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("prod_seguimiento_externos").insert({
      id_pedido: ot,
      cliente_nombre: envCliente.trim(),
      trabajo_titulo: envTrabajo.trim(),
      pedido_cliente: envPedidoCliente.trim(),
      proveedor_id: envProveedorId,
      acabado_id: envAcabadoId,
      estado: "Pendiente",
      fecha_prevista: dateInputToTimestamptz(envFecha),
      notas_logistica: envNotas.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Envío registrado.");
    setEnvIdPedido("");
    setEnvCliente("");
    setEnvTrabajo("");
    setEnvPedidoCliente("");
    setEnvProveedorId("");
    setEnvAcabadoId("");
    setEnvFecha("");
    setEnvNotas("");
    setTab("seguimiento");
    void loadCore();
  }

  function acabadoOptionsForProveedorId(provId: string): Option[] {
    if (!provId) return emptySelect;
    const prov = proveedores.find((p) => p.id === provId);
    if (!prov) return emptySelect;
    const opts = acabadosCatalogo.filter(
      (a) => a.tipo_proveedor_id === prov.tipo_proveedor_id
    );
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
        const { rows, parseWarnings } = await parseExternosImportFile(file);
        if (parseWarnings.length > 0) {
          toast.info(parseWarnings.slice(0, 5).join(" · "));
        }
        if (rows.length === 0) {
          toast.error(
            "No hay filas importables (estado Abierto / En Curso y OT válida)."
          );
          return;
        }
        setImportPreviewRows(
          rows.map((c) => {
            const dup = otEnSeguimiento.has(c.id_pedido);
            return {
              key: crypto.randomUUID(),
              id_pedido: c.id_pedido,
              cliente: c.cliente,
              ref_cliente: c.ref_cliente,
              titulo: c.titulo,
              fecha_entrega_excel: c.fecha_entrega_excel,
              fecha_prevista: c.fecha_prevista_default || defaultYmdLocal(),
              notas: "",
              proveedor_id: "",
              acabado_id: "",
              selected: false,
              duplicate: dup,
            };
          })
        );
        setBulkImportProv("");
        setBulkImportAcab("");
        toast.success(`${rows.length} fila(s) en la sala de validación.`);
      } catch (err) {
        console.error(err);
        toast.error(
          err instanceof Error ? err.message : "No se pudo leer el Excel."
        );
      }
    },
    [otEnSeguimiento]
  );

  function setImportRowProveedor(key: string, provId: string) {
    setImportPreviewRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const prov = proveedores.find((p) => p.id === provId);
        if (!prov) return { ...r, proveedor_id: provId, acabado_id: "" };
        const opts = acabadosCatalogo.filter(
          (a) => a.tipo_proveedor_id === prov.tipo_proveedor_id
        );
        let acab = r.acabado_id;
        if (!opts.some((o) => o.id === acab)) acab = "";
        return { ...r, proveedor_id: provId, acabado_id: acab };
      })
    );
  }

  function toggleImportSelectAllSelectable() {
    setImportPreviewRows((prev) => {
      const selectable = prev.filter((r) => !r.duplicate);
      if (selectable.length === 0) return prev;
      const allSelected = selectable.every((r) => r.selected);
      const nextSelect = !allSelected;
      return prev.map((r) =>
        r.duplicate ? r : { ...r, selected: nextSelect }
      );
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
    const hasTargets = importPreviewRows.some((r) => r.selected && !r.duplicate);
    if (!hasTargets) {
      toast.error(
        "Selecciona al menos una fila importable para aplicar la asignación."
      );
      return;
    }
    setImportPreviewRows((prev) =>
      prev.map((r) => {
        if (!r.selected || r.duplicate) return r;
        const prov = proveedores.find((p) => p.id === bulkImportProv);
        if (!prov) return r;
        const opts = acabadosCatalogo.filter(
          (a) => a.tipo_proveedor_id === prov.tipo_proveedor_id
        );
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
    const seleccionadas = importPreviewRows.filter(
      (r) => r.selected && !r.duplicate
    );
    if (seleccionadas.length === 0) {
      toast.error(
        "Selecciona al menos una fila importable con la casilla junto a la OT."
      );
      return;
    }
    const toInsert = seleccionadas.filter(
      (r) => r.proveedor_id && r.acabado_id && r.fecha_prevista
    );
    if (toInsert.length === 0) {
      toast.error(
        "En las filas seleccionadas, completa proveedor, acabado y fecha prevista."
      );
      return;
    }
    setSaving(true);
    const payload = toInsert.map((r) => ({
      id_pedido: r.id_pedido,
      cliente_nombre: r.cliente,
      trabajo_titulo: r.titulo,
      pedido_cliente: r.ref_cliente,
      proveedor_id: r.proveedor_id,
      acabado_id: r.acabado_id,
      estado: "Pendiente",
      fecha_prevista: dateInputToTimestamptz(r.fecha_prevista),
      notas_logistica: r.notas.trim() || null,
    }));
    const { error } = await supabase
      .from("prod_seguimiento_externos")
      .insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `Se han importado ${toInsert.length} trabajos correctamente a Seguimiento`
    );
    const importedKeys = new Set(toInsert.map((r) => r.key));
    const remainingCount = importPreviewRows.length - toInsert.length;
    setImportPreviewRows((prev) => prev.filter((r) => !importedKeys.has(r.key)));
    if (remainingCount === 0) {
      setBulkImportProv("");
      setBulkImportAcab("");
      setTab("seguimiento");
    }
    void loadCore();
  }

  const exportSeguimientoExcel = useCallback(() => {
    const rows = seguimientosFiltrados.map((r) => {
      const sem = computeSemaforo(r);
      return {
        Semáforo: sem.excelLabel,
        OT: r.id_pedido,
        Cliente: r.cliente_nombre,
        Trabajo: r.trabajo_titulo,
        "Pedido cliente": r.pedido_cliente,
        Proveedor: proveedorNombreById.get(r.proveedor_id) ?? "",
        Acabado: acabadoNombreById.get(r.acabado_id) ?? "",
        Estado: r.estado,
        "Fecha prevista": r.fecha_prevista
          ? formatFechaEsCorta(r.fecha_prevista)
          : "",
        "Fecha envío": r.fecha_envio ? formatFechaEsCorta(r.fecha_envio) : "",
        Alta: formatFechaEsCorta(r.created_at),
        Modif: formatFechaEsCorta(
          r.updated_at != null && r.updated_at !== ""
            ? r.updated_at
            : r.created_at
        ),
        Notas: r.notas_logistica ?? "",
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

  function openSeguimientoEdit(row: SeguimientoRow) {
    setSeguimientoEditing(row);
    setEditSegProveedorId(row.proveedor_id);
    setEditSegAcabadoId(row.acabado_id);
    setEditSegFecha(isoToDateInput(row.fecha_prevista));
    setEditSegNotas(row.notas_logistica ?? "");
    setSeguimientoSheetOpen(true);
  }

  async function handleUpdateSeguimiento(e: React.FormEvent) {
    e.preventDefault();
    if (!seguimientoEditing) return;
    if (!editSegProveedorId || !editSegAcabadoId || !editSegFecha) {
      toast.error("Proveedor, acabado y fecha prevista son obligatorios.");
      return;
    }
    const prov = proveedores.find((p) => p.id === editSegProveedorId);
    if (!prov) {
      toast.error("Proveedor no válido.");
      return;
    }
    const acabOk = acabadosCatalogo.some(
      (a) =>
        a.id === editSegAcabadoId && a.tipo_proveedor_id === prov.tipo_proveedor_id
    );
    if (!acabOk) {
      toast.error("El acabado no corresponde al tipo del proveedor.");
      return;
    }
    const now = new Date().toISOString();
    const patch: Record<string, string | null> = {
      proveedor_id: editSegProveedorId,
      acabado_id: editSegAcabadoId,
      fecha_prevista: dateInputToTimestamptz(editSegFecha),
      notas_logistica: editSegNotas.trim() || null,
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

  const tabTriggerClass =
    "gap-1.5 rounded-md px-2.5 py-2 text-xs data-active:bg-[#C69C2B]/20 data-active:font-semibold data-active:text-[#002147] data-active:shadow-sm data-active:ring-2 data-active:ring-[#C69C2B]/45 sm:gap-2 sm:px-3 sm:text-sm";

  return (
    <div className="w-full max-w-none space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#002147] md:text-3xl">
          Gestión de Externos
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Seguimiento de trabajos fuera, directorio de colaboradores y catálogo
          de acabados ·{" "}
          <span className="font-medium text-[#002147]">www.minervaglobal.es</span>
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="w-full max-w-none">
        <div className="mb-5 flex w-full justify-start sm:mb-6">
          <TabsList className="inline-flex h-auto w-fit max-w-full flex-wrap gap-1 rounded-lg border border-slate-200/90 bg-slate-50/90 p-1 shadow-sm">
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

        <TabsContent value="seguimiento" className="mt-0 space-y-6 outline-none">
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

          <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1.5">
                  <CardTitle className="text-lg text-[#002147]">
                    Trabajos fuera (seguimiento)
                  </CardTitle>
                  <CardDescription>
                    Por defecto no se listan trabajos «Recibido». Usa «Ver
                    Histórico» para incluirlos. Cambia el estado desde la tabla
                    al instante; el lápiz abre el panel para proveedor, acabado,
                    fecha prevista y notas. Al pasar a «Enviado» se registra la
                    fecha de envío.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || seguimientosFiltrados.length === 0}
                    onClick={exportSeguimientoExcel}
                  >
                    <FileSpreadsheet className="mr-1.5 size-4" aria-hidden />
                    Exportar Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loading || seguimientosFiltrados.length === 0}
                    onClick={() => void handlePrintListado()}
                  >
                    <Printer className="mr-1.5 size-4" aria-hidden />
                    Imprimir parte (PDF)
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <NativeSelect
                  label="Estado"
                  options={estadoFiltroOptions}
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                />
                <NativeSelect
                  label="Proveedor"
                  options={proveedorFiltroOptions}
                  value={filtroProveedorId}
                  onChange={(e) => setFiltroProveedorId(e.target.value)}
                />
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="busq-seg">Buscar (OT, cliente, pedido, trabajo)</Label>
                  <Input
                    id="busq-seg"
                    placeholder="Ej. 24001 o nombre"
                    value={busquedaSeguimiento}
                    onChange={(e) => setBusquedaSeguimiento(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="flex flex-col justify-end gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Histórico
                  </span>
                  <Toggle
                    variant="outline"
                    size="sm"
                    pressed={verHistorial}
                    onPressedChange={setVerHistorial}
                    className="h-9 w-full justify-start gap-2 px-3 sm:w-auto"
                    aria-label="Ver histórico incluyendo trabajos recibidos"
                  >
                    <History className="size-4 shrink-0 opacity-80" aria-hidden />
                    Ver Histórico
                  </Toggle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              {loading ? (
                <p className="p-6 text-sm text-muted-foreground">Cargando…</p>
              ) : seguimientosFiltrados.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  No hay registros que coincidan con los filtros.
                </p>
              ) : (
                <div className="max-h-[min(78vh,56rem)] w-full max-w-none overflow-auto rounded-lg border border-slate-200/80 sm:rounded-xl">
                  <table className="w-full min-w-[110rem] caption-bottom border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="sticky top-0 z-30 w-11 bg-slate-50/95 px-1 py-2.5 text-center text-xs font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Semáforo
                        </th>
                        <th className="sticky top-0 z-30 w-14 bg-slate-50/95 px-2 py-2.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          OT
                        </th>
                        <th className="sticky top-0 z-30 min-w-[16rem] max-w-[22%] bg-slate-50/95 px-2 py-2.5 text-left text-xs font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Cliente
                        </th>
                        <th className="sticky top-0 z-30 min-w-[28rem] max-w-[34%] bg-slate-50/95 px-2 py-2.5 text-left text-xs font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Trabajo
                        </th>
                        <th className="sticky top-0 z-30 min-w-[8rem] bg-slate-50/95 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Proveedor
                        </th>
                        <th className="sticky top-0 z-30 min-w-[8rem] bg-slate-50/95 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Acabado
                        </th>
                        <th className="sticky top-0 z-30 min-w-[6.5rem] bg-slate-50/95 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Estado
                        </th>
                        <th className="sticky top-0 z-30 w-[5.5rem] min-w-[5.5rem] max-w-[5.75rem] bg-slate-50/95 px-1 py-2 text-center text-[11px] font-medium whitespace-nowrap text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Previsto
                        </th>
                        <th className="sticky top-0 z-30 w-[5.5rem] min-w-[5.5rem] max-w-[5.75rem] bg-slate-50/95 px-1 py-2 text-center text-[11px] font-medium whitespace-nowrap text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Envío
                        </th>
                        <th className="sticky top-0 z-30 min-w-[22rem] max-w-[28rem] bg-slate-50/95 px-3 py-2.5 text-left text-xs font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Notas
                        </th>
                        <th className="sticky top-0 z-30 w-[5.5rem] min-w-[5.5rem] max-w-[5.75rem] bg-slate-50/95 px-1 py-2 text-center text-[11px] font-medium whitespace-nowrap text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Alta
                        </th>
                        <th className="sticky top-0 z-30 w-[5.5rem] min-w-[5.5rem] max-w-[5.75rem] bg-slate-50/95 px-1 py-2 text-center text-[11px] font-medium whitespace-nowrap text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Modif.
                        </th>
                        <th className="sticky top-0 z-30 w-12 bg-slate-50/95 px-2 py-2.5 text-center text-xs font-medium text-muted-foreground shadow-[0_1px_0_0_rgb(226_232_240)] backdrop-blur-sm dark:bg-slate-950/95">
                          Acciones
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
                            <td className="w-11 px-1 py-1.5 text-center align-middle">
                              <SemaforoCell row={row} />
                            </td>
                            <td className="w-14 px-2 py-1.5 font-medium whitespace-nowrap">
                              {row.id_pedido}
                            </td>
                            <td className="max-w-[22%] min-w-[16rem] truncate py-1.5 text-[13px] leading-snug">
                              {row.cliente_nombre}
                            </td>
                            <td className="min-w-[28rem] max-w-[34%] py-1.5 align-top leading-snug">
                              <span
                                className="line-clamp-2 break-words whitespace-normal text-[13px]"
                                title={row.trabajo_titulo}
                              >
                                {row.trabajo_titulo}
                              </span>
                            </td>
                            <td className="max-w-[10rem] truncate py-1.5 text-sm">
                              {proveedorNombreById.get(row.proveedor_id) ?? "—"}
                            </td>
                            <td className="max-w-[10rem] truncate py-1.5 text-sm">
                              {acabadoNombreById.get(row.acabado_id) ?? "—"}
                            </td>
                            <td className="py-1.5 align-middle">
                              <NativeSelect
                                label=""
                                options={estadoRapidoOptions}
                                value={row.estado}
                                onChange={(e) =>
                                  void updateEstado(row, e.target.value)
                                }
                                disabled={saving}
                                className="h-8 min-h-8 min-w-[9.25rem] max-w-[11.5rem] py-0 text-[11px] leading-tight"
                                aria-label={`Estado OT ${row.id_pedido}`}
                              />
                            </td>
                            <td className="w-[5.5rem] min-w-[5.5rem] max-w-[5.75rem] px-1 py-1.5 text-center align-middle text-[11px] tabular-nums leading-tight">
                              {formatFechaEsCorta(row.fecha_prevista)}
                            </td>
                            <td className="w-[5.5rem] min-w-[5.5rem] max-w-[5.75rem] px-1 py-1.5 text-center align-middle text-[11px] tabular-nums leading-tight">
                              {formatFechaEsCorta(row.fecha_envio)}
                            </td>
                            <td className="min-w-[22rem] max-w-[28rem] py-2 align-top text-xs text-muted-foreground">
                              <span
                                className="line-clamp-2 break-words whitespace-normal"
                                title={
                                  row.notas_logistica?.trim()
                                    ? row.notas_logistica
                                    : undefined
                                }
                              >
                                {row.notas_logistica?.trim()
                                  ? row.notas_logistica
                                  : "—"}
                              </span>
                            </td>
                            <td className="w-[5.5rem] min-w-[5.5rem] max-w-[5.75rem] px-1 py-1.5 text-center align-middle text-[11px] tabular-nums leading-tight">
                              {formatFechaEsCorta(row.created_at)}
                            </td>
                            <td className="w-[5.5rem] min-w-[5.5rem] max-w-[5.75rem] px-1 py-1.5 text-center align-middle text-[11px] tabular-nums leading-tight">
                              {formatFechaEsCorta(
                                row.updated_at != null && row.updated_at !== ""
                                  ? row.updated_at
                                  : row.created_at
                              )}
                            </td>
                            <td className="w-12 p-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="size-8 shrink-0"
                                onClick={() => openSeguimientoEdit(row)}
                                aria-label={`Editar OT ${row.id_pedido}`}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div
            ref={printListadoRef}
            className="externos-print-parte fixed top-0 left-[-120vw] z-0 w-[297mm] bg-white p-10 text-[11pt] leading-snug text-black print:static print:left-0"
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
                    Cliente
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Trabajo
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Prov.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Acab.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Est.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Prev.
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Envío
                  </th>
                  <th className="border border-[#002147] px-1 py-1.5 text-left font-semibold">
                    Notas
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
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-200 odd:bg-slate-50/80"
                    >
                      <td className="border border-slate-200 px-1 py-1">
                        {sem.excelLabel}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 font-medium">
                        {row.id_pedido}
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        {row.cliente_nombre}
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        {row.trabajo_titulo}
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        {proveedorNombreById.get(row.proveedor_id) ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        {acabadoNombreById.get(row.acabado_id) ?? "—"}
                      </td>
                      <td className="border border-slate-200 px-1 py-1">
                        {row.estado}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 whitespace-nowrap">
                        {formatFechaEsCorta(row.fecha_prevista)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 whitespace-nowrap">
                        {formatFechaEsCorta(row.fecha_envio)}
                      </td>
                      <td className="border border-slate-200 px-1 py-1 align-top text-[7.5pt]">
                        {row.notas_logistica?.trim()
                          ? row.notas_logistica
                          : "—"}
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
          className="mt-0 space-y-6 outline-none"
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
            <CardHeader>
              <CardTitle className="text-lg text-[#002147]">
                Importación inteligente (Excel Optimus)
              </CardTitle>
              <CardDescription>
                Archivo .xlsx o .csv con las mismas cabeceras que ventas
                (normalizadas automáticamente). Solo filas «Abierto» o «En
                Curso». La fecha prevista sugerida es un día antes de la
                entrega al cliente. Asigna proveedor y acabado antes de
                confirmar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx,.csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void processImportFile(f);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setImportDragOver(true);
                }}
                onDragLeave={() => setImportDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setImportDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void processImportFile(f);
                }}
                onClick={() => importFileInputRef.current?.click()}
                className={cn(
                  "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
                  importDragOver
                    ? "border-[#C69C2B] bg-[#C69C2B]/10"
                    : "border-slate-300 bg-slate-50/80 hover:border-[#002147]/40 hover:bg-slate-100/80"
                )}
              >
                <Upload
                  className="size-10 text-[#002147]/70"
                  strokeWidth={1.5}
                  aria-hidden
                />
                <span className="text-sm font-medium text-[#002147]">
                  Arrastra aquí tu Excel o haz clic para elegir archivo
                </span>
                <span className="text-xs text-muted-foreground">
                  .xlsx o .csv · primera hoja (Excel)
                </span>
              </button>

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

                  <div className="w-full max-w-none overflow-x-auto rounded-lg border border-slate-200">
                    <Table className="w-full min-w-[88rem]">
                      <TableHeader>
                        <TableRow className="bg-slate-50/90">
                          <TableHead className="w-10 px-2">
                            <input
                              ref={importMasterCheckboxRef}
                              type="checkbox"
                              className="size-4 rounded border"
                              checked={importSelectionStats.allSelectableSelected}
                              disabled={
                                importSelectionStats.selectableCount === 0
                              }
                              onChange={toggleImportSelectAllSelectable}
                              title="Seleccionar o quitar todas las filas importables (no afecta a «Ya en seguimiento»)"
                              aria-label="Seleccionar todas las filas importables"
                            />
                          </TableHead>
                          <TableHead className="whitespace-nowrap">OT</TableHead>
                          <TableHead className="max-w-[8rem]">Cliente</TableHead>
                          <TableHead className="min-w-[24rem] max-w-[36rem]">
                            Trabajo
                          </TableHead>
                          <TableHead className="max-w-[7rem]">
                            Pedido cliente
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Entrega (Excel)
                          </TableHead>
                          <TableHead className="whitespace-nowrap">
                            Fecha prevista
                          </TableHead>
                          <TableHead className="min-w-[10rem]">Proveedor</TableHead>
                          <TableHead className="min-w-[10rem]">Acabado</TableHead>
                          <TableHead className="min-w-[18rem] max-w-[28rem]">
                            Notas
                          </TableHead>
                          <TableHead className="min-w-[7rem]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreviewRows.map((row) => (
                          <TableRow
                            key={row.key}
                            className={cn(
                              row.duplicate &&
                                "bg-orange-50/95 text-orange-950 dark:bg-orange-950/30 dark:text-orange-100"
                            )}
                          >
                            <TableCell>
                              <input
                                type="checkbox"
                                className="size-4 rounded border"
                                checked={row.selected}
                                disabled={row.duplicate}
                                onChange={(e) =>
                                  setImportPreviewRows((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key
                                        ? { ...r, selected: e.target.checked }
                                        : r
                                    )
                                  )
                                }
                                aria-label={`Incluir OT ${row.id_pedido}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">
                              {row.id_pedido}
                            </TableCell>
                            <TableCell className="truncate text-sm">
                              {row.cliente || "—"}
                            </TableCell>
                            <TableCell className="min-w-0 align-top whitespace-normal break-words py-2 text-sm leading-snug">
                              {row.titulo || "—"}
                            </TableCell>
                            <TableCell className="truncate text-xs">
                              {row.ref_cliente || "—"}
                            </TableCell>
                            <TableCell className="max-w-[100px] truncate text-xs text-muted-foreground">
                              {formatEntregaClienteSoloFecha(row.fecha_entrega_excel)}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="date"
                                className="h-8 min-w-[9.5rem] text-xs"
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
                                disabled={row.duplicate}
                              />
                            </TableCell>
                            <TableCell className="min-w-[10rem]">
                              <select
                                className="border-input bg-background h-8 w-full max-w-[11rem] rounded-md border px-2 text-xs"
                                value={row.proveedor_id}
                                onChange={(e) =>
                                  setImportRowProveedor(row.key, e.target.value)
                                }
                                disabled={row.duplicate || !proveedores.length}
                              >
                                <option value="">—</option>
                                {proveedores.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.nombre}
                                  </option>
                                ))}
                              </select>
                            </TableCell>
                            <TableCell className="min-w-[10rem]">
                              <select
                                className="border-input bg-background h-8 w-full max-w-[11rem] rounded-md border px-2 text-xs"
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
                                disabled={row.duplicate || !row.proveedor_id}
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
                            <TableCell className="min-w-0 align-top p-2">
                              <Textarea
                                className="min-h-[2.75rem] resize-y text-xs leading-snug"
                                rows={2}
                                placeholder="Notas logística…"
                                value={row.notas}
                                disabled={row.duplicate}
                                onChange={(e) =>
                                  setImportPreviewRows((prev) =>
                                    prev.map((r) =>
                                      r.key === row.key
                                        ? { ...r, notas: e.target.value }
                                        : r
                                    )
                                  )
                                }
                                aria-label={`Notas OT ${row.id_pedido}`}
                              />
                            </TableCell>
                            <TableCell className="text-xs">
                              {row.duplicate ? (
                                <span className="font-medium text-orange-700 dark:text-orange-300">
                                  Ya en seguimiento
                                </span>
                              ) : (
                                "—"
                              )}
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
                El acabado disponible depende del tipo del proveedor elegido.
                Fecha prevista en formato calendario; se guarda con zona
                horaria en Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={handleCreateEnvio}
                className="grid gap-4 sm:grid-cols-2"
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="ot">Número de OT (id_pedido)</Label>
                  <Input
                    id="ot"
                    inputMode="numeric"
                    placeholder="Ej. 24001"
                    value={envIdPedido}
                    onChange={(e) => setEnvIdPedido(e.target.value)}
                    disabled={!proveedores.length}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="fp">Fecha prevista</Label>
                  <Input
                    id="fp"
                    type="date"
                    value={envFecha}
                    onChange={(e) => setEnvFecha(e.target.value)}
                    disabled={!proveedores.length}
                    className="w-full max-w-full"
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="cli">Cliente (nombre)</Label>
                  <Input
                    id="cli"
                    value={envCliente}
                    onChange={(e) => setEnvCliente(e.target.value)}
                    disabled={!proveedores.length}
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="tit">Título del trabajo</Label>
                  <Input
                    id="tit"
                    value={envTrabajo}
                    onChange={(e) => setEnvTrabajo(e.target.value)}
                    disabled={!proveedores.length}
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="pc">Pedido cliente</Label>
                  <Input
                    id="pc"
                    value={envPedidoCliente}
                    onChange={(e) => setEnvPedidoCliente(e.target.value)}
                    disabled={!proveedores.length}
                  />
                </div>
                <NativeSelect
                  label="Proveedor"
                  options={proveedorOptions}
                  value={envProveedorId}
                  onChange={(e) => setEnvProveedorId(e.target.value)}
                  disabled={!proveedores.length}
                />
                <NativeSelect
                  label="Acabado"
                  options={acabadoFormOptions}
                  value={envAcabadoId}
                  onChange={(e) => setEnvAcabadoId(e.target.value)}
                  disabled={!envProveedorId}
                />
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="notas">Notas de logística (opcional)</Label>
                  <Textarea
                    id="notas"
                    rows={2}
                    value={envNotas}
                    onChange={(e) => setEnvNotas(e.target.value)}
                    disabled={!proveedores.length}
                  />
                </div>
                <div className="sm:col-span-2">
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

        <TabsContent value="proveedores" className="mt-0 space-y-6 outline-none">
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
                        <TableCell className="text-sm">
                          {p.telefono ?? "—"}
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

      <Sheet
        open={seguimientoSheetOpen}
        onOpenChange={(o) => {
          setSeguimientoSheetOpen(o);
          if (!o) setSeguimientoEditing(null);
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
          <form
            onSubmit={handleUpdateSeguimiento}
            className="flex flex-1 flex-col"
          >
            <SheetHeader>
              <SheetTitle className="text-[#002147]">
                Editar envío
                {seguimientoEditing ? (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · OT {seguimientoEditing.id_pedido}
                  </span>
                ) : null}
              </SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 px-4 pb-2">
              <NativeSelect
                label="Proveedor"
                options={proveedorOptions}
                value={editSegProveedorId}
                onChange={(e) => {
                  setEditSegProveedorId(e.target.value);
                  setEditSegAcabadoId("");
                }}
                disabled={!proveedores.length}
              />
              <NativeSelect
                label="Acabado"
                options={editSeguimientoAcabadoOptions}
                value={editSegAcabadoId}
                onChange={(e) => setEditSegAcabadoId(e.target.value)}
                disabled={!editSegProveedorId}
              />
              <div className="grid gap-1.5">
                <Label htmlFor="edit-seg-fp">Fecha prevista</Label>
                <Input
                  id="edit-seg-fp"
                  type="date"
                  value={editSegFecha}
                  onChange={(e) => setEditSegFecha(e.target.value)}
                  required
                  className="w-full max-w-full"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-seg-notas">Notas de logística</Label>
                <Textarea
                  id="edit-seg-notas"
                  className="min-h-[8rem] resize-y text-sm"
                  placeholder="Instrucciones, incidencias, referencias…"
                  value={editSegNotas}
                  onChange={(e) => setEditSegNotas(e.target.value)}
                />
              </div>
            </div>
            <SheetFooter className="gap-3 border-t sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-w-[7rem]"
                onClick={() => setSeguimientoSheetOpen(false)}
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
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <SheetContent className="sm:max-w-md">
          <form onSubmit={handleSaveEdit}>
            <SheetHeader>
              <SheetTitle>Editar proveedor</SheetTitle>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
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
            </div>
            <SheetFooter className="border-t px-4 pt-4 sm:flex-row sm:justify-end">
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
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
