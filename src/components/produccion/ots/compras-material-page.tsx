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
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ComprasMaterialTableRow } from "@/types/prod-compra-material";

const TABLE_COMPRA = "prod_compra_material";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_MASTER = "prod_ots_general";
const TABLE_PROVEEDORES = "prod_proveedores";
const PAGE_SIZE = 500;

/** Solo proveedores de tipo «material de compra» (catálogo). */
const TIPO_PROVEEDOR_COMPRA_MATERIAL =
  "5f7b6eee-0835-4eee-a7c8-3fa6b39bac30";

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function normalizeEstado(estado: string | null | undefined): string {
  return (estado ?? "").trim().toLowerCase();
}

function parseGramaje(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
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

function abrirMailtoSolicitudMaterial(row: ComprasMaterialTableRow): void {
  const subject = `Solicitud de Material - ${row.num_compra} - OT ${row.ot_numero}`;
  const body = `Hola,

Necesitamos solicitar el siguiente material para la OT ${row.ot_numero}:

- Material: ${row.material?.trim() || "—"}
- Gramaje: ${gramajeTextoMail(row.gramaje)}g
- Formato: ${row.tamano_hoja?.trim() || "—"}
- Cantidad: ${row.num_hojas_brutas != null ? row.num_hojas_brutas : "—"} hojas

Por favor, confirmadnos fecha prevista de entrega.
Saludos.`;
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ComprasMaterialPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<ComprasMaterialTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<ComprasMaterialTableRow | null>(null);
  const [editFecha, setEditFecha] = useState("");
  const [editAlbaran, setEditAlbaran] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [solicitarOpen, setSolicitarOpen] = useState(false);
  const [solicitarSaving, setSolicitarSaving] = useState(false);
  const [proveedoresTipo, setProveedoresTipo] = useState<
    { id: string; nombre: string }[]
  >([]);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState("");

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
            .map((x) => String((x as { ot_numero?: string }).ot_numero ?? "").trim())
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
        { cliente: string | null; titulo: string | null }
      >();
      if (ots.length > 0) {
        const { data: masterRows, error: mErr } = await supabase
          .from(TABLE_MASTER)
          .select("num_pedido, cliente, titulo")
          .in("num_pedido", ots);
        if (mErr) throw mErr;
        for (const r of masterRows ?? []) {
          const row = r as {
            num_pedido: string;
            cliente: string | null;
            titulo: string | null;
          };
          const k = String(row.num_pedido ?? "").trim();
          if (k) {
            masterByOt.set(k, {
              cliente: row.cliente,
              titulo: row.titulo,
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
        return {
          id: String(r.id ?? ""),
          ot_numero: ot,
          num_compra: String(r.num_compra ?? ""),
          cliente: m?.cliente ?? null,
          titulo: m?.titulo ?? null,
          material: d?.material ?? null,
          gramaje: d?.gramaje ?? null,
          tamano_hoja: d?.tamano_hoja ?? null,
          num_hojas_netas: d?.num_hojas_netas ?? null,
          num_hojas_brutas: d?.num_hojas_brutas ?? null,
          proveedor_id: pid ?? null,
          proveedor_nombre:
            pid && provById.has(pid) ? provById.get(pid)! : null,
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

  const loadProveedoresFiltrados = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from(TABLE_PROVEEDORES)
        .select("id, nombre")
        .eq("tipo_proveedor_id", TIPO_PROVEEDOR_COMPRA_MATERIAL)
        .order("nombre", { ascending: true });
      if (error) throw error;
      const list = (data ?? []) as { id: string; nombre: string | null }[];
      setProveedoresTipo(
        list.map((x) => ({
          id: x.id,
          nombre: String(x.nombre ?? "").trim() || "Sin nombre",
        }))
      );
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los proveedores.");
      setProveedoresTipo([]);
    }
  }, [supabase]);

  useEffect(() => {
    if (!solicitarOpen) return;
    void loadProveedoresFiltrados();
  }, [solicitarOpen, loadProveedoresFiltrados]);

  const openEdit = useCallback((row: ComprasMaterialTableRow) => {
    setEditRow(row);
    setEditFecha(toDateInputValue(row.fecha_prevista_recepcion));
    setEditAlbaran(row.albaran_proveedor?.trim() ?? "");
    setEditOpen(true);
  }, []);

  const columns = useMemo(
    () => createComprasMaterialColumns({ onEdit: openEdit }),
    [openEdit]
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    enableMultiRowSelection: false,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedRow = useMemo(() => {
    const id = Object.keys(rowSelection).find((k) => rowSelection[k]);
    if (!id) return null;
    return rows.find((r) => r.id === id) ?? null;
  }, [rowSelection, rows]);

  const puedeSolicitar =
    selectedRow != null &&
    normalizeEstado(selectedRow.estado) === "pendiente";

  const guardarEdicion = useCallback(async () => {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const fecha =
        editFecha.trim() === "" ? null : editFecha.trim();
      const albaran = editAlbaran.trim() === "" ? null : editAlbaran.trim();
      const { error } = await supabase
        .from(TABLE_COMPRA)
        .update({
          fecha_prevista_recepcion: fecha,
          albaran_proveedor: albaran,
        })
        .eq("id", editRow.id);
      if (error) throw error;
      toast.success("Compra actualizada.");
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
  }, [editAlbaran, editFecha, editRow, loadRows, supabase]);

  const generarYEnviar = useCallback(async () => {
    if (!selectedRow || !proveedorSeleccionado) return;
    setSolicitarSaving(true);
    try {
      const now = new Date().toISOString();
      const { error: u1 } = await supabase
        .from(TABLE_COMPRA)
        .update({
          proveedor_id: proveedorSeleccionado,
          fecha_solicitud: now,
          estado: "Generada",
        })
        .eq("id", selectedRow.id);
      if (u1) throw u1;

      const { error: u2 } = await supabase
        .from(TABLE_DESPACHADAS)
        .update({ estado_material: "Orden compra generada" })
        .eq("ot_numero", selectedRow.ot_numero);
      if (u2) throw u2;

      abrirMailtoSolicitudMaterial(selectedRow);

      toast.success("Solicitud generada y enviada.");
      setSolicitarOpen(false);
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
  }, [loadRows, proveedorSeleccionado, selectedRow, supabase]);

  useEffect(() => {
    if (!solicitarOpen) {
      setProveedorSeleccionado("");
    }
  }, [solicitarOpen]);

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
            datos de despacho, maestro y proveedor. Hasta {PAGE_SIZE} registros
            recientes.
          </p>
        </div>
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
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <Table className="table-fixed min-w-[1360px] text-xs">
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
        <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-slate-100 px-4 py-3">
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
          <div className="grid gap-3 px-4 py-3">
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
        <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-slate-100 px-4 py-3">
            <DialogTitle className="text-base">Solicitar material</DialogTitle>
            <DialogDescription className="text-xs">
              Asigna un proveedor y genera la orden de solicitud.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 px-4 py-3">
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
                      ? proveedoresTipo.find((p) => p.id === proveedorSeleccionado)
                          ?.nombre ?? null
                      : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none__">Seleccionar proveedor</SelectItem>
                  {proveedoresTipo.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedRow ? (
              <div className="rounded-md border border-slate-200 bg-slate-100/80 px-3 py-2.5 text-xs leading-relaxed text-slate-800">
                <p className="font-medium text-slate-600">Resumen</p>
                <p className="mt-1">
                  Se solicitará a proveedor:{" "}
                  <span className="font-medium text-[#002147]">
                    {selectedRow.material?.trim() || "—"}
                  </span>
                  , Gramaje:{" "}
                  <span className="tabular-nums font-medium">
                    {formatGramajeResumen(selectedRow.gramaje)}
                  </span>
                  , Formato:{" "}
                  <span className="font-medium">
                    {selectedRow.tamano_hoja?.trim() || "—"}
                  </span>
                  , Cantidad:{" "}
                  <span className="tabular-nums font-medium">
                    {selectedRow.num_hojas_brutas != null
                      ? selectedRow.num_hojas_brutas
                      : "—"}
                  </span>{" "}
                  hojas.
                </p>
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
                !proveedorSeleccionado || solicitarSaving || !selectedRow
              }
              onClick={() => void generarYEnviar()}
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
    </div>
  );
}
