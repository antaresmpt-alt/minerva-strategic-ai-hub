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
 * Busca en `produccion_ot_despachadas` (solo columnas reales) y enriquece
 * cliente/titulo desde `prod_ots_general.num_pedido`.
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
    const q = term.trim();
    if (q.length < 2) {
      setSugerencias([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      // cliente/titulo NO existen en produccion_ot_despachadas (viven en maestro).
      const { data: despData, error: despErr } = await supabase
        .from("produccion_ot_despachadas")
        .select("ot_numero, estado_material")
        .ilike("ot_numero", `%${q}%`)
        .order("ot_numero", { ascending: false })
        .limit(8);
      if (despErr) throw despErr;

      const despRows = (despData ?? []) as Array<{
        ot_numero?: string | null;
        estado_material?: string | null;
      }>;
      const ots = despRows
        .map((r) => String(r.ot_numero ?? "").trim())
        .filter(Boolean);
      if (ots.length === 0) {
        setSugerencias([]);
        setOpen(false);
        return;
      }

      const { data: masterData } = await supabase
        .from("prod_ots_general")
        .select("num_pedido, cliente, titulo")
        .in("num_pedido", ots);

      const masterByOt = new Map<
        string,
        { cliente: string | null; titulo: string | null }
      >();
      for (const m of (masterData ?? []) as Array<{
        num_pedido?: string | null;
        cliente?: string | null;
        titulo?: string | null;
      }>) {
        const ot = String(m.num_pedido ?? "").trim();
        if (!ot) continue;
        masterByOt.set(ot, {
          cliente: m.cliente ?? null,
          titulo: m.titulo ?? null,
        });
      }

      const rows: OtSugerencia[] = despRows
        .map((r) => {
          const ot = String(r.ot_numero ?? "").trim();
          if (!ot) return null;
          const master = masterByOt.get(ot);
          return {
            ot_numero: ot,
            estado_material: r.estado_material ?? null,
            cliente: master?.cliente ?? null,
            titulo: master?.titulo ?? null,
          };
        })
        .filter((r): r is OtSugerencia => r != null);

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
        onFocus={() => {
          if (sugerencias.length > 0) setOpen(true);
        }}
      />
      {loading && (
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          …
        </div>
      )}
      {open && sugerencias.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {sugerencias.map((s) => (
            <li key={s.ot_numero}>
              <button
                type="button"
                className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(s.ot_numero);
                }}
              >
                <span className="shrink-0 font-mono font-semibold text-[#002147]">
                  {s.ot_numero}
                </span>
                {s.cliente && (
                  <span className="truncate text-xs text-slate-500">
                    {s.cliente}
                  </span>
                )}
                {s.estado_material && (
                  <span className="ml-auto max-w-[120px] shrink-0 truncate text-[11px] text-slate-400">
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
