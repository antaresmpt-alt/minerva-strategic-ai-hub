import {
  GoogleGenerativeAI,
  type Part,
} from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

import {
  ALBARANES_OCR_MAX_PAGES,
  ALBARANES_OCR_SYSTEM_PROMPT,
  buildOcrDraftRows,
  compraEstaPendienteDeRecepcion,
  pickJsonObject,
  type AlbaranOcrCompra,
  type AlbaranOcrLlmRow,
  type AlbaranOcrProveedor,
} from "@/lib/albaranes-ocr";
import { esAlbaranPlaceholder } from "@/lib/albaran-placeholders";
import {
  parseModelFromBody,
  resolveGoogleApiModel,
} from "@/lib/global-model";
import { createServerSupabaseClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 90;

type IncomingPart = {
  filename?: unknown;
  page?: unknown;
  mime?: unknown;
  data?: unknown;
};

function getGoogleApiKey(): string {
  const key =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY (o GEMINI_API_KEY) no configurada");
  }
  return key;
}

function unwrapJoinNombre(value: unknown): string | null {
  if (value == null) return null;
  const row = Array.isArray(value) ? value[0] : value;
  if (row && typeof row === "object" && "nombre" in row) {
    const n = (row as { nombre?: unknown }).nombre;
    return typeof n === "string" && n.trim() ? n.trim() : null;
  }
  return null;
}

function normalizeIncomingParts(raw: unknown): {
  filename: string;
  mime: string;
  data: string;
}[] {
  if (!Array.isArray(raw)) return [];
  const out: { filename: string; mime: string; data: string }[] = [];
  for (const item of raw as IncomingPart[]) {
    const filename = String(item.filename ?? "albaran").trim() || "albaran";
    const mime = String(item.mime ?? "").trim().toLowerCase();
    const data = String(item.data ?? "").replace(/^data:[^;]+;base64,/, "");
    if (!data) continue;
    if (
      mime !== "image/jpeg" &&
      mime !== "image/png" &&
      mime !== "image/webp" &&
      mime !== "application/pdf"
    ) {
      continue;
    }
    out.push({ filename, mime, data });
    if (out.length >= ALBARANES_OCR_MAX_PAGES) break;
  }
  return out;
}

export async function POST(req: NextRequest) {
  const signal = req.signal;
  try {
    const body = (await req.json()) as { files?: unknown; model?: unknown };
    const files = normalizeIncomingParts(body.files);
    if (files.length === 0) {
      return NextResponse.json(
        { error: "Adjunta al menos un PDF o foto de albarán." },
        { status: 400 }
      );
    }

    const modelId = parseModelFromBody(body.model);
    const apiModel = resolveGoogleApiModel(modelId);
    const genAI = new GoogleGenerativeAI(getGoogleApiKey());
    const model = genAI.getGenerativeModel({
      model: apiModel,
      systemInstruction: ALBARANES_OCR_SYSTEM_PROMPT,
    });

    const parts: Part[] = [
      {
        text:
          "Extrae todas las líneas de material de estos albaranes de entrada. " +
          "Cada fichero se indica antes de su contenido.\n\n" +
          files
            .map((f, i) => `${i + 1}) ${f.filename} (${f.mime})`)
            .join("\n"),
      },
    ];
    for (const f of files) {
      parts.push({ text: `Fichero: ${f.filename}` });
      parts.push({ inlineData: { mimeType: f.mime, data: f.data } });
    }

    const result = await model.generateContent(
      {
        contents: [{ role: "user", parts }],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      },
      { signal }
    );
    const text = result.response.text()?.trim();
    if (!text) {
      throw new Error("El modelo no devolvió texto.");
    }

    const parsed = pickJsonObject(text) as { rows?: unknown };
    const llmRows = Array.isArray(parsed.rows)
      ? (parsed.rows as AlbaranOcrLlmRow[])
      : [];
    if (llmRows.length === 0) {
      return NextResponse.json(
        { error: "No se leyeron líneas de material. Prueba con fotos más nítidas o Gemini Pro." },
        { status: 422 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const [{ data: provData, error: provErr }, { data: compraData, error: compraErr }, { data: albData, error: albErr }] =
      await Promise.all([
        supabase.from("prod_proveedores").select("id, nombre").order("nombre"),
        supabase
          .from("prod_compra_material")
          .select(
            "id, ot_numero, num_compra, material, gramaje, tamano_hoja, num_hojas_brutas, proveedor_id, estado, prod_proveedores(nombre)"
          )
          .order("created_at", { ascending: false })
          .limit(400),
        supabase
          .from("prod_recepciones_material")
          .select("albaran_proveedor")
          .order("fecha_recepcion", { ascending: false })
          .limit(800),
      ]);
    if (provErr) throw provErr;
    if (compraErr) throw compraErr;
    if (albErr) throw albErr;

    const catalog: AlbaranOcrProveedor[] = (provData ?? []).map((r) => ({
      id: String(r.id),
      nombre: String(r.nombre ?? "").trim(),
    }));

    const compras: AlbaranOcrCompra[] = (compraData ?? [])
      .filter((r) => compraEstaPendienteDeRecepcion(r.estado))
      .map((r) => ({
        id: String(r.id),
        ot_numero: r.ot_numero ? String(r.ot_numero) : null,
        num_compra: String(r.num_compra ?? "").trim(),
        material: r.material ? String(r.material) : null,
        gramaje: typeof r.gramaje === "number" ? r.gramaje : null,
        tamano_hoja: r.tamano_hoja ? String(r.tamano_hoja) : null,
        num_hojas_brutas:
          typeof r.num_hojas_brutas === "number" ? r.num_hojas_brutas : null,
        proveedor_id: r.proveedor_id ? String(r.proveedor_id) : null,
        proveedor_nombre: unwrapJoinNombre(r.prod_proveedores),
        estado: r.estado ? String(r.estado) : null,
      }));

    const albaranesExistentes = new Set<string>();
    for (const r of albData ?? []) {
      const alb = String(r.albaran_proveedor ?? "").trim();
      if (!alb || esAlbaranPlaceholder(alb)) continue;
      albaranesExistentes.add(alb.toLowerCase());
    }

    const fallbackFile = files[0]?.filename ?? "albaran";
    const rows = buildOcrDraftRows({
      llmRows,
      fallbackFile,
      catalog,
      compras,
      albaranesExistentes,
    });

    return NextResponse.json({
      rows,
      proveedores: catalog,
      compras,
      albaranesExistentes: [...albaranesExistentes],
      modelUsed: apiModel,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "cancelado" }, { status: 499 });
    }
    const msg = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
