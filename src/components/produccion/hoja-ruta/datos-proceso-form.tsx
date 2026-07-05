"use client";

import { useMemo, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  getCamposConfigByProcesoId,
  type CampoDefinicion,
  type CampoWidth,
  type DatosProcesoGenerico,
  type DensidadTinta,
} from "@/lib/hoja-ruta-campos-config";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

type DatosProcesoFormProps = {
  procesoId: number;
  procesoNombre?: string;
  material?: string | null;
  datosInicial?: DatosProcesoGenerico;
  onChange?: (datos: DatosProcesoGenerico) => void;
  readonly?: boolean;
  /**
   * Permite derivar campos a partir del campo que se acaba de editar
   * (ej: hojas buenas = netas − merma). Devuelve los datos ya ajustados.
   */
  computeDerived?: (
    datos: DatosProcesoGenerico,
    changedFieldId: string,
  ) => DatosProcesoGenerico;
  /**
   * Opciones dinámicas por id de campo select (ej: cajas de embalaje cargadas
   * de BD). Si existe entrada para un campo, sustituye `campo.options`.
   */
  dynamicOptions?: Record<string, { value: string; label: string }[]>;
  /** Oculta campos (p. ej. checkboxes CTP gestionados en bloque aparte). */
  excludeFieldIds?: string[];
};

/** Traduce el ancho de un campo a clases de columna en una rejilla de 6. */
function widthToColClass(width: CampoWidth | undefined): string {
  switch (width) {
    case "third":
      return "col-span-6 sm:col-span-3 md:col-span-2";
    case "half":
      return "col-span-6 md:col-span-3";
    case "full":
    default:
      return "col-span-6";
  }
}

type MaterialFamilia = "estucado" | "offset" | "cartoncillo" | "generico";

const MATERIAL_FAMILY_LABELS: Record<MaterialFamilia, string> = {
  estucado: "estucado",
  offset: "offset / sin estucar",
  cartoncillo: "cartoncillo / folding",
  generico: "genérico",
};

const DENSIDAD_RANGOS: Record<
  MaterialFamilia,
  Partial<Record<string, { min: number; max: number; label: string }>>
> = {
  estucado: {
    BLACK: { min: 1.55, max: 1.75, label: "1.55-1.75" },
    CYAN: { min: 1.4, max: 1.55, label: "1.40-1.55" },
    MAGENTA: { min: 1.4, max: 1.55, label: "1.40-1.55" },
    YELLOW: { min: 1, max: 1.1, label: "1.00-1.10" },
  },
  offset: {
    BLACK: { min: 1.2, max: 1.4, label: "1.20-1.40" },
    CYAN: { min: 1, max: 1.2, label: "1.00-1.20" },
    MAGENTA: { min: 1, max: 1.2, label: "1.00-1.20" },
    YELLOW: { min: 0.85, max: 0.95, label: "0.85-0.95" },
  },
  cartoncillo: {
    BLACK: { min: 1.4, max: 1.65, label: "1.40-1.65" },
    CYAN: { min: 1.3, max: 1.5, label: "1.30-1.50" },
    MAGENTA: { min: 1.3, max: 1.5, label: "1.30-1.50" },
    YELLOW: { min: 0.95, max: 1.05, label: "0.95-1.05" },
  },
  generico: {
    BLACK: { min: 1.3, max: 1.7, label: "1.30-1.70" },
    CYAN: { min: 1.3, max: 1.5, label: "1.30-1.50" },
    MAGENTA: { min: 1.3, max: 1.5, label: "1.30-1.50" },
    YELLOW: { min: 0.9, max: 1.05, label: "0.90-1.05" },
  },
};

function classifyMaterialFamilia(material: string | null | undefined): MaterialFamilia {
  const raw = String(material ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!raw) return "generico";
  if (/(zenith|aliking|folding|dorso gris|madera|reciclad|cartoncill)/.test(raw)) {
    return "cartoncillo";
  }
  if (/(estucad|couche|couhe|mate|brillo)/.test(raw)) return "estucado";
  if (/(offset|sin estucar|no estucad)/.test(raw)) return "offset";
  return "generico";
}

