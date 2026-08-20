"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { NativeSelect } from "@/components/ui/select-native";
import { Textarea } from "@/components/ui/textarea";
import { STOP_PENDIENTE_CORRECCION } from "@/lib/compras-material-estados";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const TABLE_COMPRA = "prod_compra_material";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";

export type ManualCompraInitialValues = {
  ot: string;
  posicion: string;
  proveedorId: string;
  material: string;
  gramaje: string;
  formato: string;
  hojasNetas: string;
  hojasBrutas: string;
  cliente: string;
  titulo: string;
  notasCompra: string;
  compraOrigenId?: string | null;
  motivoCorreccion?: string;
};

type ProveedorOption = { id: string; nombre: string };

function parseOptionalDecimalInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseOptionalIntInput(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizeOtNumeroInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return t.replace(/^ocm-/i, "").replace(/[^\d]/g, "").trim();
}

function buildNumCompraFromOt(otNumero: string): string {
  const ot = normalizeOtNumeroInput(otNumero);
  if (!ot) return "";
  return `OCM-${ot}`;
}

function buildNumCompraStockLibre(): string {
  const d = new Date();
  const ymd = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");
  const hm = [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
  ].join("");
  return `OCM-STOCK-${ymd}-${hm}`;
}

const EMPTY_FORM: ManualCompraInitialValues = {
  ot: "",
  posicion: "1",
  proveedorId: "",
  material: "",
  gramaje: "",
  formato: "",
  hojasNetas: "",
  hojasBrutas: "",
  cliente: "",
  titulo: "",
  notasCompra: "",
  compraOrigenId: null,
  motivoCorreccion: "",
};

