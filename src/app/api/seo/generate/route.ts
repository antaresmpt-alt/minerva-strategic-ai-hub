import type { GlobalModelId } from "@/lib/global-model";
import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";

export const runtime = "nodejs";
export const maxDuration = 60;

const COUNT_OPTIONS = [5, 10, 20] as const;
export type KeywordCount = (typeof COUNT_OPTIONS)[number];

export type IntentFilter =
  | "all"
  | "informational"
  | "commercial"
  | "transactional";

function buildSystemPrompt(count: number, intentFilter: IntentFilter): string {
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

  return `Eres un experto en SEO B2B para el sector del packaging (Minerva Global). El usuario te dará una palabra clave semilla.

REQUISITOS DEL USUARIO (aplícalos con rigor):
- El usuario ha solicitado exactamente ${count} palabras clave long-tail (cola larga).
- ${intentBlock}

Para cada palabra clave debes estimar de forma razonada (no inventes cifras exactas de herramientas; indica que son orientativas):
- "monthlyVolume": número entero ≥ 0, búsquedas mensuales estimadas en Google para ese término (mercado relevante para Minerva / España-Europa si aplica).
- "difficultyPercent": entero de 0 a 100, dificultad SEO para posicionar (0 = muy fácil, 100 = muy difícil). Sé coherente: nichos muy competidos → valores altos; long-tails muy específicas → valores más bajos.

Cada objeto del array debe incluir las claves exactas:
- "keyword": string (la long-tail)
- "intent": exactamente uno de "Informativa", "Comercial" o "Transaccional" (debe coincidir con las reglas anteriores)
- "titleIdea": string (título sugerido para blog o página)
- "monthlyVolume": número entero (volumen mensual estimado)
- "difficultyPercent": número entero entre 0 y 100 inclusive

Devuelve la respuesta ESTRICTAMENTE como un único JSON válido: un array de exactamente ${count} objetos. Sin texto antes ni después, sin markdown, sin comentarios.`;
}

function parseDifficultyPercent(o: Record<string, unknown>): number {
  const raw =
    o.difficultyPercent ?? o.difficulty_percent ?? o.seoDifficultyPercent;
  const n =
    typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function parseMonthlyVolume(o: Record<string, unknown>): number {
  const raw =
    o.monthlyVolume ?? o.monthly_volume ?? o.volume ?? o.searchVolume;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(999_999_999, Math.max(0, Math.round(raw)));
  }
  let s = String(raw ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!s) return 0;
  // Enteros con separador de miles tipo 1.234 (ES)
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else if (s.includes(",") && !s.includes(".")) {
    s = s.replace(",", ".");
  }
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(999_999_999, Math.round(n));
}

function parseKeywordJson(text: string): Array<{
  keyword: string;
  intent: string;
  titleIdea: string;
  monthlyVolume: number;
  difficultyPercent: number;
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
      titleIdea: String(o.titleIdea ?? ""),
      monthlyVolume: parseMonthlyVolume(o),
      difficultyPercent: parseDifficultyPercent(o),
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
  modelId: GlobalModelId;
} | { error: string } {
  if (!body || typeof body !== "object") {
    return { error: "Cuerpo de petición inválido." };
  }
  const o = body as Record<string, unknown>;
  const seed = typeof o.seed === "string" ? o.seed.trim() : "";
  if (!seed) {
    return { error: "Indica un producto o servicio (semilla)." };
  }

  const modelId = parseModelFromBody(o.model);

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

  return { seed, intentFilter, count, modelId };
}

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = parseBody(json);
    if ("error" in parsed) {
      return Response.json({ error: parsed.error }, { status: 400 });
    }

    const { seed, intentFilter, count, modelId } = parsed;
    const system = buildSystemPrompt(count, intentFilter);
    const prompt = `Palabra clave semilla del usuario: ${seed}`;

    const maxOutputTokens = count <= 10 ? 4096 : 8192;

    const result = await generateLlmText({
      modelId,
      system,
      user: prompt,
      maxOutputTokens,
      temperature: 0.4,
    });

    let rows = parseKeywordJson(result.text);
    if (rows.length > count) {
      rows = rows.slice(0, count);
    }
    if (!rows.length) {
      throw new Error("No se obtuvieron filas válidas del modelo");
    }

    return Response.json({
      items: rows,
      ...llmFieldsForApiResponse(result),
    });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "No se pudo generar la estrategia SEO";
    return Response.json({ error: message }, { status: 500 });
  }
}
