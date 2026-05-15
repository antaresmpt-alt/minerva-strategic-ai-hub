/** Semáforo de plazo según días hasta `fecha_entrega_ot` (hoja de ruta). */

export type EntregaPlazoSemaforo = "rojo" | "amarillo" | "verde" | "none";

export function todayYmdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseYmdLocal(iso: string): Date | null {
  const s = String(iso).trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(s.slice(0, 10) + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Días naturales hasta entrega (negativo = vencida). */
export function diasHastaEntregaOt(
  fecha_entrega_ot: string | null | undefined
): number | null {
  const entrega = parseYmdLocal(String(fecha_entrega_ot ?? ""));
  if (!entrega) return null;
  const hoy = parseYmdLocal(todayYmdLocal());
  if (!hoy) return null;
  const ms = entrega.getTime() - hoy.getTime();
  return Math.round(ms / 86_400_000);
}

export function entregaPlazoSemaforo(
  fecha_entrega_ot: string | null | undefined
): EntregaPlazoSemaforo {
  const dias = diasHastaEntregaOt(fecha_entrega_ot);
  if (dias == null) return "none";
  if (dias <= 4) return "rojo";
  if (dias <= 14) return "amarillo";
  return "verde";
}

export function entregaPlazoTitle(
  fecha_entrega_ot: string | null | undefined
): string {
  const dias = diasHastaEntregaOt(fecha_entrega_ot);
  if (dias == null) return "Sin fecha de entrega OT";
  if (dias < 0) {
    const n = Math.abs(dias);
    return n === 1 ? "Vencida hace 1 día" : `Vencida hace ${n} días`;
  }
  if (dias === 0) return "Entrega hoy";
  if (dias === 1) return "Falta 1 día";
  return `Faltan ${dias} días`;
}

export const PLAZO_SEMAFORO_CLASS: Record<
  EntregaPlazoSemaforo,
  string
> = {
  rojo: "bg-red-500 ring-2 ring-red-200",
  amarillo: "bg-amber-400 ring-2 ring-amber-200",
  verde: "bg-emerald-500 ring-2 ring-emerald-200",
  none: "bg-slate-200 ring-1 ring-slate-300",
};
