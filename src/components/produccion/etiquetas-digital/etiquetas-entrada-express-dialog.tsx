"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
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
import { buildMaquinaFieldsForSave } from "@/lib/etiquetas-hoja-ruta-maquina";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdEtiquetasCatalogRow } from "@/types/prod-etiquetas-catalogo";

const TABLE_OT = "prod_ots_general";
const TABLE_HR = "prod_etiquetas_hoja_ruta";

function fechaMaestroToYmd(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayYmd(): string {
  const d = new Date();
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

type ExpressForm = {
  ot_general_id: string | null;
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
  troquel_utillaje: string;
  fecha_inicio_produccion: string;
  fecha_fin_produccion: string;
  cajas: string;
  bobinas: string;
  etiquetas: string;
  cajas_restantes: string;
  finalizado: boolean;
};

function emptyForm(): ExpressForm {
  return {
    ot_general_id: null,
    ot_numero: "",
    cliente: "",
    trabajo: "",
    papel: "",
    cantidad: "",
    fecha_entrega_ot: "",
    fecha_entrada_depto: "",
    urgencia: "normal",
    observacion: "",
    konica: false,
    troqueladora: false,
    numeradora: false,
    troquel_utillaje: "",
    fecha_inicio_produccion: "",
    fecha_fin_produccion: "",
    cajas: "",
    bobinas: "",
    etiquetas: "",
    cajas_restantes: "",
    finalizado: false,
  };
}

const URGENCIA_OPTS: Option[] = [
  { value: "normal", label: "Normal" },
  { value: "urgente", label: "Urgente" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: ProdEtiquetasCatalogRow[];
  onSaved: () => void;
};

export function EtiquetasEntradaExpressDialog({
  open,
  onOpenChange,
  catalog,
  onSaved,
}: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const otInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const labelsPapel = useMemo(
    () => catalogLabels(catalog, ETIQUETAS_CATALOG_PAPEL),
    [catalog]
  );
  const [otInput, setOtInput] = useState("");
  const [loadingOt, setLoadingOt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ExpressForm>(() => emptyForm());
  const [entradaMultiple, setEntradaMultiple] = useState(false);

  useEffect(() => {
    if (!open) {
      setOtInput("");
      setForm(emptyForm());
      setEntradaMultiple(false);
      setLoadingOt(false);
      setSaving(false);
      return;
    }
    window.setTimeout(() => otInputRef.current?.focus(), 50);
  }, [open]);

  const hydrate = useCallback(async () => {
    const ot = otInput.trim();
    if (!ot) {
      toast.error("Indica un número de OT.");
      return;
    }
    setLoadingOt(true);
    try {
      const { data: master, error: errM } = await supabase
        .from(TABLE_OT)
        .select(
          "id, num_pedido, cliente, titulo, cantidad, fecha_entrega, familia, pedido_cliente"
        )
        .eq("num_pedido", ot)
        .maybeSingle();
      if (errM) throw errM;
      if (!master?.id) {
        toast.error(`No existe la OT ${ot} en el maestro.`);
        setForm(emptyForm());
        return;
      }
      const num = String(
        (master as { num_pedido?: string | null }).num_pedido ?? ot
      ).trim();
      const { data: exist, error: errE } = await supabase
        .from(TABLE_HR)
        .select("id, finalizado")
        .eq("ot_numero", num)
        .maybeSingle();
      if (errE) throw errE;
      if (exist && !(exist as { finalizado?: boolean }).finalizado) {
        toast.warning(
          `Ya existe una fila activa en hoja de ruta para OT ${num}. No se podrá guardar otra hasta finalizarla o borrarla.`
        );
      }

      const papelParts = [
        String((master as { familia?: string | null }).familia ?? "").trim(),
        String((master as { pedido_cliente?: string | null }).pedido_cliente ?? "").trim(),
      ].filter(Boolean);
      const papelGuess = papelParts.join(" · ");

      setForm({
        ...emptyForm(),
        ot_general_id: String(master.id),
        ot_numero: num,
        cliente: String(
          (master as { cliente?: string | null }).cliente ?? ""
        ).trim(),
        trabajo: String(
          (master as { titulo?: string | null }).titulo ?? ""
        ).trim(),
        papel: papelGuess,
        cantidad:
          (master as { cantidad?: number | null }).cantidad == null
            ? ""
            : String((master as { cantidad?: number | null }).cantidad),
        fecha_entrega_ot: fechaMaestroToYmd(
          (master as { fecha_entrega?: string | null }).fecha_entrega
        ),
        fecha_entrada_depto: todayYmd(),
      });
      toast.success(`OT ${num} cargada desde maestro.`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo cargar la OT."
      );
    } finally {
      setLoadingOt(false);
    }
  }, [otInput, supabase]);

  const submit = useCallback(async () => {
    const ot = form.ot_numero.trim();
    if (!ot) {
      toast.error("Carga una OT válida (Enter en el campo OT).");
      return;
    }
    setSaving(true);
    try {
      const { data: dup, error: errDup } = await supabase
        .from(TABLE_HR)
        .select("id")
        .eq("ot_numero", ot)
        .eq("finalizado", false)
        .maybeSingle();
      if (errDup) throw errDup;
      if (dup) {
        toast.error(
          `Ya hay una fila no finalizada para OT ${ot}. Finalízala o elimínala antes de crear otra.`
        );
        return;
      }

      const row: Record<string, unknown> = {
        ot_numero: ot,
        ot_general_id: form.ot_general_id,
        cliente: form.cliente.trim() || null,
        trabajo: form.trabajo.trim() || null,
        papel: form.papel.trim() || null,
        cantidad: parseOptionalDecimal(form.cantidad),
        fecha_entrega_ot: form.fecha_entrega_ot.trim() || null,
        fecha_entrada_depto: form.fecha_entrada_depto.trim() || null,
        urgencia: form.urgencia,
        observacion: form.observacion.trim() || null,
        ...buildMaquinaFieldsForSave(form.konica, form.troqueladora, form.numeradora, {
          fecha_fin_konica: null,
          fecha_fin_troqueladora: null,
          fecha_fin_numeradora: null,
        }),
        troquel_utillaje: form.troquel_utillaje.trim() || null,
        fecha_inicio_produccion: form.fecha_inicio_produccion.trim() || null,
        fecha_fin_produccion: form.fecha_fin_produccion.trim() || null,
        cajas: parseOptionalInt(form.cajas),
        bobinas: parseOptionalInt(form.bobinas),
        etiquetas: parseOptionalInt(form.etiquetas),
        cajas_restantes: form.cajas_restantes.trim() || null,
        finalizado: form.finalizado,
      };

      const { error } = await supabase.from(TABLE_HR).insert(row);
      if (error) {
        throw error;
      }
      toast.success(`OT ${ot} añadida a la hoja de ruta.`);
      onSaved();
      if (entradaMultiple) {
        setForm(emptyForm());
        setOtInput("");
        window.setTimeout(() => otInputRef.current?.focus(), 80);
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo guardar el registro."
      );
    } finally {
      setSaving(false);
    }
  }, [entradaMultiple, form, onOpenChange, onSaved, supabase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(94vh,900px)] max-w-[min(96vw,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !saving) {
            e.preventDefault();
            void submit();
          }
        }}
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 px-4 py-3 sm:px-5">
          <DialogTitle className="text-base text-[#002147]">
            Entrada express — Hoja de ruta
          </DialogTitle>
          <DialogDescription className="text-xs">
            Escribe el nº de OT y pulsa Enter para rellenar desde el maestro. Ajusta
            campos y pulsa Guardar o{" "}
            <kbd className="rounded bg-slate-100 px-1 font-mono text-[10px]">
              Ctrl+Enter
            </kbd>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[min(78vh,720px)] gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2 sm:px-5">
          <div className="grid gap-2 rounded-lg border border-[#C69C2B]/35 bg-amber-50/40 p-3 sm:col-span-2">
            <Label
              htmlFor={`${formId}-ot`}
              className="text-xs font-semibold text-[#002147]"
            >
              OT (maestro)
            </Label>
            <div className="flex gap-2">
              <Input
                id={`${formId}-ot`}
                ref={otInputRef}
                className="h-8 font-mono text-xs"
                value={otInput}
                onChange={(e) => setOtInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void hydrate();
                  }
                }}
                placeholder="Nº OT y Enter"
                autoComplete="off"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loadingOt || !otInput.trim()}
                onClick={() => void hydrate()}
              >
                {loadingOt ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "Cargar"
                )}
              </Button>
            </div>
            <p className="text-[11px] text-slate-600">
              Enter = cargar desde{" "}
              <code className="rounded bg-white/80 px-1">{TABLE_OT}</code> ·
              Ctrl+Enter = guardar en{" "}
              <code className="rounded bg-white/80 px-1">{TABLE_HR}</code>
            </p>
            {form.ot_numero ? (
              <p className="text-[11px] text-slate-700">
                <span className="font-semibold text-[#002147]">OT cargada:</span>{" "}
                <span className="font-mono">{form.ot_numero}</span>
              </p>
            ) : null}
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Cliente</Label>
            <Input
              className="h-8 text-xs"
              value={form.cliente}
              onChange={(e) =>
                setForm((f) => ({ ...f, cliente: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Trabajo (título)</Label>
            <Input
              className="h-8 text-xs"
              value={form.trabajo}
              onChange={(e) =>
                setForm((f) => ({ ...f, trabajo: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor={`${formId}-papel`} className="text-xs">
              Papel / material (editable)
            </Label>
            <Input
              id={`${formId}-papel`}
              className="h-8 text-xs"
              list={`${formId}-papel-dl`}
              value={form.papel}
              onChange={(e) => setForm((f) => ({ ...f, papel: e.target.value }))}
              placeholder="Sugerido desde familia / pedido cliente"
            />
            <datalist id={`${formId}-papel-dl`}>
              {labelsPapel.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Cantidad (etiquetas)</Label>
            <Input
              className="h-8 text-xs"
              inputMode="decimal"
              value={form.cantidad}
              onChange={(e) =>
                setForm((f) => ({ ...f, cantidad: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Urgencia</Label>
            <NativeSelect
              value={form.urgencia}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  urgencia: e.target.value as "normal" | "urgente",
                }))
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
                setForm((f) => ({ ...f, fecha_entrega_ot: e.target.value }))
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
                setForm((f) => ({
                  ...f,
                  fecha_entrada_depto: e.target.value,
                }))
              }
            />
          </div>

          <div className="grid gap-1 sm:col-span-2">
            <Label className="text-xs">Observación</Label>
            <Textarea
              className="min-h-[4rem] text-xs"
              value={form.observacion}
              onChange={(e) =>
                setForm((f) => ({ ...f, observacion: e.target.value }))
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
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.checked }))
                  }
                />
                {label}
              </label>
            ))}
          </div>

          <div className="grid gap-1">
            <Label className="text-xs">Troquel (utillaje)</Label>
            <Input
              className="h-8 text-xs"
              value={form.troquel_utillaje}
              onChange={(e) =>
                setForm((f) => ({ ...f, troquel_utillaje: e.target.value }))
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
                  setForm((f) => ({ ...f, finalizado: e.target.checked }))
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
                setForm((f) => ({
                  ...f,
                  fecha_inicio_produccion: e.target.value,
                }))
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
                setForm((f) => ({
                  ...f,
                  fecha_fin_produccion: e.target.value,
                }))
              }
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Cajas</Label>
            <Input
              className="h-8 text-xs"
              inputMode="numeric"
              value={form.cajas}
              onChange={(e) => setForm((f) => ({ ...f, cajas: e.target.value }))}
            />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs">Bobinas</Label>
            <Input
              className="h-8 text-xs"
              inputMode="numeric"
              value={form.bobinas}
              onChange={(e) =>
                setForm((f) => ({ ...f, bobinas: e.target.value }))
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
                setForm((f) => ({ ...f, etiquetas: e.target.value }))
              }
            />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label className="text-xs">Cajas restantes / notas</Label>
            <Input
              className="h-8 text-xs"
              value={form.cajas_restantes}
              onChange={(e) =>
                setForm((f) => ({ ...f, cajas_restantes: e.target.value }))
              }
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs sm:col-span-2">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300"
              checked={entradaMultiple}
              onChange={(e) => setEntradaMultiple(e.target.checked)}
            />
            Entrada múltiple (tras guardar se limpia el formulario y el foco vuelve al nº OT)
          </label>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#002147]"
            disabled={saving || !form.ot_numero.trim()}
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
