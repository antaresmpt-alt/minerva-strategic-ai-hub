"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Layers, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  createOtsDespachadasColumns,
  type OtsDespachadasColumnsContext,
  type TroquelExcelTooltip,
} from "@/components/produccion/ots/ots-despachadas-columns";
import { TroquelPickerField } from "@/components/produccion/ots/troquel-picker-field";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useSysParametrosOtsCompras } from "@/hooks/use-sys-parametros-ots-compras";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  DetallesCompraDialog,
  type CompraDetalleVista,
} from "@/components/produccion/ots/detalles-compra-dialog";
import type { OtsDespachadasTableRow } from "@/types/prod-ots-despachadas";

const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_MASTER = "prod_ots_general";
const TABLE_COMPRA_MATERIAL = "prod_compra_material";
const TABLE_PROVEEDORES = "prod_proveedores";
const PAGE_SIZE = 500;

/**
 * Normaliza `estado_material` para comparaciones laxas (mayúsculas, espacios,
 * acentos combinantes Unicode).
 */
function normalizeEstadoMaterialParaMatch(
  estado: string | null | undefined
): string {
  return (estado ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * True si la OT aún no tiene flujo de compra (texto tipo «sin orden…»).
 * Heurística acordada: contiene "sin" tras normalizar.
 */
function estadoMaterialPermiteNuevaCompra(
  estado: string | null | undefined
): boolean {
  const n = normalizeEstadoMaterialParaMatch(estado);
  if (!n) return true;
  return n.includes("sin");
}

async function fetchTroquelExcelMap(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  codes: (string | null | undefined)[]
): Promise<Map<string, TroquelExcelTooltip>> {
  const out = new Map<string, TroquelExcelTooltip>();
  const unique = [
    ...new Set(
      codes
        .map((c) => String(c ?? "").trim())
        .filter(Boolean)
    ),
  ];
  if (unique.length === 0) return out;

  const inVals: (string | number)[] = [];
  const seen = new Set<string>();
  for (const c of unique) {
    const ks = `s:${c}`;
    if (!seen.has(ks)) {
      seen.add(ks);
      inVals.push(c);
    }
    if (/^\d+$/.test(c)) {
      const n = Number(c);
      if (Number.isFinite(n)) {
        const kn = `n:${n}`;
        if (!seen.has(kn)) {
          seen.add(kn);
          inVals.push(n);
        }
      }
    }
  }

  const CHUNK = 80;
  for (let i = 0; i < inVals.length; i += CHUNK) {
    const part = inVals.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("prod_troqueles")
      .select("num_troquel,mides,num_figuras,descripcion")
      .in("num_troquel", part);
    if (error) {
      console.error(error);
      continue;
    }
    for (const r of data ?? []) {
      const raw = r as {
        num_troquel?: string | number | null;
        mides?: string | null;
        num_figuras?: string | number | null;
        descripcion?: string | null;
      };
      const nk = String(raw.num_troquel ?? "").trim().toLowerCase();
      if (!nk) continue;
      out.set(nk, {
        mides: raw.mides != null ? String(raw.mides) : null,
        num_figuras:
          raw.num_figuras != null ? String(raw.num_figuras) : null,
        descripcion: raw.descripcion != null ? String(raw.descripcion) : null,
      });
    }
  }
  return out;
}

type DespachoEditFormState = {
  tintas: string;
  material: string;
  tamano_hoja: string;
  gramaje: string;
  num_hojas_brutas: string;
  num_hojas_netas: string;
  horas_entrada: string;
  horas_tiraje: string;
  troquel: string;
  poses: string;
  acabado_pral: string;
  notas: string;
};

function emptyDespachoEditForm(): DespachoEditFormState {
  return {
    tintas: "",
    material: "",
    tamano_hoja: "",
    gramaje: "",
    num_hojas_brutas: "",
    num_hojas_netas: "",
    horas_entrada: "",
    horas_tiraje: "",
    troquel: "",
    poses: "",
    acabado_pral: "",
    notas: "",
  };
}

function parseOptionalIntInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseOptionalDecimalInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function rowToEditForm(row: OtsDespachadasTableRow): DespachoEditFormState {
  const numStr = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? String(n) : "";
  return {
    tintas: row.tintas?.trim() ?? "",
    material: row.material?.trim() ?? "",
    tamano_hoja: row.tamano_hoja?.trim() ?? "",
    gramaje: numStr(row.gramaje),
    num_hojas_brutas: numStr(row.num_hojas_brutas),
    num_hojas_netas: numStr(row.num_hojas_netas),
    horas_entrada: numStr(row.horas_entrada),
    horas_tiraje: numStr(row.horas_tiraje),
    troquel: row.troquel?.trim() ?? "",
    poses: row.poses != null && Number.isFinite(row.poses) ? String(row.poses) : "",
    acabado_pral: row.acabado_pral?.trim() ?? "",
    notas: row.notas?.trim() ?? "",
  };
}

type OtsDespachadasPageProps = {
  onCompraMaterialSuccess?: () => void;
};

export function OtsDespachadasPage({
  onCompraMaterialSuccess,
}: OtsDespachadasPageProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { umbrales: umbralesOtsCompras } = useSysParametrosOtsCompras();
  const [rows, setRows] = useState<OtsDespachadasTableRow[]>([]);
  const [troquelExcelByCodigo, setTroquelExcelByCodigo] = useState<
    Map<string, TroquelExcelTooltip>
  >(() => new Map());
  const [loading, setLoading] = useState(true);
  const [comprando, setComprando] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [compraOpen, setCompraOpen] = useState(false);
  const [compraOt, setCompraOt] = useState("");
  const [compraLoading, setCompraLoading] = useState(false);
  const [compraDetalle, setCompraDetalle] = useState<CompraDetalleVista | null>(
    null
  );
  const [compraDespachoRow, setCompraDespachoRow] =
    useState<OtsDespachadasTableRow | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<OtsDespachadasTableRow | null>(null);
  const [editForm, setEditForm] = useState<DespachoEditFormState>(
    emptyDespachoEditForm
  );
  const [editSaving, setEditSaving] = useState(false);

  const handleVerCompra = useCallback((row: OtsDespachadasTableRow) => {
    const ot = String(row.ot_numero ?? "").trim();
    setCompraOt(ot);
    setCompraDetalle(null);
    setCompraDespachoRow(row);
    setCompraOpen(true);
  }, []);

  const handleEditarDespacho = useCallback((row: OtsDespachadasTableRow) => {
    setEditRow(row);
    setEditForm(rowToEditForm(row));
    setEditOpen(true);
  }, []);

  const isSeleccionCompraDeshabilitada = useCallback(
    (row: OtsDespachadasTableRow) =>
      !estadoMaterialPermiteNuevaCompra(row.estado_material),
    []
  );

  const columnCtx = useMemo<OtsDespachadasColumnsContext>(
    () => ({
      onVerCompra: handleVerCompra,
      onEditarDespacho: handleEditarDespacho,
      troquelExcelByCodigo,
      isSeleccionCompraDeshabilitada,
      umbralesOtsCompras,
    }),
    [
      handleVerCompra,
      handleEditarDespacho,
      troquelExcelByCodigo,
      isSeleccionCompraDeshabilitada,
      umbralesOtsCompras,
    ]
  );

  const columns = useMemo(
    () => createOtsDespachadasColumns(columnCtx),
    [columnCtx]
  );

  useEffect(() => {
    if (!compraOpen || !compraOt) return;
    let cancelled = false;
    setCompraLoading(true);
    void (async () => {
      try {
        const { data: rowsCompra, error } = await supabase
          .from(TABLE_COMPRA_MATERIAL)
          .select("*")
          .eq("ot_numero", compraOt)
          .order("created_at", { ascending: false })
          .limit(1);
        if (cancelled) return;
        if (error) throw error;
        const raw = rowsCompra?.[0] as Record<string, unknown> | undefined;
        if (!raw) {
          setCompraDetalle(null);
          setCompraLoading(false);
          return;
        }
        const pid = raw.proveedor_id as string | null | undefined;
        let proveedor = "—";
        if (pid) {
          const { data: prov } = await supabase
            .from(TABLE_PROVEEDORES)
            .select("nombre")
            .eq("id", pid)
            .maybeSingle();
          if (!cancelled && prov?.nombre) {
            proveedor = String(prov.nombre).trim() || "—";
          }
        }
        if (cancelled) return;
        setCompraDetalle({
          proveedor,
          num_compra: String(raw.num_compra ?? "—"),
          fecha_solicitud: (raw.fecha_solicitud as string | null) ?? null,
          fecha_prevista:
            (raw.fecha_prevista_recepcion as string | null) ?? null,
          albaran: (raw.albaran_proveedor as string | null) ?? null,
          estado: (raw.estado as string | null) ?? null,
        });
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast.error(
            e instanceof Error ? e.message : "Error al cargar la compra."
          );
          setCompraDetalle(null);
        }
      } finally {
        if (!cancelled) setCompraLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compraOpen, compraOt, supabase]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data: desp, error } = await supabase
        .from(TABLE_DESPACHADAS)
        .select("*")
        .order("despachado_at", { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (error) throw error;
      const list = desp ?? [];
      const nums = [
        ...new Set(
          list
            .map((d) =>
              String((d as { ot_numero?: string }).ot_numero ?? "").trim()
            )
            .filter(Boolean)
        ),
      ];
      const masterByOt = new Map<
        string,
        {
          cliente: string | null;
          titulo: string | null;
          cantidad: number | null;
          fecha_entrega: string | null;
        }
      >();
      if (nums.length > 0) {
        const { data: masterRows, error: mErr } = await supabase
          .from(TABLE_MASTER)
          .select("num_pedido, cliente, titulo, cantidad, fecha_entrega")
          .in("num_pedido", nums);
        if (mErr) throw mErr;
        for (const r of masterRows ?? []) {
          const row = r as {
            num_pedido: string;
            cliente: string | null;
            titulo: string | null;
            cantidad: number | null;
            fecha_entrega: string | null;
          };
          masterByOt.set(String(row.num_pedido ?? "").trim(), {
            cliente: row.cliente,
            titulo: row.titulo,
            cantidad: row.cantidad,
            fecha_entrega: row.fecha_entrega,
          });
        }
      }
      const merged: OtsDespachadasTableRow[] = list.map((raw) => {
        const d = raw as Record<string, unknown>;
        const ot = String(d.ot_numero ?? "").trim();
        const m = masterByOt.get(ot);
        const num = (v: unknown): number | null => {
          if (typeof v === "number") return Number.isFinite(v) ? v : null;
          if (v != null && v !== "") {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          }
          return null;
        };
        return {
          id: String(d.id ?? ""),
          ot_numero: ot,
          material: (d.material as string | null) ?? null,
          gramaje: num(d.gramaje),
          tamano_hoja: (d.tamano_hoja as string | null) ?? null,
          num_hojas_netas:
            typeof d.num_hojas_netas === "number"
              ? d.num_hojas_netas
              : d.num_hojas_netas != null
                ? Number(d.num_hojas_netas)
                : null,
          num_hojas_brutas:
            typeof d.num_hojas_brutas === "number"
              ? d.num_hojas_brutas
              : d.num_hojas_brutas != null
                ? Number(d.num_hojas_brutas)
                : null,
          horas_entrada: num(d.horas_entrada),
          horas_tiraje: num(d.horas_tiraje),
          tintas: (d.tintas as string | null) ?? null,
          notas: (d.notas as string | null) ?? null,
          estado_material: (d.estado_material as string | null) ?? null,
          cliente: m?.cliente ?? null,
          titulo: m?.titulo ?? null,
          cantidad: m?.cantidad ?? null,
          fecha_entrega_prevista: m?.fecha_entrega ?? null,
          troquel: (d.troquel as string | null) ?? null,
          poses: num(d.poses),
          acabado_pral: (d.acabado_pral as string | null) ?? null,
        };
      });
      let troquelMap = new Map<string, TroquelExcelTooltip>();
      try {
        troquelMap = await fetchTroquelExcelMap(
          supabase,
          merged.map((r) => r.troquel)
        );
      } catch (e) {
        console.error(e);
      }
      setTroquelExcelByCodigo(troquelMap);
      setRows(merged);
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Error al cargar OTs despachadas."
      );
      setRows([]);
      setTroquelExcelByCodigo(new Map());
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableMultiRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedRows = useMemo(() => {
    const keys = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    const out: OtsDespachadasTableRow[] = [];
    for (const k of keys) {
      const r = rows.find((x) => x.id === k);
      if (r) out.push(r);
    }
    return out;
  }, [rowSelection, rows]);

  const handleGenerarComprasLote = useCallback(async () => {
    if (selectedRows.length === 0) return;
    const invalid = selectedRows.filter(
      (r) => !estadoMaterialPermiteNuevaCompra(r.estado_material)
    );
    if (invalid.length > 0) {
      toast.error(
        "Alguna fila seleccionada ya tiene gestión de compra. Solo aplica a estados sin pedido (p. ej. «Sin orden compra»)."
      );
      return;
    }
    setComprando(true);
    let ok = 0;
    let skipped = 0;
    let failed = 0;
    try {
      for (const row of selectedRows) {
        const ot = String(row.ot_numero ?? "").trim();
        if (!ot) {
          failed++;
          continue;
        }
        const payload = {
          ot_numero: ot,
          num_compra: `OCM-${ot}`,
          estado: "Pendiente",
          material: row.material?.trim() || null,
          gramaje: row.gramaje,
          tamano_hoja: row.tamano_hoja?.trim() || null,
          num_hojas_brutas: row.num_hojas_brutas,
        };
        const { error: insertError } = await supabase
          .from(TABLE_COMPRA_MATERIAL)
          .insert(payload);
        if (insertError) {
          if (insertError.code === "23505") {
            skipped++;
            continue;
          }
          throw insertError;
        }

        const { error: updateError } = await supabase
          .from(TABLE_DESPACHADAS)
          .update({ estado_material: "Pendiente de pedir" })
          .eq("id", row.id);
        if (updateError) throw updateError;
        ok++;
      }

      if (ok > 0) {
        toast.success(
          skipped || failed
            ? `Compras generadas: ${ok}. Omitidas (ya existían): ${skipped}. Errores: ${failed}.`
            : `Compras generadas: ${ok}.`
        );
        onCompraMaterialSuccess?.();
      } else if (skipped > 0 && failed === 0) {
        toast.info(
          "Ninguna compra nueva: todas las OT seleccionadas ya tenían registro."
        );
      } else {
        toast.error("No se pudo generar ninguna compra.");
      }
      setRowSelection({});
      void loadRows();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Error al generar compras en lote."
      );
      void loadRows();
    } finally {
      setComprando(false);
    }
  }, [loadRows, onCompraMaterialSuccess, selectedRows, supabase]);

  const submitEditDespacho = useCallback(async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from(TABLE_DESPACHADAS)
        .update({
          tintas: editForm.tintas.trim() || null,
          material: editForm.material.trim() || null,
          tamano_hoja: editForm.tamano_hoja.trim() || null,
          gramaje: parseOptionalDecimalInput(editForm.gramaje),
          num_hojas_brutas: parseOptionalIntInput(editForm.num_hojas_brutas),
          num_hojas_netas: parseOptionalIntInput(editForm.num_hojas_netas),
          horas_entrada: parseOptionalDecimalInput(editForm.horas_entrada),
          horas_tiraje: parseOptionalDecimalInput(editForm.horas_tiraje),
          troquel: editForm.troquel.trim() || null,
          poses: parseOptionalIntInput(editForm.poses),
          acabado_pral: editForm.acabado_pral.trim() || null,
          notas: editForm.notas.trim() || null,
        })
        .eq("id", editRow.id);
      if (error) throw error;
      toast.success("Despacho actualizado.");
      setEditOpen(false);
      setEditRow(null);
      setEditForm(emptyDespachoEditForm());
      void loadRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setEditSaving(false);
    }
  }, [editForm, editRow, loadRows, supabase]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <DetallesCompraDialog
        open={compraOpen}
        onOpenChange={(o) => {
          setCompraOpen(o);
          if (!o) setCompraDespachoRow(null);
        }}
        compraOt={compraOt}
        tablaCompraMaterial={TABLE_COMPRA_MATERIAL}
        compraLoading={compraLoading}
        compraDetalle={compraDetalle}
        despachoRow={compraDespachoRow}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="flex max-h-[min(92vh,720px)] max-w-[min(96vw,560px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
            <DialogTitle className="text-base">
              Editar despacho{" "}
              <span className="font-mono text-sm font-semibold text-[#002147]">
                {editRow?.ot_numero ?? ""}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Modifica los datos técnicos del despacho. Los cambios se guardan en{" "}
              <code className="rounded bg-slate-100 px-1 text-[10px]">
                {TABLE_DESPACHADAS}
              </code>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[min(60vh,480px)] gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2 sm:px-5">
            <div className="grid gap-1">
              <Label htmlFor="edit-despacho-tintas" className="text-xs">
                Tintas
              </Label>
              <Input
                id="edit-despacho-tintas"
                className="h-8 text-xs"
                value={editForm.tintas}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, tintas: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="edit-despacho-material" className="text-xs">
                Material
              </Label>
              <Input
                id="edit-despacho-material"
                className="h-8 text-xs"
                value={editForm.material}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, material: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="edit-despacho-tamano" className="text-xs">
                Tamaño hoja
              </Label>
              <Input
                id="edit-despacho-tamano"
                className="h-8 text-xs"
                value={editForm.tamano_hoja}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    tamano_hoja: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="edit-despacho-gramaje" className="text-xs">
                Gramaje
              </Label>
              <Input
                id="edit-despacho-gramaje"
                className="h-8 text-xs"
                type="number"
                value={editForm.gramaje}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, gramaje: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="edit-despacho-brutas" className="text-xs">
                Hojas brutas
              </Label>
              <Input
                id="edit-despacho-brutas"
                className="h-8 text-xs"
                type="number"
                inputMode="numeric"
                value={editForm.num_hojas_brutas}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    num_hojas_brutas: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="edit-despacho-netas" className="text-xs">
                Hojas netas
              </Label>
              <Input
                id="edit-despacho-netas"
                className="h-8 text-xs"
                type="number"
                inputMode="numeric"
                value={editForm.num_hojas_netas}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    num_hojas_netas: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="edit-despacho-horas-entrada" className="text-xs">
                Horas entrada estimadas
              </Label>
              <Input
                id="edit-despacho-horas-entrada"
                className="h-8 text-xs"
                type="number"
                step="0.1"
                value={editForm.horas_entrada}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    horas_entrada: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="edit-despacho-horas-tiraje" className="text-xs">
                Horas tiraje estimadas
              </Label>
              <Input
                id="edit-despacho-horas-tiraje"
                className="h-8 text-xs"
                type="number"
                step="0.1"
                value={editForm.horas_tiraje}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    horas_tiraje: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <TroquelPickerField
                id="edit-despacho-troquel"
                value={editForm.troquel}
                onChange={(v) =>
                  setEditForm((f) => ({ ...f, troquel: v }))
                }
                onTroquelPicked={(picked) =>
                  setEditForm((f) => ({
                    ...f,
                    troquel: picked.num_troquel,
                    poses: picked.num_figuras?.trim()
                      ? picked.num_figuras.trim()
                      : f.poses,
                  }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="edit-despacho-poses" className="text-xs">
                Poses
              </Label>
              <Input
                id="edit-despacho-poses"
                className="h-8 text-xs"
                value={editForm.poses}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, poses: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="edit-despacho-acabado" className="text-xs">
                Acabado PRAL
              </Label>
              <Input
                id="edit-despacho-acabado"
                className="h-8 text-xs"
                value={editForm.acabado_pral}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, acabado_pral: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <Label htmlFor="edit-despacho-notas" className="text-xs">
                Notas
              </Label>
              <Textarea
                id="edit-despacho-notas"
                className="min-h-[72px] resize-y text-xs"
                rows={3}
                value={editForm.notas}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, notas: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:px-5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={editSaving}
              onClick={() => setEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={editSaving || !editRow}
              className="gap-2 bg-[#002147] text-white hover:bg-[#001a38]"
              onClick={() => void submitEditDespacho()}
            >
              {editSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Guardando…
                </>
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold text-[#002147] sm:text-xl">
            OTs Despachadas
          </h2>
          <p className="text-muted-foreground mt-1 max-w-2xl text-xs sm:text-sm">
            Registros de despacho con datos del maestro (cliente, trabajo,
            entrega). Hasta {PAGE_SIZE} filas recientes.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5 shrink-0"
          disabled={selectedRows.length === 0 || comprando}
          onClick={() => void handleGenerarComprasLote()}
        >
          {comprando ? (
            <Loader2
              className="size-4 animate-spin text-[#002147]"
              aria-hidden
            />
          ) : (
            <Layers className="size-4 text-[#002147]" aria-hidden />
          )}
          Generar compras en lote
          {selectedRows.length > 0 ? (
            <span className="tabular-nums">({selectedRows.length})</span>
          ) : null}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <Table className="table-fixed min-w-[1160px] text-xs">
            <TableHeader className="bg-slate-50/95 sticky top-0 z-20 shadow-[0_1px_0_0_rgb(226_232_240)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="sticky top-0 z-20 bg-slate-50/95 px-0.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                      style={{
                        width: header.getSize(),
                        minWidth: header.getSize(),
                      }}
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
                    No hay OTs despachadas registradas.
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
    </div>
  );
}
