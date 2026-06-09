"use client";

import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CajaRow = {
  id: string;
  codigo: string;
  descripcion: string | null;
  bultos_por_palet_default: number | null;
  con_logo: boolean | null;
  activo: boolean;
  orden: number;
  notas: string | null;
};

type CajaDraft = {
  codigo: string;
  descripcion: string;
  bultos_por_palet_default: string;
  con_logo: boolean;
  activo: boolean;
  orden: number;
};

function emptyDraft(): CajaDraft {
  return {
    codigo: "",
    descripcion: "",
    bultos_por_palet_default: "",
    con_logo: true,
    activo: true,
    orden: 0,
  };
}

function rowToDraft(r: CajaRow): CajaDraft {
  return {
    codigo: r.codigo,
    descripcion: r.descripcion ?? "",
    bultos_por_palet_default:
      r.bultos_por_palet_default != null ? String(r.bultos_por_palet_default) : "",
    con_logo: r.con_logo ?? false,
    activo: r.activo,
    orden: r.orden ?? 0,
  };
}

export function RecursosCajasEmbalajePanel() {
  const [rows, setRows] = useState<CajaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<CajaDraft>(emptyDraft);
  const [editing, setEditing] = useState<Record<string, CajaDraft>>({});

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/prod-cajas-embalaje");
      const data = (await res.json()) as { rows?: CajaRow[]; error?: string };
      if (!res.ok) {
        setLoadError(data.error ?? `Error ${res.status}`);
        setRows([]);
        return;
      }
      const next = Array.isArray(data.rows) ? data.rows : [];
      setRows(next);
      setEditing(Object.fromEntries(next.map((r) => [r.id, rowToDraft(r)])));
    } catch {
      setLoadError("No se pudieron cargar las cajas de embalaje.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const createOne = useCallback(async () => {
    if (!newDraft.codigo.trim()) {
      toast.error("El código es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/prod-cajas-embalaje", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDraft),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear la caja.");
        return;
      }
      toast.success("Caja creada.");
      setNewDraft(emptyDraft());
      await fetchRows();
    } catch {
      toast.error("No se pudo crear la caja.");
    } finally {
      setSaving(false);
    }
  }, [newDraft, fetchRows]);

  const saveOne = useCallback(
    async (id: string) => {
      const d = editing[id];
      if (!d) return;
      if (!d.codigo.trim()) {
        toast.error("El código es obligatorio.");
        return;
      }
      setSaving(true);
      try {
        const res = await fetch("/api/admin/prod-cajas-embalaje", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...d }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "No se pudo guardar.");
          return;
        }
        toast.success("Caja actualizada.");
        await fetchRows();
      } catch {
        toast.error("No se pudo guardar.");
      } finally {
        setSaving(false);
      }
    },
    [editing, fetchRows],
  );

  const deleteOne = useCallback(
    async (id: string) => {
      if (!window.confirm("¿Eliminar esta caja de embalaje?")) return;
      setSaving(true);
      try {
        const res = await fetch("/api/admin/prod-cajas-embalaje", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "No se pudo eliminar.");
          return;
        }
        toast.success("Caja eliminada.");
        await fetchRows();
      } catch {
        toast.error("No se pudo eliminar.");
      } finally {
        setSaving(false);
      }
    },
    [fetchRows],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Maestro de cajas de embalaje. El valor de <strong>bultos por palet</strong> es
        orientativo (lo aporta logística); se puede ajustar por OT en el proceso de
        Engomado.
      </p>

      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando cajas…
        </div>
      ) : null}

      <section className="space-y-3 rounded-md border border-slate-200 p-3">
        <h3 className="text-sm font-semibold">Nueva caja</h3>
        <div className="grid gap-2 md:grid-cols-6">
          <Input
            placeholder="Código (MN2L)"
            value={newDraft.codigo}
            onChange={(e) =>
              setNewDraft((p) => ({ ...p, codigo: e.target.value.toUpperCase() }))
            }
          />
          <Input
            className="md:col-span-2"
            placeholder="Descripción (incl. medidas)"
            value={newDraft.descripcion}
            onChange={(e) => setNewDraft((p) => ({ ...p, descripcion: e.target.value }))}
          />
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="Bultos/palet"
            value={newDraft.bultos_por_palet_default}
            onChange={(e) =>
              setNewDraft((p) => ({ ...p, bultos_por_palet_default: e.target.value }))
            }
          />
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newDraft.con_logo}
              onChange={(e) => setNewDraft((p) => ({ ...p, con_logo: e.target.checked }))}
            />
            Con logo
          </label>
          <Button type="button" onClick={() => void createOne()} disabled={saving}>
            <Plus className="mr-1 size-4" /> Crear
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Cajas existentes</h3>
        {rows.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">Sin cajas registradas.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const d = editing[r.id];
              if (!d) return null;
              return (
                <div key={r.id} className="rounded-md border border-slate-200 p-3">
                  <div className="grid items-center gap-2 md:grid-cols-8">
                    <Input
                      className="font-mono"
                      value={d.codigo}
                      onChange={(e) =>
                        setEditing((p) => ({
                          ...p,
                          [r.id]: { ...p[r.id]!, codigo: e.target.value.toUpperCase() },
                        }))
                      }
                      placeholder="Código"
                    />
                    <Input
                      className="md:col-span-3"
                      value={d.descripcion}
                      onChange={(e) =>
                        setEditing((p) => ({
                          ...p,
                          [r.id]: { ...p[r.id]!, descripcion: e.target.value },
                        }))
                      }
                      placeholder="Descripción"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={d.bultos_por_palet_default}
                      onChange={(e) =>
                        setEditing((p) => ({
                          ...p,
                          [r.id]: {
                            ...p[r.id]!,
                            bultos_por_palet_default: e.target.value,
                          },
                        }))
                      }
                      placeholder="Bultos/palet"
                    />
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={d.con_logo}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [r.id]: { ...p[r.id]!, con_logo: e.target.checked },
                          }))
                        }
                      />
                      Logo
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={d.activo}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [r.id]: { ...p[r.id]!, activo: e.target.checked },
                          }))
                        }
                      />
                      Activa
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveOne(r.id)}
                        disabled={saving}
                      >
                        <Save className="mr-1 size-4" /> Guardar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => void deleteOne(r.id)}
                        disabled={saving}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
