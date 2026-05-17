export type CalendarioFestivoAmbito =
  | "nacional"
  | "autonomico"
  | "local"
  | "empresa";

export type ProdCalendarioFestivoRow = {
  id: string;
  fecha: string;
  nombre: string;
  ambito: CalendarioFestivoAmbito;
  codigo_ambito: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};
