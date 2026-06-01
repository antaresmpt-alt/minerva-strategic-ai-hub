"use client";

import { Plus, Sparkles } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { escapeIlikePattern } from "@/lib/troqueles-query";
import { cn } from "@/lib/utils";
import type { ProdReferenciaRow } from "@/types/prod-referencias";

export type ReferenciaMinervaValue = {
  id: string | null;
  codigo: string;
};

type ReferenciaMinervaPickerProps = {
  id?: string;
  label?: string;
  value: ReferenciaMinervaValue;
  onChange: (value: ReferenciaMinervaValue) => void;
  /** Se dispara al elegir una referencia EXISTENTE (para clonar datos del histórico). */
  onReferenciaPicked?: (row: ProdReferenciaRow) => void;
  /** Valores por defecto al crear una referencia nueva (p. ej. cliente del despacho). */
  createDefaults?: {
    cliente?: string | null;
    descripcion?: string | null;
    referenciaCliente?: string | null;
  };
  disabled?: boolean;
  className?: string;
};

function buildReferenciasOrFilter(term: string): string | null {
  const t = term.trim();
  if (!t) return null;
  const p = `%${escapeIlikePattern(t)}%`;
  return ["codigo", "referencia_cliente", "descripcion", "cliente"]
    .map((col) => `${col}.ilike.${p}`)
    .join(",");
}

export function ReferenciaMinervaPicker({
  id,
  label = "Referencia Minerva",
  value,
  onChange,
  onReferenciaPicked,
  createDefaults,
  disabled,
  className,
}: ReferenciaMinervaPickerProps) {
  const autoId = useId();
  const inputId = id ?? `referencia-minerva-${autoId}`;
  const supabase = useRef(createSupabaseBrowserClient()).current;
  const [q, setQ] = useState(value.codigo);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [hits, setHits] = useState<ProdReferenciaRow[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQ(value.codigo);
  }, [value.codigo]);

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
        const orF = buildReferenciasOrFilter(t);
        let query = supabase
          .from("prod_referencias")
          .select(
            "id, codigo, referencia_cliente, descripcion, cliente, created_at, updated_at"
          )
          .order("codigo", { ascending: true })
          .limit(12);
        if (orF) query = query.or(orF);
        const { data, error } = await query;
        if (error) throw error;
        setHits((data ?? []) as ProdReferenciaRow[]);
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

  const trimmedQ = q.trim();
  const exactMatch = hits.find(
    (h) => h.codigo.trim().toLocaleLowerCase("es") === trimmedQ.toLocaleLowerCase("es")
  );
  const canCreate = trimmedQ.length > 0 && !exactMatch;

  const selectExisting = useCallback(
    (row: ProdReferenciaRow) => {
      onChange({ id: row.id, codigo: row.codigo });
      setQ(row.codigo);
      onReferenciaPicked?.(row);
      setOpen(false);
    },
    [onChange, onReferenciaPicked]
  );

  const createNew = useCallback(async () => {
    const codigo = trimmedQ;
    if (!codigo) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("prod_referencias")
        .insert({
          codigo,
          referencia_cliente: createDefaults?.referenciaCliente?.trim() || null,
          cliente: createDefaults?.cliente?.trim() || null,
          descripcion: createDefaults?.descripcion?.trim() || null,
        })
        .select(
          "id, codigo, referencia_cliente, descripcion, cliente, created_at, updated_at"
        )
        .single();
      if (error) throw error;
      const row = data as ProdReferenciaRow;
      // Es nueva: no disparamos onReferenciaPicked (no hay histórico que clonar).
      onChange({ id: row.id, codigo: row.codigo });
      setQ(row.codigo);
      setOpen(false);
    } catch {
      // Silencioso: el padre puede revalidar. Mantenemos el texto para reintentar.
    } finally {
      setCreating(false);
    }
  }, [createDefaults, onChange, supabase, trimmedQ]);

  return (
    <div ref={wrapRef} className={cn("relative grid gap-1", className)}>
      <Label htmlFor={inputId} className="flex items-center gap-1 text-xs">
        <Sparkles className="size-3 text-[#C69C2B]" />
        {label}
      </Label>
      <Input
        id={inputId}
        className="h-8 text-xs font-mono"
        value={q}
        disabled={disabled || creating}
        placeholder="Buscar o crear (ej: M-00001)…"
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          setQ(v);
          // Al teclear, deja de estar enlazada a una referencia concreta hasta elegir/crear.
          onChange({ id: null, codigo: v });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && !disabled ? (
        <ul
          className="absolute top-full z-50 mt-0.5 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-0.5 text-xs shadow-md"
          role="listbox"
        >
          {loading ? (
            <li className="px-2 py-1.5 text-muted-foreground">Buscando…</li>
          ) : null}
          {!loading &&
            hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-left hover:bg-slate-100"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectExisting(h)}
                >
                  <span className="font-mono font-medium text-[#002147]">
                    {h.codigo}
                  </span>
                  {h.referencia_cliente ? (
                    <span className="ml-1 font-mono text-[11px] text-[#C69C2B]">
                      · {h.referencia_cliente}
                    </span>
                  ) : null}
                  {h.descripcion ? (
                    <span className="ml-1 line-clamp-1 text-muted-foreground">
                      · {h.descripcion}
                    </span>
                  ) : null}
                  {h.cliente ? (
                    <span className="ml-1 text-[10px] text-slate-400">
                      ({h.cliente})
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          {!loading && canCreate ? (
            <li className="border-t border-slate-100">
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[#002147] hover:bg-amber-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void createNew()}
                disabled={creating}
              >
                <Plus className="size-3.5" />
                Crear nueva referencia{" "}
                <span className="font-mono font-semibold">«{trimmedQ}»</span>
              </button>
            </li>
          ) : null}
          {!loading && hits.length === 0 && !canCreate ? (
            <li className="px-2 py-1.5 text-muted-foreground">
              Escribe un código para buscar o crear…
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
