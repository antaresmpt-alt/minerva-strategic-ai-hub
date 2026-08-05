"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  Download,
  FileDown,
  FileText,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  aplicarArticulosDiff,
  computeArticulosDiff,
  descargarPlantillaArticulos,
  exportarArticulosAExcel,
  exportarArticulosAPdf,
  parseArticulosExcelFile,
  type ArticuloDiffResult,
  type ArticuloImportRow,
} from "@/lib/articulos-maestro-import";
import { actualizarPromediosMaestro } from "@/lib/maestro-promedios-update";
import { exportArticuloFichaPdf } from "@/lib/articulos-maestro-ficha-pdf";
import { buildMaestroPromediosPanel } from "@/lib/maestro-prefill";
import { parseDecimalLoose } from "@/lib/parse-decimal-input";
import {
  ARTICULO_TIPO_PRODUCTO_OPTIONS,
  type ProdReferenciaRow,
  type DefaultsProcesoMaestro,
} from "@/types/prod-referencias";
import {
  CTP_REQUISITO_DEFS,
  type DespachoWizardCtpDatos,
} from "@/lib/ctp-despacho";

const REFERENCIAS_PAGE_SIZE = 1000;

async function fetchAllProdReferencias(
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): Promise<ProdReferenciaRow[]> {
  const all: ProdReferenciaRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("prod_referencias")
      .select("*")
      .order("codigo", { ascending: true })
      .range(from, from + REFERENCIAS_PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as ProdReferenciaRow[];
    all.push(...batch);
    if (batch.length < REFERENCIAS_PAGE_SIZE) break;
    from += REFERENCIAS_PAGE_SIZE;
  }
  return all;
}

// ─── Form ─────────────────────────────────────────────────────────────────────

type ArticuloForm = {
  codigo: string;
  referencia_cliente: string;
  descripcion: string;
  cliente: string;
  tipo_producto: string;
  subtipo: string;
  activo: boolean;
  formato_largo_mm: string;
  formato_ancho_mm: string;
  formato_fondo_mm: string;
  material_habitual: string;
  gramaje_habitual: string;
  poses_habitual: string;
  troquel_habitual: string;
  tintas_habituales: string;
  acabado_habitual: string;
  ruta_habitual: string;
  tipo_engomado_habitual: string;
  caja_embalaje_habitual: string;
  unidades_por_embalaje_habitual: string;
  fsc: boolean;
  fsc_fecha_validacion: string;
  notas: string;
  /** Ola 2: configuración por proceso. Se maneja directamente como objeto, no como campos de texto. */
  defaults_proceso: DefaultsProcesoMaestro;
  /** Horas oficiales (dirección); no las sobrescribe «Actualizar promedios». */
  horas_prep_impresion_oficial: string;
  horas_millar_impresion_oficial: string;
  horas_prep_troquelado_oficial: string;
  horas_millar_troquelado_oficial: string;
  horas_prep_engomado_oficial: string;
  horas_millar_engomado_oficial: string;
  horas_guillotina_oficial: string;
  horas_desbroce_oficial: string;
};

const EMPTY_FORM: ArticuloForm = {
  codigo: "",
  referencia_cliente: "",
  descripcion: "",
  cliente: "",
  tipo_producto: "",
  subtipo: "",
  activo: true,
  formato_largo_mm: "",
  formato_ancho_mm: "",
  formato_fondo_mm: "",
  material_habitual: "",
  gramaje_habitual: "",
  poses_habitual: "",
  troquel_habitual: "",
  tintas_habituales: "",
  acabado_habitual: "",
  ruta_habitual: "",
  tipo_engomado_habitual: "",
  caja_embalaje_habitual: "",
  unidades_por_embalaje_habitual: "",
  fsc: false,
  fsc_fecha_validacion: "",
  notas: "",
  defaults_proceso: {},
  horas_prep_impresion_oficial: "",
  horas_millar_impresion_oficial: "",
  horas_prep_troquelado_oficial: "",
  horas_millar_troquelado_oficial: "",
  horas_prep_engomado_oficial: "",
  horas_millar_engomado_oficial: "",
  horas_guillotina_oficial: "",
  horas_desbroce_oficial: "",
};

function numToFormStr(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? String(v) : "";
}

function formatImportError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error != null) {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [e.message, e.details, e.hint, e.code ? `code=${e.code}` : null]
      .filter(Boolean)
      .map(String)
      .join(" · ");
  }
  return String(error || "Error importando");
}

function rowToForm(row: ProdReferenciaRow): ArticuloForm {
  return {
    codigo: row.codigo,
    referencia_cliente: row.referencia_cliente ?? "",
    descripcion: row.descripcion ?? "",
    cliente: row.cliente ?? "",
    tipo_producto: row.tipo_producto ?? "",
    subtipo: row.subtipo ?? "",
    activo: row.activo,
    formato_largo_mm: row.formato_largo_mm != null ? String(row.formato_largo_mm) : "",
    formato_ancho_mm: row.formato_ancho_mm != null ? String(row.formato_ancho_mm) : "",
    formato_fondo_mm: row.formato_fondo_mm != null ? String(row.formato_fondo_mm) : "",
    material_habitual: row.material_habitual ?? "",
    gramaje_habitual: row.gramaje_habitual != null ? String(row.gramaje_habitual) : "",
    poses_habitual: row.poses_habitual != null ? String(row.poses_habitual) : "",
    troquel_habitual: row.troquel_habitual ?? "",
    tintas_habituales: row.tintas_habituales ?? "",
    acabado_habitual: row.acabado_habitual ?? "",
    ruta_habitual: row.ruta_habitual ?? "",
    tipo_engomado_habitual: row.tipo_engomado_habitual ?? "",
    caja_embalaje_habitual: row.caja_embalaje_habitual ?? "",
    unidades_por_embalaje_habitual: row.unidades_por_embalaje_habitual != null ? String(row.unidades_por_embalaje_habitual) : "",
    fsc: row.fsc ?? false,
    fsc_fecha_validacion: row.fsc_fecha_validacion ?? "",
    notas: row.notas ?? "",
    defaults_proceso: (row.defaults_proceso as DefaultsProcesoMaestro | null) ?? {},
    horas_prep_impresion_oficial: numToFormStr(row.horas_prep_impresion_oficial),
    horas_millar_impresion_oficial: numToFormStr(row.horas_millar_impresion_oficial),
    horas_prep_troquelado_oficial: numToFormStr(row.horas_prep_troquelado_oficial),
    horas_millar_troquelado_oficial: numToFormStr(row.horas_millar_troquelado_oficial),
    horas_prep_engomado_oficial: numToFormStr(row.horas_prep_engomado_oficial),
    horas_millar_engomado_oficial: numToFormStr(row.horas_millar_engomado_oficial),
    horas_guillotina_oficial: numToFormStr(row.horas_guillotina_oficial),
    horas_desbroce_oficial: numToFormStr(row.horas_desbroce_oficial),
  };
}

