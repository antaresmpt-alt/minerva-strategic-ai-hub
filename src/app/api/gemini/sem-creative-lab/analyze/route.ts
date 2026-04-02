import { NextRequest, NextResponse } from "next/server";
import { assertPdfBuffer } from "@/lib/sem-creative-lab-pdf";
import { analyzePackagingPdfWithGemini } from "@/lib/sem-creative-lab-vision";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const signal = req.signal;

  try {
    const hasVisionKey =
      !!process.env.ANTHROPIC_API_KEY?.trim() ||
      !!process.env.OPENAI_API_KEY?.trim();
    if (!hasVisionKey) {
      return NextResponse.json(
        {
          error:
            "Configura ANTHROPIC_API_KEY (recomendado) u OPENAI_API_KEY para el análisis del PDF en SEM Creative Lab.",
        },
        { status: 500 }
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          error:
            "No se pudo procesar el envío multipart (FormData). " +
            "Comprueba que el PDF no supere 12 MB, que el campo se llame «pdf» y, " +
            "si el nombre del archivo tiene acentos o símbolos, prueba renombrarlo. " +
            `Detalle: ${detail}`,
        },
        { status: 400 }
      );
    }
    const file = form.get("pdf");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Falta el archivo PDF (campo pdf)." },
        { status: 400 }
      );
    }

    if (
      file.type &&
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Solo se admiten archivos PDF." },
        { status: 400 }
      );
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    assertPdfBuffer(buf);

    const pdfBase64 = buf.toString("base64");
    const analysis = await analyzePackagingPdfWithGemini({
      apiKey: "",
      pdfBase64,
      signal,
    });

    return NextResponse.json({ analysis });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const message =
      e instanceof Error ? e.message : "Error al analizar el PDF con Minerva Vision.";
    const status =
      message.includes("no es un PDF") || message.includes("tamaño")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
