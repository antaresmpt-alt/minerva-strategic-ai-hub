"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table";
import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import {
  Download,
  FileSpreadsheet,
  FilePlus2,
  History,
  Loader2,
  Mail,
  Printer,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { createComprasMaterialColumns } from "@/components/produccion/ots/compras-material-columns";
import { useSysParametrosOtsCompras } from "@/hooks/use-sys-parametros-ots-compras";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Toggle } from "@/components/ui/toggle";
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
import { NativeSelect, type Option } from "@/components/ui/select-native";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  COMPRAS_MATERIAL_ESTADOS,
  estadoMaterialDesdeEstadoCompra,
  normalizeCompraEstado,
} from "@/lib/compras-material-estados";
import { esPrioridadStockAmarilla } from "@/lib/compras-material-prioridad";
import {
  buildComprasMaterialSolicitudEmail,
  buildGmailComposeUrl,
  DEFAULT_EMAIL_PLANTILLA_COMPRAS,
  fetchEmailPlantillasProduccion,
  type EmailPlantillaBloques,
} from "@/lib/email-plantillas-produccion";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { resolveRecepcionFotoPublicUrls } from "@/lib/recepcion-fotos-url";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import type { ComprasMaterialTableRow } from "@/types/prod-compra-material";

const TABLE_COMPRA = "prod_compra_material";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_MASTER = "prod_ots_general";
const TABLE_PROVEEDORES = "prod_proveedores";
const TABLE_TIPOS_PROVEEDOR = "prod_cat_tipos_proveedor";
const TABLE_RECEPCION = "prod_recepciones_material";
const TABLE_RECEPCION_FOTOS = "prod_recepciones_fotos";
const PAGE_SIZE = 500;

type PendingCompraCorreoEnvio = {
  ids: string[];
  ots: string[];
  proveedorId: string;
};

const RECEPCION_FOTOS_MODAL_INITIAL = {
  open: false,
  ot: "",
  numCompra: "",
  urls: [] as string[],
};

