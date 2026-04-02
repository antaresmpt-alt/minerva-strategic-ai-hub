import { NextResponse } from "next/server";

import type { LeadEmailApiPayload } from "@/lib/lead-email-payload";
import {
  generateLlmText,
  llmFieldsForApiResponse,
  parseModelFromBody,
} from "@/lib/llm-router";

export const runtime = "nodejs";
export const maxDuration = 60;

function buildPrompt(leadData: LeadEmailApiPayload): string {
  return `Eres un Ejecutivo de Ventas Senior en Minerva Global (empresa líder en packaging sostenible, cajas rígidas de lujo y estuches pharma). Tu objetivo es redactar un email comercial altamente personalizado y natural.

DATOS DEL PROSPECTO:
- Nombre: ${leadData.Contacto} (${leadData.Cargo})
- Empresa: ${leadData.Empresa}
- Interés: ${leadData.Tema_Interes}
- Origen del lead: ${leadData.Origen}
- Estado actual en el CRM: ${leadData.Estado}
- Próxima acción deseada: ${leadData.Proxima_Accion}
- Último contacto: ${leadData.Ultimo_Contacto}

REGLAS DE REDACCIÓN SEGÚN EL ESTADO:
1. Si Estado es 'Nuevo': Escribe un correo de prospección (Cold Email) o agradecimiento por el contacto inicial (si viene de Web/Feria). Menciona su Interés.
2. Si Estado es 'Contactado' o 'Reunión': Escribe un correo de seguimiento buscando fijar una fecha (haz referencia a la 'Próxima acción deseada').
3. Si Estado es 'Presupuesto': Escribe un correo formal pero cercano preguntando si tienen dudas sobre la propuesta enviada y buscando el cierre.
4. Tono: B2B, profesional, persuasivo, pero conciso (máximo 3 párrafos cortos). NADA de placeholders genéricos como [Tu Nombre], termínalo con una firma genérica de Minerva Global.

FORMATO DE SALIDA REQUERIDO:
ASUNTO: (Asunto persuasivo y corto)
CUERPO: (Texto del correo)`;
}

function isPayload(v: unknown): v is LeadEmailApiPayload {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const keys: (keyof LeadEmailApiPayload)[] = [
    "Contacto",
    "Cargo",
    "Empresa",
    "Tema_Interes",
    "Origen",
    "Estado",
    "Proxima_Accion",
    "Ultimo_Contacto",
  ];
  return keys.every((k) => typeof o[k] === "string");
}

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as { leadData?: unknown; model?: unknown };
    const leadData = json.leadData;
    const modelId = parseModelFromBody(json.model);

    if (!leadData || !isPayload(leadData)) {
      return NextResponse.json(
        { error: "leadData inválido o incompleto." },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(leadData);
    const result = await generateLlmText({
      modelId,
      user: prompt,
      maxOutputTokens: 4096,
      temperature: 0.5,
    });

    return NextResponse.json({
      text: result.text.trim(),
      ...llmFieldsForApiResponse(result),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 200 }
    );
  }
}