function formToPayload(form: ArticuloForm) {
  const parseNum = (v: string) => parseDecimalLoose(v);
  return {
    codigo: form.codigo.trim(),
    referencia_cliente: form.referencia_cliente.trim() || null,
    descripcion: form.descripcion.trim() || null,
    cliente: form.cliente.trim() || null,
    tipo_producto: form.tipo_producto.trim() || null,
    subtipo: form.subtipo.trim() || null,
    activo: form.activo,
    formato_largo_mm: parseNum(form.formato_largo_mm),
    formato_ancho_mm: parseNum(form.formato_ancho_mm),
    formato_fondo_mm: parseNum(form.formato_fondo_mm),
    material_habitual: form.material_habitual.trim() || null,
    gramaje_habitual: parseNum(form.gramaje_habitual),
    poses_habitual: parseNum(form.poses_habitual) != null ? Math.round(parseNum(form.poses_habitual)!) : null,
    troquel_habitual: form.troquel_habitual.trim() || null,
    tintas_habituales: form.tintas_habituales.trim() || null,
    acabado_habitual: form.acabado_habitual.trim() || null,
    ruta_habitual: form.ruta_habitual.trim() || null,
    tipo_engomado_habitual: form.tipo_engomado_habitual.trim() || null,
    caja_embalaje_habitual: form.caja_embalaje_habitual.trim() || null,
    unidades_por_embalaje_habitual: parseNum(form.unidades_por_embalaje_habitual) != null ? Math.round(parseNum(form.unidades_por_embalaje_habitual)!) : null,
    fsc: form.fsc,
    fsc_fecha_validacion: form.fsc ? form.fsc_fecha_validacion.trim() || null : null,
    notas: form.notas.trim() || null,
    defaults_proceso: Object.keys(form.defaults_proceso).length > 0 ? form.defaults_proceso : null,
    horas_prep_impresion_oficial: parseNum(form.horas_prep_impresion_oficial),
    horas_millar_impresion_oficial: parseNum(form.horas_millar_impresion_oficial),
    horas_prep_troquelado_oficial: parseNum(form.horas_prep_troquelado_oficial),
    horas_millar_troquelado_oficial: parseNum(form.horas_millar_troquelado_oficial),
    horas_prep_engomado_oficial: parseNum(form.horas_prep_engomado_oficial),
    horas_millar_engomado_oficial: parseNum(form.horas_millar_engomado_oficial),
    horas_guillotina_oficial: parseNum(form.horas_guillotina_oficial),
    horas_desbroce_oficial: parseNum(form.horas_desbroce_oficial),
  };
}

