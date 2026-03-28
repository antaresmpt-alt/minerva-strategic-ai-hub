/** Respuesta JSON del generador de propuestas Meta (Facebook/Instagram). */

export type MetaProposalAd = {
  copy: string;
  imagePrompt: string;
};

export type MetaProposalAdSet = {
  name: string;
  targeting: string;
  ads: MetaProposalAd[];
};

export type MetaProposalCampaign = {
  objectiveId: string;
  campaignName: string;
  adSets: MetaProposalAdSet[];
};

export type MetaProposalPayload = {
  businessAnalysis: {
    summary: string;
    problemsSolved: string;
    uniqueValue: string;
    buyerPersona: string;
  };
  campaigns: MetaProposalCampaign[];
  visualIdeas: string[];
  kpis: { metric: string; whatToWatch: string }[];
  recommendations: string[];
};

export const META_OBJECTIVE_OPTIONS: {
  id: string;
  label: string;
}[] = [
  { id: "visits", label: "Conseguir más visitas a la web" },
  { id: "sales", label: "Vender más productos" },
  { id: "brand", label: "Que la gente conozca mi marca" },
  { id: "leads", label: "Generar leads / contactos" },
  { id: "engagement", label: "Más interacción en redes" },
];
