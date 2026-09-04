"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatOtHistorialLabel } from "@/lib/despacho-wizard-shared";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  escapeIlikePattern,
  sanitizeTroquelesSearchInput,
} from "@/lib/troqueles-query";
import { cn } from "@/lib/utils";

export type OtAnteriorHit = {
  ot_numero: string;
  ot_id: string | null;
  cliente: string | null;
  titulo: string | null;
  material: string | null;
  gramaje: number | null;
  despachado_at: string | null;
};

type OtAnteriorSearchInputProps = {
  id?: string;
  value: string;
  onChange: (otNumero: string, otId: string | null) => void;
  /** No listar la OT que se está despachando. */
  excludeOtNumero?: string | null;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Enter con un número ya elegido (p. ej. clonar). */
  onConfirm?: (otNumero: string) => void;
};

const TABLE_OTS = "prod_ots_general";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";

function buildMasterOrFilter(term: string): string {
  const p = `%${escapeIlikePattern(term)}%`;
  return ["num_pedido", "cliente", "titulo"]
    .map((col) => `${col}.ilike.${p}`)
    .join(",");
}

function sortOtNumerosDesc(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
  return b.localeCompare(a, "es", { numeric: true, sensitivity: "base" });
}

/**
 * Buscador de OT ya despachada para clonar.
 * Busca por número, cliente o título/artículo (como Referencia Minerva).
 * No crea OTs: elegir rellena el número; el padre confirma con Clonar.
 */