function getDensidadRango(
  familia: MaterialFamilia,
  tinta: string,
): { min: number; max: number; label: string } | null {
  return DENSIDAD_RANGOS[familia][tinta] ?? DENSIDAD_RANGOS.generico[tinta] ?? null;
}

/**
 * Formulario dinámico que renderiza campos según la configuración del proceso.
 */
export function DatosProcesoForm({
  procesoId,
  procesoNombre,
  material,
  datosInicial = {},
  onChange,
  readonly = false,
  computeDerived,
  dynamicOptions,
  excludeFieldIds,
}: DatosProcesoFormProps) {
  const [datos, setDatos] = useState<DatosProcesoGenerico>(datosInicial);

  // Sincroniza con el padre (p. ej. checkboxes CTP fuera de este formulario).
  useEffect(() => {
    setDatos(datosInicial);
  }, [datosInicial]);

  const config = useMemo(() => getCamposConfigByProcesoId(procesoId), [procesoId]);
  const excludeSet = useMemo(
    () => new Set(excludeFieldIds ?? []),
    [excludeFieldIds],
  );

  const handleChange = useCallback(
    (fieldId: string, value: unknown) => {
      const merged = { ...datos, [fieldId]: value };
      const newDatos = computeDerived ? computeDerived(merged, fieldId) : merged;
      setDatos(newDatos);
      onChange?.(newDatos);
    },
    [datos, onChange, computeDerived]
  );

  const handleArrayAdd = useCallback(
    (fieldId: string) => {
      const current = (datos[fieldId] as string[] | undefined) ?? [];
      handleChange(fieldId, [...current, ""]);
    },
    [datos, handleChange]
  );

  const handleArrayRemove = useCallback(
    (fieldId: string, index: number) => {
      const current = (datos[fieldId] as string[] | undefined) ?? [];
      handleChange(
        fieldId,
        current.filter((_, i) => i !== index)
      );
    },
    [datos, handleChange]
  );

  const handleArrayItemChange = useCallback(
    (fieldId: string, index: number, value: string) => {
      const current = (datos[fieldId] as string[] | undefined) ?? [];
      const updated = [...current];
      updated[index] = value;
      handleChange(fieldId, updated);
    },
    [datos, handleChange]
  );

  if (!config) {
    return (
      <div className="text-sm text-muted-foreground">
        No hay configuración de campos para este proceso (ID: {procesoId}).
      </div>
    );
  }

  const shouldShowField = (campo: CampoDefinicion): boolean => {
    if (!campo.conditionalOn) return true;
    const conditionValue = datos[campo.conditionalOn];
    return conditionValue === campo.conditionalValue;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-lg font-semibold">
          {procesoNombre ?? config.procesoNombre}
        </h3>
        {readonly && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            Solo lectura
          </span>
        )}
      </div>

      <div className="grid grid-cols-6 gap-3">
        {config.campos.map((campo) => {
          if (excludeSet.has(campo.id)) return null;
          if (!shouldShowField(campo)) return null;

          const colClass = widthToColClass(campo.width);
          let content: ReactNode;

          // Campo con previsto/real: el operario solo debe tocar "Real".
          if (campo.hasPrevistoReal) {
            content = (
              <div className="h-full rounded-lg border border-slate-200 bg-white p-2.5">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#002147]">{campo.label}</p>
                  <span className="rounded-full bg-[#C69C2B]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#7A5B12]">
                    Solo Real si cambia
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md border border-slate-200 bg-slate-50/80 p-1.5">
                    <CampoInput
                      campo={{ ...campo, id: `${campo.id}_previsto` }}
                      label="Previsto"
                      value={datos[`${campo.id}_previsto`]}
                      onChange={() => undefined}
                      readonly={true}
                      tone="previsto"
                    />
                  </div>
                  <div className="rounded-md border border-[#C69C2B]/40 bg-[#C69C2B]/5 p-1.5 shadow-[inset_3px_0_0_rgba(198,156,43,0.75)]">
                    <CampoInput
                      campo={{ ...campo, id: `${campo.id}_real` }}
                      label="Real"
                      value={datos[`${campo.id}_real`]}
                      onChange={(v) => handleChange(`${campo.id}_real`, v)}
                      readonly={readonly}
                      tone="real"
                    />
                  </div>
                </div>
              </div>
            );
          } else if (campo.tipo === "densidades") {
            content = (
              <CampoDensidades
                campo={campo}
                material={material}
                value={normalizeDensidades(datos[campo.id])}
                onChange={(next) => handleChange(campo.id, next)}
                readonly={readonly}
              />
            );
          } else if (campo.tipo === "array") {
            content = (
              <CampoArray
                campo={campo}
                value={(datos[campo.id] as string[] | undefined) ?? []}
                onAdd={() => handleArrayAdd(campo.id)}
                onRemove={(idx) => handleArrayRemove(campo.id, idx)}
                onItemChange={(idx, val) => handleArrayItemChange(campo.id, idx, val)}
                readonly={readonly}
              />
            );
          } else {
            const overrideOptions = dynamicOptions?.[campo.id];
            content = (
              <CampoInput
                campo={overrideOptions ? { ...campo, options: overrideOptions } : campo}
                label={campo.label}
                value={datos[campo.id]}
                onChange={(v) => handleChange(campo.id, v)}
                readonly={readonly}
                tone={campo.emphasis === "real" ? "real" : "normal"}
              />
            );
          }

          return (
            <div key={campo.id} className={colClass}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Componente individual para renderizar un campo
// ============================================================================
type CampoInputProps = {
  campo: CampoDefinicion;
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  readonly: boolean;
  tone?: "normal" | "previsto" | "real";
};

function CampoInput({ campo, label, value, onChange, readonly, tone = "normal" }: CampoInputProps) {
  const labelWithRequired = campo.required ? `${label} *` : label;
  const labelClassName =
    tone === "real"
      ? "text-[#002147] font-semibold"
      : tone === "previsto"
        ? "text-slate-500"
        : undefined;
  const inputClassName =
    tone === "real"
      ? "border-[#C69C2B]/60 bg-white font-medium focus-visible:ring-[#C69C2B]/40"
      : tone === "previsto"
        ? "bg-slate-100 text-slate-500"
        : undefined;

  // TEXT
  if (campo.tipo === "text" || campo.tipo === "tintas") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={campo.id} className={labelClassName}>{labelWithRequired}</Label>
        <Input
          id={campo.id}
          type="text"
          placeholder={campo.placeholder}
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={readonly}
          className={inputClassName}
        />
        {campo.suffix && (
          <span className="text-xs text-muted-foreground">{campo.suffix}</span>
        )}
      </div>
    );
  }

  // DIMENSION (largo x ancho)
  if (campo.tipo === "dimension") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={campo.id} className={labelClassName}>{labelWithRequired}</Label>
        <Input
          id={campo.id}
          type="text"
          placeholder={campo.placeholder ?? "ej: 700 x 1000"}
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={readonly}
          className={inputClassName}
        />
        {campo.suffix && (
          <span className="text-xs text-muted-foreground">{campo.suffix}</span>
        )}
      </div>
    );
  }

  // NUMBER
  if (campo.tipo === "number") {
    return (
      <div className="space-y-1">
        <Label htmlFor={campo.id} className={labelClassName}>{labelWithRequired}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={campo.id}
            type="number"
            placeholder={campo.placeholder}
            value={(value as number | undefined) ?? ""}
            onChange={(e) =>
              onChange(e.target.value === "" ? undefined : Number(e.target.value))
            }
            min={campo.min}
            max={campo.max}
            step={campo.step}
            disabled={readonly}
            className={inputClassName}
          />
          {campo.suffix && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {campo.suffix}
            </span>
          )}
        </div>
        {campo.hint && (
          <p className="text-[10px] leading-tight text-slate-400">{campo.hint}</p>
        )}
      </div>
    );
  }

  // BOOLEAN (Checkbox)
  if (campo.tipo === "boolean") {
    return (
      <div className="flex items-center space-x-2">
        <Checkbox
          id={campo.id}
          checked={(value as boolean | undefined) ?? false}
          onCheckedChange={(checked) => onChange(checked === true)}
          disabled={readonly}
        />
        <Label htmlFor={campo.id} className={labelClassName ?? "cursor-pointer"}>
          {labelWithRequired}
        </Label>
      </div>
    );
  }

  // COMBO (input con sugerencias: opciones + texto libre)
  if (campo.tipo === "combo") {
    const listId = `${campo.id}-suggestions`;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={campo.id} className={labelClassName}>{labelWithRequired}</Label>
        <Input
          id={campo.id}
          type="text"
          list={listId}
          placeholder={campo.placeholder ?? "Selecciona o escribe…"}
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={readonly}
          className={inputClassName}
        />
        <datalist id={listId}>
          {campo.options?.map((opt) => (
            <option key={opt.value} value={opt.label} />
          ))}
        </datalist>
        {campo.hint && (
          <p className="text-[10px] leading-tight text-slate-400">{campo.hint}</p>
        )}
      </div>
    );
  }

  // SELECT
  if (campo.tipo === "select") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={campo.id} className={labelClassName}>{labelWithRequired}</Label>
        <Select
          value={(value as string | undefined) ?? ""}
          onValueChange={onChange}
          disabled={readonly}
        >
          <SelectTrigger id={campo.id} className={inputClassName}>
            <SelectValue placeholder="Seleccionar..." />
          </SelectTrigger>
          <SelectContent>
            {campo.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // TEXTAREA
  if (campo.tipo === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={campo.id} className={labelClassName}>{labelWithRequired}</Label>
        <Textarea
          id={campo.id}
          placeholder={campo.placeholder}
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={readonly}
          rows={3}
          className={inputClassName}
        />
      </div>
    );
  }

  return null;
}