/** Combina el formulario abierto con promedios/meta guardados para la ficha PDF. */
function buildFichaPdfRow(
  form: ArticuloForm,
  base: ProdReferenciaRow | null | undefined,
): ProdReferenciaRow {
  const payload = formToPayload(form);
  return {
    id: base?.id ?? "",
    codigo: payload.codigo || "SIN-CODIGO",
    referencia_cliente: payload.referencia_cliente,
    descripcion: payload.descripcion,
    cliente: payload.cliente,
    tipo_producto: payload.tipo_producto,
    subtipo: payload.subtipo,
    activo: payload.activo,
    formato_largo_mm: payload.formato_largo_mm,
    formato_ancho_mm: payload.formato_ancho_mm,
    formato_fondo_mm: payload.formato_fondo_mm,
    material_habitual: payload.material_habitual,
    gramaje_habitual: payload.gramaje_habitual,
    poses_habitual: payload.poses_habitual,
    troquel_habitual: payload.troquel_habitual,
    tintas_habituales: payload.tintas_habituales,
    acabado_habitual: payload.acabado_habitual,
    ruta_habitual: payload.ruta_habitual,
    tipo_engomado_habitual: payload.tipo_engomado_habitual,
    caja_embalaje_habitual: payload.caja_embalaje_habitual,
    unidades_por_embalaje_habitual: payload.unidades_por_embalaje_habitual,
    fsc: payload.fsc,
    fsc_fecha_validacion: payload.fsc_fecha_validacion,
    ultima_ot_numero: base?.ultima_ot_numero ?? null,
    ultima_ot_fecha: base?.ultima_ot_fecha ?? null,
    total_repeticiones: base?.total_repeticiones ?? 0,
    notas: payload.notas,
    defaults_proceso: payload.defaults_proceso,
    promedios_actualizados_at: base?.promedios_actualizados_at ?? null,
    promedios_basados_en_n_ots: base?.promedios_basados_en_n_ots ?? null,
    material_promedio: base?.material_promedio ?? null,
    material_oficial: base?.material_oficial ?? null,
    troquel_promedio: base?.troquel_promedio ?? null,
    troquel_oficial: base?.troquel_oficial ?? null,
    tintas_promedio: base?.tintas_promedio ?? null,
    tintas_oficial: base?.tintas_oficial ?? null,
    acabado_promedio: base?.acabado_promedio ?? null,
    acabado_oficial: base?.acabado_oficial ?? null,
    tipo_engomado_promedio: base?.tipo_engomado_promedio ?? null,
    tipo_engomado_oficial: base?.tipo_engomado_oficial ?? null,
    caja_embalaje_promedio: base?.caja_embalaje_promedio ?? null,
    caja_embalaje_oficial: base?.caja_embalaje_oficial ?? null,
    poses_promedio: base?.poses_promedio ?? null,
    poses_oficial: base?.poses_oficial ?? null,
    poses_muestra_n: base?.poses_muestra_n ?? null,
    gramaje_promedio: base?.gramaje_promedio ?? null,
    gramaje_oficial: base?.gramaje_oficial ?? null,
    gramaje_muestra_n: base?.gramaje_muestra_n ?? null,
    unidades_por_embalaje_promedio: base?.unidades_por_embalaje_promedio ?? null,
    unidades_por_embalaje_oficial: base?.unidades_por_embalaje_oficial ?? null,
    unidades_por_embalaje_muestra_n: base?.unidades_por_embalaje_muestra_n ?? null,
    merma_promedio: base?.merma_promedio ?? null,
    merma_oficial: base?.merma_oficial ?? null,
    merma_muestra_n: base?.merma_muestra_n ?? null,
    horas_prep_impresion_promedio: base?.horas_prep_impresion_promedio ?? null,
    horas_prep_impresion_oficial: payload.horas_prep_impresion_oficial,
    horas_prep_impresion_muestra_n: base?.horas_prep_impresion_muestra_n ?? null,
    horas_prep_troquelado_promedio: base?.horas_prep_troquelado_promedio ?? null,
    horas_prep_troquelado_oficial: payload.horas_prep_troquelado_oficial,
    horas_prep_troquelado_muestra_n: base?.horas_prep_troquelado_muestra_n ?? null,
    horas_prep_engomado_promedio: base?.horas_prep_engomado_promedio ?? null,
    horas_prep_engomado_oficial: payload.horas_prep_engomado_oficial,
    horas_prep_engomado_muestra_n: base?.horas_prep_engomado_muestra_n ?? null,
    horas_millar_impresion_promedio: base?.horas_millar_impresion_promedio ?? null,
    horas_millar_impresion_oficial: payload.horas_millar_impresion_oficial,
    horas_millar_impresion_muestra_n: base?.horas_millar_impresion_muestra_n ?? null,
    horas_millar_troquelado_promedio: base?.horas_millar_troquelado_promedio ?? null,
    horas_millar_troquelado_oficial: payload.horas_millar_troquelado_oficial,
    horas_millar_troquelado_muestra_n: base?.horas_millar_troquelado_muestra_n ?? null,
    horas_millar_engomado_promedio: base?.horas_millar_engomado_promedio ?? null,
    horas_millar_engomado_oficial: payload.horas_millar_engomado_oficial,
    horas_millar_engomado_muestra_n: base?.horas_millar_engomado_muestra_n ?? null,
    horas_guillotina_promedio: base?.horas_guillotina_promedio ?? null,
    horas_guillotina_oficial: payload.horas_guillotina_oficial,
    horas_guillotina_muestra_n: base?.horas_guillotina_muestra_n ?? null,
    horas_desbroce_promedio: base?.horas_desbroce_promedio ?? null,
    horas_desbroce_oficial: payload.horas_desbroce_oficial,
    horas_desbroce_muestra_n: base?.horas_desbroce_muestra_n ?? null,
    created_at: base?.created_at ?? null,
    updated_at: base?.updated_at ?? null,
  };
}

// ─── Completeness levels ────────────────────────────────────────────────────

type CompletitudNivel = "solo_codigo" | "sin_tecnica" | "parcial" | "completa";

const COMPLETITUD_META: Record<
  CompletitudNivel,
  { label: string; dot: string; className: string }
> = {
  solo_codigo: {
    label: "Solo código",
    dot: "⚫",
    className: "border-slate-300 text-slate-400",
  },
  sin_tecnica: {
    label: "Sin técnica",
    dot: "🔴",
    className: "border-red-300 bg-red-50 text-red-700",
  },
  parcial: {
    label: "Parcial",
    dot: "🟡",
    className: "border-amber-300 bg-amber-50 text-amber-700",
  },
  completa: {
    label: "Completa",
    dot: "✅",
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
  },
};

function completitudNivel(row: ProdReferenciaRow): CompletitudNivel {
  const hasIdentidad = Boolean(row.referencia_cliente || row.descripcion);
  if (!hasIdentidad) return "solo_codigo";

  const tieneMaterial = Boolean(row.material_habitual);
  const tieneTroquel = Boolean(row.troquel_habitual);
  const tieneTintas = Boolean(row.tintas_habituales);
  const tieneRuta = Boolean(row.ruta_habitual);
  const algoTecnico =
    tieneMaterial || tieneTroquel || tieneTintas || Boolean(row.poses_habitual);

  if (!algoTecnico) return "sin_tecnica";

  const esCompleta =
    tieneMaterial && tieneTroquel && tieneTintas && tieneRuta;
  return esCompleta ? "completa" : "parcial";
}

