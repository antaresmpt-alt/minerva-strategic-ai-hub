"use client";

import { AlertCircle, Loader2, Plus, Printer, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  AlbaranPendienteGroup,
  ProdStockPaletConOts,
  WizardPaletInput,
} from "@/types/prod-stock";
import { UBICACIONES_FILA } from "@/types/prod-stock";
import { CartelaPrint } from "./cartela-print";

interface CartelaWizardDialogProps {
  open: boolean;
  grupo: AlbaranPendienteGroup | null;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY_PALET: WizardPaletInput = {
  material_nombre: "",
  gramaje: "",
  formato: "",
  cantidad_inicial: "",
  ots_referencia: [],
  stock_libre: false,
  ubicacion_fila: "",
  ref_lote_proveedor: "",
  es_fsc: false,
  es_pefc: false,
  notas: "",
};

export function CartelaWizardDialog({
  open,
  grupo,
  onClose,
  onCreated,
}: CartelaWizardDialogProps) {
  const supabase = createSupabaseBrowserClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [palets, setPalets] = useState<WizardPaletInput[]>(() =>
    buildInitialPalets(grupo)
  );
  const [saving, setSaving] = useState(false);
  const [savedPalets, setSavedPalets] = useState<ProdStockPaletConOts[]>([]);
  const [otInput, setOtInput] = useState<string[]>(() =>
    Array(buildInitialPalets(grupo).length).fill("")
  );

  function buildInitialPalets(g: AlbaranPendienteGroup | null): WizardPaletInput[] {
    if (!g) return [{ ...EMPTY_PALET }];
    const numPalets = Math.max(g.palets_recibidos ?? 1, 1);
    const firstLine = g.recepciones[0];
    return Array.from({ length: numPalets }, () => ({
      ...EMPTY_PALET,
      material_nombre: firstLine?.material ?? "",
      gramaje: firstLine?.gramaje?.toString() ?? "",
      formato: firstLine?.tamano_hoja ?? "",
      cantidad_inicial: firstLine?.num_hojas_brutas
        ? Math.round(firstLine.num_hojas_brutas / numPalets).toString()
        : "",
      ots_referencia: g.recepciones
        .map((r) => r.ot_numero)
        .filter(Boolean),
      es_fsc: false,
    }));
  }

  function updatePalet(
    idx: number,
    field: keyof WizardPaletInput,
    value: unknown
  ) {
    setPalets((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function addOt(paletIdx: number) {
    const raw = (otInput[paletIdx] ?? "").trim();
    if (!raw) return;
    const already = palets[paletIdx].ots_referencia.includes(raw);
    if (already) {
      setOtInput((prev) => {
        const n = [...prev];
        n[paletIdx] = "";
        return n;
      });
      return;
    }
    updatePalet(paletIdx, "ots_referencia", [
      ...palets[paletIdx].ots_referencia,
      raw,
    ]);
    setOtInput((prev) => {
      const n = [...prev];
      n[paletIdx] = "";
      return n;
    });
  }

  function removeOt(paletIdx: number, ot: string) {
    updatePalet(
      paletIdx,
      "ots_referencia",
      palets[paletIdx].ots_referencia.filter((o) => o !== ot)
    );
  }

  function addPalet() {
    setPalets((prev) => [...prev, { ...EMPTY_PALET }]);
    setOtInput((prev) => [...prev, ""]);
  }

  function removePalet(idx: number) {
    if (palets.length <= 1) return;
    setPalets((prev) => prev.filter((_, i) => i !== idx));
    setOtInput((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    if (!grupo) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const created: ProdStockPaletConOts[] = [];

      for (let i = 0; i < palets.length; i++) {
        const p = palets[i];
        const cantidad = parseInt(p.cantidad_inicial) || 0;
        const recepcionLine = grupo.recepciones[0];

        const { data: paletRow, error: paletErr } = await supabase
          .from("prod_stock_palets")
          .insert({
            tipo_stock: "materia_prima",
            unidad: "hojas",
            recepcion_id: recepcionLine?.recepcion_id ?? null,
            compra_id: recepcionLine?.compra_id ?? null,
            material_nombre: p.material_nombre || null,
            gramaje: p.gramaje ? parseInt(p.gramaje) : null,
            formato: p.formato || null,
            cantidad_inicial: cantidad,
            cantidad_actual: cantidad,
            ot_destino_numero:
              p.ots_referencia.length === 1 ? p.ots_referencia[0] : null,
            estado: p.stock_libre ? "disponible" : "reservado",
            ubicacion_fila: p.ubicacion_fila || null,
            nota_entrega: grupo.albaran_proveedor,
            ref_lote_proveedor: p.ref_lote_proveedor || null,
            es_fsc: p.es_fsc,
            es_pefc: p.es_pefc,
            notas: p.notas || null,
            created_by: user?.id ?? null,
          })
          .select()
          .single();

        if (paletErr || !paletRow) {
          toast.error(`Error al crear palet ${i + 1}: ${paletErr?.message}`);
          setSaving(false);
          return;
        }

        if (!p.stock_libre && p.ots_referencia.length > 0) {
          const otsRows = p.ots_referencia.map((ot) => ({
            palet_id: paletRow.id,
            ot_numero: ot,
          }));
          const { error: otsErr } = await supabase
            .from("prod_stock_palet_ots")
            .insert(otsRows);
          if (otsErr) {
            toast.error(`Error al enlazar OTs del palet ${i + 1}: ${otsErr.message}`);
            setSaving(false);
            return;
          }
        }

        created.push({ ...paletRow, ots: p.ots_referencia });
      }

      setSavedPalets(created);
      toast.success(
        `${created.length} cartela${created.length !== 1 ? "s" : ""} creada${created.length !== 1 ? "s" : ""} — ID Stock ${created.map((c) => c.id_stock).join(", ")}`
      );
      onCreated();
    } catch (e) {
      toast.error(`Error inesperado: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const hasDuplicate = grupo && grupo.cartelas_existentes > 0;
  const canSave =
    palets.every(
      (p) => p.cantidad_inicial !== "" && parseInt(p.cantidad_inicial) >= 0
    ) && savedPalets.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Cartelar albarán{" "}
            <span className="font-black">{grupo?.albaran_proveedor}</span>
          </DialogTitle>
          {grupo && (
            <DialogDescription>
              {grupo.proveedor_nombre} · {grupo.recepciones.length} OC
              {grupo.recepciones.length !== 1 ? "s" : ""} ·{" "}
              {grupo.palets_recibidos ?? "?"} palet
              {(grupo.palets_recibidos ?? 0) !== 1 ? "s" : ""} ·{" "}
              {grupo.hojas_recibidas_total.toLocaleString("es-ES")} hojas
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Antiduplicado */}
        {hasDuplicate && (
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-300 px-3 py-2 text-sm text-amber-800">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <span>
              Este albarán ya tiene{" "}
              <strong>{grupo!.cartelas_existentes}</strong> cartela
              {grupo!.cartelas_existentes !== 1 ? "s" : ""} creada
              {grupo!.cartelas_existentes !== 1 ? "s" : ""}. Revisa antes de
              continuar para evitar duplicados.
            </span>
          </div>
        )}

        {/* Si ya se han guardado → mostrar resumen + imprimir */}
        {savedPalets.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-emerald-700 font-medium">
              ✓ Cartelas creadas correctamente
            </p>
            {savedPalets.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md bg-slate-50 border px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-black text-base mr-2">
                    #{p.id_stock}
                  </span>
                  {p.material_nombre} · {p.cantidad_actual.toLocaleString("es-ES")} h
                </span>
                <Badge variant={p.estado === "reservado" ? "default" : "secondary"}>
                  {p.estado}
                </Badge>
              </div>
            ))}
            {/* Print area: rendered but only visible when printing */}
            {savedPalets.map((p) => (
              <CartelaPrint key={p.id} palet={p} copies={2} />
            ))}
          </div>
        ) : (
          /* Wizard de palets */
          <div className="space-y-4">
            {palets.map((p, idx) => (
              <div key={idx} className="border rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Palet {idx + 1}</span>
                  {palets.length > 1 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      onClick={() => removePalet(idx)}
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Material</Label>
                    <Input
                      value={p.material_nombre}
                      onChange={(e) =>
                        updatePalet(idx, "material_nombre", e.target.value)
                      }
                      placeholder="Ej: Zenith 295gr"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Formato</Label>
                    <Input
                      value={p.formato}
                      onChange={(e) =>
                        updatePalet(idx, "formato", e.target.value)
                      }
                      placeholder="Ej: 65×92"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Gramaje (gr/m²)</Label>
                    <Input
                      value={p.gramaje}
                      onChange={(e) =>
                        updatePalet(idx, "gramaje", e.target.value)
                      }
                      placeholder="295"
                      type="number"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Cantidad hojas *</Label>
                    <Input
                      value={p.cantidad_inicial}
                      onChange={(e) =>
                        updatePalet(idx, "cantidad_inicial", e.target.value)
                      }
                      placeholder="1.500"
                      type="number"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Ubicación fila</Label>
                    <Select
                      value={p.ubicacion_fila}
                      onValueChange={(v) =>
                        updatePalet(idx, "ubicacion_fila", v)
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Seleccionar…" />
                      </SelectTrigger>
                      <SelectContent>
                        {UBICACIONES_FILA.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Lote proveedor</Label>
                    <Input
                      value={p.ref_lote_proveedor}
                      onChange={(e) =>
                        updatePalet(idx, "ref_lote_proveedor", e.target.value)
                      }
                      placeholder="Ej: 3238711"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>

                {/* OTs referencia */}
                <div>
                  <Label className="text-xs">OT(s) referencia (sin cantidad)</Label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {p.ots_referencia.map((ot) => (
                      <Badge
                        key={ot}
                        variant="secondary"
                        className="gap-1 cursor-pointer"
                        onClick={() => removeOt(idx, ot)}
                      >
                        {ot} <X className="size-2.5" />
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-1 mt-1">
                    <Input
                      value={otInput[idx] ?? ""}
                      onChange={(e) =>
                        setOtInput((prev) => {
                          const n = [...prev];
                          n[idx] = e.target.value;
                          return n;
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addOt(idx);
                        }
                      }}
                      placeholder="Nº OT + Enter"
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2"
                      onClick={() => addOt(idx)}
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </div>

                {/* Flags */}
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={p.stock_libre}
                      onCheckedChange={(v) =>
                        updatePalet(idx, "stock_libre", !!v)
                      }
                    />
                    Stock libre (sin OT)
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={p.es_fsc}
                      onCheckedChange={(v) =>
                        updatePalet(idx, "es_fsc", !!v)
                      }
                    />
                    FSC
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={p.es_pefc}
                      onCheckedChange={(v) =>
                        updatePalet(idx, "es_pefc", !!v)
                      }
                    />
                    PEFC
                  </label>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={addPalet}
              className="w-full text-xs"
            >
              <Plus className="size-3 mr-1" />
              Añadir otro palet
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {savedPalets.length > 0 ? "Cerrar" : "Cancelar"}
          </Button>
          {savedPalets.length > 0 ? (
            <Button onClick={handlePrint}>
              <Printer className="size-4 mr-2" />
              Imprimir cartelas (×2 copias)
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || !canSave}>
              {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              Crear {palets.length} cartela{palets.length !== 1 ? "s" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
