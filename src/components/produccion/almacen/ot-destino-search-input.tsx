"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface OtSugerencia {
  ot_numero: string;
  cliente: string | null;
  titulo: string | null;
  estado_material: string | null;
  material?: string | null;
  gramaje?: number | null;
  tamano_hoja?: string | null;
  num_hojas_netas?: number | null;
  num_hojas_brutas?: number | null;
}

interface OtDestinoSearchInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Al elegir una sugerencia (número + metadatos para autofill). */
  onSelectSuggestion?: (s: OtSugerencia) => void;
  disabled?: boolean;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}

const supabase = createSupabaseBrowserClient();

/**
 * Input de OT destino con autocompletar.
 * Busca por número OT, cliente, título/ref (p. ej. «doble accion», «EU514»).
 * Prioriza OTs más recientes (ot_numero desc).
 */
export function OtDestinoSearchInput({
  id,
  value,
  onChange,
  onSelectSuggestion,
  disabled,
  placeholder = "OT, cliente, título o ref…",
  inputRef: externalRef,
  className,
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
      const pattern = `%${q.replace(/[%_,]/g, "")}%`;
      const orFilter = [
        `num_pedido.ilike."${pattern}"`,
        `cliente.ilike."${pattern}"`,
        `titulo.ilike."${pattern}"`,
      ].join(",");

      // 1) Maestro: cliente / título / num_pedido (ref EU514, «doble accion», ANUR…)
      const { data: masterHits, error: masterErr } = await supabase
        .from("prod_ots_general")
        .select("num_pedido, cliente, titulo")
        .or(orFilter)
        .order("num_pedido", { ascending: false })
        .limit(12);
      if (masterErr) throw masterErr;

      const masterRows = (masterHits ?? []) as Array<{
        num_pedido?: string | null;
        cliente?: string | null;
        titulo?: string | null;
      }>;

      // 2) Despachadas por número OT (por si no está en el hit de maestro)
      const { data: despByOt, error: despOtErr } = await supabase
        .from("produccion_ot_despachadas")
        .select(
          "ot_numero, estado_material, material, gramaje, tamano_hoja, num_hojas_netas, num_hojas_brutas",
        )
        .ilike("ot_numero", pattern)
        .order("ot_numero", { ascending: false })
        .limit(12);
      if (despOtErr) throw despOtErr;

      const otSet = new Set<string>();
      for (const m of masterRows) {
        const ot = String(m.num_pedido ?? "").trim();
        if (ot) otSet.add(ot);
      }
      for (const d of despByOt ?? []) {
        const ot = String((d as { ot_numero?: string }).ot_numero ?? "").trim();
        if (ot) otSet.add(ot);
      }

      const ots = Array.from(otSet);
      if (ots.length === 0) {
        setSugerencias([]);
        setOpen(false);
        return;
      }

      // Orden reciente: numérico desc cuando sea posible
      ots.sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
        return b.localeCompare(a);
      });
      const otsTop = ots.slice(0, 10);

      const { data: despData, error: despErr } = await supabase
        .from("produccion_ot_despachadas")
        .select(
          "ot_numero, estado_material, material, gramaje, tamano_hoja, num_hojas_netas, num_hojas_brutas",
        )
        .in("ot_numero", otsTop);
      if (despErr) throw despErr;

      const despByNumero = new Map<
        string,
        {
          estado_material: string | null;
          material: string | null;
          gramaje: number | null;
          tamano_hoja: string | null;
          num_hojas_netas: number | null;
          num_hojas_brutas: number | null;
        }
      >();
      for (const r of (despData ?? []) as Array<{
        ot_numero?: string | null;
        estado_material?: string | null;
        material?: string | null;
        gramaje?: number | null;
        tamano_hoja?: string | null;
        num_hojas_netas?: number | null;
        num_hojas_brutas?: number | null;
      }>) {
        const ot = String(r.ot_numero ?? "").trim();
        if (!ot) continue;
        despByNumero.set(ot, {
          estado_material: r.estado_material ?? null,
          material: r.material ?? null,
          gramaje: r.gramaje ?? null,
          tamano_hoja: r.tamano_hoja ?? null,
          num_hojas_netas: r.num_hojas_netas ?? null,
          num_hojas_brutas: r.num_hojas_brutas ?? null,
        });
      }

      // Maestro completo para los OTs del set (por si el hit vino solo de despachadas)
      const { data: masterFull } = await supabase
        .from("prod_ots_general")
        .select("num_pedido, cliente, titulo")
        .in("num_pedido", otsTop);

      const masterByOt = new Map<
        string,
        { cliente: string | null; titulo: string | null }
      >();
      for (const m of (masterFull ?? []) as Array<{
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
      for (const m of masterRows) {
        const ot = String(m.num_pedido ?? "").trim();
        if (!ot || masterByOt.has(ot)) continue;
        masterByOt.set(ot, {
          cliente: m.cliente ?? null,
          titulo: m.titulo ?? null,
        });
      }

      // Solo OTs que existen en despachadas (asignar / compra operativa)
      const rows: OtSugerencia[] = otsTop
        .filter((ot) => despByNumero.has(ot))
        .map((ot) => {
          const desp = despByNumero.get(ot)!;
          const master = masterByOt.get(ot);
          return {
            ot_numero: ot,
            estado_material: desp.estado_material,
            cliente: master?.cliente ?? null,
            titulo: master?.titulo ?? null,
            material: desp.material,
            gramaje: desp.gramaje,
            tamano_hoja: desp.tamano_hoja,
            num_hojas_netas: desp.num_hojas_netas,
            num_hojas_brutas: desp.num_hojas_brutas,
          };
        });

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

  function handleSelect(s: OtSugerencia) {
    onChange(s.ot_numero);
    onSelectSuggestion?.(s);
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
        className={className}
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
        <ul className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {sugerencias.map((s) => (
            <li key={s.ot_numero}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(s);
                }}
              >
                <div className="flex w-full items-baseline gap-2">
                  <span className="shrink-0 font-mono font-semibold text-[#002147]">
                    {s.ot_numero}
                  </span>
                  {s.cliente && (
                    <span className="truncate text-xs text-slate-600">
                      {s.cliente}
                    </span>
                  )}
                  {s.estado_material && (
                    <span className="ml-auto max-w-[110px] shrink-0 truncate text-[10px] text-slate-400">
                      {s.estado_material}
                    </span>
                  )}
                </div>
                {s.titulo && (
                  <span className="truncate text-[11px] leading-snug text-slate-500">
                    {s.titulo}
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