function CompletitudBadge({ nivel }: { nivel: CompletitudNivel }) {
  const meta = COMPLETITUD_META[nivel];
  return (
    <Badge variant="outline" className={`text-[10px] ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

// ─── Form dialog ──────────────────────────────────────────────────────────────

function MaestroPromediosInfoPanel({
  row,
  onRecalcularEste,
  recalculando,
}: {
  row: ProdReferenciaRow;
  onRecalcularEste?: () => void;
  recalculando?: boolean;
}) {
  const panel = buildMaestroPromediosPanel(row);
  if (!panel.hasData) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-slate-500">
          Sin promedios calculados todavía. Usa «Actualizar promedios» tras cerrar OTs en
          histórico.
        </p>
        {onRecalcularEste ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-[11px]"
            disabled={recalculando}
            onClick={onRecalcularEste}
          >
            {recalculando ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Recalcular este artículo
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {panel.header ? (
        <p className="text-[11px] font-medium text-slate-700">{panel.header}</p>
      ) : null}
      {(panel.categoricos.length > 0 || panel.numericos.length > 0) && (
        <ul className="grid gap-0.5 text-[11px] text-slate-600 sm:grid-cols-2">
          {[...panel.categoricos, ...panel.numericos].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {panel.horas.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-1 pr-2 font-medium">Proceso</th>
                <th className="py-1 pr-2 font-medium">Prep / horas</th>
                <th className="py-1 font-medium">Millar (tiraje)</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {panel.horas.map((h) => (
                <tr key={h.proceso} className="border-b border-slate-100 last:border-0">
                  <td className="py-1 pr-2 font-medium">{h.proceso}</td>
                  <td className="py-1 pr-2 tabular-nums">
                    {h.horas != null
                      ? h.horasN != null
                        ? `${h.horas} h (n=${h.horasN})`
                        : `${h.horas} h`
                      : "—"}
                    {h.modo === "absolutas" ? (
                      <span className="ml-1 text-[10px] text-slate-400">abs.</span>
                    ) : null}
                  </td>
                  <td className="py-1 tabular-nums">
                    {h.modo === "absolutas"
                      ? "—"
                      : h.millar != null
                        ? h.millarN != null
                          ? `${h.millar} (n=${h.millarN})`
                          : String(h.millar)
                        : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {onRecalcularEste ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-[11px]"
          disabled={recalculando}
          onClick={onRecalcularEste}
        >
          {recalculando ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Recalcular este artículo
        </Button>
      ) : null}
    </div>
  );
}

function ArticuloFormDialog({
  open,
  title,
  description,
  form,
  saving,
  onFormChange,
  onSave,
  onClose,
  showCodigo = true,
  promediosRow,
  onRecalcularPromedios,
  recalculandoPromedios,
}: {
  open: boolean;
  title: string;
  description?: string;
  form: ArticuloForm;
  saving: boolean;
  onFormChange: (f: ArticuloForm) => void;
  onSave: () => void;
  onClose: () => void;
  showCodigo?: boolean;
  promediosRow?: ProdReferenciaRow | null;
  onRecalcularPromedios?: () => void;
  recalculandoPromedios?: boolean;
}) {
  const set = (k: keyof ArticuloForm, v: string | boolean | DefaultsProcesoMaestro) =>
    onFormChange({ ...form, [k]: v });

  const handlePdfFicha = () => {
    if (!form.codigo.trim()) {
      toast.error("Indica un código antes de generar la ficha PDF.");
      return;
    }
    try {
      exportArticuloFichaPdf(buildFichaPdfRow(form, promediosRow));
      toast.success(`PDF ficha · ${form.codigo.trim()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Identidad */}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Identidad
          </p>
          <div className="grid grid-cols-2 gap-3">
            {showCodigo && (
              <div className="grid gap-1">
                <Label className="text-xs">
                  Código Minerva <span className="text-red-500">*</span>
                </Label>
                <Input
                  className="h-8 font-mono text-xs"
                  placeholder="M-00001"
                  value={form.codigo}
                  onChange={(e) => set("codigo", e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-1">
              <Label className="text-xs">Referencia cliente</Label>
              <Input
                className="h-8 font-mono text-xs"
                placeholder="EU858"
                value={form.referencia_cliente}
                onChange={(e) => set("referencia_cliente", e.target.value)}
              />
            </div>
            <div className={`grid gap-1 ${showCodigo ? "" : "col-span-2"}`}>
              <Label className="text-xs">Descripción</Label>
              <Input
                className="h-8 text-xs"
                placeholder="EST BBP PROBIOMIX 10 CAP"
                value={form.descripcion}
                onChange={(e) => set("descripcion", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Cliente</Label>
              <Input
                className="h-8 text-xs"
                placeholder="LABORATORIOS ANUR, S.L"
                value={form.cliente}
                onChange={(e) => set("cliente", e.target.value)}
              />
            </div>
          </div>

          {/* Clasificación */}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Clasificación
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Tipo de producto</Label>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={form.tipo_producto}
                onChange={(e) => set("tipo_producto", e.target.value)}
              >
                <option value="">— sin tipo —</option>
                {ARTICULO_TIPO_PRODUCTO_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Subtipo</Label>
              <Input
                className="h-8 text-xs"
                placeholder="automontable, con ventana…"
                value={form.subtipo}
                onChange={(e) => set("subtipo", e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <Checkbox
                id="activo-check"
                checked={form.activo}
                onCheckedChange={(v) => set("activo", Boolean(v))}
              />
              <Label htmlFor="activo-check" className="cursor-pointer text-xs">
                Activo
              </Label>
            </div>
          </div>

          {/* Dimensiones */}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Dimensiones (mm)
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["formato_largo_mm", "Largo"],
                ["formato_ancho_mm", "Ancho"],
                ["formato_fondo_mm", "Fondo"],
              ] as const
            ).map(([k, label]) => (
              <div key={k} className="grid gap-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  min={0}
                  placeholder="—"
                  value={form[k]}
                  onChange={(e) => set(k, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Sugerencias técnicas */}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Sugerencias técnicas (pre-rellenan el despacho)
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Material habitual</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Zenith 300g"
                value={form.material_habitual}
                onChange={(e) => set("material_habitual", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Gramaje habitual (g/m²)</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min={0}
                placeholder="300"
                value={form.gramaje_habitual}
                onChange={(e) => set("gramaje_habitual", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Troquel habitual</Label>
              <Input
                className="h-8 font-mono text-xs"
                placeholder="TAG00205"
                value={form.troquel_habitual}
                onChange={(e) => set("troquel_habitual", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Poses habitual</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min={1}
                placeholder="4"
                value={form.poses_habitual}
                onChange={(e) => set("poses_habitual", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Tintas habituales</Label>
              <Input
                className="h-8 text-xs"
                placeholder="4+1"
                value={form.tintas_habituales}
                onChange={(e) => set("tintas_habituales", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Acabado habitual</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Barniz AC brillo"
                value={form.acabado_habitual}
                onChange={(e) => set("acabado_habitual", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Tipo de engomado habitual</Label>
              <Input
                className="h-8 text-xs"
                placeholder="Pegado 4 puntos"
                value={form.tipo_engomado_habitual}
                onChange={(e) => set("tipo_engomado_habitual", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Caja embalaje habitual</Label>
              <Input
                className="h-8 font-mono text-xs"
                placeholder="MN2L"
                value={form.caja_embalaje_habitual}
                onChange={(e) => set("caja_embalaje_habitual", e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Uds por caja habitual</Label>
              <Input
                className="h-8 text-xs"
                type="number"
                min={1}
                placeholder="450"
                value={form.unidades_por_embalaje_habitual}
                onChange={(e) => set("unidades_por_embalaje_habitual", e.target.value)}
              />
            </div>
            <div className="col-span-2 grid gap-1">
              <Label className="text-xs">Ruta habitual</Label>
              <Input
                className="h-8 text-xs"
                placeholder="CTP+Impresión Offset+Troquelado+Engomado"
                value={form.ruta_habitual}
                onChange={(e) => set("ruta_habitual", e.target.value)}
              />
            </div>
          </div>

          {promediosRow ? (
            <>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Promedios desde histórico (solo lectura)
              </p>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <MaestroPromediosInfoPanel
                  row={promediosRow}
                  onRecalcularEste={onRecalcularPromedios}
                  recalculando={recalculandoPromedios}
                />
              </div>
            </>
          ) : null}

          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Horas oficiales (dirección)
          </p>
          <p className="text-[10px] text-slate-400">
            Prefieren sobre el promedio al despachar («Usar maestro»). «Actualizar
            promedios» no las sobrescribe. Vacío = usar promedio/habitual.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                {
                  key: "horas_prep_impresion_oficial" as const,
                  label: "Prep impresión (h)",
                  hint: promediosRow?.horas_prep_impresion_promedio,
                },
                {
                  key: "horas_millar_impresion_oficial" as const,
                  label: "Millar impresión",
                  hint: promediosRow?.horas_millar_impresion_promedio,
                },
                {
                  key: "horas_prep_troquelado_oficial" as const,
                  label: "Prep troquel (h)",
                  hint: promediosRow?.horas_prep_troquelado_promedio,
                },
                {
                  key: "horas_millar_troquelado_oficial" as const,
                  label: "Millar troquel",
                  hint: promediosRow?.horas_millar_troquelado_promedio,
                },
                {
                  key: "horas_prep_engomado_oficial" as const,
                  label: "Prep engomado (h)",
                  hint: promediosRow?.horas_prep_engomado_promedio,
                },
                {
                  key: "horas_millar_engomado_oficial" as const,
                  label: "Millar engomado",
                  hint: promediosRow?.horas_millar_engomado_promedio,
                },
                {
                  key: "horas_guillotina_oficial" as const,
                  label: "Guillotina (h abs.)",
                  hint: promediosRow?.horas_guillotina_promedio,
                },
                {
                  key: "horas_desbroce_oficial" as const,
                  label: "Desbroce (h abs.)",
                  hint: promediosRow?.horas_desbroce_promedio,
                },
              ] as const
            ).map((f) => (
              <div key={f.key} className="grid gap-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  className="h-8 text-xs"
                  type="text"
                  inputMode="decimal"
                  placeholder={
                    f.hint != null ? `prom. ${f.hint}` : "—"
                  }
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Defaults por proceso (Ola 2) */}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Defaults por proceso
          </p>
          <p className="text-[10px] text-slate-400">
            Configuración estable por artículo (checks CTP, guillotina). Solo campos independientes de la tirada.
          </p>

          {/* CTP */}
          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-2 text-[11px] font-semibold text-slate-600">CTP / Preimpresión</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {CTP_REQUISITO_DEFS.map((def) => {
                const checked = Boolean(
                  (form.defaults_proceso.ctp as Record<string, boolean> | undefined)?.[def.hechoKey]
                );
                return (
                  <div key={def.hechoKey} className="flex items-center gap-2">
                    <Checkbox
                      id={`ctp-${def.hechoKey}`}
                      checked={checked}
                      onCheckedChange={(v) => {
                        const current = form.defaults_proceso.ctp ?? {};
                        const updated: Record<string, boolean> = { ...current };
                        if (v) updated[def.hechoKey] = true;
                        else delete updated[def.hechoKey];
                        set("defaults_proceso", {
                          ...form.defaults_proceso,
                          ctp: updated as DefaultsProcesoMaestro["ctp"],
                        });
                      }}
                    />
                    <Label
                      htmlFor={`ctp-${def.hechoKey}`}
                      className="cursor-pointer text-xs font-normal"
                    >
                      {def.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Guillotina */}
          <div className="rounded-md border border-slate-200 p-3">
            <p className="mb-2 text-[11px] font-semibold text-slate-600">Guillotina</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Patrón de corte</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="72×102 → 2×3"
                  value={form.defaults_proceso.guillotina?.patron_corte ?? ""}
                  onChange={(e) =>
                    set("defaults_proceso", {
                      ...form.defaults_proceso,
                      guillotina: {
                        ...form.defaults_proceso.guillotina,
                        patron_corte: e.target.value || null,
                      },
                    })
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Tamaño final</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="360×510"
                  value={form.defaults_proceso.guillotina?.tamano_final ?? ""}
                  onChange={(e) =>
                    set("defaults_proceso", {
                      ...form.defaults_proceso,
                      guillotina: {
                        ...form.defaults_proceso.guillotina,
                        tamano_final: e.target.value || null,
                      },
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* FSC */}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Certificación FSC
          </p>
          <div className="grid grid-cols-2 items-end gap-3">
            <div className="flex items-center gap-2 pb-1">
              <Checkbox
                id="fsc-check"
                checked={form.fsc}
                onCheckedChange={(v) => set("fsc", Boolean(v))}
              />
              <Label htmlFor="fsc-check" className="cursor-pointer text-xs">
                Artículo certificado FSC
              </Label>
            </div>
            {form.fsc ? (
              <div className="grid gap-1">
                <Label className="text-xs">Fecha validación FSC</Label>
                <Input
                  className="h-8 text-xs"
                  type="date"
                  value={form.fsc_fecha_validacion}
                  onChange={(e) => set("fsc_fecha_validacion", e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {/* Notas */}
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Notas
          </p>
          <Textarea
            className="min-h-[60px] text-xs"
            placeholder="Observaciones, incidencias históricas…"
            value={form.notas}
            onChange={(e) => set("notas", e.target.value)}
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handlePdfFicha}
            disabled={saving || !form.codigo.trim()}
            title="Descarga ficha técnica A4 (1 hoja) con habituales y promedios"
          >
            <FileDown className="size-3.5" />
            PDF ficha
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving || !form.codigo.trim()}>
              {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ArticulosMaestroPage() {
  const supabase = createSupabaseBrowserClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ProdReferenciaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroActivo, setFiltroActivo] = useState("activos");
  const [filtroCompletitud, setFiltroCompletitud] = useState("todos");

  // Modal editar
  const [editingRow, setEditingRow] = useState<ProdReferenciaRow | null>(null);
  const [editForm, setEditForm] = useState<ArticuloForm>(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal crear
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ArticuloForm>(EMPTY_FORM);
  const [savingCreate, setSavingCreate] = useState(false);

  // Import
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importDiff, setImportDiff] = useState<ArticuloDiffResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importIncluirModificados, setImportIncluirModificados] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);

  // Promedios (Bloque 6.x Paso C)
  const [updatingPromedios, setUpdatingPromedios] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchAllProdReferencias(supabase));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando artículos");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  // ── Filtered rows ───────────────────────────────────────────────────────────

  const rowsFiltradas = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    return rows.filter((r) => {
      const matchTexto =
        !q ||
        r.codigo.toLowerCase().includes(q) ||
        (r.referencia_cliente ?? "").toLowerCase().includes(q) ||
        (r.descripcion ?? "").toLowerCase().includes(q) ||
        (r.cliente ?? "").toLowerCase().includes(q);
      const matchCliente = filtroCliente === "todos" || r.cliente === filtroCliente;
      const matchTipo = filtroTipo === "todos" || r.tipo_producto === filtroTipo;
      const matchActivo =
        filtroActivo === "todos" ||
        (filtroActivo === "activos" && r.activo) ||
        (filtroActivo === "inactivos" && !r.activo);
      const nivel = completitudNivel(r);
      const matchCompletitud =
        filtroCompletitud === "todos" ||
        (filtroCompletitud === "sin_tecnica_o_menos" &&
          (nivel === "sin_tecnica" || nivel === "solo_codigo")) ||
        filtroCompletitud === nivel;
      return (
        matchTexto && matchCliente && matchTipo && matchActivo && matchCompletitud
      );
    });
  }, [rows, filtroTexto, filtroCliente, filtroTipo, filtroActivo, filtroCompletitud]);

  const completitudCounts = useMemo(() => {
    const acc = { solo_codigo: 0, sin_tecnica: 0, parcial: 0, completa: 0 };
    for (const r of rows) acc[completitudNivel(r)] += 1;
    return acc;
  }, [rows]);

  const clientesUnicos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.cliente).filter(Boolean) as string[])).sort(),
    [rows]
  );
  const tiposUnicos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.tipo_producto).filter(Boolean) as string[])).sort(),
    [rows]
  );

  // ── Crear ───────────────────────────────────────────────────────────────────

  const openCreate = useCallback(() => {
    const nextNum = rows.reduce((max, r) => {
      const m = r.codigo.match(/^M-(\d{5})$/);
      if (m) { const n = parseInt(m[1], 10); return n > max ? n : max; }
      return max;
    }, 0);
    const nextCodigo = `M-${String(nextNum + 1).padStart(5, "0")}`;
    setCreateForm({ ...EMPTY_FORM, codigo: nextCodigo });
    setCreateOpen(true);
  }, [rows]);

  const handleCreate = useCallback(async () => {
    if (!createForm.codigo.trim()) return;
    setSavingCreate(true);
    try {
      const { error: err } = await supabase
        .from("prod_referencias")
        .insert(formToPayload(createForm));
      if (err) throw err;
      toast.success(`Artículo ${createForm.codigo} creado`);
      setCreateOpen(false);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error creando artículo");
    } finally {
      setSavingCreate(false);
    }
  }, [createForm, supabase, loadData]);

  // ── Editar ──────────────────────────────────────────────────────────────────

  const openEdit = useCallback((row: ProdReferenciaRow) => {
    setEditingRow(row);
    setEditForm(rowToForm(row));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingRow) return;
    setSavingEdit(true);
    try {
      const { error: err } = await supabase
        .from("prod_referencias")
        .update(formToPayload(editForm))
        .eq("id", editingRow.id);
      if (err) throw err;
      toast.success(`Artículo ${editingRow.codigo} actualizado`);
      setEditingRow(null);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error guardando cambios");
    } finally {
      setSavingEdit(false);
    }
  }, [editingRow, editForm, supabase, loadData]);

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = useCallback(() => {
    exportarArticulosAExcel(rowsFiltradas);
  }, [rowsFiltradas]);

  const handleExportPdf = useCallback(() => {
    exportarArticulosAPdf(rowsFiltradas);
  }, [rowsFiltradas]);

  // ── Promedios (§7.1.9 paso 4) ────────────────────────────────────────────────

  const runActualizarPromedios = useCallback(
    async (referenciaIds: string[] | undefined, scopeLabel: string) => {
      const confirmMsg =
        referenciaIds && referenciaIds.length > 0
          ? `¿Recalcular promedios de ${referenciaIds.length} artículo(s) (${scopeLabel})?\n\n` +
            "Solo actualiza columnas *_promedio (nunca oficiales ni habituales)."
          : "¿Recalcular promedios de TODAS las referencias con OTs en histórico?\n\n" +
            "Solo actualiza columnas *_promedio (nunca valores oficiales ni habituales).\n" +
            "Puede tardar unos segundos si hay muchas OTs cerradas.";
      if (!window.confirm(confirmMsg)) return;

      setUpdatingPromedios(true);
      try {
        const result = await actualizarPromediosMaestro(
          supabase,
          referenciaIds && referenciaIds.length > 0
            ? { referenciaIds }
            : undefined,
        );
        if (result.referenciasActualizadas === 0 && result.referenciasFallidas === 0) {
          toast.message("Sin datos para promediar", {
            description:
              "No hay OTs en histórico con referencia y no excluidas de promedios" +
              (referenciaIds?.length ? " para la selección." : "."),
          });
        } else if (result.referenciasFallidas > 0) {
          toast.warning(
            `Promedios: ${result.referenciasActualizadas} OK, ${result.referenciasFallidas} con error`,
            {
              description: `OTs usadas: ${result.otsUsadas}. Revisar permisos RLS o IDs huérfanos.`,
            },
          );
        } else {
          toast.success(
            `Promedios actualizados: ${result.referenciasActualizadas} referencias`,
            { description: `Basado en ${result.otsUsadas} OTs del histórico.` },
          );
        }
        await loadData();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Error actualizando promedios",
        );
      } finally {
        setUpdatingPromedios(false);
      }
    },
    [supabase, loadData],
  );

  const handleActualizarPromediosTodos = useCallback(() => {
    void runActualizarPromedios(undefined, "todas");
  }, [runActualizarPromedios]);

  const handleActualizarPromediosSeleccion = useCallback(() => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      toast.message("Nada seleccionado", {
        description: "Marca artículos en la tabla o usa «Actualizar filtrados».",
      });
      return;
    }
    void runActualizarPromedios(ids, "seleccionados");
  }, [runActualizarPromedios, selectedIds]);

  const handleActualizarPromediosFiltrados = useCallback(() => {
    const ids = rowsFiltradas.map((r) => r.id);
    if (ids.length === 0) {
      toast.message("Filtro vacío", {
        description: "No hay artículos visibles con el filtro actual.",
      });
      return;
    }
    void runActualizarPromedios(ids, "filtrados");
  }, [runActualizarPromedios, rowsFiltradas]);

  const handleRecalcularArticuloEditando = useCallback(() => {
    if (!editingRow) return;
    void runActualizarPromedios([editingRow.id], editingRow.codigo);
  }, [editingRow, runActualizarPromedios]);

  const allFilteredSelected =
    rowsFiltradas.length > 0 &&
    rowsFiltradas.every((r) => selectedIds.has(r.id));

  const toggleSelectAllFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const r of rowsFiltradas) next.delete(r.id);
      } else {
        for (const r of rowsFiltradas) next.add(r.id);
      }
      return next;
    });
  }, [allFilteredSelected, rowsFiltradas]);

  const toggleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImportFile(file);
      setImportLoading(true);
      setImportError(null);
      setImportDiff(null);
      try {
        const existingCodigos = rows.map((r) => r.codigo);
        const parsed = await parseArticulosExcelFile(file, existingCodigos);
        const diff = computeArticulosDiff(parsed, rows);
        setImportDiff(diff);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Error procesando Excel");
      } finally {
        setImportLoading(false);
      }
    },
    [rows]
  );

  const handleImportConfirm = useCallback(async () => {
    if (!importDiff || !importFile) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const freshRows = await fetchAllProdReferencias(supabase);
      setRows(freshRows);
      const existingCodigos = freshRows.map((r) => r.codigo);
      const parsed = await parseArticulosExcelFile(importFile, existingCodigos);
      const diffToApply = computeArticulosDiff(parsed, freshRows);

      const { insertados, actualizados, omitidos, duplicados } = await aplicarArticulosDiff(
        supabase,
        diffToApply,
        { incluirModificados: importIncluirModificados }
      );
      const summary = `Importación completa: ${insertados} nuevos, ${actualizados} actualizados${
        duplicados > 0 ? `, ${duplicados} duplicados saltados` : ""
      }`;
      if (omitidos.length > 0) {
        setImportError(
          `${summary}. Omitidos ${omitidos.length}: ${omitidos.slice(0, 5).join(" | ")}${
            omitidos.length > 5 ? " | ..." : ""
          }`
        );
        toast.warning(`${summary}. Omitidos ${omitidos.length}.`);
      } else {
        if (duplicados > 0) {
          toast.warning(summary);
        } else {
          toast.success(summary);
        }
        setImportOpen(false);
        setImportFile(null);
        setImportDiff(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      await loadData();
    } catch (e) {
      setImportError(formatImportError(e));
    } finally {
      setImportLoading(false);
    }
  }, [importDiff, importFile, importIncluirModificados, supabase, loadData]);

  const resetImport = useCallback(() => {
    setImportFile(null);
    setImportDiff(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full min-w-0 max-w-[100vw] space-y-4 overflow-x-hidden">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2">
          <Boxes className="size-5 text-[#002147]" />
          <h1 className="font-heading text-xl font-bold text-[#002147] md:text-2xl">
            Maestro de Artículos
          </h1>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          Catálogo de referencias Minerva · {rows.length} artículos ·{" "}
          {rows.filter((r) => r.activo).length} activos
        </p>
        {rows.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
              ✅ {completitudCounts.completa} completas
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-amber-700">
              🟡 {completitudCounts.parcial} parciales
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-red-700">
              🔴 {completitudCounts.sin_tecnica} sin técnica
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-500">
              ⚫ {completitudCounts.solo_codigo} solo código
            </span>
          </div>
        )}
      </header>

      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="size-3.5" />
          Crear nuevo
        </Button>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="gap-1.5">
          <Upload className="size-3.5" />
          Importar Excel
        </Button>
        <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5">
          <Download className="size-3.5" />
          Exportar Excel ({rowsFiltradas.length})
        </Button>
        <Button size="sm" variant="outline" onClick={handleExportPdf} className="gap-1.5">
          <FileText className="size-3.5" />
          Exportar PDF
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={descargarPlantillaArticulos}
          className="gap-1.5 text-slate-500"
        >
          <FileSpreadsheet className="size-3.5" />
          Plantilla Excel
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleActualizarPromediosTodos()}
          disabled={updatingPromedios || loading}
          className="gap-1.5"
          title="Recalcula *_promedio de todas las referencias con histórico. No toca oficiales."
        >
          {updatingPromedios ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {updatingPromedios ? "Actualizando…" : "Actualizar todas"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleActualizarPromediosFiltrados()}
          disabled={updatingPromedios || loading || rowsFiltradas.length === 0}
          className="gap-1.5"
          title="Solo artículos visibles con el filtro actual."
        >
          Actualizar filtrados ({rowsFiltradas.length})
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleActualizarPromediosSeleccion()}
          disabled={updatingPromedios || loading || selectedIds.size === 0}
          className="gap-1.5"
          title="Solo filas marcadas con checkbox."
        >
          Actualizar seleccionados ({selectedIds.size})
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Buscar código, EU, descripción, cliente…"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
          {filtroTexto && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setFiltroTexto("")}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
        >
          <option value="todos">Todos los clientes</option>
          {clientesUnicos.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="todos">Todos los tipos</option>
          {tiposUnicos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={filtroActivo}
          onChange={(e) => setFiltroActivo(e.target.value)}
        >
          <option value="activos">Solo activos</option>
          <option value="todos">Todos (incl. inactivos)</option>
          <option value="inactivos">Solo inactivos</option>
        </select>

        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={filtroCompletitud}
          onChange={(e) => setFiltroCompletitud(e.target.value)}
        >
          <option value="todos">Toda completitud</option>
          <option value="completa">✅ Completas</option>
          <option value="parcial">🟡 Parciales</option>
          <option value="sin_tecnica">🔴 Sin técnica</option>
          <option value="solo_codigo">⚫ Solo código</option>
          <option value="sin_tecnica_o_menos">⚠️ Sin técnica o menos</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <Alert className="border-red-200 bg-red-50 text-red-700">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-slate-400" />
        </div>
      ) : rowsFiltradas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          {rows.length === 0
            ? "No hay artículos todavía. Crea uno o importa un Excel."
            : "No hay artículos que coincidan con los filtros."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="sticky left-0 z-10 w-11 min-w-[2.75rem] bg-slate-50 px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-[#002147]"
                    checked={allFilteredSelected}
                    onChange={() => toggleSelectAllFiltered()}
                    aria-label="Seleccionar todos los filtrados"
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Código</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Ref. cliente</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Descripción</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Cliente</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Tipo</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Material</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Ruta</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">Completitud</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">OTs</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rowsFiltradas.map((r) => (
                <tr
                  key={r.id}
                  className={`group transition hover:bg-slate-50 ${!r.activo ? "opacity-50" : ""}`}
                >
                  <td className="sticky left-0 z-10 bg-white px-2 py-2 text-center group-hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-[#002147]"
                      checked={selectedIds.has(r.id)}
                      onChange={(e) => toggleSelectOne(r.id, e.target.checked)}
                      aria-label={`Seleccionar ${r.codigo}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono font-medium text-[#002147]">{r.codigo}</td>
                  <td className="px-3 py-2 font-mono text-[#C69C2B]">
                    {r.referencia_cliente ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2 text-slate-700">
                    {r.descripcion ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2 text-slate-500">
                    {r.cliente ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {r.tipo_producto ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="max-w-[120px] truncate px-3 py-2 text-slate-500">
                    {r.material_habitual ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2 font-mono text-[10px] text-slate-400">
                    {r.ruta_habitual ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <CompletitudBadge nivel={completitudNivel(r)} />
                  </td>
                  <td className="px-3 py-2 text-center text-slate-400">
                    {r.total_repeticiones > 0 ? (
                      <span className="font-medium text-slate-600">{r.total_repeticiones}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        title="PDF ficha A4"
                        onClick={() => {
                          try {
                            exportArticuloFichaPdf(r);
                            toast.success(`PDF ficha · ${r.codigo}`);
                          } catch (e) {
                            toast.error(
                              e instanceof Error ? e.message : "No se pudo generar el PDF",
                            );
                          }
                        }}
                      >
                        <FileDown className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Crear */}
      <ArticuloFormDialog
        open={createOpen}
        title="Crear nuevo artículo"
        description="El código se auto-sugerirá pero puedes cambiarlo."
        form={createForm}
        saving={savingCreate}
        onFormChange={setCreateForm}
        onSave={handleCreate}
        onClose={() => setCreateOpen(false)}
      />

      {/* Modal Editar */}
      <ArticuloFormDialog
        open={!!editingRow}
        title={`Editar artículo · ${editingRow?.codigo ?? ""}`}
        form={editForm}
        saving={savingEdit}
        onFormChange={setEditForm}
        onSave={handleSaveEdit}
        onClose={() => setEditingRow(null)}
        showCodigo={false}
        promediosRow={
          editingRow
            ? (rows.find((r) => r.id === editingRow.id) ?? editingRow)
            : null
        }
        onRecalcularPromedios={handleRecalcularArticuloEditando}
        recalculandoPromedios={updatingPromedios}
      />

      {/* Modal Import */}
      <Dialog
        open={importOpen}
        onOpenChange={(o) => {
          if (!o) { setImportOpen(false); resetImport(); }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar artículos desde Excel</DialogTitle>
            <DialogDescription>
              Sube un Excel con la misma estructura de la plantilla. Las celdas vacías no
              sobrescriben datos existentes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={importLoading}
            >
              <Upload className="size-3.5" />
              {importFile ? importFile.name : "Seleccionar archivo…"}
            </Button>

            {importLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="size-3.5 animate-spin" />
                Procesando…
              </div>
            )}

            {importError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-xs text-red-700">{importError}</AlertDescription>
              </Alert>
            )}

            {importDiff && !importLoading && (
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <p className="font-medium text-slate-700">Vista previa de cambios:</p>
                <div className="flex gap-4">
                  <span className="text-emerald-700">
                    ✅ {importDiff.nuevos.length} nuevos
                  </span>
                  <span className="text-amber-700">
                    ✏️ {importDiff.modificados.length} con cambios
                  </span>
                  <span className="text-slate-500">
                    — {importDiff.sinCambios.length} sin cambios
                  </span>
                </div>
                {importDiff.modificados.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      id="incluir-mod"
                      checked={importIncluirModificados}
                      onCheckedChange={(v) => setImportIncluirModificados(Boolean(v))}
                    />
                    <Label htmlFor="incluir-mod" className="cursor-pointer text-xs">
                      Actualizar también los {importDiff.modificados.length} modificados
                    </Label>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setImportOpen(false); resetImport(); }}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!importDiff || importLoading}
              onClick={handleImportConfirm}
            >
              {importLoading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              {importDiff
                ? `Importar ${importDiff.nuevos.length + (importIncluirModificados ? importDiff.modificados.length : 0)} artículos`
                : "Importar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