// ============================================================================
// Componente para campos tipo array
// ============================================================================
type CampoArrayProps = {
  campo: CampoDefinicion;
  value: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onItemChange: (index: number, value: string) => void;
  readonly: boolean;
};

function CampoArray({
  campo,
  value,
  onAdd,
  onRemove,
  onItemChange,
  readonly,
}: CampoArrayProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{campo.label}</Label>
        {!readonly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAdd}
            className="h-7 gap-1"
          >
            <Plus className="h-3 w-3" />
            Añadir
          </Button>
        )}
      </div>

      {value.length === 0 && (
        <div className="text-sm text-muted-foreground italic">
          No hay elementos. Pulsa Añadir para crear uno.
        </div>
      )}

      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {campo.arrayItemType === "select" && campo.arrayItemOptions ? (
              <Select
                value={item}
                onValueChange={(v) => onItemChange(index, v ?? "")}
                disabled={readonly}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {campo.arrayItemOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type="text"
                value={item}
                onChange={(e) => onItemChange(index, e.target.value)}
                placeholder={campo.placeholder ?? `Elemento ${index + 1}`}
                disabled={readonly}
                className="flex-1"
              />
            )}
            {!readonly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(index)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Componente para densidades de tinta (tinta + valor 0–2 + ref Pantone)
// ============================================================================

/**
 * Normaliza el valor guardado a DensidadTinta[]. Acepta el formato antiguo
 * (string[] de nombres de tinta) y lo migra a objetos sin densidad.
 */
export function normalizeDensidades(raw: unknown): DensidadTinta[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): DensidadTinta | null => {
      if (typeof item === "string") {
        const tinta = item.trim();
        return tinta ? { tinta } : null;
      }
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const tinta = String(obj.tinta ?? "").trim();
        if (!tinta) return null;
        const densidadNum = Number(obj.densidad);
        return {
          tinta,
          densidad: Number.isFinite(densidadNum) ? densidadNum : undefined,
          ref: obj.ref ? String(obj.ref) : undefined,
          lote: obj.lote ? String(obj.lote).trim() || undefined : undefined,
        };
      }
      return null;
    })
    .filter((x): x is DensidadTinta => x !== null);
}

