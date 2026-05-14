"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { NativeSelect, type Option } from "@/components/ui/select-native";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  PROD_ETIQUETAS_TIPO_LINEA_VALUES,
  type ProdEtiquetasCatalogRow,
  type ProdEtiquetasTipoLinea,
} from "@/types/prod-etiquetas-catalogo";
import type {
  ProdEtiquetasCompraPrioridad,
  ProdEtiquetasCompraPropietario,
  ProdEtiquetasCompraRow,
} from "@/types/prod-etiquetas-compras";

const TABLE = "prod_etiquetas_compras";
const TABLE_COMUNICACION = "prod_etiquetas_compras_comunicacion";

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToDateInput(v: string | null | undefined): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type FormState = {
  producto: string;
  unidad: string;
  recibido: boolean;
  propietario: ProdEtiquetasCompraPropietario;
  fecha_pedido: string;
  fecha_llegada: string;
  equipo: string;
  tipo_linea: ProdEtiquetasTipoLinea;
  marca: string;
  prioridad: ProdEtiquetasCompraPrioridad;
};

function emptyForm(): FormState {
  return {
    producto: "",
    unidad: "1",
    recibido: false,
    propietario: "RITA",
    fecha_pedido: todayIsoDate(),
    fecha_llegada: "",
    equipo: "",
    tipo_linea: "ETIQUETAS",
    marca: "",
    prioridad: "MEDIA",
  };
}

