import type { LeadRow } from "@/types/leads";

/** Formato esperado por el prompt del generador de emails (claves como en Excel). */
export type LeadEmailApiPayload = {
  Contacto: string;
  Cargo: string;
  Empresa: string;
  Tema_Interes: string;
  Origen: string;
  Estado: string;
  Proxima_Accion: string;
  Ultimo_Contacto: string;
};

export function leadRowToEmailPayload(lead: LeadRow): LeadEmailApiPayload {
  return {
    Contacto: lead.contacto ?? "",
    Cargo: lead.cargo ?? "",
    Empresa: lead.empresa ?? "",
    Tema_Interes: lead.temaInteres ?? "",
    Origen: lead.origen ?? "",
    Estado: lead.estado ?? "",
    Proxima_Accion: lead.proximaAccion ?? "",
    Ultimo_Contacto: lead.ultimoContacto ?? "",
  };
}

/** Payload para scoring IA: mismos campos que email + Prioridad (CRM). */
export type LeadScoringApiPayload = LeadEmailApiPayload & {
  Prioridad: string;
};

export function leadRowToScoringPayload(lead: LeadRow): LeadScoringApiPayload {
  return {
    ...leadRowToEmailPayload(lead),
    Prioridad: lead.prioridad ?? "",
  };
}
