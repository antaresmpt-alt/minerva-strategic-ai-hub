import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const COUNT_OPTIONS = [5, 10, 15, 20] as const;
export type KeywordCount = (typeof COUNT_OPTIONS)[number];

export type IntentFilter =
  | "all"
  | "informational"
  | "commercial"
  | "transactional";

export type DifficultyFilter = "any" | "low_only";

function buildSystemPrompt(
  count: number,
  intentFilter: IntentFilter,
  difficultyFilter: DifficultyFilter
): string {
  let intentBlock: string;
  switch (intentFilter) {
    case "informational":
      intentBlock = `La intención de búsqueda de TODAS las palabras clave debe ser estrictamente "Informativa" (blog, educación, guías, cómo hacer…).`;
      break;
    case "commercial":
      intentBlock = `La intención de búsqueda de TODAS las palabras clave debe ser estrictamente "Comercial" (comparativas, reseñas, mejores opciones, vs…).`;
      break;
    case "transactional":
      intentBlock = `La intención de búsqueda de TODAS las palabras clave debe ser estrictamente "Transaccional" (compra, presupuesto, contratar, solicitar cotización…).`;
      break;
    default:
      intentBlock = `Cada ítem puede tener intención "Informativa", "Comercial" o "Transaccional"; mezcla según convenga al sector B2B packaging.`;
  }

  const difficultyBlock =
    difficultyFilter === "low_only"
      ? `La dificultad SEO estimada de TODAS las palabras clave debe ser estrictamente "Baja" (quick wins; no uses "Media" ni "Alta").`
      : `Estima la dificultad SEO como "Baja", "Media" o "Alta" según corresponda al nicho.`;

  return `Eres un experto en SEO B2B para el sector del packaging (Minerva Global). El usuario te dará una palabra clave semilla.

REQUISITOS DEL USUARIO (aplícalos con rigor):
- El usuario ha solicitado exactamente ${count} palabras clave long-tail (cola larga).
- ${intentBlock}
- ${difficultyBlock}

Cada objeto del array debe incluir las claves exactas:
- "keyword": string (la long-tail)
- "intent": exactamente uno de "Informativa", "Comercial" o "Transaccional" (debe coincidir con las reglas anteriores)
- "difficulty": exactamente uno de "Baja", "Media" o "Alta"
- "titleIdea": string (título sugerido para blog o página)

Devuelve la respuesta ESTRICTAMENTE como un único JSON válido: un array de exactamente ${count} objetos. Sin texto antes ni después, sin markdown, sin comentarios.`;
}

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

function isKeywordCount(n: number): n is KeywordCount {
  return (COUNT_OPTIONS as readonly number[]).includes(n);
}

function parseBody(body: unknown): {
  seed: string;
  intentFilter: IntentFilter;
  count: KeywordCount;
  difficultyFilter: DifficultyFilter;
} | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Cuerpo de petición inválido." };
  }
  const o = body as Record<string, unknown>;
  const seed = typeof o.seed === "string" ? o.seed.trim() : "";
  if (!seed) {
    return { error: "Indica un producto o servicio (semilla)." };
  }

  const intentRaw = o.intentFilter ?? o.intent;
  let intentFilter: IntentFilter = "all";
  if (
    intentRaw === "all" ||
    intentRaw === "informational" ||
    intentRaw === "commercial" ||
    intentRaw === "transactional"
  ) {
    intentFilter = intentRaw;
  }

  let count: KeywordCount = 10;
  const c = typeof o.count === "number" ? o.count : Number(o.count);
  if (Number.isFinite(c) && isKeywordCount(c)) {
    count = c;
  }

  const diffRaw = o.difficultyFilter ?? o.difficulty;
  let difficultyFilter: DifficultyFilter = "any";
  if (diffRaw === "low_only" || diffRaw === "any") {
    difficultyFilter = diffRaw;
  }

  return { seed, intentFilter, count, difficultyFilter };
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = parseBody(json);
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const { seed, intentFilter, count, difficultyFilter } = parsed;
    const system = buildSystemPrompt(count, intentFilter, difficultyFilter);
    const prompt = `Palabra clave semilla del usuario: ${seed}`;

    const maxOutputTokens = count <= 10 ? 4096 : 8192;

    const result = await generateText({
      model: getGoogleModel(),
      system,
      prompt,
      maxOutputTokens,
      temperature: 0.4,
    });

    let rows = parseKeywordJson(result.text);
    if (rows.length > count) {
      rows = rows.slice(0, count);
    }
    if (rows.length < count && rows.length > 0) {
      // Devolvemos lo obtenido; el front puede mostrar aviso si se desea
    }
    if (!rows.length) {
      throw new Error("No se obtuvieron filas válidas del modelo");
    }

    return Response.json({ items: rows });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "No se pudo generar la estrategia SEO";
    return Response.json({ error: message }, { status: 500 });
  }
}
