"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  FileDown,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EtiquetasEntradaExpressDialog } from "@/components/produccion/etiquetas-digital/etiquetas-entrada-express-dialog";
import { EtiquetasHojaRutaDuplicadoDialog } from "@/components/produccion/etiquetas-digital/etiquetas-hoja-ruta-duplicado-dialog";
import { EtiquetasPoolOtDetailDialog } from "@/components/produccion/etiquetas-digital/etiquetas-pool-ot-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { exportEtiquetasPoolColaPdf } from "@/lib/etiquetas-pool-export";
import {
  addOtToPoolPlan,
  devolverEnCursoACola,
  fetchEtiquetasPoolSnapshot,
  labelItinerarioEtiquetas,
  movePoolPlanItem,
  POOL_BANDEJA_FECHA_MINIMA,
  removeOtFromPoolPlan,
  removeOtFromPoolPlanByOtNumero,
  resolveSemaforoItinerario,
  type EtiquetasMaquinaFlags,
  type EtiquetasPoolCandidata,
  type EtiquetasPoolEnCursoItem,
  type EtiquetasPoolPlanItem,
} from "@/lib/etiquetas-pool-entrada";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdEtiquetasCatalogRow } from "@/types/prod-etiquetas-catalogo";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";
import type { ProdEtiquetasTroquelRow } from "@/types/prod-etiquetas-troqueles";
import { cn } from "@/lib/utils";

const CATALOG_TABLE = "prod_etiquetas_catalogo";
const TROQUELES_TABLE = "prod_etiquetas_troqueles";

function fmtEntrega(ymd: string | null): string {
  if (!ymd) return "—";
  return formatFechaEsCorta(ymd);
}

function OtNumeroButton({
  otNumero,
  onClick,
}: {
  otNumero: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="font-mono text-sm font-semibold text-[#002147] underline-offset-2 hover:underline"
      title="Ver datos maestro"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {otNumero}
    </button>
  );
}

function SemaforoItn({
  itinerario,
  hecho,
  size = "sm",
}: {
  itinerario: EtiquetasMaquinaFlags;
  hecho: EtiquetasMaquinaFlags;
  size?: "sm" | "xs";
}) {
  const itn = resolveSemaforoItinerario(itinerario);
  const pills = [
    { key: "I", applies: itn.konica, done: hecho.konica, title: "Impresión Konica" },
    {
      key: "T",
      applies: itn.troqueladora,
      done: hecho.troqueladora,
      title: "Troquelado",
    },
    {
      key: "N",
      applies: itn.numeradora,
      done: hecho.numeradora,
      title: "Numeración",
    },
  ].filter((p) => p.applies);

  return (
    <span className="inline-flex gap-0.5">
      {pills.map((p) => (
        <span
          key={p.key}
          title={`${p.title}${p.done ? " — hecho" : " — pendiente"}`}
          className={cn(
            "inline-flex items-center justify-center rounded font-semibold",
            size === "xs" ? "size-4 text-[9px]" : "size-5 text-[10px]",
            p.done
              ? "bg-emerald-600 text-white"
              : "border border-slate-300 bg-slate-100 text-slate-600",
          )}
        >
          {p.key}
        </span>
      ))}
    </span>
  );
}