async function descargarFotoRecepcionDesdeUrl(
  url: string,
  baseName: string,
  index: number
): Promise<void> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(res.statusText);
  const blob = await res.blob();
  const ext = blob.type.includes("png")
    ? "png"
    : blob.type.includes("webp")
      ? "webp"
      : "jpg";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${baseName}-foto-${index + 1}.${ext}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function parseGramaje(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function rawNumHojas(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : null;
  if (v != null && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

/** Texto numérico para el cuerpo del mail (sin «g» duplicada en la plantilla). */
function gramajeTextoMail(g: number | null | undefined): string {
  if (g == null || !Number.isFinite(g)) return "—";
  const n = Number(g);
  return Number.isInteger(n) ? String(Math.trunc(n)) : String(n);
}

function formatGramajeResumen(g: number | null | undefined): string {
  if (g == null || !Number.isFinite(g)) return "—";
  const n = Number(g);
  const s = Number.isInteger(n) ? String(Math.trunc(n)) : String(n);
  return `${s}g`;
}

function numStr(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) ? String(n) : "";
}

function parseOptionalDecimalInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseOptionalIntInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizeOtNumeroInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t.replace(/^ocm-/i, "").replace(/[^\d]/g, "").trim();
}

function buildNumCompraFromOt(otNumero: string): string {
  const ot = normalizeOtNumeroInput(otNumero);
  if (!ot) return "";
  return `OCM-${ot}`;
}

function slugTipoNombre(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

/**
 * Resuelve el id en `prod_cat_tipos_proveedor` para «Papel/Cartón» (tolerante a
 * mayúsculas, acentos y barra).
 */
function findTipoPapelCartonId(
  tipos: { id: string; nombre: string | null }[]
): string | null {
  for (const t of tipos) {
    const slug = slugTipoNombre(String(t.nombre ?? ""));
    if (slug === "papel/carton" || slug === "papelcarton") return t.id;
    if (slug.includes("papel") && slug.includes("carton")) return t.id;
  }
  return null;
}

function abrirGmailSolicitudMaterialBulk(
  rows: ComprasMaterialTableRow[],
  proveedorEmail: string,
  nombreProveedor: string,
  plantilla: EmailPlantillaBloques
): void {
  const { subject, body } = buildComprasMaterialSolicitudEmail(
    rows,
    nombreProveedor,
    plantilla
  );
  window.open(
    buildGmailComposeUrl(proveedorEmail, subject, body),
    "_blank",
    "noopener,noreferrer"
  );
}

export function ComprasMaterialPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { umbrales: umbralesOtsCompras } = useSysParametrosOtsCompras();
  const [plantillaEmailCompras, setPlantillaEmailCompras] =
    useState<EmailPlantillaBloques>(() => ({
      ...DEFAULT_EMAIL_PLANTILLA_COMPRAS,
    }));
  const [rows, setRows] = useState<ComprasMaterialTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});

  const [proveedoresPapelCarton, setProveedoresPapelCarton] = useState<
    { id: string; nombre: string }[]
  >([]);

  const [filtroBusqueda, setFiltroBusqueda] = useState("");
  const [filtroProveedorId, setFiltroProveedorId] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  /** `false`: ocultar compras en estado «Recibido» (vista limpia). `true`: ver todo el histórico. */
  const [verHistorial, setVerHistorial] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<ComprasMaterialTableRow | null>(null);
  const [recepcionFotosModal, setRecepcionFotosModal] = useState(
    RECEPCION_FOTOS_MODAL_INITIAL
  );
  const [editMaterial, setEditMaterial] = useState("");
  const [editGramaje, setEditGramaje] = useState("");
  const [editTamano, setEditTamano] = useState("");
  const [editBrutas, setEditBrutas] = useState("");
  const [editFecha, setEditFecha] = useState("");
  const [editAlbaran, setEditAlbaran] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [solicitarOpen, setSolicitarOpen] = useState(false);
  const [solicitarSaving, setSolicitarSaving] = useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState("");
  const [sobreStockConfirmOpen, setSobreStockConfirmOpen] = useState(false);
  const [correoComprasConfirmOpen, setCorreoComprasConfirmOpen] =
    useState(false);
  const [pendingCompraCorreo, setPendingCompraCorreo] =
    useState<PendingCompraCorreoEnvio | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualKeepOpen, setManualKeepOpen] = useState(true);
  const [manualOt, setManualOt] = useState("");
  const [manualPosicion, setManualPosicion] = useState("1");
  const [manualProveedorId, setManualProveedorId] = useState("");
  const [manualMaterial, setManualMaterial] = useState("");
  const [manualGramaje, setManualGramaje] = useState("");
  const [manualFormato, setManualFormato] = useState("");
  const [manualHojasNetas, setManualHojasNetas] = useState("");
  const [manualHojasBrutas, setManualHojasBrutas] = useState("");
  const [manualCliente, setManualCliente] = useState("");
  const [manualTitulo, setManualTitulo] = useState("");

  const loadProveedoresPapelCarton = useCallback(async () => {
    try {
      const { data: tipos, error: tErr } = await supabase
        .from(TABLE_TIPOS_PROVEEDOR)
        .select("id, nombre");
      if (tErr) throw tErr;
      const tipoId = findTipoPapelCartonId(
        (tipos ?? []) as { id: string; nombre: string | null }[]
      );
      if (!tipoId) {
        toast.error(
          "No se encontró el tipo «Papel/Cartón» en prod_cat_tipos_proveedor."
        );
        setProveedoresPapelCarton([]);
        return;
      }
      const { data: provs, error: pErr } = await supabase
        .from(TABLE_PROVEEDORES)
        .select("id, nombre")
        .eq("tipo_proveedor_id", tipoId)
        .order("nombre", { ascending: true });
      if (pErr) throw pErr;
      const list = (provs ?? []) as { id: string; nombre: string | null }[];
      setProveedoresPapelCarton(
        list.map((x) => ({
          id: x.id,
          nombre: String(x.nombre ?? "").trim() || "Sin nombre",
        }))
      );
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los proveedores Papel/Cartón.");
      setProveedoresPapelCarton([]);
    }
  }, [supabase]);

  useEffect(() => {
    void loadProveedoresPapelCarton();
  }, [loadProveedoresPapelCarton]);

  useEffect(() => {
    void (async () => {
      try {
        const { compras } = await fetchEmailPlantillasProduccion(supabase);
        setPlantillaEmailCompras(compras);
      } catch {
        /* plantilla por defecto */
      }
    })();
  }, [supabase]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data: compras, error: cErr } = await supabase
        .from(TABLE_COMPRA)
        .select("*")
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (cErr) throw cErr;
      const list = compras ?? [];

      const ots = [
        ...new Set(
          list
            .map((x) =>
              String((x as { ot_numero?: string }).ot_numero ?? "").trim()
            )
            .filter(Boolean)
        ),
      ];

      const provIds = [
        ...new Set(
          list
            .map((x) => (x as { proveedor_id?: string | null }).proveedor_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        ),
      ];

      const despByOt = new Map<
        string,
        {
          material: string | null;
          gramaje: number | null;
          tamano_hoja: string | null;
          num_hojas_brutas: number | null;
          num_hojas_netas: number | null;
        }
      >();

      if (ots.length > 0) {
        const { data: despRows, error: dErr } = await supabase
          .from(TABLE_DESPACHADAS)
          .select(
            "ot_numero, material, gramaje, tamano_hoja, num_hojas_brutas, num_hojas_netas, despachado_at"
          )
          .in("ot_numero", ots)
          .order("despachado_at", { ascending: false });
        if (dErr) throw dErr;
        for (const r of despRows ?? []) {
          const raw = r as Record<string, unknown>;
          const ot = String(raw.ot_numero ?? "").trim();
          if (!ot || despByOt.has(ot)) continue;
          const nb = raw.num_hojas_brutas;
          const nn = raw.num_hojas_netas;
          despByOt.set(ot, {
            material: (raw.material as string | null) ?? null,
            gramaje: parseGramaje(raw.gramaje),
            tamano_hoja: (raw.tamano_hoja as string | null) ?? null,
            num_hojas_brutas:
              typeof nb === "number"
                ? nb
                : nb != null
                  ? Number(nb)
                  : null,
            num_hojas_netas:
              typeof nn === "number"
                ? nn
                : nn != null
                  ? Number(nn)
                  : null,
          });
        }
      }

      const masterByOt = new Map<
        string,
        {
          cliente: string | null;
          titulo: string | null;
          fecha_entrega_maestro: string | null;
        }
      >();
      if (ots.length > 0) {
        const { data: masterRows, error: mErr } = await supabase
          .from(TABLE_MASTER)
          .select("num_pedido, cliente, titulo, fecha_entrega")
          .in("num_pedido", ots);
        if (mErr) throw mErr;
        for (const r of masterRows ?? []) {
          const row = r as {
            num_pedido: string;
            cliente: string | null;
            titulo: string | null;
            fecha_entrega: string | null;
          };
          const k = String(row.num_pedido ?? "").trim();
          if (k) {
            masterByOt.set(k, {
              cliente: row.cliente,
              titulo: row.titulo,
              fecha_entrega_maestro: row.fecha_entrega ?? null,
            });
          }
        }
      }

      const provById = new Map<string, string>();
      if (provIds.length > 0) {
        const { data: provs, error: pErr } = await supabase
          .from(TABLE_PROVEEDORES)
          .select("id, nombre")
          .in("id", provIds);
        if (pErr) throw pErr;
        for (const p of provs ?? []) {
          const row = p as { id: string; nombre: string | null };
          provById.set(row.id, String(row.nombre ?? "").trim());
        }
      }

      const mergedBase: ComprasMaterialTableRow[] = list.map((raw) => {
        const r = raw as Record<string, unknown>;
        const ot = String(r.ot_numero ?? "").trim();
        const d = despByOt.get(ot);
        const m = masterByOt.get(ot);
        const pid = r.proveedor_id as string | null;
        const materialCompra =
          (r.material as string | null | undefined) ?? null;
        const gramajeCompra = parseGramaje(r.gramaje);
        const tamanoCompra =
          (r.tamano_hoja as string | null | undefined) ?? null;
        const nbCompra = rawNumHojas(r.num_hojas_brutas);
        return {
          id: String(r.id ?? ""),
          ot_numero: ot,
          num_compra:
            String(r.num_compra ?? "").trim() || buildNumCompraFromOt(ot),
          posicion: rawNumHojas(r.posicion) ?? 1,
          cliente:
            String((r.cliente_nombre as string | null | undefined) ?? "").trim() ||
            m?.cliente ||
            null,
          titulo:
            String((r.trabajo_titulo as string | null | undefined) ?? "").trim() ||
            m?.titulo ||
            null,
          material: materialCompra?.trim()
            ? materialCompra.trim()
            : d?.material ?? null,
          gramaje:
            gramajeCompra != null ? gramajeCompra : d?.gramaje ?? null,
          tamano_hoja: tamanoCompra?.trim()
            ? tamanoCompra.trim()
            : d?.tamano_hoja ?? null,
          num_hojas_netas:
            rawNumHojas(r.num_hojas_netas) ?? d?.num_hojas_netas ?? null,
          num_hojas_brutas:
            nbCompra != null ? nbCompra : d?.num_hojas_brutas ?? null,
          proveedor_id: pid ?? null,
          proveedor_nombre:
            pid && provById.has(pid) ? provById.get(pid)! : null,
          fecha_entrega_maestro: m?.fecha_entrega_maestro ?? null,
          fecha_prevista_recepcion:
            (r.fecha_prevista_recepcion as string | null) ?? null,
          albaran_proveedor: (r.albaran_proveedor as string | null) ?? null,
          estado: (r.estado as string | null) ?? null,
          recepcion_foto_urls: [] as string[],
        };
      });

      const fotosByCompra = new Map<string, string[]>();
      const compraIds = mergedBase.map((r) => r.id).filter((id) => id.length > 0);
      if (compraIds.length > 0) {
        const { data: receps, error: recErr } = await supabase
          .from(TABLE_RECEPCION)
          .select("id, compra_id")
          .in("compra_id", compraIds);
        if (recErr) throw recErr;
        const recepToCompra = new Map<string, string>();
        const recepIds: string[] = [];
        for (const row of receps ?? []) {
          const rec = row as { id: string; compra_id: string };
          if (!rec.id || !rec.compra_id) continue;
          recepToCompra.set(rec.id, rec.compra_id);
          recepIds.push(rec.id);
        }
        if (recepIds.length > 0) {
          const { data: fotos, error: fErr } = await supabase
            .from(TABLE_RECEPCION_FOTOS)
            .select("recepcion_id, foto_url")
            .in("recepcion_id", recepIds);
          if (fErr) throw fErr;
          for (const row of fotos ?? []) {
            const f = row as { recepcion_id: string; foto_url: string | null };
            const cid = recepToCompra.get(f.recepcion_id);
            const url = f.foto_url?.trim();
            if (!cid || !url) continue;
            const arr = fotosByCompra.get(cid) ?? [];
            arr.push(url);
            fotosByCompra.set(cid, arr);
          }
        }
      }

      const merged = mergedBase.map((r) => ({
        ...r,
        recepcion_foto_urls: fotosByCompra.get(r.id) ?? [],
      }));

      setRows(merged);
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Error al cargar compras de material."
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const rowsFiltradas = useMemo(() => {
    let list = rows;
    if (!verHistorial) {
      list = list.filter(
        (r) => normalizeCompraEstado(r.estado) !== "recibido"
      );
    }
    if (filtroProveedorId) {
      list = list.filter((r) => (r.proveedor_id ?? "") === filtroProveedorId);
    }
    if (filtroEstado) {
      list = list.filter((r) => (r.estado ?? "").trim() === filtroEstado);
    }
    const q = filtroBusqueda.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const bloques = [
          r.ot_numero,
          r.num_compra,
          r.cliente,
          r.titulo,
        ].map((x) => String(x ?? "").toLowerCase());
        return bloques.some((s) => s.includes(q));
      });
    }
    return list;
  }, [rows, verHistorial, filtroBusqueda, filtroEstado, filtroProveedorId]);

  const proveedoresUnicosDeLista = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const id = r.proveedor_id;
      if (!id) continue;
      if (!map.has(id)) {
        map.set(
          id,
          (r.proveedor_nombre?.trim() || "Sin nombre").trim() || "Sin nombre"
        );
      }
    }
    return [...map.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], "es", { sensitivity: "base" })
    );
  }, [rows]);

  const proveedorFiltroOptions = useMemo<Option[]>(() => {
    const opts: Option[] = [{ value: "", label: "Todos los proveedores" }];
    for (const [id, nombre] of proveedoresUnicosDeLista) {
      opts.push({ value: id, label: nombre });
    }
    return opts;
  }, [proveedoresUnicosDeLista]);

  const estadoFiltroOptions = useMemo<Option[]>(
    () => [
      { value: "", label: "Todos los estados" },
      ...COMPRAS_MATERIAL_ESTADOS.map((e) => ({ value: e, label: e })),
    ],
    []
  );

  const conteosEstadoFiltrado = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rowsFiltradas) {
      const key = (r.estado ?? "").trim() || "Sin estado";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [rowsFiltradas]);

  useEffect(() => {
    const allowed = new Set(rowsFiltradas.map((r) => r.id));
    setRowSelection((prev) => {
      const next: RowSelectionState = {};
      for (const id of allowed) {
        if (prev[id]) next[id] = true;
      }
      return next;
    });
  }, [rowsFiltradas]);

  const selectedRows = useMemo(() => {
    const keys = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    const out: ComprasMaterialTableRow[] = [];
    for (const k of keys) {
      const r = rowsFiltradas.find((x) => x.id === k);
      if (r) out.push(r);
    }
    return out;
  }, [rowSelection, rowsFiltradas]);

  const mismoProveedorSeleccion = useMemo(() => {
    if (selectedRows.length === 0) return false;
    const a0 = selectedRows[0].proveedor_id ?? "";
    return !selectedRows.slice(1).some((r) => (r.proveedor_id ?? "") !== a0);
  }, [selectedRows]);

  const proveedoresMezclados = useMemo(
    () => selectedRows.length > 1 && !mismoProveedorSeleccion,
    [mismoProveedorSeleccion, selectedRows.length]
  );

  const puedeSolicitar =
    selectedRows.length > 0 &&
    mismoProveedorSeleccion &&
    selectedRows.every((r) => normalizeCompraEstado(r.estado) === "pendiente");

  const solicitarDisabledReason = useMemo(() => {
    if (selectedRows.length === 0) return "Selecciona una o más filas.";
    if (proveedoresMezclados)
      return "Las filas seleccionadas deben tener el mismo proveedor asignado.";
    if (!selectedRows.every((r) => normalizeCompraEstado(r.estado) === "pendiente"))
      return "Solo se puede solicitar material en estado Pendiente.";
    return null;
  }, [proveedoresMezclados, selectedRows]);

  const isSavingRow = useCallback(
    (id: string) => Boolean(savingById[id]),
    [savingById]
  );

  const isRowCheckboxDisabled = useCallback(
    (row: ComprasMaterialTableRow) => {
      if (selectedRows.length === 0) return false;
      if (selectedRows.some((s) => s.id === row.id)) return false;
      const anchor = selectedRows[0].proveedor_id ?? "";
      return (row.proveedor_id ?? "") !== anchor;
    },
    [selectedRows]
  );

  const openRecepcionFotos = useCallback(
    (row: ComprasMaterialTableRow) => {
      try {
        const raw = [...(row.recepcion_foto_urls ?? [])].map((u) => String(u).trim()).filter(Boolean);
        console.log("URLs encontradas (raw, BD/storage):", raw);
        if (raw.length === 0) {
          toast.error("No hay URLs de fotos para esta compra.");
          return;
        }
        const urls = resolveRecepcionFotoPublicUrls(supabase, raw);
        console.log("URLs encontradas (públicas resueltas):", urls);
        if (urls.length === 0) {
          setRecepcionFotosModal({
            open: true,
            ot: row.ot_numero,
            numCompra: row.num_compra,
            urls: [],
          });
          return;
        }
        setRecepcionFotosModal({
          open: true,
          ot: row.ot_numero,
          numCompra: row.num_compra,
          urls,
        });
      } catch (err) {
        console.error("[Compras] openRecepcionFotos", err);
        toast.error(
          err instanceof Error
            ? err.message
            : "No se pudo abrir el visor de fotos de recepción."
        );
      }
    },
    [supabase]
  );

  const openEdit = useCallback((row: ComprasMaterialTableRow) => {
    setEditRow(row);
    setEditMaterial(row.material?.trim() ?? "");
    setEditGramaje(numStr(row.gramaje));
    setEditTamano(row.tamano_hoja?.trim() ?? "");
    setEditBrutas(numStr(row.num_hojas_brutas));
    setEditFecha(toDateInputValue(row.fecha_prevista_recepcion));
    setEditAlbaran(row.albaran_proveedor?.trim() ?? "");
    setEditOpen(true);
  }, []);

  const patchNombreProveedorLocal = useCallback(
    (rowId: string, proveedorId: string | null) => {
      const nombre =
        proveedorId == null || proveedorId === ""
          ? null
          : proveedoresPapelCarton.find((p) => p.id === proveedorId)?.nombre ??
            null;
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                proveedor_id: proveedorId,
                proveedor_nombre: nombre,
              }
            : r
        )
      );
    },
    [proveedoresPapelCarton]
  );

  const onProveedorChange = useCallback(
    async (rowId: string, proveedorId: string) => {
      const val = proveedorId === "" ? null : proveedorId;
      setSavingById((s) => ({ ...s, [rowId]: true }));
      try {
        const { error } = await supabase
          .from(TABLE_COMPRA)
          .update({ proveedor_id: val })
          .eq("id", rowId);
        if (error) throw error;
        patchNombreProveedorLocal(rowId, val);
        toast.success("Proveedor actualizado.");
      } catch (e) {
        console.error(e);
        toast.error(
          e instanceof Error ? e.message : "No se pudo actualizar el proveedor."
        );
        void loadRows();
      } finally {
        setSavingById((s) => {
          const n = { ...s };
          delete n[rowId];
          return n;
        });
      }
    },
    [loadRows, patchNombreProveedorLocal, supabase]
  );

  const onEstadoChange = useCallback(
    async (rowId: string, estado: string) => {
      setSavingById((s) => ({ ...s, [rowId]: true }));
      try {
        const { error } = await supabase
          .from(TABLE_COMPRA)
          .update({ estado })
          .eq("id", rowId);
        if (error) throw error;
        const ot = rows.find((r) => r.id === rowId)?.ot_numero;
        const mat = estadoMaterialDesdeEstadoCompra(estado);
        if (ot && mat) {
          const { error: dErr } = await supabase
            .from(TABLE_DESPACHADAS)
            .update({ estado_material: mat })
            .eq("ot_numero", ot);
          if (dErr) console.warn(dErr);
        }
        setRows((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, estado } : r))
        );
        toast.success("Estado actualizado.");
      } catch (e) {
        console.error(e);
        toast.error(
          e instanceof Error ? e.message : "No se pudo actualizar el estado."
        );
        void loadRows();
      } finally {
        setSavingById((s) => {
          const n = { ...s };
          delete n[rowId];
          return n;
        });
      }
    },
    [rows, supabase]
  );

  const onFechaPrevistaCommit = useCallback(
    async (rowId: string, ymd: string) => {
      const fecha = ymd.trim() === "" ? null : ymd.trim();
      setSavingById((s) => ({ ...s, [rowId]: true }));
      try {
        const { error } = await supabase
          .from(TABLE_COMPRA)
          .update({ fecha_prevista_recepcion: fecha })
          .eq("id", rowId);
        if (error) throw error;
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowId ? { ...r, fecha_prevista_recepcion: fecha } : r
          )
        );
        toast.success("Fecha prevista guardada.");
      } catch (e) {
        console.error(e);
        toast.error(
          e instanceof Error ? e.message : "No se pudo guardar la fecha."
        );
        void loadRows();
      } finally {
        setSavingById((s) => {
          const n = { ...s };
          delete n[rowId];
          return n;
        });
      }
    },
    [loadRows, supabase]
  );

  const columns = useMemo(
    () =>
      createComprasMaterialColumns({
        onEdit: openEdit,
        onDelete: async (row) => {
          const ok = window.confirm(
            `¿Eliminar la compra OT ${row.ot_numero} / P${row.posicion ?? 1}?`
          );
          if (!ok) return;
          setSavingById((s) => ({ ...s, [row.id]: true }));
          try {
            const { error } = await supabase
              .from(TABLE_COMPRA)
              .delete()
              .eq("id", row.id);
            if (error) throw error;
            setRows((prev) => prev.filter((r) => r.id !== row.id));
            toast.success("Línea eliminada.");
          } catch (e) {
            console.error(e);
            toast.error(
              e instanceof Error ? e.message : "No se pudo eliminar la línea."
            );
            void loadRows();
          } finally {
            setSavingById((s) => {
              const n = { ...s };
              delete n[row.id];
              return n;
            });
          }
        },
        onOpenRecepcionFotos: openRecepcionFotos,
        proveedoresPapelCarton,
        isRowCheckboxDisabled,
        isSavingRow,
        onProveedorChange,
        onEstadoChange,
        onFechaPrevistaCommit,
        umbralesOtsCompras,
      }),
    [
      isRowCheckboxDisabled,
      isSavingRow,
      loadRows,
      onEstadoChange,
      onFechaPrevistaCommit,
      onProveedorChange,
      openEdit,
      openRecepcionFotos,
      proveedoresPapelCarton,
      supabase,
      umbralesOtsCompras,
    ]
  );

  const table = useReactTable({
    data: rowsFiltradas,
    columns,
    getRowId: (row) => row.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableMultiRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const guardarEdicion = useCallback(async () => {
    if (!editRow) return;
    setEditSaving(true);
    const ot = String(editRow.ot_numero ?? "").trim();
    const material = editMaterial.trim() || null;
    const gramaje = parseOptionalDecimalInput(editGramaje);
    const tamano_hoja = editTamano.trim() || null;
    const num_hojas_brutas = parseOptionalIntInput(editBrutas);
    const fecha = editFecha.trim() === "" ? null : editFecha.trim();
    const albaran = editAlbaran.trim() === "" ? null : editAlbaran.trim();

    const payloadTecnico = {
      material,
      gramaje,
      tamano_hoja,
      num_hojas_brutas,
    };

    try {
      const { error: errDesp } = await supabase
        .from(TABLE_DESPACHADAS)
        .update(payloadTecnico)
        .eq("ot_numero", ot);
      if (errDesp) throw errDesp;

      const { error: errCompra } = await supabase
        .from(TABLE_COMPRA)
        .update({
          ...payloadTecnico,
          fecha_prevista_recepcion: fecha,
          albaran_proveedor: albaran,
        })
        .eq("id", editRow.id);
      if (errCompra) throw errCompra;

      toast.success("Compra y despacho actualizados.");
      setEditOpen(false);
      setEditRow(null);
      void loadRows();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "No se pudo guardar los cambios."
      );
    } finally {
      setEditSaving(false);
    }
  }, [
    editAlbaran,
    editBrutas,
    editFecha,
    editGramaje,
    editMaterial,
    editRow,
    editTamano,
    loadRows,
    supabase,
  ]);

  const abrirGmailYModalConfirmCompras = useCallback(async () => {
    if (selectedRows.length === 0) return;
    const provTarget =
      proveedorSeleccionado || selectedRows[0].proveedor_id || "";
    if (!provTarget) {
      toast.error("Selecciona un proveedor.");
      return;
    }
    setSolicitarSaving(true);
    try {
      const ids = selectedRows.map((r) => r.id);
      const ots = [...new Set(selectedRows.map((r) => r.ot_numero))];

      const { data: provMail } = await supabase
        .from(TABLE_PROVEEDORES)
        .select("email")
        .eq("id", provTarget)
        .maybeSingle();
      const emailProveedor = String(
        (provMail as { email?: string | null } | null)?.email ?? ""
      ).trim();

      const nombreProveedor =
        proveedoresPapelCarton.find((p) => p.id === provTarget)?.nombre?.trim() ||
        selectedRows[0]?.proveedor_nombre?.trim() ||
        "Proveedor";

      abrirGmailSolicitudMaterialBulk(
        selectedRows,
        emailProveedor,
        nombreProveedor,
        plantillaEmailCompras
      );
      setPendingCompraCorreo({ ids, ots, proveedorId: provTarget });
      setSolicitarOpen(false);
      setSobreStockConfirmOpen(false);
      setCorreoComprasConfirmOpen(true);
      toast.message("Gmail abierto en una pestaña nueva", {
        description:
          "Si ya has enviado el mail, confirma aquí para registrar la solicitud y actualizar el estado.",
      });
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "No se pudo abrir Gmail."
      );
    } finally {
      setSolicitarSaving(false);
    }
  }, [
    plantillaEmailCompras,
    proveedorSeleccionado,
    proveedoresPapelCarton,
    selectedRows,
    supabase,
  ]);

  const confirmarEnvioCorreoCompras = useCallback(async () => {
    if (!pendingCompraCorreo) return;
    setSolicitarSaving(true);
    try {
      const now = new Date().toISOString();
      const { ids, ots, proveedorId: provTarget } = pendingCompraCorreo;

      const { error: u1 } = await supabase
        .from(TABLE_COMPRA)
        .update({
          proveedor_id: provTarget,
          fecha_solicitud: now,
          estado: "Generada",
        })
        .in("id", ids);
      if (u1) throw u1;

      for (const ot of ots) {
        const { error: u2 } = await supabase
          .from(TABLE_DESPACHADAS)
          .update({ estado_material: "Orden compra generada" })
          .eq("ot_numero", ot);
        if (u2) throw u2;
      }

      toast.success(
        ids.length > 1
          ? `Solicitud registrada (${ids.length} líneas). Estado «Generada».`
          : "Solicitud registrada. Estado «Generada»."
      );
      setCorreoComprasConfirmOpen(false);
      setPendingCompraCorreo(null);
      setProveedorSeleccionado("");
      setRowSelection({});
      void loadRows();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "No se pudo confirmar la solicitud."
      );
    } finally {
      setSolicitarSaving(false);
    }
  }, [loadRows, pendingCompraCorreo, supabase]);

  const iniciarGenerarYEnviar = useCallback(() => {
    if (selectedRows.length === 0) return;
    const prov = proveedorSeleccionado || selectedRows[0]?.proveedor_id;
    if (!prov) {
      toast.error("Selecciona un proveedor.");
      return;
    }
    if (
      selectedRows.some((r) =>
        esPrioridadStockAmarilla(
          r.fecha_entrega_maestro,
          umbralesOtsCompras.sobrestockUmbral
        )
      )
    ) {
      setSobreStockConfirmOpen(true);
      return;
    }
    void abrirGmailYModalConfirmCompras();
  }, [
    abrirGmailYModalConfirmCompras,
    proveedorSeleccionado,
    selectedRows,
    umbralesOtsCompras.sobrestockUmbral,
  ]);

  useEffect(() => {
    if (!solicitarOpen) {
      setProveedorSeleccionado("");
      return;
    }
    void loadProveedoresPapelCarton();
    const first = selectedRows[0]?.proveedor_id;
    if (
      selectedRows.length > 0 &&
      selectedRows.every((r) => (r.proveedor_id ?? "") === (first ?? "")) &&
      first
    ) {
      setProveedorSeleccionado(first);
    }
  }, [loadProveedoresPapelCarton, solicitarOpen, selectedRows]);

  const exportComprasMaterialExcel = useCallback(() => {
    const data = rowsFiltradas.map((r) => ({
      OT: r.ot_numero,
      "Nº compra": r.num_compra?.trim() || buildNumCompraFromOt(r.ot_numero),
      P: r.posicion ?? 1,
      Cliente: r.cliente?.trim() ?? "",
      Título: r.titulo?.trim() ?? "",
      Material: r.material?.trim() ?? "",
      Gramaje: formatGramajeResumen(r.gramaje),
      Formato: r.tamano_hoja?.trim() ?? "",
      "H. brutas": r.num_hojas_brutas ?? "",
      Proveedor: r.proveedor_nombre?.trim() ?? "",
      Estado: r.estado?.trim() ?? "",
      "F. prevista recep.": r.fecha_prevista_recepcion
        ? formatFechaEsCorta(r.fecha_prevista_recepcion)
        : "",
      "F. entrega OT": r.fecha_entrega_maestro
        ? formatFechaEsCorta(r.fecha_entrega_maestro)
        : "",
      Albarán: r.albaran_proveedor?.trim() ?? "",
      "Fotos recep.": r.recepcion_foto_urls?.length ?? 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Compras");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `compras-material-${stamp}.xlsx`);
    toast.success("Excel descargado (vista filtrada actual).");
  }, [rowsFiltradas]);

  const exportComprasMaterialPdf = useCallback(() => {
    if (rowsFiltradas.length === 0) return;
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    doc.setTextColor(0, 33, 71);
    doc.setFontSize(13);
    doc.text("Compras de material", 10, 12);
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(
      `Listado filtrado · ${rowsFiltradas.length} fila(s) · ${new Date().toLocaleString("es-ES")}`,
      10,
      18
    );
    const head = [
      [
        "OT",
        "Nº compra",
        "P",
        "Cliente",
        "Material",
        "Gramaje",
        "Formato",
        "Hojas brutas",
        "Proveedor",
        "Estado",
        "F. prev.",
        "F. entrega OT",
      ],
    ];
    const cell = (v: string | number | null | undefined) =>
      String(v ?? "").trim() || "—";
    const body = rowsFiltradas.map((r) => [
      cell(r.ot_numero),
      cell(r.num_compra?.trim() || buildNumCompraFromOt(r.ot_numero)),
      cell(r.posicion ?? 1),
      cell(r.cliente),
      cell(r.material),
      formatGramajeResumen(r.gramaje),
      cell(r.tamano_hoja),
      cell(r.num_hojas_brutas),
      cell(r.proveedor_nombre),
      cell(r.estado),
      r.fecha_prevista_recepcion
        ? formatFechaEsCorta(r.fecha_prevista_recepcion)
        : "—",
      r.fecha_entrega_maestro
        ? formatFechaEsCorta(r.fecha_entrega_maestro)
        : "—",
    ]);
    autoTable(doc, {
      head,
      body,
      startY: 22,
      styles: { fontSize: 7, cellPadding: 1.2, overflow: "linebreak" },
      headStyles: { fontSize: 7, fillColor: [0, 33, 71], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 16 },
        1: { cellWidth: 26 },
        2: { cellWidth: 10 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
        5: { cellWidth: 16 },
        6: { cellWidth: 20 },
        7: { cellWidth: 18 },
        8: { cellWidth: 26 },
        9: { cellWidth: 18 },
        10: { cellWidth: 16 },
        11: { cellWidth: 16 },
      },
      margin: { left: 10, right: 10 },
    });
    const stamp = new Date().toISOString().slice(0, 10);
    doc.save(`compras-material-${stamp}.pdf`);
    toast.success("PDF descargado (vista filtrada actual).");
  }, [rowsFiltradas]);

  const resetManualForm = useCallback(() => {
    setManualOt("");
    setManualPosicion("1");
    setManualProveedorId("");
    setManualMaterial("");
    setManualGramaje("");
    setManualFormato("");
    setManualHojasNetas("");
    setManualHojasBrutas("");
    setManualCliente("");
    setManualTitulo("");
  }, []);

  const manualOtNumero = normalizeOtNumeroInput(manualOt);
  const manualNumCompra = buildNumCompraFromOt(manualOtNumero);
  const manualPosicionTrim = manualPosicion.trim();
  const manualPosicionParsed = /^\d+$/.test(manualPosicionTrim)
    ? Number(manualPosicionTrim)
    : Number.NaN;
  const manualPosicionValid =
    manualPosicionTrim !== "" &&
    Number.isInteger(manualPosicionParsed) &&
    manualPosicionParsed >= 1;

  const guardarManualCompra = useCallback(async () => {
    const ot = normalizeOtNumeroInput(manualOt);
    const numCompra = buildNumCompraFromOt(ot);
    const proveedorId = manualProveedorId.trim();
    const material = manualMaterial.trim();
    const clienteNombre = manualCliente.trim();
    const trabajoTitulo = manualTitulo.trim();
    if (!manualPosicionValid) {
      toast.error("Posición debe ser un entero mayor o igual que 1.");
      return;
    }
    if (!ot || !numCompra || !proveedorId || !material) {
      toast.error("Completa OT, Nº compra, proveedor y material.");
      return;
    }

    const gramaje = parseOptionalDecimalInput(manualGramaje);
    const tamanoHoja = manualFormato.trim() || null;
    const numHojasNetas = parseOptionalIntInput(manualHojasNetas);
    const numHojasBrutas = parseOptionalIntInput(manualHojasBrutas);

    setManualSaving(true);
    try {
      const { error: insertErr } = await supabase.from(TABLE_COMPRA).insert({
        ot_numero: ot,
        num_compra: numCompra,
        posicion: manualPosicionParsed,
        cliente_nombre: clienteNombre || null,
        trabajo_titulo: trabajoTitulo || null,
        proveedor_id: proveedorId,
        material,
        gramaje,
        tamano_hoja: tamanoHoja,
        num_hojas_netas: numHojasNetas,
        num_hojas_brutas: numHojasBrutas,
        estado: "Generada",
      });
      if (insertErr) throw insertErr;

      const { error: updDespErr } = await supabase
        .from(TABLE_DESPACHADAS)
        .update({
          material,
          gramaje,
          tamano_hoja: tamanoHoja,
          num_hojas_netas: numHojasNetas,
          num_hojas_brutas: numHojasBrutas,
        })
        .eq("ot_numero", ot);
      if (updDespErr) throw updDespErr;

      toast.success("Material guardado en compras con estado «Generada».");
      void loadRows();

      if (manualKeepOpen) {
        setManualMaterial("");
        setManualGramaje("");
        setManualFormato("");
        setManualHojasNetas("");
        setManualHojasBrutas("");
        setManualPosicion(String(manualPosicionParsed + 1));
      } else {
        setManualOpen(false);
        resetManualForm();
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error
          ? err.message
          : "No se pudo guardar la solicitud de material."
      );
    } finally {
      setManualSaving(false);
    }
  }, [
    loadRows,
    manualFormato,
    manualGramaje,
    manualHojasBrutas,
    manualHojasNetas,
    manualKeepOpen,
    manualMaterial,
    manualPosicionParsed,
    manualPosicionValid,
    manualNumCompra,
    manualPosicion,
    manualOt,
    manualCliente,
    manualProveedorId,
    manualTitulo,
    resetManualForm,
    supabase,
  ]);

  const solicitarButton = (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="gap-1.5 shrink-0"
      disabled={!puedeSolicitar || solicitarSaving}
      onClick={() => setSolicitarOpen(true)}
    >
      {solicitarSaving ? (
        <Loader2 className="size-4 animate-spin text-[#002147]" aria-hidden />
      ) : (
        <Mail className="size-4 text-[#002147]" aria-hidden />
      )}
      Solicitar material
      {selectedRows.length > 1 ? (
        <span className="tabular-nums">({selectedRows.length})</span>
      ) : null}
    </Button>
  );

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <div className="border-b border-slate-200/80 pb-4">
        <h2 className="font-heading text-lg font-semibold text-[#002147] sm:text-xl">
          Compras de material
        </h2>
        <p className="text-muted-foreground mt-1 max-w-2xl text-xs sm:text-sm">
          Peticiones en{" "}
          <span className="font-mono text-[11px]">{TABLE_COMPRA}</span> con datos
          de despacho, maestro y proveedor. Proveedores en línea: tipo «Papel/Cartón».
          Hasta {PAGE_SIZE} registros recientes. Los totales y exportaciones usan
          la vista filtrada.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200/90 bg-slate-50/40 p-3 shadow-sm">
        <div className="hidden flex-col gap-3 md:flex">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
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
            <div className="grid min-w-0 max-w-sm flex-1 gap-1.5">
              <Label htmlFor="busq-compra-mat">
                Buscar (OT, compra, cliente, título)
              </Label>
              <Input
                id="busq-compra-mat"
                placeholder="Ej. 24001 o cliente"
                value={filtroBusqueda}
                onChange={(e) => setFiltroBusqueda(e.target.value)}
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
                aria-label={
                  verHistorial
                    ? "Ocultar compras recibidas"
                    : "Ver histórico incluyendo compras recibidas"
                }
              >
                <History className="size-4 shrink-0 opacity-80" aria-hidden />
                {verHistorial ? "Ocultar Recibidos" : "Ver Histórico"}
              </Toggle>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                Mostrando{" "}
                <span className="font-normal text-foreground">
                  {rowsFiltradas.length}
                </span>{" "}
                de{" "}
                <span className="font-normal text-foreground">{rows.length}</span>{" "}
                registros
              </p>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {COMPRAS_MATERIAL_ESTADOS.map((est) => {
                  const n = conteosEstadoFiltrado.get(est) ?? 0;
                  if (n === 0) return null;
                  return (
                    <span
                      key={est}
                      className="inline-flex items-center rounded-md border border-slate-200/90 bg-white px-2 py-0.5 text-[10px] font-normal tabular-nums text-[#002147] shadow-xs"
                    >
                      {est}: {n}
                    </span>
                  );
                })}
                {[...conteosEstadoFiltrado.entries()]
                  .filter(
                    ([k]) =>
                      !(COMPRAS_MATERIAL_ESTADOS as readonly string[]).includes(k)
                  )
                  .sort(([a], [b]) => a.localeCompare(b, "es"))
                  .map(([est, n]) => (
                    <span
                      key={est}
                      className="inline-flex items-center rounded-md border border-slate-200/90 bg-white px-2 py-0.5 text-[10px] font-normal tabular-nums text-[#002147] shadow-xs"
                    >
                      {est}: {n}
                    </span>
                  ))}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setManualOpen(true)}
              >
                <FilePlus2 className="size-4 text-[#002147]/80" aria-hidden />
                Entrada Compra Manual
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={loading || rowsFiltradas.length === 0}
                title="Descargar Excel (vista filtrada)"
                onClick={exportComprasMaterialExcel}
              >
                <span aria-hidden className="text-base leading-none">
                  📊
                </span>
                <FileSpreadsheet
                  className="size-4 text-[#002147]/80"
                  aria-hidden
                />
                Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={loading || rowsFiltradas.length === 0}
                title="Descargar PDF (vista filtrada)"
                onClick={() => exportComprasMaterialPdf()}
              >
                <span aria-hidden className="text-base leading-none">
                  📄
                </span>
                <Printer className="size-4 text-[#002147]/80" aria-hidden />
                PDF
              </Button>
              {!puedeSolicitar && solicitarDisabledReason ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help outline-none">
                      {solicitarButton}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {solicitarDisabledReason}
                  </TooltipContent>
                </Tooltip>
              ) : (
                solicitarButton
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 md:hidden">
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
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor="busq-compra-mat-m">
              Buscar (OT, compra, cliente, título)
            </Label>
            <Input
              id="busq-compra-mat-m"
              placeholder="Ej. 24001 o cliente"
              value={filtroBusqueda}
              onChange={(e) => setFiltroBusqueda(e.target.value)}
              className="min-h-11 w-full touch-manipulation text-base"
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
              className="h-9 w-auto min-w-0 self-start touch-manipulation justify-start gap-2 px-3"
              aria-label={
                verHistorial
                  ? "Ocultar compras recibidas"
                  : "Ver histórico incluyendo compras recibidas"
              }
            >
              <History className="size-4 shrink-0 opacity-80" aria-hidden />
              {verHistorial ? "Ocultar Recibidos" : "Ver Histórico"}
            </Toggle>
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            Mostrando{" "}
            <span className="font-normal text-foreground">
              {rowsFiltradas.length}
            </span>{" "}
            de{" "}
            <span className="font-normal text-foreground">{rows.length}</span>{" "}
            registros
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COMPRAS_MATERIAL_ESTADOS.map((est) => {
              const n = conteosEstadoFiltrado.get(est) ?? 0;
              if (n === 0) return null;
              return (
                <span
                  key={est}
                  className="inline-flex items-center rounded-md border border-slate-200/90 bg-white px-2 py-0.5 text-[10px] font-normal tabular-nums text-[#002147]"
                >
                  {est}: {n}
                </span>
              );
            })}
            {[...conteosEstadoFiltrado.entries()]
              .filter(
                ([k]) =>
                  !(COMPRAS_MATERIAL_ESTADOS as readonly string[]).includes(k)
              )
              .sort(([a], [b]) => a.localeCompare(b, "es"))
              .map(([est, n]) => (
                <span
                  key={est}
                  className="inline-flex items-center rounded-md border border-slate-200/90 bg-white px-2 py-0.5 text-[10px] font-normal tabular-nums text-[#002147]"
                >
                  {est}: {n}
                </span>
              ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setManualOpen(true)}
            >
              <FilePlus2 className="size-4 text-[#002147]/80" aria-hidden />
              Entrada Compra Manual
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={loading || rowsFiltradas.length === 0}
              title="Descargar Excel (vista filtrada)"
              onClick={exportComprasMaterialExcel}
            >
              <span aria-hidden className="text-base leading-none">
                📊
              </span>
              <FileSpreadsheet
                className="size-4 text-[#002147]/80"
                aria-hidden
              />
              Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={loading || rowsFiltradas.length === 0}
              title="Descargar PDF (vista filtrada)"
              onClick={() => exportComprasMaterialPdf()}
            >
              <span aria-hidden className="text-base leading-none">
                📄
              </span>
              <Printer className="size-4 text-[#002147]/80" aria-hidden />
              PDF
            </Button>
            {!puedeSolicitar && solicitarDisabledReason ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help outline-none">
                    {solicitarButton}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {solicitarDisabledReason}
                </TooltipContent>
              </Tooltip>
            ) : (
              solicitarButton
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <Table className="table-fixed min-w-[1524px] text-xs">
            <TableHeader className="bg-slate-50/95 sticky top-0 z-20 shadow-[0_1px_0_0_rgb(226_232_240)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="sticky top-0 z-20 bg-slate-50/95 px-0.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="py-10 text-center"
                  >
                    <Loader2 className="mx-auto size-6 animate-spin text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-muted-foreground py-8 text-center text-sm"
                  >
                    No hay compras de material registradas.
                  </TableCell>
                </TableRow>
              ) : rowsFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-muted-foreground py-8 text-center text-sm"
                  >
                    Ningún resultado con los filtros actuales. Ajusta búsqueda,
                    proveedor o estado.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="hover:bg-slate-50/80"
                    data-state={row.getIsSelected() ? "selected" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="p-0 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditRow(null);
        }}
      >
        <DialogContent className="max-h-[min(92vh,640px)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3">
            <DialogTitle className="text-base">Editar compra</DialogTitle>
            <DialogDescription className="text-xs">
              {editRow ? (
                <>
                  OT{" "}
                  <span className="font-mono font-normal">{editRow.ot_numero}</span>{" "}
                  · {editRow.num_compra}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,480px)] space-y-4 overflow-y-auto px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Material acordado
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1 sm:col-span-1">
                  <Label htmlFor="edit-compra-material" className="text-xs">
                    Material
                  </Label>
                  <Input
                    id="edit-compra-material"
                    className="h-8 text-xs"
                    value={editMaterial}
                    onChange={(e) => setEditMaterial(e.target.value)}
                    placeholder="Ej. Estucado mate"
                  />
                </div>
                <div className="grid gap-1 sm:col-span-1">
                  <Label htmlFor="edit-compra-gramaje" className="text-xs">
                    Gramaje (g/m²)
                  </Label>
                  <Input
                    id="edit-compra-gramaje"
                    type="number"
                    step="any"
                    className="h-8 text-xs"
                    value={editGramaje}
                    onChange={(e) => setEditGramaje(e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div className="grid gap-1 sm:col-span-1">
                  <Label htmlFor="edit-compra-formato" className="text-xs">
                    Formato
                  </Label>
                  <Input
                    id="edit-compra-formato"
                    className="h-8 text-xs"
                    value={editTamano}
                    onChange={(e) => setEditTamano(e.target.value)}
                    placeholder="Ej. 72×102"
                  />
                </div>
                <div className="grid gap-1 sm:col-span-1">
                  <Label htmlFor="edit-compra-brutas" className="text-xs">
                    Hojas brutas
                  </Label>
                  <Input
                    id="edit-compra-brutas"
                    type="number"
                    inputMode="numeric"
                    className="h-8 text-xs"
                    value={editBrutas}
                    onChange={(e) => setEditBrutas(e.target.value)}
                    placeholder="—"
                  />
                </div>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Seguimiento
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="edit-fecha-prev" className="text-xs">
                    Fecha prevista recepción
                  </Label>
                  <Input
                    id="edit-fecha-prev"
                    type="date"
                    className="h-8 text-xs"
                    value={editFecha}
                    onChange={(e) => setEditFecha(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="edit-albaran" className="text-xs">
                    Albarán proveedor
                  </Label>
                  <Input
                    id="edit-albaran"
                    type="text"
                    className="h-8 text-xs"
                    value={editAlbaran}
                    onChange={(e) => setEditAlbaran(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={editSaving}
              onClick={() => void guardarEdicion()}
            >
              {editSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={manualOpen}
        onOpenChange={(open) => {
          setManualOpen(open);
          if (!open) {
            resetManualForm();
          }
        }}
      >
        <DialogContent className="max-h-[min(92vh,700px)] max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-slate-100 px-4 py-3">
            <DialogTitle className="text-base">Solicitar material</DialogTitle>
            <DialogDescription className="text-xs">
              Alta manual en <span className="font-mono">{TABLE_COMPRA}</span> con
              lógica multi-línea por OT, Nº compra y posición.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[min(62vh,560px)] gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="manual-ot" className="text-xs">
                OT
              </Label>
              <Input
                id="manual-ot"
                value={manualOt}
                onChange={(e) =>
                  setManualOt(normalizeOtNumeroInput(e.target.value))
                }
                onBlur={(e) =>
                  setManualOt(normalizeOtNumeroInput(e.target.value))
                }
                placeholder="Ej. 38514"
                inputMode="numeric"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="manual-num-compra" className="text-xs">
                Nº compra
              </Label>
              <Input
                id="manual-num-compra"
                readOnly
                type="text"
                value={manualNumCompra}
                placeholder="OCM-XXXXX"
                tabIndex={-1}
                aria-readonly
                className="h-8 cursor-not-allowed bg-slate-100 font-mono text-xs text-slate-600 selection:bg-transparent"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="manual-posicion" className="text-xs">
                P
              </Label>
              <Input
                id="manual-posicion"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={manualPosicion}
                onChange={(e) => setManualPosicion(e.target.value)}
                onKeyDown={(e) => {
                  if ([".", ",", "e", "E", "+", "-"].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                placeholder="1"
                className={cn(
                  "h-8 text-xs",
                  !manualPosicionValid && "border-red-500 focus-visible:ring-red-500"
                )}
              />
            </div>
            <div className="grid gap-1">
              <NativeSelect
                label="Proveedor"
                options={[
                  { value: "", label: "Seleccionar proveedor" },
                  ...proveedoresPapelCarton.map((p) => ({
                    value: p.id,
                    label: p.nombre,
                  })),
                ]}
                value={manualProveedorId}
                onChange={(e) => setManualProveedorId(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="manual-material" className="text-xs">
                Material
              </Label>
              <Input
                id="manual-material"
                value={manualMaterial}
                onChange={(e) => setManualMaterial(e.target.value)}
                placeholder="Ej. Estucado mate"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="manual-gramaje" className="text-xs">
                Gramaje
              </Label>
              <Input
                id="manual-gramaje"
                type="number"
                step="any"
                value={manualGramaje}
                onChange={(e) => setManualGramaje(e.target.value)}
                placeholder="Ej. 350"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="manual-formato" className="text-xs">
                Formato
              </Label>
              <Input
                id="manual-formato"
                value={manualFormato}
                onChange={(e) => setManualFormato(e.target.value)}
                placeholder="Ej. 70x100"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="manual-hojas-netas" className="text-xs">
                Hojas netas
              </Label>
              <Input
                id="manual-hojas-netas"
                type="number"
                inputMode="numeric"
                value={manualHojasNetas}
                onChange={(e) => setManualHojasNetas(e.target.value)}
                placeholder="Ej. 1000"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="manual-hojas-brutas" className="text-xs">
                Hojas brutas
              </Label>
              <Input
                id="manual-hojas-brutas"
                type="number"
                inputMode="numeric"
                value={manualHojasBrutas}
                onChange={(e) => setManualHojasBrutas(e.target.value)}
                placeholder="Ej. 1200"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="manual-cliente" className="text-xs">
                Cliente
              </Label>
              <Input
                id="manual-cliente"
                value={manualCliente}
                onChange={(e) => setManualCliente(e.target.value)}
                placeholder="Cliente"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <Label htmlFor="manual-titulo" className="text-xs">
                Título del trabajo
              </Label>
              <Input
                id="manual-titulo"
                value={manualTitulo}
                onChange={(e) => setManualTitulo(e.target.value)}
                placeholder="Título del trabajo"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:justify-between">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <Checkbox
                checked={manualKeepOpen}
                onCheckedChange={(v) => setManualKeepOpen(v === true)}
                aria-label="Mantener abierto para entrada múltiple"
              />
              Entrada múltiple (mantener abierto)
            </label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setManualOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={manualSaving || !manualPosicionValid || !manualNumCompra}
                onClick={() => void guardarManualCompra()}
              >
                {manualSaving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Guardar material"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={recepcionFotosModal.open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setRecepcionFotosModal(RECEPCION_FOTOS_MODAL_INITIAL);
          }
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,760px)] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-y-auto p-0 sm:max-w-3xl"
        >
          <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3">
            <DialogTitle className="text-base font-normal text-[#002147]">
              Fotos de recepción (muelle)
            </DialogTitle>
            <DialogDescription className="text-xs font-normal">
              {recepcionFotosModal.open ? (
                <>
                  OT{" "}
                  <span className="font-mono font-normal text-[#002147]">
                    {recepcionFotosModal.ot}
                  </span>{" "}
                  · Nº compra{" "}
                  <span className="font-mono font-normal text-[#002147]">
                    {recepcionFotosModal.numCompra}
                  </span>
                  {recepcionFotosModal.urls.length > 0 ? (
                    <>
                      {" · "}
                      {recepcionFotosModal.urls.length} imagen
                      {recepcionFotosModal.urls.length === 1 ? "" : "es"}
                    </>
                  ) : null}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-[12rem] flex-1 overflow-y-auto px-4 py-4">
            {recepcionFotosModal.open && recepcionFotosModal.urls.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {recepcionFotosModal.urls.map((url, i) => {
                  const baseName = `ot-${recepcionFotosModal.ot}-compra-${recepcionFotosModal.numCompra}`
                    .replace(/[^\w.-]+/g, "_")
                    .slice(0, 96);
                  return (
                    <div
                      key={`${url}-${i}`}
                      className="rounded-lg border border-slate-200/90 bg-slate-50/90 p-2 shadow-xs"
                    >
                      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-white">
                        <img
                          src={url}
                          alt={`Foto recepción ${i + 1}`}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 font-normal"
                          onClick={() => {
                            void descargarFotoRecepcionDesdeUrl(
                              url,
                              baseName,
                              i
                            ).catch(() => {
                              toast.error("No se pudo descargar la imagen.");
                            });
                          }}
                        >
                          <Download className="size-3.5 opacity-90" aria-hidden />
                          Descargar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : recepcionFotosModal.open ? (
              <p className="text-center text-sm font-normal text-muted-foreground">
                No se pudieron cargar las imágenes. Revisa la consola (URLs
                encontradas) y que el path en base de datos coincida con el
                archivo en el bucket{" "}
                <span className="font-mono text-xs">recepciones-fotos</span>.
              </p>
            ) : null}
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              className="font-normal"
              onClick={() => {
                setRecepcionFotosModal(RECEPCION_FOTOS_MODAL_INITIAL);
              }}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={solicitarOpen} onOpenChange={setSolicitarOpen}>
        <DialogContent className="max-h-[min(92vh,560px)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-slate-100 px-4 py-3">
            <DialogTitle className="text-base">Solicitar material</DialogTitle>
            <DialogDescription className="text-xs">
              {selectedRows.length > 1
                ? `Lote de ${selectedRows.length} líneas. Mismo proveedor en todas las filas. Tras «Abrir Gmail», confirma el envío para pasar el estado a «Generada».`
                : "Asigna un proveedor. Tras «Abrir Gmail», confirma el envío para pasar el estado a «Generada»."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[min(50vh,360px)] gap-3 overflow-y-auto px-4 py-3">
            <div className="grid gap-1">
              <Label className="text-xs">Proveedor</Label>
              <Select
                value={proveedorSeleccionado || "__none__"}
                onValueChange={(v) =>
                  setProveedorSeleccionado(!v || v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger size="sm" className="h-8 w-full min-w-0 text-xs">
                  <SelectValue placeholder="Seleccionar proveedor">
                    {proveedorSeleccionado
                      ? proveedoresPapelCarton.find(
                          (p) => p.id === proveedorSeleccionado
                        )?.nombre ?? null
                      : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none__">Seleccionar proveedor</SelectItem>
                  {proveedoresPapelCarton.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRows.length > 0 ? (
              <div className="rounded-md border border-slate-200 bg-slate-100/80 px-3 py-2.5 text-xs leading-relaxed text-slate-800">
                <p className="font-medium text-slate-600">
                  Resumen ({selectedRows.length})
                </p>
                <ul className="mt-2 max-h-48 list-inside list-disc space-y-1 overflow-y-auto pr-1">
                  {selectedRows.map((r) => (
                    <li key={r.id} className="marker:text-slate-400">
                      <span className="font-mono text-[10px]">{r.ot_numero}</span>{" "}
                      · {r.material?.trim() || "—"} ·{" "}
                      {formatGramajeResumen(r.gramaje)} ·{" "}
                      {r.tamano_hoja?.trim() || "—"} ·{" "}
                      <span className="tabular-nums">
                        {r.num_hojas_brutas ?? "—"} h. brutas
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSolicitarOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={
                solicitarSaving ||
                selectedRows.length === 0 ||
                !(proveedorSeleccionado || selectedRows[0]?.proveedor_id)
              }
              onClick={() => void iniciarGenerarYEnviar()}
            >
              {solicitarSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" aria-hidden />
              )}
              Abrir Gmail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sobreStockConfirmOpen}
        onOpenChange={setSobreStockConfirmOpen}
      >
        <DialogContent className="max-w-md gap-0 border-amber-200/80 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-amber-100 bg-amber-50/50 px-4 py-3">
            <DialogTitle className="text-base text-amber-950">
              Aviso de sobrestock
            </DialogTitle>
            <DialogDescription className="pt-1 text-xs leading-relaxed text-amber-950/90">
              ⚠️ AVISO DE SOBRESTOCK: Alguna OT seleccionada se entrega con más de
              30 días de margen. ¿Confirmas solicitar el material ahora?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-200"
              onClick={() => setSobreStockConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={solicitarSaving}
              className="gap-1.5 bg-orange-600 font-medium text-white shadow-sm hover:bg-orange-700 focus-visible:ring-orange-500"
              onClick={() => void abrirGmailYModalConfirmCompras()}
            >
              {solicitarSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Abriendo…
                </>
              ) : (
                "Sí, continuar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={correoComprasConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCorreoComprasConfirmOpen(false);
            setPendingCompraCorreo(null);
          }
        }}
      >
        <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-slate-100 px-4 py-3">
            <DialogTitle className="text-base text-[#002147]">
              ¿Confirmar envío de correo?
            </DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-relaxed">
              Si ya has enviado el mail, confirma para actualizar el estado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={solicitarSaving}
              onClick={() => {
                setCorreoComprasConfirmOpen(false);
                setPendingCompraCorreo(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={solicitarSaving || !pendingCompraCorreo}
              className="bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700 hover:text-white"
              onClick={() => void confirmarEnvioCorreoCompras()}
            >
              {solicitarSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Guardando…
                </>
              ) : (
                "Sí, confirmar envío"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