export function OtAnteriorSearchInput({
  id,
  value,
  onChange,
  excludeOtNumero,
  disabled,
  placeholder = "Buscar OT, cliente o artículo…",
  className,
  onConfirm,
}: OtAnteriorSearchInputProps) {
  const supabase = useRef(createSupabaseBrowserClient()).current;
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchGen = useRef(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<OtAnteriorHit[]>([]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const search = useCallback(
    async (term: string) => {
      const t = sanitizeTroquelesSearchInput(term);
      const gen = ++searchGen.current;
      if (t.length < 2) {
        setHits([]);
        setLoading(false);
        return;
      }
      const exclude = String(excludeOtNumero ?? "").trim();
      setLoading(true);
      try {
        const orF = buildMasterOrFilter(t);
        const pattern = `%${escapeIlikePattern(t)}%`;

        const [{ data: masterHits, error: masterErr }, { data: despByOt, error: despErr }] =
          await Promise.all([
            supabase
              .from(TABLE_OTS)
              .select("id, num_pedido, cliente, titulo")
              .or(orF)
              .order("num_pedido", { ascending: false })
              .limit(40),
            supabase
              .from(TABLE_DESPACHADAS)
              .select("ot_numero, material, gramaje, despachado_at")
              .ilike("ot_numero", pattern)
              .order("ot_numero", { ascending: false })
              .limit(20),
          ]);
        if (gen !== searchGen.current) return;
        if (masterErr) throw masterErr;
        if (despErr) throw despErr;

        const masterRows = (masterHits ?? []) as Array<{
          id?: string | null;
          num_pedido?: string | null;
          cliente?: string | null;
          titulo?: string | null;
        }>;

        const otSet = new Set<string>();
        const masterByOt = new Map<
          string,
          { ot_id: string | null; cliente: string | null; titulo: string | null }
        >();
        for (const m of masterRows) {
          const ot = String(m.num_pedido ?? "").trim();
          if (!ot || ot === exclude) continue;
          otSet.add(ot);
          masterByOt.set(ot, {
            ot_id: typeof m.id === "string" ? m.id : null,
            cliente: m.cliente ?? null,
            titulo: m.titulo ?? null,
          });
        }
        for (const d of despByOt ?? []) {
          const ot = String(
            (d as { ot_numero?: string | null }).ot_numero ?? "",
          ).trim();
          if (!ot || ot === exclude) continue;
          otSet.add(ot);
        }

        const ots = Array.from(otSet).sort(sortOtNumerosDesc).slice(0, 12);
        if (ots.length === 0) {
          if (gen === searchGen.current) setHits([]);
          return;
        }

        const [{ data: despData, error: despFullErr }, { data: masterFull }] =
          await Promise.all([
            supabase
              .from(TABLE_DESPACHADAS)
              .select("ot_numero, material, gramaje, despachado_at")
              .in("ot_numero", ots),
            supabase
              .from(TABLE_OTS)
              .select("id, num_pedido, cliente, titulo")
              .in("num_pedido", ots),
          ]);
        if (gen !== searchGen.current) return;
        if (despFullErr) throw despFullErr;

        const despByNumero = new Map<
          string,
          {
            material: string | null;
            gramaje: number | null;
            despachado_at: string | null;
          }
        >();
        for (const r of (despData ?? []) as Array<{
          ot_numero?: string | null;
          material?: string | null;
          gramaje?: number | null;
          despachado_at?: string | null;
        }>) {
          const ot = String(r.ot_numero ?? "").trim();
          if (!ot) continue;
          despByNumero.set(ot, {
            material: r.material ?? null,
            gramaje: r.gramaje ?? null,
            despachado_at: r.despachado_at ?? null,
          });
        }

        for (const m of (masterFull ?? []) as Array<{
          id?: string | null;
          num_pedido?: string | null;
          cliente?: string | null;
          titulo?: string | null;
        }>) {
          const ot = String(m.num_pedido ?? "").trim();
          if (!ot || masterByOt.has(ot)) continue;
          masterByOt.set(ot, {
            ot_id: typeof m.id === "string" ? m.id : null,
            cliente: m.cliente ?? null,
            titulo: m.titulo ?? null,
          });
        }

        const rows: OtAnteriorHit[] = [];
        for (const ot of ots) {
          const desp = despByNumero.get(ot);
          if (!desp) continue;
          const master = masterByOt.get(ot);
          rows.push({
            ot_numero: ot,
            ot_id: master?.ot_id ?? null,
            cliente: master?.cliente ?? null,
            titulo: master?.titulo ?? null,
            material: desp.material,
            gramaje: desp.gramaje,
            despachado_at: desp.despachado_at,
          });
        }

        if (gen === searchGen.current) setHits(rows);
      } catch {
        if (gen === searchGen.current) setHits([]);
      } finally {
        if (gen === searchGen.current) setLoading(false);
      }
    },
    [excludeOtNumero, supabase],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void search(value);
    }, 280);
    return () => clearTimeout(t);
  }, [open, search, value]);

  const selectHit = useCallback(
    (hit: OtAnteriorHit) => {
      onChange(hit.ot_numero, hit.ot_id);
      setOpen(false);
    },
    [onChange],
  );

  const trimmed = value.trim();
  const exactHit = hits.find((h) => h.ot_numero === trimmed);

  return (
    <div ref={wrapRef} className={cn("relative min-w-0 flex-1", className)}>
      <Input
        id={id}
        className="h-8 text-xs font-mono"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value, null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (open && hits.length > 0 && !exactHit) {
            const first = hits[0];
            if (first) selectHit(first);
            return;
          }
          if (trimmed) onConfirm?.(trimmed);
        }}
      />
      {open && !disabled ? (
        <ul
          className="absolute top-full z-[80] mt-0.5 max-h-56 w-max min-w-full max-w-[min(28rem,70vw)] overflow-auto rounded-md border border-slate-200 bg-white py-0.5 text-xs shadow-md"
          role="listbox"
        >
          {loading ? (
            <li className="px-2 py-1.5 text-muted-foreground">Buscando…</li>
          ) : null}
          {hits.map((h) => (
            <li key={h.ot_numero}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left hover:bg-slate-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectHit(h)}
              >
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono font-medium text-[#002147]">
                    {formatOtHistorialLabel(h.ot_numero, h.despachado_at)}
                  </span>
                  {h.cliente ? (
                    <span className="truncate text-[10px] text-slate-400">
                      {h.cliente}
                    </span>
                  ) : null}
                </div>
                {h.titulo ? (
                  <div className="line-clamp-1 text-[11px] text-muted-foreground">
                    {h.titulo}
                  </div>
                ) : null}
                {h.material ? (
                  <div className="truncate text-[10px] text-slate-400">
                    {h.material}
                    {h.gramaje != null ? ` ${h.gramaje}g` : ""}
                  </div>
                ) : null}
              </button>
            </li>
          ))}
          {!loading && hits.length === 0 ? (
            <li className="px-2 py-1.5 text-muted-foreground">
              {sanitizeTroquelesSearchInput(value).length < 2
                ? "Escribe al menos 2 caracteres (OT, cliente o artículo)…"
                : "Sin OTs despachadas que coincidan."}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
