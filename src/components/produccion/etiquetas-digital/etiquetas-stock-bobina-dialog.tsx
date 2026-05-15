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
import { Textarea } from "@/components/ui/textarea";
import {
  catalogLabels,
  ETIQUETAS_CATALOG_PAPEL,
} from "@/lib/etiquetas-catalogo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdEtiquetasCatalogRow } from "@/types/prod-etiquetas-catalogo";
import type { ProdEtiquetasStockBobinaRow } from "@/types/prod-etiquetas-stock-bobinas";

const TABLE = "prod_etiquetas_stock_bobinas";

type FormState = {
  papel: string;
  fabricante: string;
  codigo: string;
  unidades_stock: string;
  fecha_pedido: string;
  fecha_recepcion: string;
  ancho_mm: string;
  ubicacion: string;
  notas: string;
  activo: boolean;
};

function emptyForm(): FormState {
  return {
    papel: "",
    fabricante: "",
    codigo: "",
    unidades_stock: "0",
    fecha_pedido: "",
    fecha_recepcion: "",
    ancho_mm: "",
    ubicacion: "",
    notas: "",
    activo: true,
  };
}

function isoToDateInput(v: string | null | undefined): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

function rowToForm(r: ProdEtiquetasStockBobinaRow): FormState {
  return {
    papel: r.papel,
    fabricante: r.fabricante ?? "",
    codigo: r.codigo ?? "",
    unidades_stock: String(r.unidades_stock),
    fecha_pedido: isoToDateInput(r.fecha_pedido),
    fecha_recepcion: isoToDateInput(r.fecha_recepcion),
    ancho_mm: r.ancho_mm != null ? String(r.ancho_mm) : "",
    ubicacion: r.ubicacion ?? "",
    notas: r.notas ?? "",
    activo: r.activo,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ProdEtiquetasStockBobinaRow | null;
  catalog: ProdEtiquetasCatalogRow[];
  onSaved: () => void;
};

export function EtiquetasStockBobinaDialog({
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

  const labelsPapel = useMemo(
    () => catalogLabels(catalog, ETIQUETAS_CATALOG_PAPEL),
    [catalog]
  );
  const labelsFabricante = useMemo(
    () =>
      catalog
        .filter(
          (c) =>
            c.categoria === "marca" &&
            c.activo &&
            (c.grupo ?? "") === "ETIQUETAS"
        )
        .map((c) => c.label)
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a.localeCompare(b, "es")),
    [catalog]
  );

  useEffect(() => {
    if (!open) {
      setForm(null);
      setSaving(false);
      setDeleting(false);
      return;
    }
    setForm(row ? rowToForm(row) : emptyForm());
  }, [open, row]);

  const submit = useCallback(async () => {
    if (!form) return;
    const papel = form.papel.trim();
    if (!papel) {
      toast.error("Indica el papel / material.");
      return;
    }
    const unidades = Math.max(0, Math.trunc(Number(form.unidades_stock) || 0));
    const anchoRaw = form.ancho_mm.trim().replace(",", ".");
    const ancho_mm =
      anchoRaw === ""
        ? null
        : (() => {
            const n = Number(anchoRaw);
            return Number.isFinite(n) && n > 0 ? n : null;
          })();
    if (anchoRaw !== "" && ancho_mm == null) {
      toast.error("Ancho (mm) no válido.");
      return;
    }

    const payload = {
      papel,
      fabricante: form.fabricante.trim(),
      codigo: form.codigo.trim(),
      unidades_stock: unidades,
      fecha_pedido: form.fecha_pedido.trim() || null,
      fecha_recepcion: form.fecha_recepcion.trim() || null,
      ancho_mm,
      ubicacion: form.ubicacion.trim() || null,
      notas: form.notas.trim() || null,
      activo: form.activo,
    };

    setSaving(true);
    try {
      if (row) {
        const { error } = await supabase
          .from(TABLE)
          .update(payload)
          .eq("id", row.id);
        if (error) throw error;
        toast.success("Stock actualizado.");
      } else {
        const { error } = await supabase.from(TABLE).insert(payload);
        if (error) throw error;
        toast.success("Artículo de stock creado.");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo guardar.";
      if (msg.toLowerCase().includes("unique") || msg.includes("duplicate")) {
        toast.error(
          "Ya existe un registro con el mismo papel, fabricante y código."
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }, [form, onOpenChange, onSaved, row, supabase]);

  const remove = useCallback(async () => {
    if (!row) return;
    if (
      !window.confirm(
        "¿Eliminar este artículo del stock? No se puede deshacer."
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .delete()
        .eq("id", row.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) {
        throw new Error(
          "No se eliminó ningún registro. Comprueba permisos o actualiza la página."
        );
      }
      toast.success("Eliminado.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo eliminar el registro."
      );
    } finally {
      setDeleting(false);
    }
  }, [onOpenChange, onSaved, row, supabase]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,820px)] max-w-[min(96vw,560px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
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
        {form ? (
          <>
            <DialogHeader className="border-b border-slate-200/80 px-4 py-3 sm:px-5">
              <DialogTitle className="text-base text-[#002147]">
                {row ? "Editar stock" : "Nuevo artículo en stock"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Unidad: rollos. Ctrl+Enter para guardar.
              </DialogDescription>
            </DialogHeader>

            <div className="grid max-h-[min(70vh,560px)] gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2 sm:px-5">
              <div className="grid gap-1 sm:col-span-2">
                <Label htmlFor={`${formId}-papel`} className="text-xs">
                  Papel / material
                </Label>
                <Input
                  id={`${formId}-papel`}
                  className="h-8 text-xs"
                  list={`${formId}-papel-dl`}
                  value={form.papel}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, papel: e.target.value } : f))
                  }
                />
                <datalist id={`${formId}-papel-dl`}>
                  {labelsPapel.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`${formId}-fab`} className="text-xs">
                  Fabricante
                </Label>
                <Input
                  id={`${formId}-fab`}
                  className="h-8 text-xs"
                  list={`${formId}-fab-dl`}
                  value={form.fabricante}
                  onChange={(e) =>
                    setForm((f) =>
                      f ? { ...f, fabricante: e.target.value } : f
                    )
                  }
                />
                <datalist id={`${formId}-fab-dl`}>
                  {labelsFabricante.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`${formId}-cod`} className="text-xs">
                  Código
                </Label>
                <Input
                  id={`${formId}-cod`}
                  className="h-8 text-xs"
                  value={form.codigo}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, codigo: e.target.value } : f))
                  }
                  placeholder="Ref. proveedor"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Rollos en stock</Label>
                <Input
                  className="h-8 text-xs"
                  inputMode="numeric"
                  min={0}
                  value={form.unidades_stock}
                  onChange={(e) =>
                    setForm((f) =>
                      f ? { ...f, unidades_stock: e.target.value } : f
                    )
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Ancho (mm)</Label>
                <Input
                  className="h-8 text-xs"
                  inputMode="decimal"
                  value={form.ancho_mm}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, ancho_mm: e.target.value } : f))
                  }
                  placeholder="Opcional"
                />
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
                <Label className="text-xs">Fecha recepción</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.fecha_recepcion}
                  onChange={(e) =>
                    setForm((f) =>
                      f ? { ...f, fecha_recepcion: e.target.value } : f
                    )
                  }
                />
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <Label className="text-xs">Ubicación</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.ubicacion}
                  onChange={(e) =>
                    setForm((f) =>
                      f ? { ...f, ubicacion: e.target.value } : f
                    )
                  }
                  placeholder="Estantería, máquina…"
                />
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <Label className="text-xs">Notas</Label>
                <Textarea
                  className="min-h-[4rem] text-xs"
                  value={form.notas}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, notas: e.target.value } : f))
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-xs sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) =>
                    setForm((f) =>
                      f ? { ...f, activo: e.target.checked } : f
                    )
                  }
                  className="size-3.5 rounded border-slate-300"
                />
                Activo (visible en listado)
              </label>
            </div>

            <DialogFooter className="flex flex-col-reverse gap-2 border-t border-slate-200/80 px-4 py-3 sm:flex-row sm:justify-between sm:px-5">
              {row ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  disabled={saving || deleting}
                  onClick={() => void remove()}
                >
                  {deleting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    "Eliminar"
                  )}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving || deleting}
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving || deleting}
                  onClick={() => void submit()}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    "Guardar"
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