type CampoDensidadesProps = {
  campo: CampoDefinicion;
  material?: string | null;
  value: DensidadTinta[];
  onChange: (value: DensidadTinta[]) => void;
  readonly: boolean;
};

function CampoDensidades({ campo, material, value, onChange, readonly }: CampoDensidadesProps) {
  const opciones = campo.arrayItemOptions ?? [];
  const familia = classifyMaterialFamilia(material);
  const familiaLabel = MATERIAL_FAMILY_LABELS[familia];

  const update = (index: number, patch: Partial<DensidadTinta>) => {
    const next = value.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange(next);
  };
  const add = () => onChange([...value, { tinta: "CYAN" }]);
  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-semibold text-[#002147]">{campo.label}</Label>
          <p className="text-[10px] leading-tight text-slate-400">
            Guía ISO 12647 orientativa según material: {familiaLabel}. No bloquea el guardado.
          </p>
        </div>
        {!readonly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={add}
            className="h-7 gap-1"
          >
            <Plus className="h-3 w-3" />
            Tinta
          </Button>
        )}
      </div>

      {value.length === 0 && (
        <div className="text-xs italic text-muted-foreground">
          Sin densidades. Pulsa «Tinta» para añadir.
        </div>
      )}

      <div className="space-y-1.5">
        {value.map((item, index) => {
          const esPantone = item.tinta === "PANTONE";
          const rango = getDensidadRango(familia, item.tinta);
          const fueraRango =
            rango &&
            item.densidad != null &&
            (item.densidad < rango.min || item.densidad > rango.max);
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center gap-2">
                <Select
                  value={item.tinta}
                  onValueChange={(v) => update(index, { tinta: v ?? "" })}
                  disabled={readonly}
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Tinta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {opciones.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {esPantone && (
                  <Input
                    type="text"
                    value={item.ref ?? ""}
                    onChange={(e) => update(index, { ref: e.target.value })}
                    placeholder="nº Pantone"
                    disabled={readonly}
                    className="h-8 w-24"
                  />
                )}

                <Input
                  type="text"
                  value={item.lote ?? ""}
                  onChange={(e) => update(index, { lote: e.target.value })}
                  placeholder="Lote"
                  disabled={readonly}
                  className="h-8 w-28"
                  aria-label="Lote tinta"
                />

                <Input
                  type="number"
                  inputMode="decimal"
                  step={0.01}
                  min={0}
                  max={2}
                  value={item.densidad ?? ""}
                  onChange={(e) =>
                    update(index, {
                      densidad: e.target.value === "" ? undefined : Number(e.target.value),
                    })
                  }
                  placeholder={rango?.label ?? "0.00"}
                  disabled={readonly}
                  className={`h-8 w-20 text-right ${
                    fueraRango ? "border-amber-400 bg-amber-50 focus-visible:ring-amber-300" : ""
                  }`}
                  aria-label="Densidad"
                />

                {!readonly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(index)}
                    className="h-8 w-8 shrink-0 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {rango ? (
                <p
                  className={`pl-1 text-[10px] leading-tight ${
                    fueraRango ? "font-medium text-amber-700" : "text-slate-400"
                  }`}
                >
                  Objetivo orientativo {familiaLabel}: {rango.label}
                  {fueraRango ? " · revisar ajuste/papel" : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