function rowToForm(
  r: ProdEtiquetasCompraRow,
  marcaDefault: string
): FormState {
  return {
    producto: r.producto,
    unidad: String(r.unidad),
    recibido: r.recibido,
    propietario: r.propietario,
    fecha_pedido: isoToDateInput(r.fecha_pedido) || todayIsoDate(),
    fecha_llegada: isoToDateInput(r.fecha_llegada),
    equipo: r.equipo ?? "",
    tipo_linea: r.tipo_linea,
    marca: r.marca.trim() ? r.marca : marcaDefault,
    prioridad: r.prioridad,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ProdEtiquetasCompraRow | null;
  catalog: ProdEtiquetasCatalogRow[];
  onSaved: () => void;
};

export function EtiquetasCompraDialog({
  open,
  onOpenChange,
  row,
  catalog,
  onSaved,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const formId = useId();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [comunicacionExiste, setComunicacionExiste] = useState(false);
  /** Solo alta: tras guardar, vaciar formulario y seguir en el modal. */
  const [entradaMultiple, setEntradaMultiple] = useState(false);

  const labelsProducto = useMemo(
    () =>
      catalog
        .filter((c) => c.categoria === "producto" && c.activo)
        .map((c) => c.label),
    [catalog]
  );
  const labelsEquipo = useMemo(
    () =>
      catalog
        .filter((c) => c.categoria === "equipo" && c.activo)
        .map((c) => c.label),
    [catalog]
  );
  const marcasForTipo = useCallback(
    (tipo: ProdEtiquetasTipoLinea) =>
      catalog
        .filter(
          (c) =>
            c.categoria === "marca" && c.activo && (c.grupo ?? "") === tipo
        )
        .map((c) => c.label),
    [catalog]
  );

  const firstMarca = useCallback(
    (tipo: ProdEtiquetasTipoLinea) => marcasForTipo(tipo)[0] ?? "",
    [marcasForTipo]
  );

  useEffect(() => {
    if (!open || !row?.id) {
      setComunicacionExiste(false);
      return;
    }
    setComunicacionExiste(false);
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from(TABLE_COMUNICACION)
        .select("id")
        .contains("compra_ids", [row.id])
        .limit(1);
      if (cancelled) return;
      if (error) {
        console.warn("[etiquetas compras comunicacion]", error.message);
        setComunicacionExiste(false);
        return;
      }
      setComunicacionExiste((data?.length ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, row?.id, supabase]);

  useEffect(() => {
    if (!open) {
      setForm(null);
      setSaving(false);
      setDeleting(false);
      setComunicacionExiste(false);
      setEntradaMultiple(false);
      return;
    }
    if (row) {
      setForm(rowToForm(row, firstMarca(row.tipo_linea)));
    } else {
      const f = emptyForm();
      f.marca = firstMarca(f.tipo_linea);
      setForm(f);
    }
  }, [open, row?.id, firstMarca, row]);

  /** Incluye valor actual aunque ya no esté en catálogo (edición legado). */
  const marcaSelectOptions: Option[] = useMemo(() => {
    if (!form) return [];
    const base = marcasForTipo(form.tipo_linea).map((m) => ({
      value: m,
      label: m,
    }));
    if (form.marca.trim() && !base.some((o) => o.value === form.marca)) {
      return [
        { value: form.marca, label: `${form.marca} (actual)` },
        ...base,
      ];
    }
    return base;
  }, [form, marcasForTipo]);

  const submit = useCallback(async () => {
    if (!form) return;
    const producto = form.producto.trim();
    if (!producto) {
      toast.error("Indica el producto.");
      return;
    }
    const unidad = Math.max(1, Math.trunc(Number(form.unidad) || 1));
    const marca = form.marca.trim();
    if (!marca) {
      toast.error("Indica la marca.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        producto,
        unidad,
        recibido: form.recibido,
        propietario: form.propietario,
        fecha_pedido: form.fecha_pedido.trim() || todayIsoDate(),
        fecha_llegada: form.fecha_llegada.trim() || null,
        equipo: form.equipo.trim(),
        tipo_linea: form.tipo_linea,
        marca,
        prioridad: form.prioridad,
      };
      if (row) {
        const { error } = await supabase
          .from(TABLE)
          .update(payload)
          .eq("id", row.id);
        if (error) throw error;
        toast.success("Cambios guardados.");
        onSaved();
        onOpenChange(false);
      } else {
        const { error } = await supabase.from(TABLE).insert(payload);
        if (error) throw error;
        toast.success("Línea creada.");
        onSaved();
        if (entradaMultiple) {
          const next = emptyForm();
          next.marca = firstMarca(next.tipo_linea);
          setForm(next);
        } else {
          onOpenChange(false);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }, [entradaMultiple, firstMarca, form, onOpenChange, onSaved, row, supabase]);

  const remove = useCallback(async () => {
    if (!row) return;
    const riesgo = row.enviado || comunicacionExiste;
    const msg = riesgo
      ? "Esta línea está marcada como «enviada» por correo o tiene entradas en el historial de comunicaciones. Eliminarla no borrará el historial global del lote, pero perderás la fila en la tabla de compras. ¿Continuar?"
      : "¿Eliminar esta línea de compras? No se puede deshacer.";
    if (!window.confirm(msg)) {
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", row.id);
      if (error) throw error;
      toast.success("Eliminada.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setDeleting(false);
    }
  }, [comunicacionExiste, onOpenChange, onSaved, row, supabase]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,860px)] max-w-[min(96vw,560px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onKeyDown={(e) => {
          if (
            e.key === "Enter" &&
            (e.ctrlKey || e.metaKey) &&
            !saving &&
            !deleting &&
            form
          ) {
            e.preventDefault();
            void submit();
          }
        }}
      >
        {!form ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-600">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Cargando…
          </div>
        ) : (
          <>
            <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
              <DialogTitle className="text-base text-[#002147]">
                {row ? "Editar compra" : "Nueva línea de compra"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {row ? "Modifica y guarda." : "Alta rápida."}{" "}
                <kbd className="rounded bg-slate-100 px-1 font-mono text-[10px]">
                  Ctrl+Enter
                </kbd>{" "}
                para guardar.
              </DialogDescription>
            </DialogHeader>

            <div className="grid max-h-[min(70vh,640px)] gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2 sm:px-5">
              <div className="grid gap-1 sm:col-span-2">
                <Label htmlFor={`${formId}-prod`} className="text-xs">
                  Producto
                </Label>
                <Input
                  id={`${formId}-prod`}
                  className="h-8 text-xs"
                  list={`${formId}-prod-dl`}
                  value={form.producto}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, producto: e.target.value } : f))
                  }
                />
                <datalist id={`${formId}-prod-dl`}>
                  {labelsProducto.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Unidad</Label>
                <Input
                  className="h-8 text-xs"
                  inputMode="numeric"
                  min={1}
                  value={form.unidad}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, unidad: e.target.value } : f))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Prioridad</Label>
                <NativeSelect
                  value={form.prioridad}
                  onChange={(e) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            prioridad: e.target
                              .value as ProdEtiquetasCompraPrioridad,
                          }
                        : f
                    )
                  }
                  options={[
                    { value: "ALTA", label: "Alta" },
                    { value: "MEDIA", label: "Media" },
                    { value: "BAJA", label: "Baja" },
                  ]}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Propietario</Label>
                <NativeSelect
                  value={form.propietario}
                  onChange={(e) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            propietario: e.target
                              .value as ProdEtiquetasCompraPropietario,
                          }
                        : f
                    )
                  }
                  options={[
                    { value: "RITA", label: "Rita" },
                    { value: "HUGO", label: "Hugo" },
                  ]}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="size-4 rounded border-slate-300 accent-[#002147]"
                    checked={form.recibido}
                    onChange={(e) =>
                      setForm((f) =>
                        f ? { ...f, recibido: e.target.checked } : f
                      )
                    }
                  />
                  Recibido
                </label>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Fecha pedido</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.fecha_pedido}
                  onChange={(e) =>
                    setForm((f) =>
                      f ? { ...f, fecha_pedido: e.target.value } : f
                    )
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Fecha llegada</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.fecha_llegada}
                  onChange={(e) =>
                    setForm((f) =>
                      f ? { ...f, fecha_llegada: e.target.value } : f
                    )
                  }
                />
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <Label className="text-xs">Equipo</Label>
                <Input
                  className="h-8 text-xs"
                  list={`${formId}-eq-dl`}
                  value={form.equipo}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, equipo: e.target.value } : f))
                  }
                />
                <datalist id={`${formId}-eq-dl`}>
                  {labelsEquipo.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Tipo de línea</Label>
                <NativeSelect
                  value={form.tipo_linea}
                  onChange={(e) => {
                    const tipo = e.target.value as ProdEtiquetasTipoLinea;
                    setForm((f) => {
                      if (!f) return f;
                      const nextMarca = marcasForTipo(tipo).includes(f.marca)
                        ? f.marca
                        : marcasForTipo(tipo)[0] ?? "";
                      return { ...f, tipo_linea: tipo, marca: nextMarca };
                    });
                  }}
                  options={PROD_ETIQUETAS_TIPO_LINEA_VALUES.map((t) => ({
                    value: t,
                    label: t,
                  }))}
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Marca</Label>
                {marcaSelectOptions.length > 0 ? (
                  <NativeSelect
                    value={
                      marcaSelectOptions.some((o) => o.value === form.marca)
                        ? form.marca
                        : marcaSelectOptions[0]!.value
                    }
                    onChange={(e) =>
                      setForm((f) =>
                        f ? { ...f, marca: e.target.value } : f
                      )
                    }
                    options={marcaSelectOptions}
                  />
                ) : (
                  <Input
                    className="h-8 text-xs"
                    value={form.marca}
                    onChange={(e) =>
                      setForm((f) => (f ? { ...f, marca: e.target.value } : f))
                    }
                    placeholder="Sin catálogo — escribe marca"
                  />
                )}
              </div>
            </div>

            <DialogFooter className="shrink-0 flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              {row ? (
                <Button
                  type="button"
                  variant="destructive"
                  className="order-2 w-full sm:order-1 sm:w-auto"
                  disabled={saving || deleting}
                  onClick={() => void remove()}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Eliminando…
                    </>
                  ) : (
                    "Eliminar"
                  )}
                </Button>
              ) : (
                <label
                  className="order-2 flex cursor-pointer items-center gap-2 self-start py-1 text-left text-xs text-slate-700 sm:order-1 sm:max-w-[14rem] sm:py-0"
                  title="Tras guardar, el formulario se vacía para dar de alta otra línea sin cerrar la ventana."
                >
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 rounded border-slate-300 accent-[#002147]"
                    checked={entradaMultiple}
                    onChange={(e) => setEntradaMultiple(e.target.checked)}
                  />
                  Entrada múltiple
                </label>
              )}
              <div className="order-1 flex w-full flex-col gap-2 sm:order-2 sm:w-auto sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={saving || deleting}
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  className="w-full bg-[#002147] sm:w-auto"
                  disabled={saving || deleting || !form}
                  onClick={() => void submit()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      Guardando…
                    </>
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