/** Modal aislado: el estado del formulario no re-renderiza la tabla de compras al teclear. */
export function ComprasMaterialManualDialog({
  open,
  onOpenChange,
  isCorreccionFlow,
  initialValues,
  proveedores,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCorreccionFlow: boolean;
  initialValues: ManualCompraInitialValues | null;
  proveedores: ProveedorOption[];
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [saving, setSaving] = useState(false);
  const [keepOpen, setKeepOpen] = useState(true);
  const [esStockLibre, setEsStockLibre] = useState(false);
  const [numCompraManual, setNumCompraManual] = useState("");
  const [form, setForm] = useState<ManualCompraInitialValues>(EMPTY_FORM);

  useEffect(() => {
    if (!open) return;
    setForm(initialValues ?? EMPTY_FORM);
    setKeepOpen(true);
    setEsStockLibre(false);
    setNumCompraManual(buildNumCompraStockLibre());
  }, [open, initialValues]);

  const otNumero = normalizeOtNumeroInput(form.ot);
  const numCompra = esStockLibre
    ? numCompraManual.trim()
    : buildNumCompraFromOt(otNumero);
  const posicionTrim = form.posicion.trim();
  const posicionParsed = /^\d+$/.test(posicionTrim) ? Number(posicionTrim) : Number.NaN;
  const posicionValid =
    posicionTrim !== "" && Number.isInteger(posicionParsed) && posicionParsed >= 1;

  const patch = useCallback(
    (partial: Partial<ManualCompraInitialValues>) =>
      setForm((prev) => ({ ...prev, ...partial })),
    [],
  );

  const guardar = useCallback(async () => {
    const ot = esStockLibre ? null : normalizeOtNumeroInput(form.ot);
    const num = esStockLibre ? numCompraManual.trim() : buildNumCompraFromOt(form.ot);
    const proveedorId = form.proveedorId.trim();
    const material = form.material.trim();
    if (!posicionValid) {
      toast.error("Posición debe ser un entero mayor o igual que 1.");
      return;
    }
    if (!num || !proveedorId || !material) {
      toast.error(
        esStockLibre
          ? "Completa Nº compra, proveedor y material."
          : "Completa OT, Nº compra, proveedor y material.",
      );
      return;
    }
    if (!esStockLibre && !ot) {
      toast.error("Indica la OT o marca «Stock libre (sin OT)».");
      return;
    }

    setSaving(true);
    try {
      const gramaje = parseOptionalDecimalInput(form.gramaje);
      const tamanoHoja = form.formato.trim() || null;
      const numHojasNetas = parseOptionalIntInput(form.hojasNetas);
      const numHojasBrutas = parseOptionalIntInput(form.hojasBrutas);
      const notasBase = form.notasCompra.trim();
      const notasCompra = esStockLibre
        ? [notasBase, "[STOCK LIBRE — sin OT]"].filter(Boolean).join(" ")
        : notasBase || null;

      const insertPayload: Record<string, unknown> = {
        ot_numero: ot,
        num_compra: num,
        posicion: posicionParsed,
        cliente_nombre: form.cliente.trim() || null,
        trabajo_titulo: form.titulo.trim() || null,
        proveedor_id: proveedorId,
        material,
        gramaje,
        tamano_hoja: tamanoHoja,
        num_hojas_netas: numHojasNetas,
        num_hojas_brutas: numHojasBrutas,
        notas: notasCompra,
        estado: "Pendiente",
      };

      // 9.8.3: si es flujo de corrección, marcar tipo y origen.
      if (isCorreccionFlow) {
        insertPayload.tipo = "correccion";
        insertPayload.compra_origen_id = form.compraOrigenId ?? undefined;
        insertPayload.motivo = form.motivoCorreccion?.trim() || undefined;
      }

      const { error: insertErr } = await supabase.from(TABLE_COMPRA).insert(insertPayload);
      if (insertErr) throw insertErr;

      if (!esStockLibre && ot) {
        const despPayload: Record<string, unknown> = {
          material,
          gramaje,
          tamano_hoja: tamanoHoja,
          num_hojas_netas: numHojasNetas,
          num_hojas_brutas: numHojasBrutas,
        };
        if (isCorreccionFlow) {
          despPayload.estado_material = STOP_PENDIENTE_CORRECCION;
        }
        const { error: updDespErr } = await supabase
          .from(TABLE_DESPACHADAS)
          .update(despPayload)
          .eq("ot_numero", ot);
        if (updDespErr) throw updDespErr;
      }

      toast.success(
        esStockLibre
          ? "Compra de stock libre creada. Recibe en muelle y cartela sin OT."
          : isCorreccionFlow
            ? "Compra de corrección creada. OT marcada como «Pendiente compra de corrección»."
            : "Material guardado en compras con estado «Pendiente».",
      );
      onSaved();

      if (keepOpen) {
        setForm((prev) => ({
          ...prev,
          material: "",
          gramaje: "",
          formato: "",
          hojasNetas: "",
          hojasBrutas: "",
          notasCompra: "",
          posicion: String(posicionParsed + 1),
        }));
        if (esStockLibre) {
          setNumCompraManual(buildNumCompraStockLibre());
        }
      } else {
        onOpenChange(false);
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la compra.");
    } finally {
      setSaving(false);
    }
  }, [
    esStockLibre,
    form,
    isCorreccionFlow,
    keepOpen,
    numCompraManual,
    onOpenChange,
    onSaved,
    posicionParsed,
    posicionValid,
    supabase,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,700px)] max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-slate-100 px-4 py-3">
          <DialogTitle className="text-base">
            {isCorreccionFlow ? "Compra de corrección" : "Solicitar material"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Alta manual en <span className="font-mono">{TABLE_COMPRA}</span> con
            lógica multi-línea por OT, Nº compra y posición.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[min(62vh,560px)] gap-3 overflow-y-auto px-4 py-3 sm:grid-cols-2">
          {!isCorreccionFlow ? (
            <label className="flex items-center gap-2 text-xs text-slate-700 sm:col-span-2">
              <Checkbox
                checked={esStockLibre}
                onCheckedChange={(v) => {
                  const checked = v === true;
                  setEsStockLibre(checked);
                  if (checked) {
                    setNumCompraManual(buildNumCompraStockLibre());
                  }
                }}
                aria-label="Compra de stock libre sin OT"
              />
              Stock libre (sin OT) — cartelar y asignar después a una OT (Caso C)
            </label>
          ) : null}
          {!esStockLibre ? (
            <div className="grid gap-1">
              <Label htmlFor="manual-ot" className="text-xs">
                OT
              </Label>
              <Input
                id="manual-ot"
                value={form.ot}
                onChange={(e) => patch({ ot: normalizeOtNumeroInput(e.target.value) })}
                onBlur={(e) => patch({ ot: normalizeOtNumeroInput(e.target.value) })}
                placeholder="Ej. 38514"
                inputMode="numeric"
                className="h-8 text-xs"
              />
            </div>
          ) : null}
          <div className={`grid gap-1 ${esStockLibre ? "sm:col-span-2" : ""}`}>
            <Label htmlFor="manual-num-compra" className="text-xs">
              Nº compra
            </Label>
            <Input
              id="manual-num-compra"
              readOnly={!esStockLibre}
              type="text"
              value={numCompra}
              onChange={
                esStockLibre
                  ? (e) => setNumCompraManual(e.target.value.toUpperCase())
                  : undefined
              }
              placeholder={esStockLibre ? "OCM-STOCK-…" : "OCM-XXXXX"}
              tabIndex={esStockLibre ? 0 : -1}
              aria-readonly={!esStockLibre}
              className={
                esStockLibre
                  ? "h-8 font-mono text-xs"
                  : "h-8 cursor-not-allowed bg-slate-100 font-mono text-xs text-slate-600 selection:bg-transparent"
              }
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="manual-posicion" className="text-xs">
              P
            </Label>
            <Input
              id="manual-posicion"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={form.posicion}
              onChange={(e) => patch({ posicion: e.target.value })}
              onKeyDown={(e) => {
                if ([".", ",", "e", "E", "+", "-"].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              placeholder="1"
              className={cn(
                "h-8 text-xs",
                !posicionValid && "border-red-500 focus-visible:ring-red-500",
              )}
            />
          </div>
          <div className="grid gap-1">
            <NativeSelect
              label="Proveedor"
              options={[
                { value: "", label: "Seleccionar proveedor" },
                ...proveedores.map((p) => ({ value: p.id, label: p.nombre })),
              ]}
              value={form.proveedorId}
              onChange={(e) => patch({ proveedorId: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="manual-material" className="text-xs">
              Material
            </Label>
            <Input
              id="manual-material"
              value={form.material}
              onChange={(e) => patch({ material: e.target.value })}
              placeholder="Ej. Estucado mate"
              className="h-8 text-xs"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="manual-gramaje" className="text-xs">
              Gramaje
            </Label>
            <Input
              id="manual-gramaje"
              type="number"
              step="any"
              value={form.gramaje}
              onChange={(e) => patch({ gramaje: e.target.value })}
              placeholder="Ej. 350"
              className="h-8 text-xs"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="manual-formato" className="text-xs">
              Formato
            </Label>
            <Input
              id="manual-formato"
              value={form.formato}
              onChange={(e) => patch({ formato: e.target.value })}
              placeholder="Ej. 72x102"
              className="h-8 text-xs"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="manual-hojas-netas" className="text-xs">
              Hojas netas
            </Label>
            <Input
              id="manual-hojas-netas"
              type="number"
              step={1}
              value={form.hojasNetas}
              onChange={(e) => patch({ hojasNetas: e.target.value })}
              placeholder="Ej. 1800"
              className="h-8 text-xs"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="manual-hojas-brutas" className="text-xs">
              Hojas brutas
            </Label>
            <Input
              id="manual-hojas-brutas"
              type="number"
              step={1}
              value={form.hojasBrutas}
              onChange={(e) => patch({ hojasBrutas: e.target.value })}
              placeholder="Ej. 1000"
              className="h-8 text-xs"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="manual-cliente" className="text-xs">
              Cliente
            </Label>
            <Input
              id="manual-cliente"
              value={form.cliente}
              onChange={(e) => patch({ cliente: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="manual-titulo" className="text-xs">
              Título del trabajo
            </Label>
            <Input
              id="manual-titulo"
              value={form.titulo}
              onChange={(e) => patch({ titulo: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          {isCorreccionFlow ? (
            <div className="grid gap-1 sm:col-span-2">
              <Label htmlFor="manual-motivo-correccion" className="text-xs">
                Motivo de corrección (STOP)
              </Label>
              <Textarea
                id="manual-motivo-correccion"
                rows={2}
                value={form.motivoCorreccion ?? ""}
                onChange={(e) => patch({ motivoCorreccion: e.target.value })}
                placeholder="Ej. Formato equivocado 65×92 (real 72×102), material defectuoso, etc."
                className="resize-y text-xs leading-snug"
              />
            </div>
          ) : null}
          <div className="grid gap-1 sm:col-span-2">
            <Label htmlFor="manual-notas-compra" className="text-xs">
              Notas compra (Jordi)
            </Label>
            <Textarea
              id="manual-notas-compra"
              rows={3}
              value={form.notasCompra}
              onChange={(e) => patch({ notasCompra: e.target.value })}
              placeholder="Instrucciones para recepción (opcional)"
              className="resize-y text-xs leading-snug"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:justify-between">
          <label className="inline-flex items-center gap-2 text-xs text-slate-700">
            <Checkbox
              checked={keepOpen}
              onCheckedChange={(v) => setKeepOpen(v === true)}
              aria-label="Mantener abierto para entrada múltiple"
            />
            Entrada múltiple (mantener abierto)
          </label>
          <div className="flex items-center gap-2">
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
              disabled={saving || !posicionValid || !numCompra || (!esStockLibre && !otNumero)}
              onClick={() => void guardar()}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Guardar material"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
