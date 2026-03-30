import { parseDeliveryDate } from "@/lib/sales-delivery-timing";
import type { LeadRow } from "@/types/leads";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Días desde Ultimo_Contacto hasta hoy (enteros). Vacío o inválido → null. */
export function daysSinceUltimoContacto(lead: LeadRow): number | null {
  const d = parseDeliveryDate(lead.ultimoContacto);
  if (!d || Number.isNaN(d.getTime())) return null;
  const today = startOfLocalDay(new Date());
  const u = startOfLocalDay(d);
  return Math.round((today.getTime() - u.getTime()) / 86_400_000);
}

/** Contactado o Reunión (tolerante a tildes y mayúsculas). */
export function isEstadoContactadoOReunion(lead: LeadRow): boolean {
  const e = norm(lead.estado);
  return e === "contactado" || e === "reunion" || e === "reunión";
}

/** Lead “dormido”: estado contactado/reunión y último contacto hace más de 7 días. */
export function isLeadDormido(lead: LeadRow): boolean {
  if (!isEstadoContactadoOReunion(lead)) return false;
  const days = daysSinceUltimoContacto(lead);
  if (days === null) return false;
  return days > 7;
}

export function isPrioridadAlta(lead: LeadRow): boolean {
  return norm(lead.prioridad) === "alta";
}

export function isEstadoPresupuesto(lead: LeadRow): boolean {
  return norm(lead.estado) === "presupuesto";
}
