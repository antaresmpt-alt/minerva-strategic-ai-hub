"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

interface OtSugerencia {
  ot_numero: string;
  cliente: string | null;
  titulo: string | null;
  estado_material: string | null;
}

interface OtDestinoSearchInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

const supabase = createSupabaseBrowserClient();

/**
 * §18.15 — Input de OT destino con autocompletar liviano.
 * Busca en produccion_ot_despachadas con ilike al escribir ≥2 caracteres.
 * Dropdown clicable debajo del input; al elegir rellena con ot_numero.
 * Se puede teclear OT exacta aunque no salga en sugerencias.
 */
export function OtDestinoSearchInput({
  id,
  value,
  onChange,
  disabled,
  placeholder = "Ej. 98020",
  inputRef: externalRef,
}: OtDestinoSearchInputProps) {
  const [sugerencias, setSugerencias] = useState<OtSugerencia[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const internalRef = useRef<HTMLInputElement | null>(null);
  const inputRef = externalRef ?? internalRef;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const buscar = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setSugerencias([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("produccion_ot_despachadas")
        .select("ot_numero, cliente, titulo, estado_material")
        .ilike("ot_numero", `%${term.trim()}%`)
        .limit(8);
      const rows = (data ?? []) as OtSugerencia[];
      setSugerencias(rows);
      setOpen(rows.length > 0);
    } catch {
      setSugerencias([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void buscar(v), 250);
  }

  function handleSelect(ot: string) {
    onChange(ot);
    setSugerencias([]);
    setOpen(false);
  }

  function handleBlur(e: React.FocusEvent) {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setOpen(false);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative" onBlur={handleBlur}>
      <Input
        id={id}
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
          …
        </div>
      )}
      {open && sugerencias.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 rounded-md border bg-white shadow-lg py-1 max-h-52 overflow-y-auto">
          {sugerencias.map((s) => (
            <li key={s.ot_numero}>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 flex items-baseline gap-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(s.ot_numero);
                }}
              >
                <span className="font-mono font-semibold text-[#002147] shrink-0">
                  {s.ot_numero}
                </span>
                {s.cliente && (
                  <span className="text-xs text-slate-500 truncate">
                    {s.cliente}
                  </span>
                )}
                {s.estado_material && (
                  <span className="text-[11px] text-slate-400 ml-auto shrink-0 truncate max-w-[120px]">
                    {s.estado_material}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
