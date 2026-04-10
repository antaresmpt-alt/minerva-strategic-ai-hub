"use client";

import { Loader2, Package, Pencil, Plus, Upload } from "lucide-react";
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

const RESERVA_ESTADOS = ["Pendiente", "Consumido", "Cancelado"] as const;
const TRANSITO_ESTADOS = ["Pedido", "Parcial", "Recibido"] as const;

type MaterialOption = { id: string; nombre: string };

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

  const [editMaterialOpen, setEditMaterialOpen] = useState(false);
  const [editStockFisico, setEditStockFisico] = useState("");
  const [editStockMinimo, setEditStockMinimo] = useState("");
  const [editMaterialSaving, setEditMaterialSaving] = useState(false);

  const [reservaEditOpen, setReservaEditOpen] = useState(false);
  const [reservaEditRow, setReservaEditRow] = useState<AlmacenReservaRow | null>(
    null
  );
  const [reservaEditEstado, setReservaEditEstado] = useState<string>(
    RESERVA_ESTADOS[0]
  );
  const [reservaEditCantidad, setReservaEditCantidad] = useState("");
  const [reservaEditSaving, setReservaEditSaving] = useState(false);

  const [nuevaReservaOpen, setNuevaReservaOpen] = useState(false);
  const [nuevaReservaMaterialId, setNuevaReservaMaterialId] = useState("");
  const [nuevaReservaOt, setNuevaReservaOt] = useState("");
  const [nuevaReservaCantidad, setNuevaReservaCantidad] = useState("");
  const [nuevaReservaFecha, setNuevaReservaFecha] = useState("");
  const [nuevaReservaSaving, setNuevaReservaSaving] = useState(false);

  const [transitoEditOpen, setTransitoEditOpen] = useState(false);
  const [transitoEditRow, setTransitoEditRow] =
    useState<AlmacenPedidoTransitoRow | null>(null);
  const [transitoEditEstado, setTransitoEditEstado] = useState<string>(
    TRANSITO_ESTADOS[0]
  );
  const [transitoEditCantidad, setTransitoEditCantidad] = useState("");
  const [transitoEditSaving, setTransitoEditSaving] = useState(false);

  const [nuevoTransitoOpen, setNuevoTransitoOpen] = useState(false);
  const [nuevoTransitoMaterialId, setNuevoTransitoMaterialId] = useState("");
  const [nuevoTransitoNumPedido, setNuevoTransitoNumPedido] = useState("");
  const [nuevoTransitoCantidad, setNuevoTransitoCantidad] = useState("");
  const [nuevoTransitoFecha, setNuevoTransitoFecha] = useState("");
  const [nuevoTransitoSaving, setNuevoTransitoSaving] = useState(false);

  const [materialesCatalog, setMaterialesCatalog] = useState<MaterialOption[]>(
    []
  );

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

  const loadMaterialesCatalog = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from(TBL_MATERIALES)
        .select("id,nombre")
        .order("nombre", { ascending: true, nullsFirst: false });
      if (error) throw error;
      const rows = (data ?? []) as { id: string; nombre: string | null }[];
      setMaterialesCatalog(
        rows
          .filter((x) => x.id && x.nombre)
          .map((x) => ({ id: x.id, nombre: String(x.nombre) }))
      );
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "Error al cargar el catálogo de materiales."
      );
    }
  }, [supabase]);

  const refreshAllAfterMutation = useCallback(async () => {
    await loadControl();
    if (reservasLoadedOnce) await loadReservas();
    if (transitoLoadedOnce) await loadTransito();
  }, [
    loadControl,
    loadReservas,
    loadTransito,
    reservasLoadedOnce,
    transitoLoadedOnce,
  ]);

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

  function openEditMaterial(r: AlmacenControlInteligenteRow) {
    const mid = materialIdFromRow(r);
    if (!mid) {
      toast.error("Esta fila no tiene id de material.");
      return;
    }
    setRowActiva(r);
    setEditStockFisico(String(Math.trunc(toNum(r.stock_fisico)) || 0));
    const sm = toNum(r.stock_minimo);
    setEditStockMinimo(Number.isFinite(sm) ? String(Math.trunc(sm)) : "0");
    setEditMaterialOpen(true);
  }

  function openEditReserva(r: AlmacenReservaRow) {
    const est = (r.estado ?? "").trim();
    const estadoOk = RESERVA_ESTADOS.includes(
      est as (typeof RESERVA_ESTADOS)[number]
    )
      ? est
      : RESERVA_ESTADOS[0];
    setReservaEditRow(r);
    setReservaEditEstado(estadoOk);
    setReservaEditCantidad(String(Math.trunc(toNum(r.cantidad_bruta)) || 0));
    setReservaEditOpen(true);
  }

  function openEditTransito(r: AlmacenPedidoTransitoRow) {
    const est = (r.estado ?? "").trim();
    const legacy: Record<string, string> = { Pendiente: "Pedido" };
    const normalized = legacy[est] ?? est;
    const estadoOk = TRANSITO_ESTADOS.includes(
      normalized as (typeof TRANSITO_ESTADOS)[number]
    )
      ? normalized
      : TRANSITO_ESTADOS[0];
    setTransitoEditRow(r);
    setTransitoEditEstado(estadoOk);
    setTransitoEditCantidad(String(Math.trunc(toNum(r.cantidad_pedida)) || 0));
    setTransitoEditOpen(true);
  }

  async function openNuevaReserva() {
    setNuevaReservaMaterialId("");
    setNuevaReservaOt("");
    setNuevaReservaCantidad("");
    setNuevaReservaFecha("");
    if (materialesCatalog.length === 0) await loadMaterialesCatalog();
    setNuevaReservaOpen(true);
  }

  async function openNuevoTransito() {
    setNuevoTransitoMaterialId("");
    setNuevoTransitoNumPedido("");
    setNuevoTransitoCantidad("");
    setNuevoTransitoFecha("");
    if (materialesCatalog.length === 0) await loadMaterialesCatalog();
    setNuevoTransitoOpen(true);
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
        estado: "Pedido",
      };
      if (pedirFechaLlegada.trim()) {
        payload.fecha_llegada = pedirFechaLlegada.trim();
      }
      const { error } = await supabase.from(TBL_TRANSITO).insert(payload);
      if (error) throw error;
      toast.success("Pedido en tránsito registrado.");
      setPedirOpen(false);
      setRowActiva(null);
      await refreshAllAfterMutation();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setPedirSaving(false);
    }
  }

  async function guardarEditMaterial() {
    if (!rowActiva) return;
    const mid = materialIdFromRow(rowActiva);
    if (!mid) return;
    const sf = Math.trunc(Number(editStockFisico.replace(",", ".")));
    const smin = Math.trunc(Number(editStockMinimo.replace(",", ".")));
    if (!Number.isFinite(sf) || sf < 0) {
      toast.error("Stock físico no válido.");
      return;
    }
    if (!Number.isFinite(smin) || smin < 0) {
      toast.error("Stock mínimo no válido.");
      return;
    }
    setEditMaterialSaving(true);
    try {
      const { error } = await supabase
        .from(TBL_MATERIALES)
        .update({ stock_fisico: sf, stock_minimo: smin })
        .eq("id", mid);
      if (error) throw error;
      toast.success("Material actualizado.");
      setEditMaterialOpen(false);
      setRowActiva(null);
      await refreshAllAfterMutation();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar.");
    } finally {
      setEditMaterialSaving(false);
    }
  }

  async function guardarEditReserva() {
    if (!reservaEditRow) return;
    const cant = Math.trunc(Number(reservaEditCantidad.replace(",", ".")));
    if (!Number.isFinite(cant)) {
      toast.error("Cantidad no válida.");
      return;
    }
    setReservaEditSaving(true);
    try {
      const { error } = await supabase
        .from(TBL_RESERVAS)
        .update({
          cantidad_bruta: cant,
          estado: reservaEditEstado,
        })
        .eq("id", reservaEditRow.id);
      if (error) throw error;
      toast.success("Reserva actualizada.");
      setReservaEditOpen(false);
      setReservaEditRow(null);
      await refreshAllAfterMutation();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setReservaEditSaving(false);
    }
  }

  async function guardarNuevaReserva() {
    if (!nuevaReservaMaterialId) {
      toast.error("Selecciona un material.");
      return;
    }
    const ot = nuevaReservaOt.trim();
    if (!ot) {
      toast.error("Indica el número de OT.");
      return;
    }
    const cant = Math.trunc(Number(nuevaReservaCantidad.replace(",", ".")));
    if (!Number.isFinite(cant)) {
      toast.error("Cantidad no válida.");
      return;
    }
    setNuevaReservaSaving(true);
    try {
      const payload: Record<string, unknown> = {
        material_id: nuevaReservaMaterialId,
        ot_num: ot,
        cantidad_bruta: cant,
        estado: "Pendiente",
      };
      if (nuevaReservaFecha.trim()) {
        payload.fecha_prevista = nuevaReservaFecha.trim();
      }
      const { error } = await supabase.from(TBL_RESERVAS).insert(payload);
      if (error) throw error;
      toast.success("Reserva creada.");
      setNuevaReservaOpen(false);
      await refreshAllAfterMutation();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear.");
    } finally {
      setNuevaReservaSaving(false);
    }
  }

  async function guardarEditTransito() {
    if (!transitoEditRow) return;
    const cant = Math.trunc(Number(transitoEditCantidad.replace(",", ".")));
    if (!Number.isFinite(cant) || cant < 0) {
      toast.error("Cantidad no válida.");
      return;
    }
    setTransitoEditSaving(true);
    try {
      const { error } = await supabase
        .from(TBL_TRANSITO)
        .update({
          cantidad_pedida: cant,
          estado: transitoEditEstado,
        })
        .eq("id", transitoEditRow.id);
      if (error) throw error;
      toast.success("Pedido actualizado.");
      setTransitoEditOpen(false);
      setTransitoEditRow(null);
      await refreshAllAfterMutation();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setTransitoEditSaving(false);
    }
  }

  async function guardarNuevoTransito() {
    if (!nuevoTransitoMaterialId) {
      toast.error("Selecciona un material.");
      return;
    }
    const ref = nuevoTransitoNumPedido.trim();
    if (!ref) {
      toast.error("Indica el número de pedido o referencia.");
      return;
    }
    const cant = Math.trunc(Number(nuevoTransitoCantidad.replace(",", ".")));
    if (!Number.isFinite(cant) || cant <= 0) {
      toast.error("Cantidad no válida.");
      return;
    }
    setNuevoTransitoSaving(true);
    try {
      const payload: Record<string, unknown> = {
        material_id: nuevoTransitoMaterialId,
        num_pedido: ref,
        cantidad_pedida: cant,
        estado: "Pedido",
      };
      if (nuevoTransitoFecha.trim()) {
        payload.fecha_llegada = nuevoTransitoFecha.trim();
      }
      const { error } = await supabase.from(TBL_TRANSITO).insert(payload);
      if (error) throw error;
      toast.success("Pedido en tránsito registrado.");
      setNuevoTransitoOpen(false);
      await refreshAllAfterMutation();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear.");
    } finally {
      setNuevoTransitoSaving(false);
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
      await refreshAllAfterMutation();
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
                                className="size-7 border-[#002147]/30 text-[#002147] hover:bg-slate-100"
                                title="Editar stock físico y mínimo"
                                aria-label="Editar material"
                                onClick={() => openEditMaterial(r)}
                              >
                                <Pencil className="size-3.5" />
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
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 bg-[#002147] px-2.5 text-xs text-white hover:bg-[#001a38]"
                onClick={() => void openNuevaReserva()}
              >
                <Plus className="size-3.5" aria-hidden />
                Nueva reserva
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
              <div className="max-h-[min(65vh,560px)] overflow-auto">
                <Table className="min-w-[780px] text-xs">
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
                      <TableHead className="w-12 px-1 py-1.5 text-center text-[10px] font-semibold uppercase">
                        Ed.
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingReservas ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center">
                          <Loader2 className="mx-auto size-5 animate-spin text-slate-400" />
                        </TableCell>
                      </TableRow>
                    ) : reservasRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
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
                          <TableCell className="px-1 py-0.5 text-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="size-7 border-[#002147]/25 text-[#002147]"
                              title="Editar reserva"
                              aria-label="Editar reserva"
                              onClick={() => openEditReserva(r)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="transito" className="mt-0 outline-none">
          <div className="flex flex-col gap-2">
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 bg-[#002147] px-2.5 text-xs text-white hover:bg-[#001a38]"
                onClick={() => void openNuevoTransito()}
              >
                <Plus className="size-3.5" aria-hidden />
                Nuevo pedido
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
              <div className="max-h-[min(65vh,560px)] overflow-auto">
                <Table className="min-w-[820px] text-xs">
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
                      <TableHead className="w-12 px-1 py-1.5 text-center text-[10px] font-semibold uppercase">
                        Ed.
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTransito ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center">
                          <Loader2 className="mx-auto size-5 animate-spin text-slate-400" />
                        </TableCell>
                      </TableRow>
                    ) : transitoRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
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
                          <TableCell className="px-1 py-0.5 text-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="size-7 border-[#002147]/25 text-[#002147]"
                              title="Editar pedido"
                              aria-label="Editar pedido en tránsito"
                              onClick={() => openEditTransito(r)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
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

      <Dialog open={editMaterialOpen} onOpenChange={setEditMaterialOpen}>
        <DialogContent className="max-w-sm p-0">
          <DialogHeader className="px-4 py-3">
            <DialogTitle className="text-base">Editar stocks del material</DialogTitle>
            {rowActiva?.material ? (
              <p className="text-muted-foreground text-xs">{rowActiva.material}</p>
            ) : null}
          </DialogHeader>
          <div className="grid gap-3 px-4 pb-2">
            <div className="grid gap-1">
              <Label className="text-xs">Stock físico</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min={0}
                value={editStockFisico}
                onChange={(e) => setEditStockFisico(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Stock mínimo (seguridad)</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min={0}
                value={editStockMinimo}
                onChange={(e) => setEditStockMinimo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditMaterialOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={editMaterialSaving}
              onClick={() => void guardarEditMaterial()}
            >
              {editMaterialSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reservaEditOpen} onOpenChange={setReservaEditOpen}>
        <DialogContent className="max-w-md p-0 sm:max-w-md">
          <DialogHeader className="px-4 py-3">
            <DialogTitle className="text-base">Editar reserva OT</DialogTitle>
            {reservaEditRow ? (
              <p className="text-muted-foreground text-xs">
                OT {reservaEditRow.ot_num ?? "—"} ·{" "}
                {materialNombreFromJoin(reservaEditRow.almacen_materiales) ||
                  reservaEditRow.material_id}
              </p>
            ) : null}
          </DialogHeader>
          <div className="grid gap-3 px-4 pb-2">
            <div className="grid gap-1">
              <Label className="text-xs">Estado</Label>
              <Select
                value={reservaEditEstado}
                onValueChange={(v) => {
                  if (v) setReservaEditEstado(v);
                }}
              >
                <SelectTrigger size="sm" className="h-8 w-full min-w-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESERVA_ESTADOS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Cantidad bruta</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                value={reservaEditCantidad}
                onChange={(e) => setReservaEditCantidad(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReservaEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={reservaEditSaving}
              onClick={() => void guardarEditReserva()}
            >
              {reservaEditSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={nuevaReservaOpen} onOpenChange={setNuevaReservaOpen}>
        <DialogContent className="max-w-md p-0 sm:max-w-md">
          <DialogHeader className="px-4 py-3">
            <DialogTitle className="text-base">Nueva reserva manual</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 px-4 pb-2">
            <div className="grid gap-1">
              <Label className="text-xs">Material</Label>
              <Select
                value={nuevaReservaMaterialId || "__none__"}
                onValueChange={(v) =>
                  setNuevaReservaMaterialId(
                    !v || v === "__none__" ? "" : v
                  )
                }
              >
                <SelectTrigger size="sm" className="h-8 w-full min-w-0 text-xs">
                  <SelectValue placeholder="Seleccionar material" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none__">Seleccionar material</SelectItem>
                  {materialesCatalog.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Nº OT</Label>
              <Input
                className="h-8 text-xs"
                value={nuevaReservaOt}
                onChange={(e) => setNuevaReservaOt(e.target.value)}
                placeholder="Ej. 4703"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Cantidad bruta</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                value={nuevaReservaCantidad}
                onChange={(e) => setNuevaReservaCantidad(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Fecha prevista (opcional)</Label>
              <Input
                className="h-8 text-xs"
                type="date"
                value={nuevaReservaFecha}
                onChange={(e) => setNuevaReservaFecha(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNuevaReservaOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={nuevaReservaSaving}
              onClick={() => void guardarNuevaReserva()}
            >
              {nuevaReservaSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Crear"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transitoEditOpen} onOpenChange={setTransitoEditOpen}>
        <DialogContent className="max-w-md p-0 sm:max-w-md">
          <DialogHeader className="px-4 py-3">
            <DialogTitle className="text-base">Editar pedido en tránsito</DialogTitle>
            {transitoEditRow ? (
              <p className="text-muted-foreground text-xs">
                {transitoEditRow.num_pedido ?? "—"} ·{" "}
                {materialNombreFromJoin(transitoEditRow.almacen_materiales) ||
                  transitoEditRow.material_id}
              </p>
            ) : null}
          </DialogHeader>
          <div className="grid gap-3 px-4 pb-2">
            <div className="grid gap-1">
              <Label className="text-xs">Estado</Label>
              <Select
                value={transitoEditEstado}
                onValueChange={(v) => {
                  if (v) setTransitoEditEstado(v);
                }}
              >
                <SelectTrigger size="sm" className="h-8 w-full min-w-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSITO_ESTADOS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Cantidad pedida</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min={0}
                value={transitoEditCantidad}
                onChange={(e) => setTransitoEditCantidad(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTransitoEditOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={transitoEditSaving}
              onClick={() => void guardarEditTransito()}
            >
              {transitoEditSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={nuevoTransitoOpen} onOpenChange={setNuevoTransitoOpen}>
        <DialogContent className="max-w-md p-0 sm:max-w-md">
          <DialogHeader className="px-4 py-3">
            <DialogTitle className="text-base">Nuevo pedido a proveedor</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 px-4 pb-2">
            <div className="grid gap-1">
              <Label className="text-xs">Material</Label>
              <Select
                value={nuevoTransitoMaterialId || "__none__"}
                onValueChange={(v) =>
                  setNuevoTransitoMaterialId(
                    !v || v === "__none__" ? "" : v
                  )
                }
              >
                <SelectTrigger size="sm" className="h-8 w-full min-w-0 text-xs">
                  <SelectValue placeholder="Seleccionar material" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="__none__">Seleccionar material</SelectItem>
                  {materialesCatalog.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Nº pedido / referencia</Label>
              <Input
                className="h-8 text-xs"
                value={nuevoTransitoNumPedido}
                onChange={(e) => setNuevoTransitoNumPedido(e.target.value)}
                placeholder="Ej. PO-2026-014"
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Cantidad pedida</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min={1}
                value={nuevoTransitoCantidad}
                onChange={(e) => setNuevoTransitoCantidad(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Fecha esperada de llegada (opcional)</Label>
              <Input
                className="h-8 text-xs"
                type="date"
                value={nuevoTransitoFecha}
                onChange={(e) => setNuevoTransitoFecha(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNuevoTransitoOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={nuevoTransitoSaving}
              onClick={() => void guardarNuevoTransito()}
            >
              {nuevoTransitoSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Registrar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
