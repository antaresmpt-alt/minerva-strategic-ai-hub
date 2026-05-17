import type { CalendarioFestivoAmbito } from "@/types/prod-calendario-festivo";
import type { ProdCalendarioFestivoRow } from "@/types/prod-calendario-festivo";

export type FestivoCapasActivas = {
  nacional: boolean;
  autonomico: boolean;
  local: boolean;
  empresa: boolean;
};

export const FESTIVO_CAPAS_DEFAULT: FestivoCapasActivas = {
  nacional: true,
  autonomico: true,
  local: true,
  empresa: true,
};

export function festivoPasaCapas(
  row: Pick<ProdCalendarioFestivoRow, "ambito" | "activo">,
  capas: FestivoCapasActivas
): boolean {
  if (!row.activo) return false;
  if (row.ambito === "nacional") return capas.nacional;
  if (row.ambito === "autonomico") return capas.autonomico;
  if (row.ambito === "local") return capas.local;
  if (row.ambito === "empresa") return capas.empresa;
  return false;
}

export function festivosPorDia(
  rows: ProdCalendarioFestivoRow[],
  capas: FestivoCapasActivas
): Map<string, ProdCalendarioFestivoRow[]> {
  const map = new Map<string, ProdCalendarioFestivoRow[]>();
  for (const r of rows) {
    if (!festivoPasaCapas(r, capas)) continue;
    const key = String(r.fecha).slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }
  return map;
}

export function countFestivosEnRango(
  map: Map<string, ProdCalendarioFestivoRow[]>,
  start: string,
  end: string
): number {
  let n = 0;
  for (const [ymd, list] of map) {
    if (ymd >= start && ymd <= end && list.length > 0) n += 1;
  }
  return n;
}

export function labelAmbitoFestivo(ambito: CalendarioFestivoAmbito): string {
  switch (ambito) {
    case "nacional":
      return "Nacional";
    case "autonomico":
      return "Autonómico";
    case "local":
      return "Local";
    case "empresa":
      return "Empresa";
    default:
      return ambito;
  }
}

export const APUNTE_PLANTILLAS = [
  "Avería Konica",
  "Falta material",
  "Muestra cliente",
  "Mantenimiento",
  "Servicio técnico",
  "Reunión departamento",
] as const;
