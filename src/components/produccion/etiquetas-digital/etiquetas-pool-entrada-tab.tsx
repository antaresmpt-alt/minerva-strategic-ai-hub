"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EtiquetasHojaRutaDuplicadoDialog } from "@/components/produccion/etiquetas-digital/etiquetas-hoja-ruta-duplicado-dialog";
import { EtiquetasHojaRutaEditDialog } from "@/components/produccion/etiquetas-digital/etiquetas-hoja-ruta-edit-dialog";
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
import {
  addOtToPoolPlan,
  fetchEtiquetasPoolSnapshot,
  iniciarOtEnHojaRutaDesdePool,
  labelItinerarioEtiquetas,
  movePoolPlanItem,
  removeOtFromPoolPlan,
  type EtiquetasPoolCandidata,
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

type Props = {
  /** Tras iniciar, el padre puede cambiar de pestaña (p. ej. hoja de ruta). */
  onOtIniciada?: (row: ProdEtiquetasHojaRutaRow) => void;
};

function fmtEntrega(ymd: string | null): string {
  if (!ymd) return "—";
  return formatFechaEsCorta(ymd);
}

function CandidataCard({
  row,
  onAdd,
  adding,
  disabled,
}: {
  row: EtiquetasPoolCandidata;
  onAdd: () => void;
  adding: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-sm font-semibold text-[#002147]">
              {row.otNumero}
            </span>
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[10px] font-semibold"
              title="Itinerario etiquetas (I/T/N)"
            >
              {labelItinerarioEtiquetas(row.maquinas)}
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
          <p className="truncate text-[11px] text-slate-600" title={row.trabajo ?? ""}>
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
          title="Añadir al plan del día"
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
      <button
        type="button"
        className="w-full text-left"
        onClick={onSelect}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-sm font-semibold text-[#002147]">
            {row.otNumero}
          </span>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold">
            {labelItinerarioEtiquetas(row.maquinas)}
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
          title="Quitar del plan"
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

export function EtiquetasPoolEntradaTab({ onOtIniciada }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [candidatas, setCandidatas] = useState<EtiquetasPoolCandidata[]>([]);
  const [plan, setPlan] = useState<EtiquetasPoolPlanItem[]>([]);
  const [catalog, setCatalog] = useState<ProdEtiquetasCatalogRow[]>([]);
  const [troqueles, setTroqueles] = useState<ProdEtiquetasTroquelRow[]>([]);
  const [addingOt, setAddingOt] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedOt, setSelectedOt] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [editingRow, setEditingRow] = useState<ProdEtiquetasHojaRutaRow | null>(
    null,
  );
  const [duplicadosState, setDuplicadosState] = useState<{
    otNumero: string;
    rows: ProdEtiquetasHojaRutaRow[];
  } | null>(null);
  const [poolTableMissing, setPoolTableMissing] = useState(false);

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
      toast.success(`OT ${row.otNumero} añadida al plan.`);
      setSelectedOt(row.otNumero);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo añadir al plan."));
    } finally {
      setAddingOt(null);
    }
  };

  const handleRemove = async (item: EtiquetasPoolPlanItem) => {
    setRemovingId(item.poolId);
    try {
      await removeOtFromPoolPlan(supabase, item.poolId);
      toast.success(`OT ${item.otNumero} quitada del plan.`);
      if (selectedOt === item.otNumero) setSelectedOt(null);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo quitar del plan."));
    } finally {
      setRemovingId(null);
    }
  };

  const handleMove = async (
    item: EtiquetasPoolPlanItem,
    direction: "up" | "down",
  ) => {
    try {
      await movePoolPlanItem(supabase, item.poolId, direction, plan);
      await load();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo reordenar."));
    }
  };

  const handleIniciar = async () => {
    if (!selectedItem) {
      toast.error("Selecciona una OT del plan.");
      return;
    }
    if (!selectedItem.otGeneralId) {
      toast.error(
        "No hay datos de maestro para esta OT. Recarga o quítala del plan.",
      );
      return;
    }
    setIniciando(true);
    try {
      const row = await iniciarOtEnHojaRutaDesdePool(supabase, selectedItem);
      toast.success(`OT ${row.ot_numero} iniciada en hoja de ruta.`);
      setEditingRow(row);
      onOtIniciada?.(row);
      await load();
    } catch (e) {
      if (
        e instanceof Error &&
        e.message === "DUPLICADO_HR" &&
        "existentes" in e
      ) {
        const existentes = (e as Error & { existentes: ProdEtiquetasHojaRutaRow[] })
          .existentes;
        setDuplicadosState({
          otNumero: selectedItem.otNumero,
          rows: existentes,
        });
        return;
      }
      toast.error(errorMessageFromUnknown(e, "No se pudo iniciar la OT."));
    } finally {
      setIniciando(false);
    }
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
        onAbrirExistente={(row) => {
          setDuplicadosState(null);
          setEditingRow(row);
          onOtIniciada?.(row);
        }}
        onCancelar={() => setDuplicadosState(null)}
      />

      <EtiquetasHojaRutaEditDialog
        open={editingRow != null}
        onOpenChange={(o) => {
          if (!o) setEditingRow(null);
        }}
        row={editingRow}
        catalog={catalog}
        troqueles={troqueles}
        onSaved={() => {
          setEditingRow(null);
        }}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="min-w-0 border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base text-[#002147]">
                  Bandeja — candidatas
                </CardTitle>
                <CardDescription className="text-xs">
                  OTs etiqueta en maestro (itinerario I/T/N) que aún no están en
                  hoja de ruta. Sin filtro de despacho; se indica el estado.
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
                Falta aplicar la migración{" "}
                <code className="rounded bg-white px-1 text-[10px]">
                  prod_etiquetas_pool_plan
                </code>{" "}
                en Supabase. La bandeja se puede consultar cuando esté la tabla
                del plan del día.
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
                  adding={addingOt === row.otNumero}
                  disabled={poolTableMissing}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-slate-200/80 bg-white/90 shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-base text-[#002147]">
              Plan del día — pool para Hugo
            </CardTitle>
            <CardDescription className="text-xs">
              Rita ordena las OTs a realizar. Hugo selecciona una y pulsa{" "}
              <strong>Iniciar</strong> para abrir la hoja de ruta (como siempre).
              La entrada manual en la pestaña Hoja de ruta sigue disponible.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex max-h-[min(70vh,36rem)] flex-col gap-3 overflow-hidden pt-0">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader2 className="size-6 animate-spin" aria-hidden />
                </div>
              ) : plan.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Añade OTs desde la bandeja izquierda.
                </p>
              ) : (
                plan.map((row, idx) => (
                  <PlanCard
                    key={row.poolId}
                    row={row}
                    selected={selectedOt === row.otNumero}
                    onSelect={() => setSelectedOt(row.otNumero)}
                    onRemove={() => void handleRemove(row)}
                    onMoveUp={() => void handleMove(row, "up")}
                    onMoveDown={() => void handleMove(row, "down")}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < plan.length - 1}
                    removing={removingId === row.poolId}
                  />
                ))
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 pt-3">
              <Button
                type="button"
                className="w-full gap-2 bg-[#002147]"
                disabled={
                  !selectedItem || iniciando || poolTableMissing || loading
                }
                onClick={() => void handleIniciar()}
              >
                {iniciando ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Play className="size-4" aria-hidden />
                )}
                Iniciar OT seleccionada
              </Button>
              {selectedItem ? (
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  Se creará la fila en hoja de ruta y se abrirá el formulario de{" "}
                  <span className="font-mono">{selectedItem.otNumero}</span>.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
