"use client";

import { Loader2, Package, Plus, SlidersHorizontal, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { syncAlmacenFromExcelBuffer } from "@/lib/almacen-import";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  AlmacenControlInteligenteRow,
  AlmacenMaterialNombreRef,
  AlmacenPedidoTransitoRow,
  AlmacenReservaRow,
} from "@/types/almacen-mrp";
import { cn } from "@/lib/utils";

const VIEW_CONTROL = "almacen_control_inteligente";
const TBL_MATERIALES = "almacen_materiales";
const TBL_RESERVAS = "almacen_reservas";
const TBL_TRANSITO = "almacen_pedidos_transito";

function toNum(v: unknown): number {
  if (v == null || v === "") return NaN;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function materialIdFromRow(r: AlmacenControlInteligenteRow): string | null {
  const id = r.material_id ?? r.id;
  return id && String(id).trim() !== "" ? String(id) : null;
}

function cellProyectadoClass(dp: number, stockMinimo: number): string {
  if (dp < 0) {
    return "bg-red-600 text-white font-semibold tabular-nums";
  }
  if (dp >= 0 && dp < stockMinimo) {
    return "bg-amber-400/95 text-amber-950 font-medium tabular-nums";
  }
  return "bg-emerald-50/80 text-slate-800 tabular-nums";
}

function cellRealTextClass(dr: number): string {
  if (dr < 0) return "font-bold text-red-600 tabular-nums";
  return "tabular-nums text-slate-800";
}

function materialNombreFromJoin(
  joined:
    | AlmacenMaterialNombreRef
    | AlmacenMaterialNombreRef[]
    | null
    | undefined
): string {
  if (joined == null) return "";
  const ref = Array.isArray(joined) ? joined[0] : joined;
  const n = ref?.nombre;
  return typeof n === "string" ? n.trim() : "";
}

export function AlmacenMrpPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [tab, setTab] = useState("control");

  const [controlRows, setControlRows] = useState<AlmacenControlInteligenteRow[]>(
    []
  );
  const [reservasRows, setReservasRows] = useState<AlmacenReservaRow[]>([]);
  const [transitoRows, setTransitoRows] = useState<AlmacenPedidoTransitoRow[]>(
    []
  );

  const [loadingControl, setLoadingControl] = useState(true);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [loadingTransito, setLoadingTransito] = useState(false);
  const [reservasLoadedOnce, setReservasLoadedOnce] = useState(false);
  const [transitoLoadedOnce, setTransitoLoadedOnce] = useState(false);

  const [pedirOpen, setPedirOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [rowActiva, setRowActiva] = useState<AlmacenControlInteligenteRow | null>(
    null
  );

  const [pedirNumPedido, setPedirNumPedido] = useState("");
  const [pedirCantidad, setPedirCantidad] = useState("");
  const [pedirFechaLlegada, setPedirFechaLlegada] = useState("");
  const [pedirSaving, setPedirSaving] = useState(false);

  const [ajusteStock, setAjusteStock] = useState("");
  const [ajusteSaving, setAjusteSaving] = useState(false);

  const excelInputRef = useRef<HTMLInputElement>(null);
  const [syncingExcel, setSyncingExcel] = useState(false);

  const loadControl = useCallback(async () => {
    setLoadingControl(true);
    try {
      const { data, error } = await supabase
        .from(VIEW_CONTROL)
        .select("*")
        .order("material", { ascending: true, nullsFirst: false });
      if (error) throw error;
      setControlRows((data ?? []) as AlmacenControlInteligenteRow[]);
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Error al cargar Control Inteligente."
      );
      setControlRows([]);
    } finally {
      setLoadingControl(false);
    }
  }, [supabase]);

  const loadReservas = useCallback(async () => {
    setLoadingReservas(true);
    try {
      const { data, error } = await supabase
        .from(TBL_RESERVAS)
        .select("*, almacen_materiales ( id, nombre )")
        .order("fecha_prevista", { ascending: true, nullsFirst: false });
      if (error) throw error;
      setReservasRows((data ?? []) as AlmacenReservaRow[]);
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Error al cargar reservas."
      );
      setReservasRows([]);
    } finally {
      setLoadingReservas(false);
    }
  }, [supabase]);

  const loadTransito = useCallback(async () => {
    setLoadingTransito(true);
    try {
      const { data, error } = await supabase
        .from(TBL_TRANSITO)
        .select("*, almacen_materiales ( id, nombre )")
        .order("fecha_llegada", { ascending: true, nullsFirst: false });
      if (error) throw error;
      setTransitoRows((data ?? []) as AlmacenPedidoTransitoRow[]);
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Error al cargar pedidos en tránsito."
      );
      setTransitoRows([]);
    } finally {
      setLoadingTransito(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadControl();
  }, [loadControl]);

  useEffect(() => {
    if (tab === "reservas" && !reservasLoadedOnce) {
      setReservasLoadedOnce(true);
      void loadReservas();
    }
    if (tab === "transito" && !transitoLoadedOnce) {
      setTransitoLoadedOnce(true);
      void loadTransito();
    }
  }, [tab, reservasLoadedOnce, transitoLoadedOnce, loadReservas, loadTransito]);

  function openPedir(r: AlmacenControlInteligenteRow) {
    const mid = materialIdFromRow(r);
    if (!mid) {
      toast.error("Esta fila no tiene material_id: no se puede pedir material.");
      return;
    }
    setRowActiva(r);
    setPedirNumPedido("");
    setPedirCantidad("");
    setPedirFechaLlegada("");
    setPedirOpen(true);
  }

  function openAjuste(r: AlmacenControlInteligenteRow) {
    const mid = materialIdFromRow(r);
    if (!mid) {
      toast.error("Esta fila no tiene id de material.");
      return;
    }
    setRowActiva(r);
    setAjusteStock(String(toNum(r.stock_fisico) || ""));
    setAjusteOpen(true);
  }

  async function guardarPedido() {
    if (!rowActiva) return;
    const mid = materialIdFromRow(rowActiva);
    if (!mid) return;
    const qty = Math.trunc(Number(pedirCantidad.replace(",", ".")));
    if (!pedirNumPedido.trim() || !Number.isFinite(qty) || qty <= 0) {
      toast.error("Indica Nº pedido y cantidad válida.");
      return;
    }
    setPedirSaving(true);
    try {
      const payload: Record<string, unknown> = {
        material_id: mid,
        num_pedido: pedirNumPedido.trim(),
        cantidad_pedida: qty,
        estado: "Pendiente",
      };
      if (pedirFechaLlegada.trim()) {
        payload.fecha_llegada = pedirFechaLlegada.trim();
      }
      const { error } = await supabase.from(TBL_TRANSITO).insert(payload);
      if (error) throw error;
      toast.success("Pedido en tránsito registrado.");
      setPedirOpen(false);
      setRowActiva(null);
      void loadControl();
      void loadTransito();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setPedirSaving(false);
    }
  }

  async function guardarAjuste() {
    if (!rowActiva) return;
    const mid = materialIdFromRow(rowActiva);
    if (!mid) return;
    const n = Math.trunc(Number(ajusteStock.replace(",", ".")));
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Stock físico no válido.");
      return;
    }
    setAjusteSaving(true);
    try {
      const { error } = await supabase
        .from(TBL_MATERIALES)
        .update({ stock_fisico: n })
        .eq("id", mid);
      if (error) throw error;
      toast.success("Stock actualizado.");
      setAjusteOpen(false);
      setRowActiva(null);
      void loadControl();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar.");
    } finally {
      setAjusteSaving(false);
    }
  }

  async function onExcelFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx")) {
      toast.error("El archivo debe ser .xlsx.");
      return;
    }
    setSyncingExcel(true);
    const toastId = toast.loading(
      "Sincronizando catálogo, reservas y tránsitos…"
    );
    try {
      const buffer = await file.arrayBuffer();
      const outcome = await syncAlmacenFromExcelBuffer(supabase, buffer);
      if (!outcome.ok) {
        toast.error(outcome.message, { id: toastId });
        return;
      }
      toast.success(
        `Sincronizado: ${outcome.materialesUpserted} materiales, ${outcome.reservasInserted} reservas, ${outcome.transitoInserted} en tránsito.`,
        { id: toastId, duration: 6000 }
      );
      if (
        outcome.reservasSkippedNoMaterial > 0 ||
        outcome.transitoSkippedNoMaterial > 0
      ) {
        toast.message(
          `Filas omitidas (material no encontrado): reservas ${outcome.reservasSkippedNoMaterial}, tránsito ${outcome.transitoSkippedNoMaterial}.`,
          { duration: 8000 }
        );
      }
      for (const w of outcome.warnings.slice(0, 6)) {
        toast.message(w, { duration: 7000 });
      }
      await loadControl();
      if (reservasLoadedOnce) await loadReservas();
      if (transitoLoadedOnce) await loadTransito();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al leer el Excel.",
        { id: toastId }
      );
    } finally {
      setSyncingExcel(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
      <header className="border-b border-slate-200/80 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl font-semibold text-[#002147] sm:text-2xl">
              Almacén y planificación MRP
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl text-xs sm:text-sm">
              Control Inteligente (vista{" "}
              <code className="rounded bg-slate-100 px-1">{VIEW_CONTROL}</code>
              ), reservas por OT y pedidos en tránsito.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              aria-hidden
              onChange={(ev) => void onExcelFileSelected(ev)}
            />
            <Button
              type="button"
              className="h-9 gap-1.5 bg-[#002147] px-3 text-xs font-semibold text-white shadow-sm hover:bg-[#001a38] sm:text-sm"
              disabled={syncingExcel}
              onClick={() => excelInputRef.current?.click()}
            >
              {syncingExcel ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Upload className="size-4 shrink-0" aria-hidden />
              )}
              Sincronizar Excel Almacén
            </Button>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/90 px-3 py-2 text-xs text-slate-600">
              <Package className="size-4 shrink-0 text-[#002147]" aria-hidden />
              MRP
            </div>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="gap-3">
        <TabsList className="h-9 w-full max-w-xl flex-wrap justify-start gap-1 sm:h-9">
          <TabsTrigger value="control" className="text-xs sm:text-sm">
            Control Inteligente
          </TabsTrigger>
          <TabsTrigger value="reservas" className="text-xs sm:text-sm">
            Reservas OTs
          </TabsTrigger>
          <TabsTrigger value="transito" className="text-xs sm:text-sm">
            En tránsito
          </TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="mt-0 outline-none">
          <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
            <div className="max-h-[min(72vh,680px)] overflow-auto">
              <Table className="min-w-[920px] text-xs">
                <TableHeader className="sticky top-0 z-20 bg-slate-50/95 shadow-[0_1px_0_0_rgb(226_232_240)]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky top-0 z-20 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                      Material
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 w-16 px-1 py-1.5 text-right text-[10px] font-semibold uppercase">
                      St. fís.
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 w-14 px-1 py-1.5 text-right text-[10px] font-semibold uppercase">
                      St. mín.
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 w-16 px-1 py-1.5 text-right text-[10px] font-semibold uppercase">
                      Reserv.
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 w-16 px-1 py-1.5 text-right text-[10px] font-semibold uppercase">
                      Ped. pend.
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 w-20 px-1 py-1.5 text-right text-[10px] font-semibold uppercase">
                      Disp. real
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 w-24 px-1 py-1.5 text-right text-[10px] font-semibold uppercase">
                      Disp. proyect.
                    </TableHead>
                    <TableHead className="sticky top-0 z-20 w-[5.5rem] px-1 py-1.5 text-center text-[10px] font-semibold uppercase">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingControl ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-12 text-center">
                        <Loader2 className="mx-auto size-6 animate-spin text-slate-400" />
                      </TableCell>
                    </TableRow>
                  ) : controlRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-muted-foreground py-8 text-center text-sm"
                      >
                        Sin datos en la vista. Comprueba RLS y que la vista
                        exista en Supabase.
                      </TableCell>
                    </TableRow>
                  ) : (
                    controlRows.map((r, idx) => {
                      const smin = toNum(r.stock_minimo);
                      const dp = toNum(r.disponible_proyectado);
                      const dr = toNum(r.disponible_real);
                      const sminSafe = Number.isFinite(smin) ? smin : 0;
                      const dpSafe = Number.isFinite(dp) ? dp : 0;
                      const drSafe = Number.isFinite(dr) ? dr : 0;
                      return (
                        <TableRow
                          key={materialIdFromRow(r) ?? `row-${idx}`}
                          className="hover:bg-slate-50/80"
                        >
                          <TableCell className="max-w-[220px] truncate px-2 py-1 font-medium text-[#002147]">
                            {r.material ?? "—"}
                          </TableCell>
                          <TableCell className="px-1 py-1 text-right text-[11px] tabular-nums">
                            {toNum(r.stock_fisico)}
                          </TableCell>
                          <TableCell className="px-1 py-1 text-right text-[11px] tabular-nums text-slate-600">
                            {Number.isFinite(smin) ? smin : "—"}
                          </TableCell>
                          <TableCell className="px-1 py-1 text-right text-[11px] tabular-nums">
                            {toNum(r.reservado_total)}
                          </TableCell>
                          <TableCell className="px-1 py-1 text-right text-[11px] tabular-nums">
                            {toNum(r.pedido_pendiente)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "px-1 py-1 text-right text-[11px]",
                              cellRealTextClass(drSafe)
                            )}
                          >
                            {Number.isFinite(dr) ? dr : "—"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "px-1 py-1 text-right text-[11px]",
                              cellProyectadoClass(dpSafe, sminSafe)
                            )}
                          >
                            {Number.isFinite(dp) ? dp : "—"}
                          </TableCell>
                          <TableCell className="px-1 py-0.5">
                            <div className="flex flex-wrap justify-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="size-7 border-emerald-600/40 text-emerald-800 hover:bg-emerald-50"
                                title="Pedir material (tránsito)"
                                aria-label="Pedir material"
                                onClick={() => openPedir(r)}
                              >
                                <Plus className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="size-7"
                                title="Ajustar stock físico"
                                aria-label="Ajustar stock"
                                onClick={() => openAjuste(r)}
                              >
                                <SlidersHorizontal className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reservas" className="mt-0 outline-none">
          <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
            <div className="max-h-[min(65vh,560px)] overflow-auto">
              <Table className="min-w-[720px] text-xs">
                <TableHeader className="sticky top-0 z-20 bg-slate-50/95">
                  <TableRow>
                    <TableHead className="px-2 py-1.5 text-[10px] font-semibold uppercase">
                      OT
                    </TableHead>
                    <TableHead className="px-2 py-1.5 text-[10px] font-semibold uppercase">
                      Material
                    </TableHead>
                    <TableHead className="text-right text-[10px] font-semibold uppercase">
                      Cant.
                    </TableHead>
                    <TableHead className="px-2 py-1.5 text-[10px] font-semibold uppercase">
                      Estado
                    </TableHead>
                    <TableHead className="px-2 py-1.5 text-[10px] font-semibold uppercase">
                      Fecha prevista
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingReservas ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center">
                        <Loader2 className="mx-auto size-5 animate-spin text-slate-400" />
                      </TableCell>
                    </TableRow>
                  ) : reservasRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground py-6 text-center"
                      >
                        No hay reservas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reservasRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="px-2 py-1 font-mono text-[11px]">
                          {r.ot_num ?? "—"}
                        </TableCell>
                        <TableCell
                          className="max-w-[min(280px,40vw)] truncate px-2 py-1 text-[11px] font-medium text-[#002147]"
                          title={r.material_id ?? undefined}
                        >
                          {materialNombreFromJoin(r.almacen_materiales) ||
                            r.material_id ||
                            "—"}
                        </TableCell>
                        <TableCell className="py-1 text-right tabular-nums">
                          {toNum(r.cantidad_bruta)}
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          {r.estado ?? "—"}
                        </TableCell>
                        <TableCell className="px-2 py-1 tabular-nums">
                          {r.fecha_prevista ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transito" className="mt-0 outline-none">
          <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
            <div className="max-h-[min(65vh,560px)] overflow-auto">
              <Table className="min-w-[760px] text-xs">
                <TableHeader className="sticky top-0 z-20 bg-slate-50/95">
                  <TableRow>
                    <TableHead className="px-2 py-1.5 text-[10px] font-semibold uppercase">
                      Nº pedido
                    </TableHead>
                    <TableHead className="px-2 py-1.5 text-[10px] font-semibold uppercase">
                      Material
                    </TableHead>
                    <TableHead className="text-right text-[10px] font-semibold uppercase">
                      Cant. pedida
                    </TableHead>
                    <TableHead className="px-2 py-1.5 text-[10px] font-semibold uppercase">
                      Estado
                    </TableHead>
                    <TableHead className="px-2 py-1.5 text-[10px] font-semibold uppercase">
                      Fecha llegada
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTransito ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center">
                        <Loader2 className="mx-auto size-5 animate-spin text-slate-400" />
                      </TableCell>
                    </TableRow>
                  ) : transitoRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground py-6 text-center"
                      >
                        No hay pedidos en tránsito.
                      </TableCell>
                    </TableRow>
                  ) : (
                    transitoRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="px-2 py-1 font-mono text-[11px]">
                          {r.num_pedido ?? "—"}
                        </TableCell>
                        <TableCell
                          className="max-w-[min(280px,40vw)] truncate px-2 py-1 text-[11px] font-medium text-[#002147]"
                          title={r.material_id ?? undefined}
                        >
                          {materialNombreFromJoin(r.almacen_materiales) ||
                            r.material_id ||
                            "—"}
                        </TableCell>
                        <TableCell className="py-1 text-right tabular-nums">
                          {toNum(r.cantidad_pedida)}
                        </TableCell>
                        <TableCell className="px-2 py-1">
                          {r.estado ?? "—"}
                        </TableCell>
                        <TableCell className="px-2 py-1 tabular-nums">
                          {r.fecha_llegada ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={pedirOpen} onOpenChange={setPedirOpen}>
        <DialogContent className="max-w-md p-0 sm:max-w-md">
          <DialogHeader className="px-4 py-3">
            <DialogTitle className="text-base">
              Pedir material
              {rowActiva?.material ? (
                <span className="mt-1 block font-normal text-slate-600">
                  {rowActiva.material}
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 px-4 pb-2">
            <div className="grid gap-1">
              <Label className="text-xs">Nº pedido / referencia</Label>
              <Input
                className="h-8 text-xs"
                value={pedirNumPedido}
                onChange={(e) => setPedirNumPedido(e.target.value)}
                placeholder="Ej. PO-2026-001"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Cantidad pedida</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min={1}
                value={pedirCantidad}
                onChange={(e) => setPedirCantidad(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Fecha llegada prevista (opcional)</Label>
              <Input
                className="h-8 text-xs"
                type="date"
                value={pedirFechaLlegada}
                onChange={(e) => setPedirFechaLlegada(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPedirOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pedirSaving}
              onClick={() => void guardarPedido()}
            >
              {pedirSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Registrar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ajusteOpen} onOpenChange={setAjusteOpen}>
        <DialogContent className="max-w-sm p-0">
          <DialogHeader className="px-4 py-3">
            <DialogTitle className="text-base">Ajustar stock físico</DialogTitle>
            {rowActiva?.material ? (
              <p className="text-muted-foreground text-xs">{rowActiva.material}</p>
            ) : null}
          </DialogHeader>
          <div className="px-4 pb-2">
            <Label className="text-xs">Stock físico</Label>
            <Input
              className="mt-1 h-8 text-xs"
              type="number"
              min={0}
              value={ajusteStock}
              onChange={(e) => setAjusteStock(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAjusteOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={ajusteSaving}
              onClick={() => void guardarAjuste()}
            >
              {ajusteSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
