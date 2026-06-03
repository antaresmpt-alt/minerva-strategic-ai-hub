"use client";

import { useMemo, useState, useCallback } from "react";
import {
  getCamposConfigByProcesoId,
  type CampoDefinicion,
  type DatosProcesoGenerico,
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
  datosInicial?: DatosProcesoGenerico;
  onChange?: (datos: DatosProcesoGenerico) => void;
  readonly?: boolean;
};

/**
 * Formulario dinámico que renderiza campos según la configuración del proceso.
 */
export function DatosProcesoForm({
  procesoId,
  procesoNombre,
  datosInicial = {},
  onChange,
  readonly = false,
}: DatosProcesoFormProps) {
  const [datos, setDatos] = useState<DatosProcesoGenerico>(datosInicial);

  const config = useMemo(() => getCamposConfigByProcesoId(procesoId), [procesoId]);

  const handleChange = useCallback(
    (fieldId: string, value: unknown) => {
      const newDatos = { ...datos, [fieldId]: value };
      setDatos(newDatos);
      onChange?.(newDatos);
    },
    [datos, onChange]
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

      <div className="space-y-4">
        {config.campos.map((campo) => {
          if (!shouldShowField(campo)) return null;

          // Campo con previsto/real → renderizar dos campos
          if (campo.hasPrevistoReal) {
            return (
              <div key={campo.id} className="grid grid-cols-2 gap-4">
                <CampoInput
                  campo={{ ...campo, id: `${campo.id}_previsto` }}
                  label={`${campo.label} (Previsto)`}
                  value={datos[`${campo.id}_previsto`]}
                  onChange={(v) => handleChange(`${campo.id}_previsto`, v)}
                  readonly={readonly}
                />
                <CampoInput
                  campo={{ ...campo, id: `${campo.id}_real` }}
                  label={`${campo.label} (Real)`}
                  value={datos[`${campo.id}_real`]}
                  onChange={(v) => handleChange(`${campo.id}_real`, v)}
                  readonly={readonly}
                />
              </div>
            );
          }

          // Campo normal
          if (campo.tipo === "array") {
            return (
              <CampoArray
                key={campo.id}
                campo={campo}
                value={(datos[campo.id] as string[] | undefined) ?? []}
                onAdd={() => handleArrayAdd(campo.id)}
                onRemove={(idx) => handleArrayRemove(campo.id, idx)}
                onItemChange={(idx, val) => handleArrayItemChange(campo.id, idx, val)}
                readonly={readonly}
              />
            );
          }

          return (
            <CampoInput
              key={campo.id}
              campo={campo}
              label={campo.label}
              value={datos[campo.id]}
              onChange={(v) => handleChange(campo.id, v)}
              readonly={readonly}
            />
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
};

function CampoInput({ campo, label, value, onChange, readonly }: CampoInputProps) {
  const labelWithRequired = campo.required ? `${label} *` : label;

  // TEXT
  if (campo.tipo === "text" || campo.tipo === "tintas") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={campo.id}>{labelWithRequired}</Label>
        <Input
          id={campo.id}
          type="text"
          placeholder={campo.placeholder}
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={readonly}
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
        <Label htmlFor={campo.id}>{labelWithRequired}</Label>
        <Input
          id={campo.id}
          type="text"
          placeholder={campo.placeholder ?? "ej: 700 x 1000"}
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={readonly}
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
      <div className="space-y-1.5">
        <Label htmlFor={campo.id}>{labelWithRequired}</Label>
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
            disabled={readonly}
          />
          {campo.suffix && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {campo.suffix}
            </span>
          )}
        </div>
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
        <Label htmlFor={campo.id} className="cursor-pointer">
          {labelWithRequired}
        </Label>
      </div>
    );
  }

  // SELECT
  if (campo.tipo === "select") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={campo.id}>{labelWithRequired}</Label>
        <Select
          value={(value as string | undefined) ?? ""}
          onValueChange={onChange}
          disabled={readonly}
        >
          <SelectTrigger id={campo.id}>
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
        <Label htmlFor={campo.id}>{labelWithRequired}</Label>
        <Textarea
          id={campo.id}
          placeholder={campo.placeholder}
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={readonly}
          rows={3}
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
                onValueChange={(v) => onItemChange(index, v)}
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
