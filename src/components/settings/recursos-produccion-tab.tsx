"use client";

import { Loader2, Plus, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TipoMaquina = "impresion" | "troquelado" | "engomado";
type MaquinaRow = {
  id: string;
  codigo: string;
  nombre: string;
  tipo_maquina: TipoMaquina;
  activa: boolean;
  orden_visual: number;
  capacidad_horas_default_manana: number;
  capacidad_horas_default_tarde: number;
  notas: string | null;
};

const TIPOS: Array<{ id: TipoMaquina; label: string }> = [
  { id: "impresion", label: "Impresión" },
  { id: "troquelado", label: "Troquelado" },
  { id: "engomado", label: "Engomado" },
];

function emptyDraft(): Omit<MaquinaRow, "id"> {
  return {
    codigo: "",
    nombre: "",
    tipo_maquina: "impresion",
    activa: true,
    orden_visual: 0,
    capacidad_horas_default_manana: 8,
    capacidad_horas_default_tarde: 8,
    notas: "",
  };
}

export function RecursosProduccionTab() {
  const [rows, setRows] = useState<MaquinaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState<Record<string, Omit<MaquinaRow, "id">>>(
    {},
  );

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/prod-maquinas");
      const data = (await res.json()) as { rows?: MaquinaRow[]; error?: string };
      if (!res.ok) {
        setLoadError(data.error ?? `Error ${res.status}`);
        setRows([]);
        return;
      }
      const next = Array.isArray(data.rows) ? data.rows : [];
      setRows(next);
      setEditing(
        Object.fromEntries(
          next.map((r) => [
            r.id,
            {
              codigo: r.codigo,
              nombre: r.nombre,
              tipo_maquina: r.tipo_maquina,
              activa: r.activa,
              orden_visual: r.orden_visual,
              capacidad_horas_default_manana: Number(
                r.capacidad_horas_default_manana ?? 8,
              ),
              capacidad_horas_default_tarde: Number(
                r.capacidad_horas_default_tarde ?? 8,
              ),
              notas: r.notas ?? "",
            },
          ]),
        ),
      );
    } catch {
      setLoadError("No se pudo cargar recursos de producción.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const grouped = useMemo(() => {
    const map = new Map<TipoMaquina, MaquinaRow[]>();
    for (const t of TIPOS) map.set(t.id, []);
    for (const r of rows) map.get(r.tipo_maquina)?.push(r);
    return map;
  }, [rows]);

  const saveOne = useCallback(async (id: string) => {
    const d = editing[id];
    if (!d) return;
    if (!d.codigo.trim() || !d.nombre.trim()) {
      toast.error("Código y nombre son obligatorios.");
      return;
    }
    if (d.capacidad_horas_default_manana < 0 || d.capacidad_horas_default_tarde < 0) {
      toast.error("Las horas deben ser >= 0.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/prod-maquinas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...d }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Máquina actualizada.");
      await fetchRows();
    } catch {
      toast.error("No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }, [editing, fetchRows]);

  const createOne = useCallback(async () => {
    if (!newDraft.codigo.trim() || !newDraft.nombre.trim()) {
      toast.error("Código y nombre son obligatorios.");
      return;
    }
    if (
      newDraft.capacidad_horas_default_manana < 0 ||
      newDraft.capacidad_horas_default_tarde < 0
    ) {
      toast.error("Las horas deben ser >= 0.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/prod-maquinas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDraft),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear la máquina.");
        return;
      }
      toast.success("Máquina creada.");
      setNewDraft(emptyDraft());
      await fetchRows();
    } catch {
      toast.error("No se pudo crear la máquina.");
    } finally {
      setSaving(false);
    }
  }, [newDraft, fetchRows]);

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Recursos de Producción</CardTitle>
        <CardDescription>
          Configura máquinas por tipo y sus capacidades por defecto de turno.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadError ? (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando máquinas...
          </div>
        ) : null}

        <section className="space-y-3 rounded-md border border-slate-200 p-3">
          <h3 className="text-sm font-semibold">Nueva máquina</h3>
          <div className="grid gap-2 md:grid-cols-4">
            <Input
              placeholder="Código (ej. SM-CD102)"
              value={newDraft.codigo}
              onChange={(e) =>
                setNewDraft((p) => ({ ...p, codigo: e.target.value.toUpperCase() }))
              }
            />
            <Input
              placeholder="Nombre"
              value={newDraft.nombre}
              onChange={(e) => setNewDraft((p) => ({ ...p, nombre: e.target.value }))}
            />
            <select
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              value={newDraft.tipo_maquina}
              onChange={(e) =>
                setNewDraft((p) => ({
                  ...p,
                  tipo_maquina: e.target.value as TipoMaquina,
                }))
              }
            >
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="Orden visual"
              value={newDraft.orden_visual}
              onChange={(e) =>
                setNewDraft((p) => ({ ...p, orden_visual: Number(e.target.value) || 0 }))
              }
            />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="Horas mañana"
              value={newDraft.capacidad_horas_default_manana}
              onChange={(e) =>
                setNewDraft((p) => ({
                  ...p,
                  capacidad_horas_default_manana: Number(e.target.value) || 0,
                }))
              }
            />
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="Horas tarde"
              value={newDraft.capacidad_horas_default_tarde}
              onChange={(e) =>
                setNewDraft((p) => ({
                  ...p,
                  capacidad_horas_default_tarde: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <Textarea
            placeholder="Notas opcionales"
            value={newDraft.notas ?? ""}
            onChange={(e) => setNewDraft((p) => ({ ...p, notas: e.target.value }))}
          />
          <Button type="button" onClick={() => void createOne()} disabled={saving}>
            <Plus className="mr-1 size-4" /> Crear máquina
          </Button>
        </section>

        {TIPOS.map((tipo) => (
          <section key={tipo.id} className="space-y-3">
            <h3 className="text-sm font-semibold">{tipo.label}</h3>
            {(grouped.get(tipo.id) ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin máquinas en este tipo.</p>
            ) : (
              (grouped.get(tipo.id) ?? []).map((r) => {
                const d = editing[r.id];
                if (!d) return null;
                return (
                  <div key={r.id} className="space-y-2 rounded-md border border-slate-200 p-3">
                    <div className="grid gap-2 md:grid-cols-4">
                      <div className="space-y-1">
                        <Label>Código</Label>
                        <Input
                          value={d.codigo}
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [r.id]: { ...p[r.id]!, codigo: e.target.value.toUpperCase() },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Nombre</Label>
                        <Input
                          value={d.nombre}
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [r.id]: { ...p[r.id]!, nombre: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Orden</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={d.orden_visual}
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [r.id]: {
                                ...p[r.id]!,
                                orden_visual: Number(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </div>
                      <label className="mt-7 inline-flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={d.activa}
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [r.id]: { ...p[r.id]!, activa: e.target.checked },
                            }))
                          }
                        />
                        Activa
                      </label>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Horas mañana</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={d.capacidad_horas_default_manana}
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [r.id]: {
                                ...p[r.id]!,
                                capacidad_horas_default_manana: Number(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Horas tarde</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={d.capacidad_horas_default_tarde}
                          onChange={(e) =>
                            setEditing((p) => ({
                              ...p,
                              [r.id]: {
                                ...p[r.id]!,
                                capacidad_horas_default_tarde: Number(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Notas</Label>
                      <Textarea
                        value={d.notas ?? ""}
                        onChange={(e) =>
                          setEditing((p) => ({
                            ...p,
                            [r.id]: { ...p[r.id]!, notas: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <Button type="button" onClick={() => void saveOne(r.id)} disabled={saving}>
                      <Save className="mr-1 size-4" /> Guardar
                    </Button>
                  </div>
                );
              })
            )}
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
