"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Loader2, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createOtsDespachadasColumns } from "@/components/produccion/ots/ots-despachadas-columns";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { OtsDespachadasTableRow } from "@/types/prod-ots-despachadas";

const TABLE_DESPACHADAS = "produccion_ot_despachadas";
const TABLE_MASTER = "prod_ots_general";
const TABLE_COMPRA_MATERIAL = "prod_compra_material";
const PAGE_SIZE = 500;

type OtsDespachadasPageProps = {
  onCompraMaterialSuccess?: () => void;
};

export function OtsDespachadasPage({
  onCompraMaterialSuccess,
}: OtsDespachadasPageProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<OtsDespachadasTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [comprando, setComprando] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useMemo(() => createOtsDespachadasColumns(), []);

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
            .map((d) => String((d as { ot_numero?: string }).ot_numero ?? "").trim())
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
        return {
          id: String(d.id ?? ""),
          ot_numero: ot,
          material: (d.material as string | null) ?? null,
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
          estado_material: (d.estado_material as string | null) ?? null,
          cliente: m?.cliente ?? null,
          titulo: m?.titulo ?? null,
          cantidad: m?.cantidad ?? null,
          fecha_entrega_prevista: m?.fecha_entrega ?? null,
        };
      });
      setRows(merged);
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Error al cargar OTs despachadas."
      );
      setRows([]);
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
    enableMultiRowSelection: false,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedRow = useMemo(() => {
    const id = Object.keys(rowSelection).find((k) => rowSelection[k]);
    if (!id) return null;
    return rows.find((r) => r.id === id) ?? null;
  }, [rowSelection, rows]);

  const handleComprarMaterial = useCallback(async () => {
    if (!selectedRow) return;
    const ot = String(selectedRow.ot_numero ?? "").trim();
    if (!ot) {
      toast.error("La fila no tiene número de OT.");
      return;
    }
    setComprando(true);
    try {
      const { error: insertError } = await supabase
        .from(TABLE_COMPRA_MATERIAL)
        .insert({
          ot_numero: ot,
          num_compra: `OCM-${ot}`,
          estado: "Pendiente",
        });
      if (insertError) {
        if (insertError.code === "23505") {
          toast.error("Esta OT ya tiene una compra iniciada");
          return;
        }
        throw insertError;
      }

      const { error: updateError } = await supabase
        .from(TABLE_DESPACHADAS)
        .update({ estado_material: "Pendiente de pedir" })
        .eq("id", selectedRow.id);
      if (updateError) throw updateError;

      toast.success("Compra de material registrada.");
      onCompraMaterialSuccess?.();
      void loadRows();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "No se pudo iniciar la compra de material."
      );
    } finally {
      setComprando(false);
    }
  }, [loadRows, onCompraMaterialSuccess, selectedRow, supabase]);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
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
          disabled={!selectedRow || comprando}
          onClick={() => {
            void handleComprarMaterial();
          }}
        >
          {comprando ? (
            <Loader2 className="size-4 animate-spin text-[#002147]" aria-hidden />
          ) : (
            <ShoppingCart className="size-4 text-[#002147]" aria-hidden />
          )}
          Comprar material
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <Table className="table-fixed min-w-[1100px] text-xs">
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
