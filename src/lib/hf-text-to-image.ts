const PRIMARY_MODEL = "black-forest-labs/FLUX.1-schnell";
const FALLBACK_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";

/** Router HF Inference (api-inference.huggingface.co deprecado → 410). */
const HF_INFERENCE_MODELS_BASE =
  "https://router.huggingface.co/hf-inference/models";

/** Single HTTP request timeout (ms). HF Free cold starts need a generous window. */
const REQUEST_TIMEOUT_MS = 120_000;

const MAX_ATTEMPTS = 12;
const MAX_BACKOFF_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type HfErrorBody = {
  error?: string;
  estimated_time?: number;
};

function parseErrorBody(text: string): HfErrorBody | null {
  try {
    return JSON.parse(text) as HfErrorBody;
  } catch {
    return null;
  }
}

function isLoadingState(status: number, bodyText: string): boolean {
  if (status === 503) return true;
  const j = parseErrorBody(bodyText);
  const err = (j?.error ?? "").toLowerCase();
  return err.includes("loading") || err.includes("initializing");
}

function backoffMs(estimated: number | undefined, attempt: number): number {
  if (estimated != null && estimated > 0) {
    return Math.min(
      MAX_BACKOFF_MS,
      Math.max(3000, Math.round(estimated * 1000))
    );
  }
  return Math.min(MAX_BACKOFF_MS, 5000 + attempt * 2500);
}

async function postInference(
  model: string,
  prompt: string,
  token: string,
  signal: AbortSignal
): Promise<Response> {
  const url = `${HF_INFERENCE_MODELS_BASE}/${model}`;
  const isFlux = model.includes("FLUX");
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: isFlux
        ? { num_inference_steps: 4 }
        : {
            num_inference_steps: 30,
            guidance_scale: 7.5,
          },
    }),
    signal,
  });
}

function bufferToImageBuffer(
  buf: Buffer,
  contentType: string | null
): Buffer {
  const ct = contentType ?? "";
  if (ct.includes("application/json")) {
    const text = buf.toString("utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        "Hugging Face devolvió JSON en lugar de imagen. Revisa el modelo o el prompt."
      );
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "image" in parsed &&
      typeof (parsed as { image?: string }).image === "string"
    ) {
      return Buffer.from((parsed as { image: string }).image, "base64");
    }
    throw new Error(
      typeof parsed === "object" && parsed && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : "Respuesta inesperada de Hugging Face (JSON sin imagen)."
    );
  }
  if (buf.length < 256) {
    const asText = buf.toString("utf8");
    const j = parseErrorBody(asText);
    if (j?.error) throw new Error(j.error);
  }
  return buf;
}

function linkAbort(parent: AbortSignal, child: AbortController): void {
  if (parent.aborted) {
    child.abort();
    return;
  }
  parent.addEventListener("abort", () => child.abort(), { once: true });
}

/**
 * Text-to-image via Hugging Face Inference API with retries for cold start / loading.
 */
export async function generateImageWithHuggingFace(params: {
  prompt: string;
  token: string;
  signal?: AbortSignal;
}): Promise<{ buffer: Buffer; modelUsed: string }> {
  const token = params.token.trim();
  if (!token) throw new Error("HF_TOKEN no configurada");

  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (params.signal?.aborted) {
        const err = new Error("cancelado");
        err.name = "AbortError";
        throw err;
      }

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      if (params.signal) linkAbort(params.signal, controller);

      try {
        const res = await postInference(
          model,
          params.prompt,
          token,
          controller.signal
        );
        const raw = Buffer.from(await res.arrayBuffer());
        const head = raw.toString(
          "utf8",
          0,
          Math.min(raw.length, 400)
        );

        if (!res.ok) {
          if (isLoadingState(res.status, head) || res.status === 429) {
            const j = parseErrorBody(head);
            const wait = backoffMs(j?.estimated_time, attempt);
            await sleep(wait);
            continue;
          }
          if (res.status === 402 || res.status === 403) {
            throw new Error(
              "Cuota o permisos insuficientes en Hugging Face. Comprueba tu plan y el token HF_TOKEN."
            );
          }
          const errMsg = parseErrorBody(head)?.error ?? head.slice(0, 200);
          lastError = new Error(
            `Hugging Face (${model}): ${res.status} ${errMsg}`
          );
          break;
        }

        const buffer = bufferToImageBuffer(raw, res.headers.get("content-type"));
        clearTimeout(t);
        return { buffer, modelUsed: model };
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          if (params.signal?.aborted) throw e;
          lastError = new Error(
            `Tiempo de espera agotado (${REQUEST_TIMEOUT_MS / 1000}s) al generar la imagen.`
          );
          continue;
        }
        if (
          e instanceof Error &&
          (e.message.includes("Cuota") || e.message.includes("permisos"))
        ) {
          throw e;
        }
        lastError = e instanceof Error ? e : new Error(String(e));
        await sleep(backoffMs(undefined, attempt));
      } finally {
        clearTimeout(t);
      }
    }
  }

  throw (
    lastError ??
    new Error(
      "No se pudo generar la imagen con Hugging Face tras varios intentos."
    )
  );
}
