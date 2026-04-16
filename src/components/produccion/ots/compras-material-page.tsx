"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Loader2, Mail, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createComprasMaterialColumns } from "@/components/produccion/ots/compras-material-columns";
import { useSysParametrosOtsCompras } from "@/hooks/use-sys-parametros-ots-compras";
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
  estadoMaterialDesdeEstadoCompra,
  normalizeCompraEstado,
} from "@/lib/compras-material-estados";
import { esPrioridadStockAmarilla } from "@/lib/compras-material-prioridad";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ComprasMaterialTableRow } from "@/types/prod-compra-material";

const TABLE_COMPRA = "prod_compra_material";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_MASTER = "prod_ots_general";
const TABLE_PROVEEDORES = "prod_proveedores";
const TABLE_TIPOS_PROVEEDOR = "prod_cat_tipos_proveedor";
const PAGE_SIZE = 500;

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
  proveedorEmail: string
): void {
  const ots = [...new Set(rows.map((r) => r.ot_numero))].join(", ");
  const asunto = `Solicitud de Material (${rows.length} línea${rows.length > 1 ? "s" : ""}) — OT ${ots}`;
  const lineas = rows
    .map((row, i) => {
      const fechaPrevista = formatFechaEsCorta(row.fecha_prevista_recepcion);
      return `--- ${i + 1}. OT ${row.ot_numero} · ${row.num_compra} ---
Material: ${row.material?.trim() || "—"}
Gramaje: ${gramajeTextoMail(row.gramaje)}g
Formato: ${row.tamano_hoja?.trim() || "—"}
Cantidad (Brutas): ${row.num_hojas_brutas != null ? String(row.num_hojas_brutas) : "—"} hojas
Fecha deseada de entrega: ${fechaPrevista}`;
    })
    .join("\n\n");
  const cuerpo = `Estimados,

Por la presente les solicitamos presupuesto y confirmación de plazo para el siguiente material:

${lineas}

Quedamos a la espera de su confirmación para proceder con el pedido.

Saludos cordiales.`;

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(proveedorEmail.trim())}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  window.open(gmailUrl, "_blank", "noopener,noreferrer");
}

export function ComprasMaterialPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { umbrales: umbralesOtsCompras } = useSysParametrosOtsCompras();
  const [rows, setRows] = useState<ComprasMaterialTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});

  const [proveedoresPapelCarton, setProveedoresPapelCarton] = useState<
    { id: string; nombre: string }[]
  >([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<ComprasMaterialTableRow | null>(null);
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

      const merged: ComprasMaterialTableRow[] = list.map((raw) => {
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
          num_compra: String(r.num_compra ?? ""),
          cliente: m?.cliente ?? null,
          titulo: m?.titulo ?? null,
          material: materialCompra?.trim()
            ? materialCompra.trim()
            : d?.material ?? null,
          gramaje:
            gramajeCompra != null ? gramajeCompra : d?.gramaje ?? null,
          tamano_hoja: tamanoCompra?.trim()
            ? tamanoCompra.trim()
            : d?.tamano_hoja ?? null,
          num_hojas_netas: d?.num_hojas_netas ?? null,
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
        };
      });

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

  const selectedRows = useMemo(() => {
    const keys = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    const out: ComprasMaterialTableRow[] = [];
    for (const k of keys) {
      const r = rows.find((x) => x.id === k);
      if (r) out.push(r);
    }
    return out;
  }, [rowSelection, rows]);

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
      onEstadoChange,
      onFechaPrevistaCommit,
      onProveedorChange,
      openEdit,
      proveedoresPapelCarton,
      umbralesOtsCompras,
    ]
  );

  const table = useReactTable({
    data: rows,
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

  const ejecutarGenerarYEnviar = useCallback(async () => {
    if (selectedRows.length === 0) return;
    const provTarget =
      proveedorSeleccionado || selectedRows[0].proveedor_id || "";
    if (!provTarget) {
      toast.error("Selecciona un proveedor.");
      return;
    }
    setSolicitarSaving(true);
    try {
      const now = new Date().toISOString();
      const ids = selectedRows.map((r) => r.id);
      const ots = [...new Set(selectedRows.map((r) => r.ot_numero))];

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

      const { data: provMail } = await supabase
        .from(TABLE_PROVEEDORES)
        .select("email")
        .eq("id", provTarget)
        .maybeSingle();
      const emailProveedor = String(
        (provMail as { email?: string | null } | null)?.email ?? ""
      ).trim();

      abrirGmailSolicitudMaterialBulk(selectedRows, emailProveedor);

      toast.success(
        ids.length > 1
          ? `Solicitud generada (${ids.length} líneas) y enviada.`
          : "Solicitud generada y enviada."
      );
      setSolicitarOpen(false);
      setSobreStockConfirmOpen(false);
      setProveedorSeleccionado("");
      setRowSelection({});
      void loadRows();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "No se pudo completar la solicitud."
      );
    } finally {
      setSolicitarSaving(false);
    }
  }, [loadRows, proveedorSeleccionado, selectedRows, supabase]);

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
    void ejecutarGenerarYEnviar();
  }, [
    ejecutarGenerarYEnviar,
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
      <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-[#002147] sm:text-xl">
            Compras de material
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-xs sm:text-sm">
            Peticiones en{" "}
            <span className="font-mono text-[11px]">{TABLE_COMPRA}</span> con
            datos de despacho, maestro y proveedor. Proveedores del desplegable:
            tipo «Papel/Cartón». Hasta {PAGE_SIZE} registros recientes.
          </p>
        </div>
        {!puedeSolicitar && solicitarDisabledReason ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex shrink-0 cursor-help outline-none"
                tabIndex={0}
              >
                {solicitarButton}
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs text-xs">
              {solicitarDisabledReason}
            </TooltipContent>
          </Tooltip>
        ) : (
          solicitarButton
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <Table className="table-fixed min-w-[1480px] text-xs">
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
                  <span className="font-mono font-medium">{editRow.ot_numero}</span>{" "}
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

      <Dialog open={solicitarOpen} onOpenChange={setSolicitarOpen}>
        <DialogContent className="max-h-[min(92vh,560px)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-slate-100 px-4 py-3">
            <DialogTitle className="text-base">Solicitar material</DialogTitle>
            <DialogDescription className="text-xs">
              {selectedRows.length > 1
                ? `Lote de ${selectedRows.length} líneas. Mismo proveedor en todas las filas.`
                : "Asigna un proveedor y genera la orden de solicitud."}
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
                <Send className="size-4" aria-hidden />
              )}
              Generar y enviar
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
              onClick={() => void ejecutarGenerarYEnviar()}
            >
              {solicitarSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                "Sí, continuar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