function CandidataCard({
  row,
  onAdd,
  onOtClick,
  adding,
  disabled,
}: {
  row: EtiquetasPoolCandidata;
  onAdd: () => void;
  onOtClick: () => void;
  adding: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <OtNumeroButton otNumero={row.otNumero} onClick={onOtClick} />
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] font-semibold"
              title="Itinerario previsto (I/T/N)"
            >
              {labelItinerarioEtiquetas(
                resolveSemaforoItinerario(row.itinerario),
              )}
            </Badge>
            {row.despachada ? (
              <Badge className="h-5 bg-emerald-600/90 px-1.5 text-[10px] hover:bg-emerald-600/90">
                Despachada
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="h-5 border border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-900"
              >
                Sin despachar
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs font-medium text-slate-800">
            {row.cliente?.trim() || "—"}
          </p>
          <p
            className="truncate text-[11px] text-slate-600"
            title={row.trabajo ?? ""}
          >
            {row.trabajo?.trim() || "—"}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-slate-500">
            <span>Entrega {fmtEntrega(row.fechaEntrega)}</span>
            {row.cantidad != null ? (
              <span>{Number(row.cantidad).toLocaleString("es-ES")} uds</span>
            ) : null}
            {row.materialDespacho ? (
              <span className="max-w-[10rem] truncate" title={row.materialDespacho}>
                Mat. {row.materialDespacho}
              </span>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0 gap-1 text-xs"
          disabled={disabled || adding}
          onClick={onAdd}
          title="Añadir a la cola"
        >
          {adding ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden />
          )}
          Añadir
        </Button>
      </div>
    </div>
  );
}

function PlanCard({
  row,
  selected,
  onSelect,
  onOtClick,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  removing,
}: {
  row: EtiquetasPoolPlanItem;
  selected: boolean;
  onSelect: () => void;
  onOtClick: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  removing: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5 transition-colors",
        selected
          ? "border-[#C69C2B]/60 bg-amber-50/50 ring-1 ring-[#C69C2B]/35"
          : "border-slate-200/90 bg-white hover:bg-slate-50/80",
      )}
    >
      <button type="button" className="w-full text-left" onClick={onSelect}>
        <div className="flex flex-wrap items-center gap-1.5">
          <OtNumeroButton otNumero={row.otNumero} onClick={onOtClick} />
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold">
            {labelItinerarioEtiquetas(
              resolveSemaforoItinerario(row.itinerario),
            )}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-700">
          {row.cliente?.trim() || "—"}
          {row.trabajo ? ` · ${row.trabajo}` : ""}
        </p>
        <p className="text-[10px] text-slate-500">
          Entrega {fmtEntrega(row.fechaEntrega)}
        </p>
      </button>
      <div className="mt-2 flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          title="Subir"
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          title="Bajar"
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto size-7 text-slate-500 hover:text-red-600"
          disabled={removing}
          onClick={onRemove}
          title="Quitar de la cola"
        >
          {removing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <X className="size-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

function EnCursoCard({
  row,
  onOtClick,
  onDevolver,
  devolviendo,
}: {
  row: EtiquetasPoolEnCursoItem;
  onOtClick: () => void;
  onDevolver: () => void;
  devolviendo: boolean;
}) {
  return (
    <div className="rounded-lg border border-sky-200/80 bg-sky-50/40 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <OtNumeroButton otNumero={row.otNumero} onClick={onOtClick} />
            <Badge className="h-5 bg-sky-700/90 px-1.5 text-[10px] hover:bg-sky-700/90">
              En curso
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-700">
            {row.cliente?.trim() || "—"}
          </p>
          <p className="truncate text-[11px] text-slate-600">{row.trabajo?.trim() || "—"}</p>
          <p className="mt-1 text-[10px] text-slate-500">
            Entrega {fmtEntrega(row.fechaEntrega)}
          </p>
        </div>
        <SemaforoItn itinerario={row.itinerario} hecho={row.hecho} />
      </div>
      <div className="mt-2 flex justify-end border-t border-sky-100 pt-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-[11px]"
          disabled={devolviendo}
          onClick={onDevolver}
          title="Quita la OT de hoja de ruta y la devuelve a la cola"
        >
          {devolviendo ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <RotateCcw className="size-3" aria-hidden />
          )}
          Devolver a cola
        </Button>
      </div>
    </div>
  );
}

export function EtiquetasPoolEntradaTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [candidatas, setCandidatas] = useState<EtiquetasPoolCandidata[]>([]);
  const [plan, setPlan] = useState<EtiquetasPoolPlanItem[]>([]);
  const [enCurso, setEnCurso] = useState<EtiquetasPoolEnCursoItem[]>([]);
  const [catalog, setCatalog] = useState<ProdEtiquetasCatalogRow[]>([]);
  const [troqueles, setTroqueles] = useState<ProdEtiquetasTroquelRow[]>([]);
  const [addingOt, setAddingOt] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedOt, setSelectedOt] = useState<string | null>(null);
  const [expressOpen, setExpressOpen] = useState(false);
  const [expressPrefillOt, setExpressPrefillOt] = useState<string | null>(null);
  const [duplicadosState, setDuplicadosState] = useState<{
    otNumero: string;
    rows: ProdEtiquetasHojaRutaRow[];
  } | null>(null);
  const [poolTableMissing, setPoolTableMissing] = useState(false);
  const [detailOt, setDetailOt] = useState<string | null>(null);
  const [devolviendoHrId, setDevolviendoHrId] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    const [{ data: cat }, { data: troq }] = await Promise.all([
      supabase
        .from(CATALOG_TABLE)
        .select("id, categoria, grupo, label, activo, orden")
        .order("categoria")
        .order("grupo")
        .order("orden")
        .order("label"),
      supabase.from(TROQUELES_TABLE).select("*").order("codigo"),
    ]);
    setCatalog((cat ?? []) as ProdEtiquetasCatalogRow[]);
    setTroqueles((troq ?? []) as ProdEtiquetasTroquelRow[]);
  }, [supabase]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await fetchEtiquetasPoolSnapshot(supabase, filtro);
      setCandidatas(snap.candidatas);
      setPlan(snap.plan);
      setEnCurso(snap.enCurso);
      setPoolTableMissing(false);
    } catch (e) {
      const msg = errorMessageFromUnknown(e, "No se pudo cargar el pool.");
      if (
        msg.includes("prod_etiquetas_pool_plan") ||
        msg.includes("does not exist") ||
        msg.includes("schema cache")
      ) {
        setPoolTableMissing(true);
      } else {
        toast.error(msg);
      }
      setCandidatas([]);
      setPlan([]);
      setEnCurso([]);
    } finally {
      setLoading(false);
    }
  }, [filtro, supabase]);

  useEffect(() => {
    setSelectedOt((prev) => {
      if (prev && plan.some((p) => p.otNumero === prev)) return prev;
      return plan[0]?.otNumero ?? null;
    });
  }, [plan]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), filtro ? 280 : 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const selectedItem = useMemo(
    () => plan.find((p) => p.otNumero === selectedOt) ?? null,
    [plan, selectedOt],
  );

  const handleAdd = async (row: EtiquetasPoolCandidata) => {
    setAddingOt(row.otNumero);
    try {
      await addOtToPoolPlan(supabase, row.otNumero);
      toast.success(`OT ${row.otNumero} añadida a la cola.`);
      setSelectedOt(row.otNumero);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo añadir a la cola."));
    } finally {
      setAddingOt(null);
    }
  };

  const handleRemove = async (item: EtiquetasPoolPlanItem) => {
    setRemovingId(item.id);
    try {
      await removeOtFromPoolPlan(supabase, item.id);
      toast.success(`OT ${item.otNumero} quitada de la cola.`);
      if (selectedOt === item.otNumero) setSelectedOt(null);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo quitar de la cola."));
    } finally {
      setRemovingId(null);
    }
  };

  const handleMove = async (
    item: EtiquetasPoolPlanItem,
    direction: "up" | "down",
  ) => {
    try {
      await movePoolPlanItem(supabase, item.id, direction, plan);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo reordenar."));
    }
  };

  const handleIniciar = () => {
    if (!selectedItem) {
      toast.error("Selecciona una OT de la cola.");
      return;
    }
    setExpressPrefillOt(selectedItem.otNumero);
    setExpressOpen(true);
  };

  const handleDevolverACola = async (row: EtiquetasPoolEnCursoItem) => {
    const ok = window.confirm(
      `¿Devolver la OT ${row.otNumero} a la cola?\n\nSe borrará su fila en hoja de ruta (Kon/Troq/Num, metros, troquel…). Esta acción no se puede deshacer.`,
    );
    if (!ok) return;

    setDevolviendoHrId(row.hrId);
    try {
      await devolverEnCursoACola(supabase, row.hrId, row.otNumero);
      toast.success(`OT ${row.otNumero} devuelta a la cola.`);
      setSelectedOt(row.otNumero);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo devolver a la cola."));
    } finally {
      setDevolviendoHrId(null);
    }
  };

  const handleExportColaPdf = () => {
    if (plan.length === 0) {
      toast.error("La cola está vacía.");
      return;
    }
    exportEtiquetasPoolColaPdf(plan);
    toast.success("PDF de la cola descargado.");
  };

  const handleExpressSaved = async () => {
    const ot = expressPrefillOt;
    setExpressOpen(false);
    setExpressPrefillOt(null);
    if (ot) {
      try {
        await removeOtFromPoolPlanByOtNumero(supabase, ot);
      } catch {
        /* la OT puede no estar ya en cola */
      }
    }
    toast.success("OT guardada en hoja de ruta.");
    await load();
  };

  return (
    <>
      <EtiquetasHojaRutaDuplicadoDialog
        open={duplicadosState != null}
        onOpenChange={(o) => {
          if (!o) setDuplicadosState(null);
        }}
        otNumero={duplicadosState?.otNumero ?? ""}
        existentes={duplicadosState?.rows ?? []}
        onAbrirExistente={() => {
          setDuplicadosState(null);
          setExpressOpen(false);
          setExpressPrefillOt(null);
          void load();
        }}
        onCancelar={() => setDuplicadosState(null)}
      />

      <EtiquetasPoolOtDetailDialog
        open={detailOt != null}
        onOpenChange={(o) => {
          if (!o) setDetailOt(null);
        }}
        otNumero={detailOt}
      />

      <EtiquetasEntradaExpressDialog
        open={expressOpen}
        onOpenChange={(o) => {
          setExpressOpen(o);
          if (!o) setExpressPrefillOt(null);
        }}
        catalog={catalog}
        troqueles={troqueles}
        prefillOtNumero={expressPrefillOt}
        onSaved={() => void handleExpressSaved()}
        onAbrirExistente={() => {
          setExpressOpen(false);
          setExpressPrefillOt(null);
          void load();
        }}
      />

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="min-w-0 border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base text-[#002147]">
                  1 · Entrada OTs
                </CardTitle>
                <CardDescription className="text-xs">
                  Etiquetas en maestro activas en Optimus, entrega o apertura
                  desde {POOL_BANDEJA_FECHA_MINIMA.slice(8, 10)}/
                  {POOL_BANDEJA_FECHA_MINIMA.slice(5, 7)}/
                  {POOL_BANDEJA_FECHA_MINIMA.slice(0, 4)}, que Hugo aún no
                  tiene en hoja de ruta.
                </CardDescription>
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shrink-0"
                onClick={() => void load()}
                disabled={loading}
                title="Recargar"
              >
                <RefreshCw
                  className={cn("size-3.5", loading && "animate-spin")}
                />
              </Button>
            </div>
            <div className="relative pt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-8 pl-8 text-xs"
                placeholder="Buscar OT, cliente o trabajo…"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[min(70vh,36rem)] space-y-2 overflow-y-auto pt-0">
            {poolTableMissing ? (
              <p className="rounded-md border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                Falta la tabla{" "}
                <code className="rounded bg-white px-1 text-[10px]">
                  prod_etiquetas_pool_plan
                </code>{" "}
                en Supabase.
              </p>
            ) : null}
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="size-6 animate-spin" aria-hidden />
              </div>
            ) : candidatas.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No hay OTs nuevas en maestro para etiquetas digital.
              </p>
            ) : (
              candidatas.map((row) => (
                <CandidataCard
                  key={row.otNumero}
                  row={row}
                  onAdd={() => void handleAdd(row)}
                  onOtClick={() => setDetailOt(row.otNumero)}
                  adding={addingOt === row.otNumero}
                  disabled={poolTableMissing}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base text-[#002147]">
                  2 · Cola de ejecución
                </CardTitle>
                <CardDescription className="text-xs">
                  Rita ordena el backlog. Hugo selecciona una OT y pulsa{" "}
                  <strong>Iniciar</strong> → se abre la{" "}
                  <strong>entrada express</strong> con los datos cargados
                  (Kon/Troq/Num sin marcar).
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 gap-1 text-[11px]"
                disabled={loading || plan.length === 0}
                onClick={handleExportColaPdf}
                title="Descargar PDF de la cola"
              >
                <FileDown className="size-3.5" aria-hidden />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex max-h-[min(70vh,36rem)] flex-col gap-3 overflow-hidden pt-0">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader2 className="size-6 animate-spin" aria-hidden />
                </div>
              ) : plan.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Añade OTs desde la entrada izquierda.
                </p>
              ) : (
                plan.map((row, idx) => (
                  <PlanCard
                    key={row.id}
                    row={row}
                    selected={selectedOt === row.otNumero}
                    onSelect={() => setSelectedOt(row.otNumero)}
                    onOtClick={() => setDetailOt(row.otNumero)}
                    onRemove={() => void handleRemove(row)}
                    onMoveUp={() => void handleMove(row, "up")}
                    onMoveDown={() => void handleMove(row, "down")}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < plan.length - 1}
                    removing={removingId === row.id}
                  />
                ))
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 pt-3">
              <Button
                type="button"
                className="w-full gap-2 bg-[#002147]"
                disabled={
                  !selectedItem || poolTableMissing || loading || expressOpen
                }
                onClick={handleIniciar}
              >
                <Play className="size-4" aria-hidden />
                Iniciar OT seleccionada
              </Button>
              {selectedItem ? (
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  Abre entrada express para{" "}
                  <span className="font-mono">{selectedItem.otNumero}</span> —
                  revisa y guarda.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-base text-[#002147]">
              3 · En curso
            </CardTitle>
            <CardDescription className="text-xs">
              OTs activas en hoja de ruta. Semáforo I/T/N: verde cuando Hugo
              marca el paso en la pestaña Hoja de ruta. Al finalizar, desaparecen.
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[min(70vh,36rem)] space-y-2 overflow-y-auto pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="size-6 animate-spin" aria-hidden />
              </div>
            ) : enCurso.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Ninguna OT en curso. Hugo las inicia desde la cola.
              </p>
            ) : (
              enCurso.map((row) => (
                <EnCursoCard
                  key={row.hrId}
                  row={row}
                  onOtClick={() => setDetailOt(row.otNumero)}
                  onDevolver={() => void handleDevolverACola(row)}
                  devolviendo={devolviendoHrId === row.hrId}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
