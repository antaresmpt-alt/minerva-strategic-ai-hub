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
import {
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ProdProcesoCatRow, ProdRutaPlantillaRow } from "@/types/prod-rutas-plantilla";

type ItinerarioSlot = {
  key: string;
  procesoId: number;
  nombre: string;
};

function newSlot(p: ProdProcesoCatRow): ItinerarioSlot {
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
  slot: ItinerarioSlot;
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
        "flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm shadow-sm",
        isDragging && "z-10 opacity-90 ring-2 ring-[#C69C2B]/50",
      )}
    >
      <button
        type="button"
        className="touch-none text-slate-400 hover:text-slate-700"
        aria-label="Arrastrar para reordenar"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="min-w-0 flex-1 truncate font-medium text-[#002147]">
        {slot.nombre}
      </span>
      <button
        type="button"
        className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"
        aria-label="Quitar paso"
        disabled={disabled}
        onClick={onRemove}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function RecursosPlantillasRutasPanel() {
  const [procesos, setProcesos] = useState<ProdProcesoCatRow[]>([]);
  const [plantillas, setPlantillas] = useState<ProdRutaPlantillaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [activo, setActivo] = useState(true);
  const [slots, setSlots] = useState<ItinerarioSlot[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const slotIds = useMemo(() => slots.map((s) => s.key), [slots]);

  const fetchCatalogos = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [resP, resT] = await Promise.all([
        fetch("/api/admin/prod-procesos-cat"),
        fetch("/api/admin/prod-rutas-plantilla"),
      ]);
      const dataP = (await resP.json()) as { rows?: ProdProcesoCatRow[]; error?: string };
      const dataT = (await resT.json()) as { rows?: ProdRutaPlantillaRow[]; error?: string };
      let err: string | null = null;
      if (!resP.ok) {
        err = dataP.error ?? `Procesos: error ${resP.status}`;
        setProcesos([]);
      } else {
        setProcesos(Array.isArray(dataP.rows) ? dataP.rows : []);
      }
      if (!resT.ok) {
        err = err
          ? `${err}; ${dataT.error ?? `Plantillas: error ${resT.status}`}`
          : (dataT.error ?? `Plantillas: error ${resT.status}`);
        setPlantillas([]);
      } else {
        setPlantillas(Array.isArray(dataT.rows) ? dataT.rows : []);
      }
      setLoadError(err);
    } catch {
      setLoadError("No se pudieron cargar catálogos.");
      setProcesos([]);
      setPlantillas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCatalogos();
  }, [fetchCatalogos]);

  const loadPlantilla = useCallback(async (id: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prod-rutas-plantilla/${id}`);
      const data = (await res.json()) as {
        plantilla?: ProdRutaPlantillaRow;
        pasos?: Array<{ proceso_id: number; nombre: string }>;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo cargar la plantilla.");
        return;
      }
      const p = data.plantilla;
      if (!p) return;
      setSelectedId(p.id);
      setNombre(p.nombre);
      setDescripcion(p.descripcion ?? "");
      setActivo(p.activo !== false);
      setSlots(
        (data.pasos ?? []).map((row) => ({
          key: crypto.randomUUID(),
          procesoId: row.proceso_id,
          nombre: row.nombre,
        })),
      );
    } catch {
      toast.error("No se pudo cargar la plantilla.");
    } finally {
      setSaving(false);
    }
  }, []);

  const nuevaPlantilla = useCallback(() => {
    setSelectedId(null);
    setNombre("");
    setDescripcion("");
    setActivo(true);
    setSlots([]);
  }, []);

  const appendProceso = useCallback((p: ProdProcesoCatRow) => {
    setSlots((prev) => [...prev, newSlot(p)]);
  }, []);

  const aplicarPlantillaRapida = useCallback(
    (id: string) => {
      void loadPlantilla(id);
    },
    [loadPlantilla],
  );

  const guardar = useCallback(async () => {
    const n = nombre.trim();
    if (!n) {
      toast.error("El nombre de la plantilla es obligatorio.");
      return;
    }
    if (slots.length === 0) {
      toast.error("Añade al menos un paso al itinerario.");
      return;
    }
    const pasos = slots.map((s) => s.procesoId);
    setSaving(true);
    try {
      const isNew = !selectedId;
      const res = await fetch(
        isNew ? "/api/admin/prod-rutas-plantilla" : `/api/admin/prod-rutas-plantilla/${selectedId}`,
        {
          method: isNew ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: n,
            descripcion: descripcion.trim() || null,
            activo,
            pasos,
          }),
        },
      );
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar.");
        return;
      }
      toast.success(isNew ? "Plantilla creada." : "Plantilla actualizada.");
      if (isNew && data.id) {
        setSelectedId(data.id);
      }
      await fetchCatalogos();
    } catch {
      toast.error("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }, [activo, descripcion, fetchCatalogos, nombre, selectedId, slots]);

  const eliminar = useCallback(async () => {
    if (!selectedId) return;
    if (!window.confirm("¿Eliminar esta plantilla y todos sus pasos?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prod-rutas-plantilla/${selectedId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo eliminar.");
        return;
      }
      toast.success("Plantilla eliminada.");
      nuevaPlantilla();
      await fetchCatalogos();
    } catch {
      toast.error("No se pudo eliminar.");
    } finally {
      setSaving(false);
    }
  }, [fetchCatalogos, nuevaPlantilla, selectedId]);

  const onDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSlots((items) => {
      const oldIndex = items.findIndex((x) => x.key === active.id);
      const newIndex = items.findIndex((x) => x.key === over.id);
      if (oldIndex < 0 || newIndex < 0) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  }, []);

  return (
    <div className="space-y-4">
      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando plantillas y procesos…
        </div>
      ) : null}

      <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,14rem)] lg:items-start">
        {/* Columna 1: plantillas guardadas */}
        <div className="flex min-h-0 flex-col space-y-2 rounded-md border border-slate-200 bg-slate-50/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Plantillas
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={nuevaPlantilla}
              disabled={saving}
            >
              <Plus className="mr-1 size-3" />
              Nueva
            </Button>
          </div>
          <div className="max-h-[min(28rem,62vh)] min-h-0 space-y-1 overflow-y-auto overscroll-contain pb-4 pr-2 [scrollbar-gutter:stable]">
            {plantillas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aún no hay plantillas.</p>
            ) : (
              plantillas.map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  onClick={() => void aplicarPlantillaRapida(pl.id)}
                  className={cn(
                    "w-full rounded-md border px-2 py-1.5 text-left text-xs transition-colors",
                    selectedId === pl.id
                      ? "border-[#C69C2B] bg-[#C69C2B]/15 font-medium text-[#002147]"
                      : "border-transparent bg-white hover:border-slate-200 hover:bg-white",
                    pl.activo === false && "opacity-60",
                  )}
                >
                  <span className="line-clamp-2">{pl.nombre}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Columna 2: procesos */}
        <div className="flex min-h-0 flex-col space-y-2 rounded-md border border-slate-200 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Procesos
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Pulsa para añadir al itinerario (columna derecha).
          </p>
          <div className="flex min-h-0 max-h-[min(28rem,62vh)] flex-wrap gap-1.5 overflow-y-auto overscroll-contain pb-4 pr-2 [scrollbar-gutter:stable]">
            {procesos.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant="secondary"
                className={cn(
                  "h-auto min-h-8 max-w-full whitespace-normal px-2 py-1 text-left text-xs",
                  p.activo === false && "opacity-50",
                )}
                disabled={saving}
                onClick={() => appendProceso(p)}
              >
                {p.nombre}
              </Button>
            ))}
          </div>
        </div>

        {/* Columna 3: orden */}
        <div className="flex min-h-0 flex-col space-y-2 rounded-md border border-slate-200 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Orden
          </h3>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={slotIds} strategy={verticalListSortingStrategy}>
              <div className="flex max-h-[min(22.5rem,56vh)] min-h-[10rem] flex-col gap-1.5 overflow-y-auto overscroll-contain rounded border border-dashed border-slate-200 bg-white p-2 pb-4 pr-2 [scrollbar-gutter:stable]">
                {slots.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Sin pasos. Añade procesos o carga una plantilla.
                  </p>
                ) : (
                  slots.map((slot, idx) => (
                    <SortablePasoRow
                      key={slot.key}
                      slot={{ ...slot, nombre: `${idx + 1}. ${slot.nombre}` }}
                      disabled={saving}
                      onRemove={() =>
                        setSlots((prev) => prev.filter((s) => s.key !== slot.key))
                      }
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-slate-200 p-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="tpl-nombre">Nombre plantilla</Label>
            <Input
              id="tpl-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Estuche plastificado"
              disabled={saving}
            />
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              disabled={saving}
            />
            Activa
          </label>
        </div>
        <div className="space-y-1">
          <Label htmlFor="tpl-desc">Descripción (opcional)</Label>
          <Textarea
            id="tpl-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            disabled={saving}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void guardar()} disabled={saving}>
            <Save className="mr-1 size-4" />
            {selectedId ? "Guardar cambios" : "Crear plantilla"}
          </Button>
          {selectedId ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => void eliminar()}
              disabled={saving}
            >
              <Trash2 className="mr-1 size-4" />
              Eliminar
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
