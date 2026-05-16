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
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  ProdEtiquetasMaterialCatalogoRow,
  ProdEtiquetasMaterialMarca,
} from "@/types/prod-etiquetas-material-catalogo";

const TABLE = "prod_etiquetas_material_catalogo";

const MARCA_OPTIONS: Option[] = [
  { value: "ADESTOR", label: "Adestor" },
  { value: "FEDRIGONI", label: "Fedrigoni" },
];

type FormState = {
  marca: ProdEtiquetasMaterialMarca;
  categoria: string;
  item_number: string;
  face_name: string;
  adhesive: string;
  backing: string;
  price_m2: string;
  ean_code: string;
  notes: string;
  stock_dimensions: string;
  activo: boolean;
};

function emptyForm(): FormState {
  return {
    marca: "FEDRIGONI",
    categoria: "",
    item_number: "",
    face_name: "",
    adhesive: "",
    backing: "",
    price_m2: "",
    ean_code: "",
    notes: "",
    stock_dimensions: "",
    activo: true,
  };
}

function rowToForm(r: ProdEtiquetasMaterialCatalogoRow): FormState {
  return {
    marca: r.marca,
    categoria: r.categoria ?? "",
    item_number: r.item_number,
    face_name: r.face_name ?? "",
    adhesive: r.adhesive ?? "",
    backing: r.backing ?? "",
    price_m2: r.price_m2 != null ? String(r.price_m2) : "",
    ean_code: r.ean_code ?? "",
    notes: r.notes ?? "",
    stock_dimensions: r.stock_dimensions ?? "",
    activo: r.activo,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ProdEtiquetasMaterialCatalogoRow | null;
  onSaved: () => void;
};

export function EtiquetasMaterialDialog({
  open,
  onOpenChange,
  row,
  onSaved,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const formId = useId();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(null);
      return;
    }
    setForm(row ? rowToForm(row) : emptyForm());
  }, [open, row]);

  const submit = useCallback(async () => {
    if (!form) return;
    const item_number = form.item_number.trim();
    if (!item_number) {
      toast.error("Indica el código (Item Number).");
      return;
    }
    let price_m2: number | null = null;
    const priceRaw = form.price_m2.trim();
    if (priceRaw) {
      const n = Number.parseFloat(priceRaw.replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        toast.error("Precio no válido.");
        return;
      }
      price_m2 = n;
    }
    const payload = {
      marca: form.marca,
      categoria: form.categoria.trim() || null,
      item_number,
      face_name: form.face_name.trim() || null,
      adhesive: form.adhesive.trim() || null,
      backing: form.backing.trim() || null,
      price_m2,
      ean_code: form.ean_code.trim() || null,
      notes: form.notes.trim() || null,
      stock_dimensions: form.stock_dimensions.trim() || null,
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
        toast.success("Material actualizado.");
      } else {
        const { error } = await supabase.from(TABLE).insert(payload);
        if (error) throw error;
        toast.success("Material añadido al catálogo.");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }, [form, onOpenChange, onSaved, row, supabase]);

  const remove = useCallback(async () => {
    if (!row) return;
    if (!window.confirm("¿Eliminar esta fila del catálogo? No se puede deshacer.")) {
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
        throw new Error("No se eliminó. Comprueba permisos (admin/gerencia).");
      }
      toast.success("Eliminado.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setDeleting(false);
    }
  }, [onOpenChange, onSaved, row, supabase]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(92vh,860px)] max-w-[min(96vw,640px)] flex-col gap-0 overflow-hidden p-0"
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
                {row ? "Editar material" : "Nuevo material (catálogo)"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Códigos y referencias Adestor / Fedrigoni.{" "}
                <kbd className="rounded bg-slate-100 px-1 font-mono text-[10px]">
                  Ctrl+Enter
                </kbd>{" "}
                guardar.
              </DialogDescription>
            </DialogHeader>

            <div className="grid max-h-[min(70vh,640px)] gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2 sm:px-5">
              <div className="grid gap-1">
                <Label className="text-xs">Marca</Label>
                <NativeSelect
                  value={form.marca}
                  onChange={(e) =>
                    setForm((f) =>
                      f
                        ? {
                            ...f,
                            marca: e.target.value as ProdEtiquetasMaterialMarca,
                          }
                        : f
                    )
                  }
                  options={MARCA_OPTIONS}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`${formId}-item`} className="text-xs">
                  Código (Item Number) *
                </Label>
                <Input
                  id={`${formId}-item`}
                  className="h-8 font-mono text-xs"
                  value={form.item_number}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, item_number: e.target.value } : f))
                  }
                />
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <Label htmlFor={`${formId}-cat`} className="text-xs">
                  Categoría
                </Label>
                <Input
                  id={`${formId}-cat`}
                  className="h-8 text-xs"
                  value={form.categoria}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, categoria: e.target.value } : f))
                  }
                />
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <Label htmlFor={`${formId}-face`} className="text-xs">
                  Face name
                </Label>
                <Input
                  id={`${formId}-face`}
                  className="h-8 text-xs"
                  value={form.face_name}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, face_name: e.target.value } : f))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Adhesivo</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.adhesive}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, adhesive: e.target.value } : f))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Backing</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.backing}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, backing: e.target.value } : f))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Precio (€/m²)</Label>
                <Input
                  className="h-8 text-xs"
                  inputMode="decimal"
                  value={form.price_m2}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, price_m2: e.target.value } : f))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">EAN</Label>
                <Input
                  className="h-8 font-mono text-xs"
                  value={form.ean_code}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, ean_code: e.target.value } : f))
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Stock / ancho</Label>
                <Input
                  className="h-8 text-xs"
                  value={form.stock_dimensions}
                  onChange={(e) =>
                    setForm((f) =>
                      f ? { ...f, stock_dimensions: e.target.value } : f
                    )
                  }
                />
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <Label htmlFor={`${formId}-notes`} className="text-xs">
                  Notas
                </Label>
                <Textarea
                  id={`${formId}-notes`}
                  className="min-h-[4rem] text-xs"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, notes: e.target.value } : f))
                  }
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs sm:col-span-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300"
                  checked={form.activo}
                  onChange={(e) =>
                    setForm((f) => (f ? { ...f, activo: e.target.checked } : f))
                  }
                />
                Activo en consulta
              </label>
            </div>

            <DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
              {row ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={saving || deleting}
                  onClick={() => void remove()}
                >
                  {deleting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    "Eliminar"
                  )}
                </Button>
              ) : null}
              <div className="flex-1" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-[#002147]"
                disabled={saving || deleting}
                onClick={() => void submit()}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "Guardar"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
