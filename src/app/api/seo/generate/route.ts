import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const SEO_KEYWORD_SYSTEM = `Eres un experto en SEO B2B para el sector del packaging (Minerva Global). El usuario te dará una palabra clave semilla. Tu tarea es generar exactamente 5 palabras clave "long-tail" (cola larga) derivadas, indicando su intención de búsqueda (solo uno de estos valores: "Informativa", "Comercial" o "Transaccional"), una estimación de dificultad SEO (solo uno de: "Baja", "Media" o "Alta") y un título sugerido para un artículo de blog o página de servicio.

Devuelve la respuesta ESTRICTAMENTE como un único JSON válido: un array de exactamente 5 objetos, cada uno con las claves exactas "keyword", "intent", "difficulty", "titleIdea". Sin texto antes ni después, sin markdown, sin comentarios.`;

function getGoogleModel() {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY o GOOGLE_GENERATIVE_AI_API_KEY no configurada");
  }
  const google = createGoogleGenerativeAI({ apiKey });
  return google("gemini-2.5-flash");
}

function parseKeywordJson(text: string): Array<{
  keyword: string;
  intent: string;
  difficulty: string;
  titleIdea: string;
}> {
  let t = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/m.exec(t);
  if (fenced) t = fenced[1].trim();
  else if (t.startsWith("```")) {
    t = t
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/u, "")
      .trim();
  }
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start >= 0 && end > start) {
    t = t.slice(start, end + 1);
  }
  const parsed = JSON.parse(t) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("La respuesta no es un array JSON");
  }
  return parsed.map((item, i) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Elemento ${i + 1} inválido`);
    }
    const o = item as Record<string, unknown>;
    return {
      keyword: String(o.keyword ?? ""),
      intent: String(o.intent ?? ""),
      difficulty: String(o.difficulty ?? ""),
      titleIdea: String(o.titleIdea ?? ""),
    };
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { seed?: string };
    const seed = typeof body.seed === "string" ? body.seed.trim() : "";
    if (!seed) {
      return Response.json(
        { error: "Indica un producto o servicio (semilla)." },
        { status: 400 }
      );
    }

    const result = await generateText({
      model: getGoogleModel(),
      system: SEO_KEYWORD_SYSTEM,
      prompt: `Palabra clave semilla del usuario: ${seed}`,
      maxOutputTokens: 2048,
      temperature: 0.4,
    });

    const rows = parseKeywordJson(result.text);
    return Response.json({ items: rows });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "No se pudo generar la estrategia SEO";
    return Response.json({ error: message }, { status: 500 });
  }
}
