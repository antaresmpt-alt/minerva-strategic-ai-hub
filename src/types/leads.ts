/** Fila normalizada del Excel corporativo de leads (Minerva). */
export interface LeadRow {
  idLead: string;
  empresa: string;
  contacto: string;
  cargo: string;
  email: string;
  telefono: string;
  origen: string;
  temaInteres: string;
  comercial: string;
  estado: string;
  prioridad: string;
  ultimoContacto: string;
  proximaAccion: string;
}
