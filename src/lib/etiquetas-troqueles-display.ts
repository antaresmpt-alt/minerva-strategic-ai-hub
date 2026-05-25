import type { ProdEtiquetasHojaRutaRow } from "@/types/prod-etiquetas-hoja-ruta";
import type { ProdEtiquetasTroquelRow } from "@/types/prod-etiquetas-troqueles";

export function formatTroquelCatalogLabel(troquel: ProdEtiquetasTroquelRow): string {
  const parts = [
    troquel.codigo,
    troquel.dimensiones_texto,
    troquel.forma,
    troquel.cliente,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);

  return parts.join(" · ");
}

export function buildTroquelOptions(
  troqueles: ProdEtiquetasTroquelRow[],
  query: string,
  limit = 80
): ProdEtiquetasTroquelRow[] {
  const q = query.trim().toLowerCase();
  const base = [...troqueles].sort((a, b) =>
    a.codigo.localeCompare(b.codigo, "es", { numeric: true })
  );

  if (!q) return base.slice(0, limit);

  return base
    .filter((troquel) => {
      const haystack = [
        troquel.codigo,
        troquel.dimensiones_texto,
        troquel.forma,
        troquel.cliente,
        troquel.trabajo,
        troquel.carpeta_original,
      ]
        .map((part) => String(part ?? "").toLowerCase())
        .join(" ");

      return haystack.includes(q);
    })
    .slice(0, limit);
}

export function resolveTroquelDisplay(
  row: ProdEtiquetasHojaRutaRow,
  troquelesById: Map<number, ProdEtiquetasTroquelRow>
): string {
  const troquel =
    row.troquel_id == null ? null : troquelesById.get(Number(row.troquel_id));

  if (troquel) return formatTroquelCatalogLabel(troquel);

  const libre = String(row.troquel_utillaje ?? "").trim();
  if (libre) return `${libre} (texto libre)`;

  return "—";
}
