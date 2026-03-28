import type { MetaProposalPayload } from "@/lib/meta-proposal-types";

export const META_PROPOSAL_SYSTEM = `Eres una consultora senior de performance marketing especializada en Meta Ads (Facebook e Instagram).
Generas propuestas en español, tono profesional y accionable, listas para presentar a un cliente final.
Debes responder SIEMPRE con un único objeto JSON válido (sin markdown, sin comentarios) que cumpla exactamente la estructura pedida en el mensaje del usuario.`;

export function buildMetaProposalUserPrompt(params: {
  websiteText: string;
  businessType: string;
  budgetMonthly: string;
  geo: string;
  objectiveIds: string[];
  objectiveLabels: string[];
}): string {
  const objs = params.objectiveLabels.map((l, i) => `- (${params.objectiveIds[i]}) ${l}`).join("\n");

  return `## Datos del cliente

### Texto / información de la web (pega libre)
${params.websiteText.trim() || "(sin texto)"}

### Tipo de negocio
${params.businessType.trim() || "—"}

### Presupuesto mensual estimado en anuncios
${params.budgetMonthly.trim() || "—"}

### Ubicación / mercado de los anuncios
${params.geo.trim() || "—"}

### Objetivos seleccionados por el usuario
${objs || "(ninguno — infiere objetivos razonables a partir del contexto)"}

## Instrucciones de generación

1) Construye el JSON con esta forma exacta de claves (en español los valores):
{
  "businessAnalysis": {
    "summary": "string",
    "problemsSolved": "string",
    "uniqueValue": "string",
    "buyerPersona": "string"
  },
  "campaigns": [
    {
      "objectiveId": "id que coincida con uno de los objetivos del usuario o el más cercano",
      "campaignName": "string",
      "adSets": [
        {
          "name": "string",
          "targeting": "string (audiencias, intereses, edades, remarketing, etc.)",
          "ads": [
            { "copy": "string (texto del anuncio con emojis, persuasivo, estilo feed Meta)", "imagePrompt": "string (descripción en inglés o español para generar imagen cuadrada tipo creativo publicitario)" },
            { "copy": "...", "imagePrompt": "..." }
          ]
        },
        {
          "name": "string",
          "targeting": "string",
          "ads": [
            { "copy": "...", "imagePrompt": "..." },
            { "copy": "...", "imagePrompt": "..." }
          ]
        }
      ]
    }
  ],
  "visualIdeas": ["string", "..."],
  "kpis": [
    { "metric": "string", "whatToWatch": "string" }
  ],
  "recommendations": ["string", "..."]
}

2) **Campañas:** Crea **una campaña por cada objetivo** que el usuario haya marcado (máximo 3 campañas). Si marcó más de 3, usa solo los 3 más relevantes. Si no marcó ninguno, crea 2 campañas alineadas al negocio.

3) Cada campaña debe tener **exactamente 2 conjuntos de anuncios** (adSets), con enfoques de segmentación distintos.

4) Cada conjunto debe tener **exactamente 2 anuncios** (ads), con copys distintos y imagePrompt detallado para creatividad visual coherente con el copy.

5) Los imagePrompt deben ser autocontenidos (no asumas que el generador de imagen ha leído el copy).

6) KPIs: al menos 5 filas, métricas reales de Meta (CPA, ROAS, CTR, CPM, frecuencia, etc.) según encaje.

7) Recomendaciones: píxel de Meta, CAPI, pruebas A/B, página de destino, etc.

Responde solo con el JSON.`;
}

export function isMetaProposalPayload(x: unknown): x is MetaProposalPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const ba = o.businessAnalysis;
  if (!ba || typeof ba !== "object") return false;
  const b = ba as Record<string, unknown>;
  if (
    typeof b.summary !== "string" ||
    typeof b.problemsSolved !== "string" ||
    typeof b.uniqueValue !== "string" ||
    typeof b.buyerPersona !== "string"
  ) {
    return false;
  }
  if (!Array.isArray(o.campaigns)) return false;
  for (const c of o.campaigns) {
    if (!c || typeof c !== "object") return false;
    const cc = c as Record<string, unknown>;
    if (typeof cc.objectiveId !== "string" || typeof cc.campaignName !== "string")
      return false;
    if (!Array.isArray(cc.adSets)) return false;
    for (const adSet of cc.adSets) {
      if (!adSet || typeof adSet !== "object") return false;
      const a = adSet as Record<string, unknown>;
      if (typeof a.name !== "string" || typeof a.targeting !== "string")
        return false;
      if (!Array.isArray(a.ads)) return false;
      for (const ad of a.ads) {
        if (!ad || typeof ad !== "object") return false;
        const adObj = ad as Record<string, unknown>;
        if (typeof adObj.copy !== "string" || typeof adObj.imagePrompt !== "string")
          return false;
      }
    }
  }
  if (!Array.isArray(o.visualIdeas) || !o.visualIdeas.every((v) => typeof v === "string"))
    return false;
  if (!Array.isArray(o.kpis)) return false;
  for (const k of o.kpis) {
    if (!k || typeof k !== "object") return false;
    const kk = k as Record<string, unknown>;
    if (typeof kk.metric !== "string" || typeof kk.whatToWatch !== "string")
      return false;
  }
  if (
    !Array.isArray(o.recommendations) ||
    !o.recommendations.every((r) => typeof r === "string")
  ) {
    return false;
  }
  return true;
}
