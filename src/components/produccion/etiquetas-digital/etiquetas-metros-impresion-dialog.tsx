"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nº OT a mostrar en el título (informativo). */
  otNumero: string | null;
  /** Valor inicial del input (si la fila ya tenía metros guardados). */
  valorInicial: number | null;
  /**
   * Callback al confirmar. Recibe el número de metros (≥ 0) o `null` si el
   * usuario pulsa "Omitir". El llamador es responsable de cerrar el diálogo
   * cuando termine la persistencia (se llama con `onOpenChange(false)`).
   */
  onConfirmar: (metros: number | null) => void | Promise<void>;
};

/** Parsea coma/punto a número decimal. Devuelve null si vacío o inválido. */
function parseMetrosInput(raw: string): {
  ok: boolean;
  value: number | null;
  error?: string;
} {
  const t = raw.trim().replace(",", ".");
  if (!t) return { ok: true, value: null };
  const n = Number(t);
  if (!Number.isFinite(n)) {
    return { ok: false, value: null, error: "Introduce un número válido." };
  }
  if (n < 0) {
    return { ok: false, value: null, error: "Los metros no pueden ser negativos." };
  }
  return { ok: true, value: n };
}

export function EtiquetasMetrosImpresionDialog({
  open,
  onOpenChange,
  otNumero,
  valorInicial,
  onConfirmar,
}: Props) {
  const formId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [valor, setValor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setValor(valorInicial != null ? String(valorInicial).replace(".", ",") : "");
      setError(null);
      setSaving(false);
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open, valorInicial]);

  const handleGuardar = async () => {
    const parsed = parseMetrosInput(valor);
    if (!parsed.ok) {
      setError(parsed.error ?? "Valor inválido.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onConfirmar(parsed.value);
    } finally {
      setSaving(false);
    }
  };

  const handleOmitir = async () => {
    setError(null);
    setSaving(true);
    try {
      await onConfirmar(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (saving) return;
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="max-w-sm gap-4 sm:max-w-md"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !saving) {
            e.preventDefault();
            void handleGuardar();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-[#002147]">
            Metros de impresión
            {otNumero ? (
              <span className="ml-2 font-mono text-sm text-slate-600">
                · OT {otNumero}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Indica los metros de papel consumidos en Konica para esta OT.
            Puedes pulsar <kbd className="rounded bg-slate-100 px-1 font-mono text-[10px]">Omitir</kbd>
            {" "}si no lo tienes a mano; se guardará vacío y podrás completarlo más tarde.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor={`${formId}-metros`} className="text-xs">
            Metros (≥ 0, admite decimales)
          </Label>
          <Input
            id={`${formId}-metros`}
            ref={inputRef}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className="h-10 text-base tabular-nums"
            placeholder="Ej. 124,5"
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              if (error) setError(null);
            }}
            disabled={saving}
          />
          {error ? (
            <p className="text-[11px] font-medium text-red-600">{error}</p>
          ) : (
            <p className="text-[11px] text-slate-500">
              Se guardará junto al tick de Konica y la fecha de fin.
            </p>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleOmitir()}
              disabled={saving}
              title="Marca Konica sin guardar metros (queda en blanco)."
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Guardando…
                </>
              ) : (
                "Omitir"
              )}
            </Button>
            <Button
              type="button"
              className="bg-[#002147]"
              onClick={() => void handleGuardar()}
              disabled={saving}
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
      </DialogContent>
    </Dialog>
  );
}
