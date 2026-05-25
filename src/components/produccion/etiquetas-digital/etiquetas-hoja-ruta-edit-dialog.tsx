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
import {
  catalogLabels,
  ETIQUETAS_CATALOG_PAPEL,
} from "@/lib/etiquetas-catalogo";
import {
  findHojaRutaPorOtNumeroExcepto,
  normalizaOtNumero,
} from "@/lib/etiquetas-hoja-ruta-duplicados";
import { buildMaquinaFieldsForSaveFromForm } from "@/lib/etiquetas-hoja-ruta-maquina";
import { todayYmdLocal } from "@/lib/etiquetas-hoja-ruta-plazo";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdEtiquetasCatalogRow } from "@/types/prod-etiquetas-catalogo";
import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";

const TABLE_HR = "prod_etiquetas_hoja_ruta";

function isoToDateInput(v: string | null | undefined): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseOptionalInt(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseOptionalDecimal(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type EditForm = {
  ot_numero: string;
  cliente: string;
  trabajo: string;
  papel: string;
  cantidad: string;
  fecha_entrega_ot: string;
  fecha_entrada_depto: string;
  urgencia: "normal" | "urgente";
  observacion: string;
  konica: boolean;
  troqueladora: boolean;
  numeradora: boolean;
  fecha_fin_konica: string;
  fecha_fin_troqueladora: string;
  fecha_fin_numeradora: string;
  metros_impresion: string;
  troquel_utillaje: string;
  fecha_inicio_produccion: string;
  fecha_fin_produccion: string;
  cajas: string;
  bobinas: string;
  etiquetas: string;
  cajas_restantes: string;
  finalizado: boolean;
};

function rowToForm(r: ProdEtiquetasHojaRutaRow): EditForm {
  return {
    ot_numero: String(r.ot_numero ?? "").trim(),
    cliente: String(r.cliente ?? "").trim(),
    trabajo: String(r.trabajo ?? "").trim(),
    papel: String(r.papel ?? "").trim(),
    cantidad: r.cantidad == null ? "" : String(r.cantidad),
    fecha_entrega_ot: isoToDateInput(r.fecha_entrega_ot),
    fecha_entrada_depto: isoToDateInput(r.fecha_entrada_depto),
    urgencia: r.urgencia === "urgente" ? "urgente" : "normal",
    observacion: String(r.observacion ?? "").trim(),
    konica: Boolean(r.konica),
    troqueladora: Boolean(r.troqueladora),
    numeradora: Boolean(r.numeradora),
    fecha_fin_konica: isoToDateInput(r.fecha_fin_konica),
    fecha_fin_troqueladora: isoToDateInput(r.fecha_fin_troqueladora),
    fecha_fin_numeradora: isoToDateInput(r.fecha_fin_numeradora),
    metros_impresion:
      r.metros_impresion == null
        ? ""
        : String(r.metros_impresion).replace(".", ","),
    troquel_utillaje: String(r.troquel_utillaje ?? "").trim(),
    fecha_inicio_produccion: isoToDateInput(r.fecha_inicio_produccion),
    fecha_fin_produccion: isoToDateInput(r.fecha_fin_produccion),
    cajas: r.cajas == null ? "" : String(r.cajas),
    bobinas: r.bobinas == null ? "" : String(r.bobinas),
    etiquetas: r.etiquetas == null ? "" : String(r.etiquetas),
    cajas_restantes: String(r.cajas_restantes ?? "").trim(),
    finalizado: Boolean(r.finalizado),
  };
}

const URGENCIA_OPTS: Option[] = [
  { value: "normal", label: "Normal" },
  { value: "urgente", label: "Urgente" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: ProdEtiquetasHojaRutaRow | null;
  catalog: ProdEtiquetasCatalogRow[];
  onSaved: () => void;
};

export function EtiquetasHojaRutaEditDialog({
  open,
  onOpenChange,
  row,
  catalog,
  onSaved,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const formId = useId();
  const labelsPapel = useMemo(
    () => catalogLabels(catalog, ETIQUETAS_CATALOG_PAPEL),
    [catalog]
  );
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open && row) {
      setForm(rowToForm(row));
    } else {
      setForm(null);
    }
    if (!open) {
      setSaving(false);
      setDeleting(false);
    }
  }, [open, row?.id]);

  const submit = useCallback(async () => {
    if (!row || !form) return;
    const otNuevo = normalizaOtNumero(form.ot_numero);
    if (!otNuevo) {
      toast.error("El número de OT no puede estar vacío.");
      return;
    }
    const otOriginal = normalizaOtNumero(row.ot_numero);
    if (otNuevo !== otOriginal) {
      try {
        const otros = await findHojaRutaPorOtNumeroExcepto(
          supabase,
          otNuevo,
          row.id
        );
        if (otros.length > 0) {
          const ok = window.confirm(
            `Ya existe otra fila con OT ${otNuevo} (${otros.length} coincidencia${otros.length === 1 ? "" : "s"}). Si guardas, generarás un duplicado.\n\n¿Guardar de todos modos?`
          );
          if (!ok) return;
        }
      } catch (e) {
        toast.error(
          e instanceof Error
            ? `No se pudo comprobar duplicados: ${e.message}`
            : "No se pudo comprobar duplicados."
        );
        return;
      }
    }
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        ot_numero: otNuevo,
        cliente: form.cliente.trim() || null,
        trabajo: form.trabajo.trim() || null,
        papel: form.papel.trim() || null,
        cantidad: parseOptionalDecimal(form.cantidad),
        fecha_entrega_ot: form.fecha_entrega_ot.trim() || null,
        fecha_entrada_depto: form.fecha_entrada_depto.trim() || null,
        urgencia: form.urgencia,
        observacion: form.observacion.trim() || null,
        ...buildMaquinaFieldsForSaveFromForm(
          form.konica,
          form.troqueladora,
          form.numeradora,
          {
            fecha_fin_konica: form.fecha_fin_konica,
            fecha_fin_troqueladora: form.fecha_fin_troqueladora,
            fecha_fin_numeradora: form.fecha_fin_numeradora,
          },
          parseOptionalDecimal(form.metros_impresion)
        ),
        troquel_utillaje: form.troquel_utillaje.trim() || null,
        fecha_inicio_produccion: form.fecha_inicio_produccion.trim() || null,
        fecha_fin_produccion: form.fecha_fin_produccion.trim() || null,
        cajas: parseOptionalInt(form.cajas),
        bobinas: parseOptionalInt(form.bobinas),
        etiquetas: parseOptionalInt(form.etiquetas),
        cajas_restantes: form.cajas_restantes.trim() || null,
        finalizado: form.finalizado,
      };

      const { error } = await supabase
        .from(TABLE_HR)
        .update(patch)
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Cambios guardados.");
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo guardar la fila."
      );
    } finally {
      setSaving(false);
    }
  }, [form, onOpenChange, onSaved, row, supabase]);

  const remove = useCallback(async () => {
    if (!row) return;
    if (
      !window.confirm(
        "¿Eliminar este registro de la hoja de ruta? La acción no se puede deshacer."
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const { data, error } = await supabase
        .from(TABLE_HR)
        .delete()
        .eq("id", row.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) {
        throw new Error(
          "No se eliminó ningún registro. Comprueba permisos o actualiza la página."
        );
      }
      toast.success("Registro eliminado.");
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
        className="flex max-h-[min(94vh,900px)] max-w-[min(96vw,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
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
        {!row || !form ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-600">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Cargando…
          </div>
        ) : (
          <>
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
          <DialogTitle className="text-base text-[#002147]">
            Editar hoja de ruta · OT{" "}
            <span className="font-mono">{row.ot_numero}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Modifica los campos y guarda.{" "}
            <kbd className="rounded bg-slate-100 px-1 font-mono text-[10px]">
              Ctrl+Enter
            </kbd>{" "}
            para guardar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[min(78vh,720px)] gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2 sm:px-5">
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor={`${formId}-ot`} className="text-xs">
              OT (nº)
            </Label>
            <Input
              id={`${formId}-ot`}
              className="h-8 font-mono text-xs"
              value={form.ot_numero}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, ot_numero: e.target.value } : f))
              }
            />
            <p className="text-[10px] text-slate-500">
              Original:{" "}
              <span className="font-mono">{row.ot_numero}</span>. Al cambiar
              el número se avisará si ya existe otra fila con el mismo OT.
            </p>
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Cliente</Label>
            <Input
              className="h-8 text-xs"
              value={form.cliente}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, cliente: e.target.value } : f))
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Trabajo</Label>
            <Input
              className="h-8 text-xs"
              value={form.trabajo}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, trabajo: e.target.value } : f))
              }
            />
          </div>
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
            <Label className="text-xs">Cantidad</Label>
            <Input
              className="h-8 text-xs"
              inputMode="decimal"
              value={form.cantidad}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, cantidad: e.target.value } : f))
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Urgencia</Label>
            <NativeSelect
              value={form.urgencia}
              onChange={(e) =>
                setForm((f) =>
                  f
                    ? {
                        ...f,
                        urgencia: e.target.value as "normal" | "urgente",
                      }
                    : f
                )
              }
              options={URGENCIA_OPTS}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Fecha entrega OT</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={form.fecha_entrega_ot}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, fecha_entrega_ot: e.target.value } : f
                )
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Fecha entrada depto.</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={form.fecha_entrada_depto}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, fecha_entrada_depto: e.target.value } : f
                )
              }
            />
          </div>

          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor={`${formId}-obs`} className="text-xs">
              Observación
            </Label>
            <Textarea
              id={`${formId}-obs`}
              className="min-h-[4rem] text-xs"
              value={form.observacion}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, observacion: e.target.value } : f))
              }
            />
          </div>

          <div className="flex flex-wrap gap-4 sm:col-span-2">
            {(
              [
                ["konica", "Konica (imprimir)"],
                ["troqueladora", "Troqueladora"],
                ["numeradora", "Numeradora"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 text-xs"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-slate-300"
                  checked={form[key]}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const today = todayYmdLocal();
                    setForm((f) => {
                      if (!f) return f;
                      const fechaKey =
                        key === "konica"
                          ? "fecha_fin_konica"
                          : key === "troqueladora"
                            ? "fecha_fin_troqueladora"
                            : "fecha_fin_numeradora";
                      const next: EditForm = {
                        ...f,
                        [key]: checked,
                        [fechaKey]: checked
                          ? f[fechaKey].trim() || today
                          : "",
                      };
                      if (key === "konica" && !checked) {
                        next.metros_impresion = "";
                      }
                      return next;
                    });
                  }}
                />
                {label}
              </label>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 sm:col-span-2">
            Fechas de fin por proceso (calendario I / T / N).
          </p>
          <div className="grid gap-1">
            <Label className="text-xs">F. fin Konica (I)</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              disabled={!form.konica}
              value={form.fecha_fin_konica}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, fecha_fin_konica: e.target.value } : f
                )
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Metros impresión (Konica)</Label>
            <Input
              className="h-8 text-xs tabular-nums"
              inputMode="decimal"
              placeholder="Ej. 124,5"
              disabled={!form.konica}
              value={form.metros_impresion}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, metros_impresion: e.target.value } : f
                )
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">F. fin Troqueladora (T)</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              disabled={!form.troqueladora}
              value={form.fecha_fin_troqueladora}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, fecha_fin_troqueladora: e.target.value } : f
                )
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">F. fin Numeradora (N)</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              disabled={!form.numeradora}
              value={form.fecha_fin_numeradora}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, fecha_fin_numeradora: e.target.value } : f
                )
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Troquel (utillaje)</Label>
            <Input
              className="h-8 text-xs"
              value={form.troquel_utillaje}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, troquel_utillaje: e.target.value } : f
                )
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Finalizado</Label>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="size-4 rounded border-slate-300"
                checked={form.finalizado}
                onChange={(e) =>
                  setForm((f) =>
                    f ? { ...f, finalizado: e.target.checked } : f
                  )
                }
              />
              Marcar fila como cerrada
            </label>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">F. inicio producción</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={form.fecha_inicio_produccion}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, fecha_inicio_produccion: e.target.value } : f
                )
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">F. fin producción</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={form.fecha_fin_produccion}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, fecha_fin_produccion: e.target.value } : f
                )
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Cajas</Label>
            <Input
              className="h-8 text-xs"
              inputMode="numeric"
              value={form.cajas}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, cajas: e.target.value } : f))
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Bobinas</Label>
            <Input
              className="h-8 text-xs"
              inputMode="numeric"
              value={form.bobinas}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, bobinas: e.target.value } : f))
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Etiquetas</Label>
            <Input
              className="h-8 text-xs"
              inputMode="numeric"
              value={form.etiquetas}
              onChange={(e) =>
                setForm((f) => (f ? { ...f, etiquetas: e.target.value } : f))
              }
            />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label className="text-xs">Cajas restantes / notas</Label>
            <Input
              className="h-8 text-xs"
              value={form.cajas_restantes}
              onChange={(e) =>
                setForm((f) =>
                  f ? { ...f, cajas_restantes: e.target.value } : f
                )
              }
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Button
            type="button"
            variant="destructive"
            className="order-2 w-full sm:order-1 sm:w-auto"
            disabled={saving || deleting || !row}
            onClick={() => void remove()}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Eliminando…
              </>
            ) : (
              "Eliminar registro"
            )}
          </Button>
          <div className="order-1 flex w-full flex-col gap-2 sm:order-2 sm:w-auto sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
              disabled={saving || deleting}
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
