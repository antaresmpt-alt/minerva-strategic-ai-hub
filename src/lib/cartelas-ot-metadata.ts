import type { SupabaseClient } from "@supabase/supabase-js";

import type { AlbaranRecepcionLine } from "@/types/prod-stock";

/** Metadatos de OT desde prod_ots_general (fallback si compra viene vacía). */
export type OtMetadata = {
  cliente: string | null;
  titulo: string | null;
};

export type OtMetadataMap = Record<string, OtMetadata>;

/** Carga cliente + titulo de prod_ots_general para un lote de num_pedido. */
export async function fetchOtMetadataMap(
  supabase: SupabaseClient,
  otNums: string[]
): Promise<OtMetadataMap> {
  const unique = [...new Set(otNums.map((o) => o.trim()).filter(Boolean))];
  if (unique.length === 0) return {};

  const { data } = await supabase
    .from("prod_ots_general")
    .select("num_pedido, cliente, titulo")
    .in("num_pedido", unique);

  const map: OtMetadataMap = {};
  for (const row of data ?? []) {
    const key = String(row.num_pedido ?? "").trim();
    if (!key) continue;
    map[key] = {
      cliente: typeof row.cliente === "string" && row.cliente.trim() ? row.cliente.trim() : null,
      titulo: typeof row.titulo === "string" && row.titulo.trim() ? row.titulo.trim() : null,
    };
  }
  return map;
}

/** Resuelve cliente mostrable: compra → prod_ots_general. */
export function resolveClienteNombre(
  line: Pick<AlbaranRecepcionLine, "ot_numero" | "cliente_nombre">,
  otMeta: OtMetadataMap
): string | null {
  if (line.cliente_nombre?.trim()) return line.cliente_nombre.trim();
  return otMeta[line.ot_numero]?.cliente ?? null;
}

/** Resuelve trabajo mostrable: compra → prod_ots_general.titulo. */
export function resolveTrabajoTitulo(
  line: Pick<AlbaranRecepcionLine, "ot_numero" | "trabajo_titulo">,
  otMeta: OtMetadataMap
): string | null {
  if (line.trabajo_titulo?.trim()) return line.trabajo_titulo.trim();
  return otMeta[line.ot_numero]?.titulo ?? null;
}

/** Enriquece una línea de recepción con fallback prod_ots_general. */
export function enrichRecepcionLine(
  line: AlbaranRecepcionLine,
  otMeta: OtMetadataMap
): AlbaranRecepcionLine {
  return {
    ...line,
    cliente_nombre: resolveClienteNombre(line, otMeta),
    trabajo_titulo: resolveTrabajoTitulo(line, otMeta),
  };
}

/** Formato Optimus: "{ot} - {trabajo}" o solo ot si no hay trabajo. */
export function buildRefLote(otNumero: string | null, trabajoTitulo: string | null): string | null {
  if (!otNumero) return null;
  if (trabajoTitulo) return `${otNumero} - ${trabajoTitulo}`;
  return otNumero;
}

/** Mapa ot → titulo para impresión de cartela. */
export function otTitulosFromMetadata(
  otNums: string[],
  otMeta: OtMetadataMap
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const ot of otNums) {
    const t = otMeta[ot]?.titulo?.trim();
    if (t) out[ot] = t;
  }
  return out;
}

/** Texto "cliente · trabajo" para UI; "—" si ambos vacíos. */
export function formatClienteTrabajo(
  cliente: string | null | undefined,
  trabajo: string | null | undefined
): string {
  const c = cliente?.trim() ?? "";
  const t = trabajo?.trim() ?? "";
  if (c && t) return `${c} · ${t}`;
  if (c) return c;
  if (t) return t;
  return "—";
}
