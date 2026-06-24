"use client";

import { AlertCircle, ClipboardCopy, Loader2, Plus, Printer, X } from "lucide-react";
import { useEffect, useState } from "react";
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
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import {
  buildRefLote,
  enrichRecepcionLine,
  fetchOtMetadataMap,
  formatClienteTrabajo,
  type OtMetadataMap,
  resolveTrabajoTitulo,
} from "@/lib/cartelas-ot-metadata";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type {
  AlbaranPendienteGroup,
  AlbaranRecepcionLine,
  ProdStockPaletConOts,
  WizardPaletInput,
} from "@/types/prod-stock";
import { UBICACIONES_FILA } from "@/types/prod-stock";

interface CartelaWizardDialogProps {
  open: boolean;
  grupo: AlbaranPendienteGroup | null;
  onClose: () => void;
  onCreated: () => void;
  /** Llamado tras crear cartelas para que la página padre gestione la impresión (evita 29 págs). */
  onPrintReady: (palets: ProdStockPaletConOts[]) => void;
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

function buildInitialPalets(g: AlbaranPendienteGroup | null): WizardPaletInput[] {
  if (!g) return [{ ...EMPTY_PALET }];
  // Por defecto arranca con 1 palet aunque el muelle diga N — el usuario añade los que necesite.
  // Evita forzar 9 bloques vacíos cuando solo se va a cartelar 1 de prueba.
  const firstLine = g.recepciones[0];
  return [
    {
      ...EMPTY_PALET,
      material_nombre: firstLine?.material ?? "",
      gramaje: firstLine?.gramaje?.toString() ?? "",
      formato: firstLine?.tamano_hoja ?? "",
      cantidad_inicial: firstLine?.num_hojas_brutas?.toString() ?? "",
      ots_referencia: firstLine?.ot_numero ? [firstLine.ot_numero] : [],
      es_fsc: false,
    },
  ];
}

export function CartelaWizardDialog({
  open,
  grupo,
  onClose,
  onCreated,
  onPrintReady,
}: CartelaWizardDialogProps) {
  const supabase = createSupabaseBrowserClient();

  const [palets, setPalets] = useState<WizardPaletInput[]>(() =>
    buildInitialPalets(grupo)
  );
  const [saving, setSaving] = useState(false);
  const [savedPalets, setSavedPalets] = useState<ProdStockPaletConOts[]>([]);
  const [otInput, setOtInput] = useState<string[]>([""]);
  const [hijasOts, setHijasOts] = useState<string[]>([]);
  const [loadingHijas, setLoadingHijas] = useState(false);
  const [otMetadata, setOtMetadata] = useState<OtMetadataMap>({});

  // Reset completo al abrir un albarán distinto — fix estado stale
  useEffect(() => {
    if (open && grupo) {
      const initial = buildInitialPalets(grupo);
      setPalets(initial);
      setSavedPalets([]);
      setOtInput(initial.map(() => ""));
      setHijasOts([]);
      setOtMetadata({});
      void loadOtContext(grupo.recepciones);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, grupo]);

  async function loadOtContext(recepciones: AlbaranRecepcionLine[]) {
    const otNums = [...new Set(recepciones.map((r) => r.ot_numero).filter(Boolean))];
    if (otNums.length === 0) return;
    setLoadingHijas(true);
    try {
      const meta = await fetchOtMetadataMap(supabase, otNums);
      setOtMetadata(meta);
      await loadHijasIfNeeded(recepciones);
    } finally {
      setLoadingHijas(false);
    }
  }

  async function loadHijasIfNeeded(recepciones: AlbaranRecepcionLine[]) {
    const otNums = [...new Set(recepciones.map((r) => r.ot_numero).filter(Boolean))];
    if (otNums.length === 0) return;
    try {
      // Buscar OTs que sean contenedor o que tengan hijas
      const { data: contenedores } = await supabase
        .from("prod_ots_general")
        .select("num_pedido, ot_tipo")
        .in("num_pedido", otNums);

      const contenedorNums = (contenedores ?? [])
        .filter((r) => r.ot_tipo === "contenedor")
        .map((r) => String(r.num_pedido ?? "").trim())
        .filter(Boolean);

      if (contenedorNums.length === 0) return;

      const { data: hijas } = await supabase
        .from("prod_ots_general")
        .select("num_pedido")
        .in("ot_padre_numero", contenedorNums)
        .order("num_pedido");

      const hijasList = (hijas ?? [])
        .map((r) => String(r.num_pedido ?? "").trim())
        .filter(Boolean);

      setHijasOts(hijasList);
    } catch {
      // hijas opcionales — no bloquear wizard
    }
  }

  function updatePalet(idx: number, field: keyof WizardPaletInput, value: unknown) {
    setPalets((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function toggleOt(paletIdx: number, ot: string) {
    const current = palets[paletIdx].ots_referencia;
    const next = current.includes(ot)
      ? current.filter((o) => o !== ot)
      : [...current, ot];
    updatePalet(paletIdx, "ots_referencia", next);
  }

  function addOtManual(paletIdx: number) {
    const raw = (otInput[paletIdx] ?? "").trim();
    if (!raw) return;
    if (!palets[paletIdx].ots_referencia.includes(raw)) {
      updatePalet(paletIdx, "ots_referencia", [
        ...palets[paletIdx].ots_referencia,
        raw,
      ]);
    }
    setOtInput((prev) => { const n = [...prev]; n[paletIdx] = ""; return n; });
  }

  function removeOt(paletIdx: number, ot: string) {
    updatePalet(
      paletIdx,
      "ots_referencia",
      palets[paletIdx].ots_referencia.filter((o) => o !== ot)
    );
  }

  /** Clic en línea del albarán → reemplaza material/OT del palet activo (solo esa OT). */
  function prefillPaletFromLine(paletIdx: number, line: AlbaranRecepcionLine) {
    setPalets((prev) => {
      const next = [...prev];
      next[paletIdx] = {
        ...next[paletIdx],
        material_nombre: line.material ?? next[paletIdx].material_nombre,
        gramaje: line.gramaje?.toString() ?? next[paletIdx].gramaje,
        formato: line.tamano_hoja ?? next[paletIdx].formato,
        cantidad_inicial: line.num_hojas_brutas?.toString() ?? next[paletIdx].cantidad_inicial,
        ots_referencia: line.ot_numero ? [line.ot_numero] : [],
      };
      return next;
    });
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
      const { data: { user } } = await supabase.auth.getUser();
      const created: ProdStockPaletConOts[] = [];

      for (let i = 0; i < palets.length; i++) {
        const p = palets[i];
        const cantidad = parseInt(p.cantidad_inicial) || 0;
        const primeraOt = p.ots_referencia[0] ?? null;
        const recepcionLine =
          grupo.recepciones.find((r) => r.ot_numero === primeraOt) ??
          grupo.recepciones[0];

        const trabajoTitulo = primeraOt
          ? resolveTrabajoTitulo(
              grupo.recepciones.find((r) => r.ot_numero === primeraOt) ?? {
                ot_numero: primeraOt,
                trabajo_titulo: null,
              },
              otMetadata
            )
          : null;
        const refLoteCalculado = buildRefLote(primeraOt, trabajoTitulo);

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
            ot_destino_numero: p.ots_referencia.length === 1 ? p.ots_referencia[0] : null,
            estado: p.stock_libre ? "disponible" : "reservado",
            ubicacion_fila: p.ubicacion_fila || null,
            nota_entrega: grupo.albaran_proveedor,
            ref_lote_proveedor: p.ref_lote_proveedor || null,
            ref_lote: refLoteCalculado,
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
          const otsRows = p.ots_referencia.map((ot) => ({ palet_id: paletRow.id, ot_numero: ot }));
          const { error: otsErr } = await supabase.from("prod_stock_palet_ots").insert(otsRows);
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

  const hasDuplicate = grupo && grupo.cartelas_existentes > 0;
  const canSave =
    palets.every((p) => p.cantidad_inicial !== "" && parseInt(p.cantidad_inicial) >= 0) &&
    savedPalets.length === 0;

  // OTs únicas del albarán para checkboxes rápidos
  const otsAlbaran = grupo
    ? [...new Set(grupo.recepciones.map((r) => r.ot_numero).filter(Boolean))]
    : [];
  // Todas las OTs disponibles para seleccionar: del albarán + hijas de contenedor
  const otsSugeridas = [...new Set([...otsAlbaran, ...hijasOts])];

  // Líneas enriquecidas con fallback prod_ots_general para panel izquierdo
  const lineasEnriquecidas = grupo
    ? grupo.recepciones.map((line) => enrichRecepcionLine(line, otMetadata))
    : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[95vw] max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
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
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-300 px-3 py-2 text-sm text-amber-800 shrink-0">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <span>
              Este albarán ya tiene{" "}
              <strong>{grupo!.cartelas_existentes}</strong> cartela
              {grupo!.cartelas_existentes !== 1 ? "s" : ""} creada
              {grupo!.cartelas_existentes !== 1 ? "s" : ""}. Revisa antes de continuar.
            </span>
          </div>
        )}

        {/* ── CUERPO SCROLLABLE ── */}
        <div className="flex-1 overflow-hidden flex gap-6 min-h-0 px-1">

          {/* PANEL IZQUIERDO — resumen albarán */}
          <div className="w-72 min-w-[260px] shrink-0 overflow-y-auto pr-5 border-r border-slate-200 space-y-4">
            {grupo && (
              <>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Proveedor</p>
                  <p className="text-sm font-medium">{grupo.proveedor_nombre ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Albarán</p>
                  <p className="text-sm font-mono">{grupo.albaran_proveedor}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recibido</p>
                  <p className="text-sm">{formatFechaEsCorta(grupo.fecha_recepcion)}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Palets</p>
                    <p className="text-sm">{grupo.palets_recibidos ?? "?"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hojas</p>
                    <p className="text-sm">{grupo.hojas_recibidas_total.toLocaleString("es-ES")}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Líneas del albarán
                  </p>
                  <p className="text-xs text-slate-400 mb-2">Clic para usar solo esa OT en el palet</p>
                  <div className="space-y-2">
                    {lineasEnriquecidas.map((line) => (
                      <button
                        key={line.recepcion_id}
                        type="button"
                        onClick={() => prefillPaletFromLine(0, line)}
                        className="w-full text-left rounded border border-slate-200 px-2.5 py-2 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                      >
                        <span className="block text-xs font-mono font-semibold text-[#002147]">
                          OT {line.ot_numero}
                        </span>
                        <span className="block text-xs text-slate-600 truncate mt-0.5">
                          {formatClienteTrabajo(line.cliente_nombre, line.trabajo_titulo)}
                        </span>
                        <span className="block text-xs text-slate-500 truncate mt-0.5">
                          {line.material}
                          {line.gramaje ? ` ${line.gramaje}gr` : ""}
                          {line.tamano_hoja ? ` · ${line.tamano_hoja}` : ""}
                        </span>
                        {line.num_hojas_brutas && (
                          <span className="block text-xs text-slate-400">
                            {line.num_hojas_brutas.toLocaleString("es-ES")} h
                          </span>
                        )}
                        <span
                          className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600"
                          title="Copiar al palet activo"
                        >
                          <ClipboardCopy className="size-2.5" /> usar
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* PANEL DERECHO — form palets */}
          <div className="flex-1 overflow-y-auto pl-2 pr-1 space-y-5 min-w-0">
            {savedPalets.length > 0 ? (
              /* Estado success */
              <div className="space-y-3">
                <p className="text-sm text-emerald-700 font-medium">✓ Cartelas creadas correctamente</p>
                {savedPalets.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md bg-slate-50 border px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="font-black text-base mr-2">#{p.id_stock}</span>
                      {p.material_nombre} · {p.cantidad_actual.toLocaleString("es-ES")} h
                      {p.ref_lote && (
                        <span className="ml-2 text-slate-400 text-xs">· {p.ref_lote}</span>
                      )}
                    </span>
                    <Badge variant={p.estado === "reservado" ? "default" : "secondary"}>
                      {p.estado}
                    </Badge>
                  </div>
                ))}
                <p className="text-xs text-slate-500">
                  Usa el botón &quot;Imprimir&quot; para obtener las 2 copias de cada cartela.
                </p>
              </div>
            ) : (
              /* Wizard de palets */
              <>
                {palets.map((p, idx) => (
                  <div key={idx} className="border rounded-md p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">
                        Palet {idx + 1} de {palets.length}
                      </span>
                      {palets.length > 1 && (
                        <Button size="icon" variant="ghost" className="size-6" onClick={() => removePalet(idx)}>
                          <X className="size-3" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Material</Label>
                        <Input
                          value={p.material_nombre}
                          onChange={(e) => updatePalet(idx, "material_nombre", e.target.value)}
                          placeholder="Ej: TP WHITE"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Formato</Label>
                        <Input
                          value={p.formato}
                          onChange={(e) => updatePalet(idx, "formato", e.target.value)}
                          placeholder="Ej: 58×92"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Gramaje (gr/m²)</Label>
                        <Input
                          value={p.gramaje}
                          onChange={(e) => updatePalet(idx, "gramaje", e.target.value)}
                          placeholder="350"
                          type="number"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cantidad hojas *</Label>
                        <Input
                          value={p.cantidad_inicial}
                          onChange={(e) => updatePalet(idx, "cantidad_inicial", e.target.value)}
                          placeholder="1.500"
                          type="number"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Ubicación fila</Label>
                        <Select
                          value={p.ubicacion_fila}
                          onValueChange={(v) => updatePalet(idx, "ubicacion_fila", v)}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="Seleccionar…" />
                          </SelectTrigger>
                          <SelectContent>
                            {UBICACIONES_FILA.map((f) => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Lote proveedor</Label>
                        <Input
                          value={p.ref_lote_proveedor}
                          onChange={(e) => updatePalet(idx, "ref_lote_proveedor", e.target.value)}
                          placeholder="Ej: 3238711"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* OTs referencia — checkboxes + manual */}
                    <div>
                      <Label className="text-xs mb-1 block">OT(s) referencia (sin cantidad)</Label>

                      {/* Checkboxes OTs del albarán + hijas */}
                      {otsSugeridas.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {loadingHijas && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Loader2 className="size-3 animate-spin" /> cargando hijas…
                            </span>
                          )}
                          {otsSugeridas.map((ot) => (
                            <label key={ot} className="flex items-center gap-1.5 text-xs cursor-pointer bg-slate-50 border rounded px-2 py-1 hover:bg-slate-100">
                              <Checkbox
                                checked={p.ots_referencia.includes(ot)}
                                onCheckedChange={() => toggleOt(idx, ot)}
                                className="size-3"
                              />
                              <span className="font-mono">{ot}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {/* OTs seleccionadas como badges */}
                      {p.ots_referencia.length > 0 && (
                        <div className="flex gap-1 flex-wrap mb-1">
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
                      )}

                      {/* Input manual para OTs no listadas */}
                      <div className="flex gap-1">
                        <Input
                          value={otInput[idx] ?? ""}
                          onChange={(e) =>
                            setOtInput((prev) => { const n = [...prev]; n[idx] = e.target.value; return n; })
                          }
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOtManual(idx); } }}
                          placeholder="Otra OT + Enter"
                          className="h-7 text-xs flex-1"
                        />
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => addOtManual(idx)}>
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Flags */}
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={p.stock_libre}
                          onCheckedChange={(v) => updatePalet(idx, "stock_libre", !!v)}
                        />
                        Stock libre (sin OT)
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={p.es_fsc} onCheckedChange={(v) => updatePalet(idx, "es_fsc", !!v)} />
                        FSC
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox checked={p.es_pefc} onCheckedChange={(v) => updatePalet(idx, "es_pefc", !!v)} />
                        PEFC
                      </label>
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addPalet} className="w-full text-xs">
                  <Plus className="size-3 mr-1" />
                  Añadir otro palet
                </Button>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 shrink-0 pt-3 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {savedPalets.length > 0 ? "Cerrar" : "Cancelar"}
          </Button>
          {savedPalets.length > 0 ? (
            <Button onClick={() => { onPrintReady(savedPalets); onClose(); }}>
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
