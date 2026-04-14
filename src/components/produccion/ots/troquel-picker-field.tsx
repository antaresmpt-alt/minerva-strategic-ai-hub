"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { troquelesSearchOrFilter } from "@/lib/troqueles-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type TroquelPickRow = {
  num_troquel: string;
  mides: string | null;
  num_figuras: string | null;
  descripcion: string | null;
};

type TroquelPickerFieldProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (code: string) => void;
  /** Al elegir una fila del buscador (p. ej. autorrellenar poses con num_figuras). */
  onTroquelPicked?: (row: TroquelPickRow) => void;
  disabled?: boolean;
  className?: string;
};

export function TroquelPickerField({
  id,
  label = "Troquel (código)",
  value,
  onChange,
  onTroquelPicked,
  disabled,
  className,
}: TroquelPickerFieldProps) {
  const autoId = useId();
  const inputId = id ?? `troquel-${autoId}`;
  const supabase = useRef(createSupabaseBrowserClient()).current;
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<TroquelPickRow[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQ(value);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const search = useCallback(
    async (term: string) => {
      const t = term.trim();
      if (t.length < 1) {
        setHits([]);
        return;
      }
      setLoading(true);
      try {
        const orF = troquelesSearchOrFilter(t);
        let q = supabase
          .from("prod_troqueles")
          .select("num_troquel,mides,num_figuras,descripcion")
          .limit(12);
        if (orF) q = q.or(orF);
        const { data, error } = await q;
        if (error) throw error;
        setHits(
          (data ?? []).map((r) => ({
            num_troquel: String((r as TroquelPickRow).num_troquel ?? "").trim(),
            mides: (r as TroquelPickRow).mides ?? null,
            num_figuras: (r as TroquelPickRow).num_figuras ?? null,
            descripcion: (r as TroquelPickRow).descripcion ?? null,
          }))
        );
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void search(q);
    }, 280);
    return () => clearTimeout(t);
  }, [q, open, search]);

  return (
    <div ref={wrapRef} className={cn("relative grid gap-1", className)}>
      <Label htmlFor={inputId} className="text-xs">
        {label}
      </Label>
      <Input
        id={inputId}
        className="h-8 text-xs"
        value={q}
        disabled={disabled}
        placeholder="Buscar por nº troquel…"
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          onChange(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && !disabled && (loading || hits.length > 0) ? (
        <ul
          className="absolute top-full z-50 mt-0.5 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-0.5 text-xs shadow-md"
          role="listbox"
        >
          {loading ? (
            <li className="px-2 py-1.5 text-muted-foreground">Buscando…</li>
          ) : (
            hits.map((h) => (
              <li key={h.num_troquel}>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left hover:bg-slate-100"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(h.num_troquel);
                    setQ(h.num_troquel);
                    onTroquelPicked?.(h);
                    setOpen(false);
                  }}
                >
                  <span className="font-mono font-medium">{h.num_troquel}</span>
                  {h.descripcion ? (
                    <span className="text-muted-foreground ml-1 line-clamp-1">
                      · {h.descripcion}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
