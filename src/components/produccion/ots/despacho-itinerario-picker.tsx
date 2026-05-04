"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GripVertical, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProdProcesoCatRow, ProdRutaPlantillaRow } from "@/types/prod-rutas-plantilla";

export type DespachoItinerarioSlot = {
  key: string;
  procesoId: number;
  nombre: string;
};

function newSlot(p: ProdProcesoCatRow): DespachoItinerarioSlot {
  return {
    key: crypto.randomUUID(),
    procesoId: p.id,
    nombre: p.nombre,
  };
}

function SortablePasoRow({
  slot,
  disabled,
  onRemove,
}: {
  slot: DespachoItinerarioSlot;
  disabled?: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.key, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1.5 rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px]",
        isDragging && "z-10 opacity-90 ring-1 ring-[#C69C2B]/50",
      )}
    >
      {disabled ? (
        <span
          className="inline-flex size-3.5 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-[9px] font-semibold text-slate-500"
          aria-hidden
        >
          ·
        </span>
      ) : (
        <button
          type="button"
          className="touch-none text-slate-400 hover:text-slate-700"
          aria-label="Arrastrar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-3.5 shrink-0" />
        </button>
      )}
      <span className="min-w-0 flex-1 truncate font-medium text-[#002147]">
        {slot.nombre}
      </span>
      {!disabled ? (
        <button
          type="button"
          className="rounded p-0.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
          aria-label="Quitar"
          onClick={onRemove}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

type Props = {
  open: boolean;
  supabase: SupabaseClient;
  disabled?: boolean;
  slots: DespachoItinerarioSlot[];
  onSlotsChange: (next: DespachoItinerarioSlot[]) => void;
};

export function DespachoItinerarioPicker({
  open,
  supabase,
  disabled,
  slots,
  onSlotsChange,
}: Props) {
  const [procesos, setProcesos] = useState<ProdProcesoCatRow[]>([]);
  const [plantillas, setPlantillas] = useState<ProdRutaPlantillaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const slotIds = useMemo(() => slots.map((s) => s.key), [slots]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    if (disabled) {
      setProcesos([]);
      setPlantillas([]);
      setLoadErr(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setLoadErr(null);
    void (async () => {
      try {
        const [rP, rT] = await Promise.all([
          supabase
            .from("prod_procesos_cat")
            .select("id, nombre, seccion_slug, es_externo, orden_sugerido, activo")
            .order("orden_sugerido", { ascending: true, nullsFirst: false })
            .order("nombre"),
          supabase
            .from("prod_rutas_plantilla")
            .select("id, nombre, descripcion, activo, creado_at")
            .or("activo.eq.true,activo.is.null")
            .order("nombre"),
        ]);
        if (cancelled) return;
        let errMsg: string | null = null;
        if (rP.error) {
          errMsg = rP.error.message;
          setProcesos([]);
        } else {
          setProcesos((rP.data ?? []) as ProdProcesoCatRow[]);
        }
        if (rT.error) {
          errMsg = errMsg
            ? `${errMsg}; ${rT.error.message}`
            : rT.error.message;
          setPlantillas([]);
        } else {
          setPlantillas((rT.data ?? []) as ProdRutaPlantillaRow[]);
        }
        setLoadErr(errMsg);
      } catch {
        if (!cancelled) setLoadErr("No se pudieron cargar plantillas/procesos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [disabled, open, supabase]);

  const loadPlantillaPasos = useCallback(
    async (plantillaId: string) => {
      const { data: pasosRows, error } = await supabase
        .from("prod_rutas_plantilla_pasos")
        .select("proceso_id, orden")
        .eq("plantilla_id", plantillaId)
        .order("orden", { ascending: true });
      if (error) {
        setLoadErr(error.message);
        return;
      }
      const ids = [...new Set((pasosRows ?? []).map((r) => r.proceso_id as number))];
      const nombreById = new Map<number, string>();
      for (const p of procesos) {
        nombreById.set(p.id, p.nombre);
      }
      if (ids.some((id) => !nombreById.has(id))) {
        const { data: cats } = await supabase
          .from("prod_procesos_cat")
          .select("id, nombre")
          .in("id", ids);
        for (const c of cats ?? []) {
          nombreById.set(c.id as number, String(c.nombre ?? ""));
        }
      }
      const next: DespachoItinerarioSlot[] = (pasosRows ?? []).map((row) => ({
        key: crypto.randomUUID(),
        procesoId: row.proceso_id as number,
        nombre: nombreById.get(row.proceso_id as number) ?? `Proceso #${row.proceso_id}`,
      }));
      onSlotsChange(next);
    },
    [onSlotsChange, procesos, supabase],
  );

  const appendProceso = useCallback(
    (p: ProdProcesoCatRow) => {
      onSlotsChange([...slots, newSlot(p)]);
    },
    [onSlotsChange, slots],
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIndex = slots.findIndex((x) => x.key === active.id);
      const newIndex = slots.findIndex((x) => x.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      onSlotsChange(arrayMove(slots, oldIndex, newIndex));
    },
    [onSlotsChange, slots],
  );

  if (!open) return null;

  const readOnly = !!disabled;

  return (
    <div className="space-y-2 border-t border-slate-200 pt-3 sm:col-span-2">
      <p className="text-xs font-semibold text-[#002147]">
        {readOnly ? "Itinerario (solo lectura)" : "Itinerario (opcional)"}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {readOnly
          ? "Refleja el orden actual guardado en base de datos. No se puede modificar porque ya hay pasos iniciados o finalizados."
          : "Define el orden de procesos para esta OT. Si lo dejas vacío, solo se registra el despacho técnico."}
      </p>
      {loadErr ? (
        <p className="text-[11px] text-destructive" role="alert">
          {loadErr}
        </p>
      ) : null}
      {!readOnly && loading ? (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Cargando procesos…
        </div>
      ) : null}

      {readOnly ? (
        <div className="flex min-h-0 flex-col space-y-1 rounded border border-slate-200 bg-slate-50/40 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Orden actual
          </p>
          <div className="flex max-h-40 min-h-[5.625rem] flex-col gap-1 overflow-y-auto overscroll-contain rounded border border-dashed border-slate-200 bg-white p-1 pb-3 pr-2 [scrollbar-gutter:stable]">
            {slots.length === 0 ? (
              <p className="py-2 text-center text-[10px] text-muted-foreground">
                Sin pasos
              </p>
            ) : (
              slots.map((slot, idx) => (
                <div
                  key={slot.key}
                  className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px]"
                >
                  <span className="inline-flex min-w-[1.1rem] justify-center font-mono text-[10px] font-semibold text-slate-500">
                    {idx + 1}.
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-[#002147]">
                    {slot.nombre}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 gap-2 md:grid-cols-3 md:items-start">
          <div className="flex min-h-0 flex-col space-y-1 rounded border border-slate-200 bg-slate-50/60 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Plantillas
            </p>
            <div className="max-h-40 min-h-0 space-y-1 overflow-y-auto overscroll-contain pb-3 pr-2 [scrollbar-gutter:stable]">
              {plantillas.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">Sin plantillas.</p>
              ) : (
                plantillas.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => void loadPlantillaPasos(pl.id)}
                    className="w-full rounded px-1.5 py-1 text-left text-[10px] hover:bg-white"
                  >
                    {pl.nombre}
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-col space-y-1 rounded border border-slate-200 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Procesos
            </p>
            <div className="flex min-h-0 max-h-40 flex-wrap gap-1 overflow-y-auto overscroll-contain pb-3 pr-2 [scrollbar-gutter:stable]">
              {procesos.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  size="sm"
                  variant="secondary"
                  className={cn(
                    "h-auto min-h-7 max-w-full whitespace-normal px-1.5 py-0.5 text-[10px]",
                    p.activo === false && "opacity-50",
                  )}
                  onClick={() => appendProceso(p)}
                >
                  {p.nombre}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex min-h-0 flex-col space-y-1 rounded border border-slate-200 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Orden
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={slotIds} strategy={verticalListSortingStrategy}>
                <div className="flex max-h-40 min-h-[5.625rem] flex-col gap-1 overflow-y-auto overscroll-contain rounded border border-dashed border-slate-200 bg-white p-1 pb-3 pr-2 [scrollbar-gutter:stable]">
                  {slots.length === 0 ? (
                    <p className="py-2 text-center text-[10px] text-muted-foreground">
                      Vacío
                    </p>
                  ) : (
                    slots.map((slot, idx) => (
                      <SortablePasoRow
                        key={slot.key}
                        slot={{
                          ...slot,
                          nombre: `${idx + 1}. ${slot.nombre}`,
                        }}
                        disabled={false}
                        onRemove={() =>
                          onSlotsChange(slots.filter((s) => s.key !== slot.key))
                        }
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  );
}
