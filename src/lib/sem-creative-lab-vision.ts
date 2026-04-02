import {
  type PackagingAnalysis,
  normalizeSemCreativeLabAnalysis,
} from "@/lib/sem-creative-lab-types";

/** Claude 3.5 Sonnet (visión / PDF). */
const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";
/** Respaldo si no hay ANTHROPIC_API_KEY. */
const OPENAI_MODEL = "gpt-4o";

const USER_PROMPT = `Actúa como un experto en pre-impresión. Escanea el PDF buscando las líneas de troquel (líneas rojas, azules o de corte indicadas en el plano). Identifica que el diseño es para una CAJA PLEGABLE (folding carton). Ignora cualquier forma cilíndrica o sugerencia de botella.

Énfasis de color y tipografía (línea Biform / troquel):
- En las caras principales del desplegable, el fondo dominante debe documentarse como Pantone 2415 C (morado corporativo): es el color de fondo que inunda esas caras salvo donde el PDF indique otro motivo.
- Lee el bloque o tabla «COLORES» del PDF: el titular «Drenaje Activador Cítrico» debe describirse como texto en BLANCO sobre el morado, tal cual allí (no lo conviertas a gris ni a negro).
- NO asumas fondo blanco en caras donde el troquel muestre color a registro completo (full bleed morado). Si el plano muestra el morado ocupando la cara, indícalo en exact_colors y die_cut_faces; evita describir «fondo blanco» salvo que el PDF muestre blanco real como base en esa cara.

Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin bloques de código, sin comentarios). Todos los campos deben existir siempre. Las claves deben ser exactamente estas seis.

Ejemplo de forma (sustituye por datos reales del PDF):
{
  "product_name": "Nombre comercial completo",
  "main_colors": ["Pantone 2415 C (morado)", "Naranja cítrico"],
  "exact_colors": "Caras principales con fondo Pantone 2415 C a registro; titular Drenaje Activador Cítrico en blanco según bloque COLORES del PDF",
  "key_elements": ["Rodaja de pomelo", "Logotipo Biform", "Sello Vegano"],
  "format": "Estuche de cartón rectangular",
  "die_cut_faces": "Frontal con foto de pomelo, Lateral con tabla de ingredientes"
}

Definición de campos:
- product_name: nombre comercial completo tal como en el documento.
- main_colors: lista de colores dominantes; incluye explícitamente Pantone 2415 C (morado) cuando corresponda a las caras principales.
- exact_colors: descripción técnica fiel al PDF (Pantone 2415 C en fondos de caras principales; texto del titular en blanco según COLORES; sin inventar fondos blancos si el troquel muestra bleed morado).
- key_elements: lista de elementos visuales; menciona tipografía blanca del titular «Drenaje Activador Cítrico» si el PDF lo marca en COLORES.
- format: DEBE ser exactamente "Estuche de cartón rectangular" O "Caja de farmacia". Prohibido usar la palabra "botella" u otros envases no cartón.
- die_cut_faces: análisis de caras del troquel; indica dónde el morado Pantone 2415 C cubre la cara y dónde va el texto blanco.

Si no puedes determinar con seguridad un campo de texto o un elemento de lista, usa el valor literal "standard pharmaceutical packaging" en ese string o como único elemento del array según corresponda. Para format, elige siempre uno de los dos valores permitidos (nunca dejes format vacío).

Responde solo con el JSON, nada más.`;

/** Base64 limpio (sin prefijo data: ni espacios). */
export function normalizePdfBase64(raw: string): string {
  const s = raw.trim();
  const m = s.match(/^data:application\/pdf;base64,([\s\S]+)$/i);
  if (m?.[1]) return m[1].replace(/\s/g, "");
  return s.replace(/\s/g, "");
}

