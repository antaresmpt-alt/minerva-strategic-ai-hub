"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { isDecimalDraft, parseDecimalLoose } from "@/lib/parse-decimal-input";

type DecimalInputProps = Omit<
  ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "inputMode"
> & {
  /** Valor numérico controlado (o vacío). */
  value: number | null | undefined;
  /** Emite número parseado, o `undefined` si el campo queda vacío. */
  onValueChange: (value: number | undefined) => void;
};

function valueToDraft(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return String(value);
}

/**
 * Input decimal permisivo: acepta `.` y `,` mientras se escribe
 * (teclado ES + teclado numérico), sin perder el borrador intermedio ("0,", "1.").
 */
export function DecimalInput({
  value,
  onValueChange,
  onFocus,
  onBlur,
  ...rest
}: DecimalInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => valueToDraft(value));

  useEffect(() => {
    if (!focused) setDraft(valueToDraft(value));
  }, [value, focused]);

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      value={focused ? draft : valueToDraft(value)}
      onFocus={(e) => {
        setFocused(true);
        setDraft(valueToDraft(value));
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        const t = draft.trim();
        if (!t) {
          onValueChange(undefined);
          setDraft("");
        } else {
          const n = parseDecimalLoose(t);
          if (n != null) {
            onValueChange(n);
            setDraft(String(n));
          } else {
            setDraft(valueToDraft(value));
          }
        }
        onBlur?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== "" && !isDecimalDraft(raw)) return;
        setDraft(raw);
        const t = raw.trim();
        if (!t) {
          onValueChange(undefined);
          return;
        }
        // Borrador incompleto: no empujar al padre todavía
        if (t === "-" || t === "." || t === "," || /[.,]$/.test(t)) return;
        const n = parseDecimalLoose(t);
        if (n != null) onValueChange(n);
      }}
    />
  );
}