function extractJsonObject(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function logPayload(label: string, payload: Record<string, unknown>): void {
  try {
    console.log(`[SEM Creative Lab] ${label}`, JSON.stringify(payload));
  } catch {
    console.log(`[SEM Creative Lab] ${label} (could not stringify)`);
  }
}

function parseAnalysisFromModelText(text: string): PackagingAnalysis {
  const raw = extractJsonObject(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    logPayload("vision-json-parse-error", {
      err: e instanceof Error ? e.message : String(e),
      preview: text.slice(0, 800),
    });
    throw new Error(
      "El modelo no devolvió JSON válido. Revisa el PDF o vuelve a intentarlo."
    );
  }
  const analysis = normalizeSemCreativeLabAnalysis(parsed);
  logPayload("vision-normalized-analysis", {
    product_name: analysis.product_name,
    format: analysis.format,
    main_colors_len: analysis.main_colors.length,
    key_elements_len: analysis.key_elements.length,
  });
  return analysis;
}

async function analyzeWithAnthropic(params: {
  pdfBase64: string;
  signal?: AbortSignal;
}): Promise<PackagingAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada");

  const dataB64 = normalizePdfBase64(params.pdfBase64);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: dataB64,
              },
            },
            {
              type: "text",
              text: USER_PROMPT,
            },
          ],
        },
      ],
    }),
    signal: params.signal,
  });

  const rawText = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    logPayload("anthropic-non-json", { status: res.status, rawText: rawText.slice(0, 1200) });
    throw new Error(
      `Anthropic: respuesta no JSON (HTTP ${res.status}). ${rawText.slice(0, 200)}`
    );
  }

  if (!res.ok) {
    const err = body as { error?: { message?: string } };
    logPayload("anthropic-error", {
      status: res.status,
      error: err?.error ?? body,
    });
    throw new Error(
      err?.error?.message ?? `Anthropic HTTP ${res.status}`
    );
  }

  const msg = body as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const parts = msg.content ?? [];
  const text = parts
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim();

  if (!text) {
    logPayload("anthropic-empty-text", { bodyPreview: rawText.slice(0, 800) });
    throw new Error("Anthropic no devolvió texto.");
  }

  return parseAnalysisFromModelText(text);
}

function extractOpenAIResponsesText(body: Record<string, unknown>): string {
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }
  const out = body.output;
  if (!Array.isArray(out)) return "";
  const chunks: string[] = [];
  for (const item of out) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as { content?: unknown[]; type?: string };
    if (!Array.isArray(o.content)) continue;
    for (const part of o.content) {
      if (typeof part !== "object" || part === null) continue;
      const p = part as { type?: string; text?: string };
      if (
        (p.type === "output_text" || p.type === "text") &&
        typeof p.text === "string"
      ) {
        chunks.push(p.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

async function analyzeWithOpenAI(params: {
  pdfBase64: string;
  signal?: AbortSignal;
}): Promise<PackagingAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");

  const dataB64 = normalizePdfBase64(params.pdfBase64);
  const fileDataUri = `data:application/pdf;base64,${dataB64}`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: "sem-creative-lab.pdf",
              file_data: fileDataUri,
            },
            {
              type: "input_text",
              text: USER_PROMPT,
            },
          ],
        },
      ],
    }),
    signal: params.signal,
  });

  const rawText = await res.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    logPayload("openai-non-json", { status: res.status, rawText: rawText.slice(0, 1200) });
    throw new Error(
      `OpenAI: respuesta no JSON (HTTP ${res.status}). ${rawText.slice(0, 200)}`
    );
  }

  if (!res.ok) {
    const apiErr = body.error as { message?: string } | undefined;
    logPayload("openai-error", {
      status: res.status,
      error: apiErr ?? body,
    });
    throw new Error(apiErr?.message ?? `OpenAI HTTP ${res.status}`);
  }

  const text = extractOpenAIResponsesText(body);
  if (!text) {
    logPayload("openai-empty-text", { bodyPreview: rawText.slice(0, 1200) });
    throw new Error("OpenAI no devolvió texto.");
  }

  return parseAnalysisFromModelText(text);
}

/**
 * SEM Creative Lab — visión del PDF: Anthropic (preferido) u OpenAI (respaldo).
 */
export async function analyzePackagingPdfWithGemini(params: {
  apiKey: string;
  pdfBase64: string;
  signal?: AbortSignal;
}): Promise<PackagingAnalysis> {
  void params.apiKey;

  const pdfBase64 = normalizePdfBase64(params.pdfBase64);
  if (pdfBase64.length < 64) {
    throw new Error("PDF en base64 no válido o demasiado corto.");
  }

  const useAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const useOpenAI = !!process.env.OPENAI_API_KEY?.trim();

  if (!useAnthropic && !useOpenAI) {
    throw new Error(
      "Configura ANTHROPIC_API_KEY (recomendado) u OPENAI_API_KEY para el análisis del PDF en SEM Creative Lab."
    );
  }

  if (useAnthropic) {
    try {
      return await analyzeWithAnthropic({
        pdfBase64,
        signal: params.signal,
      });
    } catch (e) {
      if (!useOpenAI) throw e;
      logPayload("anthropic-failed-fallback-openai", {
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return analyzeWithOpenAI({ pdfBase64, signal: params.signal });
}
