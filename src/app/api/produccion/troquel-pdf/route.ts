import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

/** Incluye SIN_REF_001, TAG00025, etc. */
const NUM_TROQUEL_SAFE = /^[\w.\-]+$/;

export async function GET(req: NextRequest) {
  const num = req.nextUrl.searchParams.get("num")?.trim() ?? "";
  if (!num || !NUM_TROQUEL_SAFE.test(num)) {
    return NextResponse.json(
      { error: "Número de troquel no válido." },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: config, error: cfgErr } = await supabase
    .from("prod_troqueles_config")
    .select("pdf_path")
    .limit(1)
    .maybeSingle();

  if (cfgErr) {
    return NextResponse.json({ error: cfgErr.message }, { status: 500 });
  }

  const base = config?.pdf_path?.trim();
  if (!base) {
    return NextResponse.json(
      {
        error:
          "Configura la carpeta de PDFs en Troqueles (Configuración de ubicación).",
      },
      { status: 400 }
    );
  }

  const candidates = [
    path.join(base, `${num}.pdf`),
    path.join(base, num, `${num}.pdf`),
  ];

  for (const filePath of candidates) {
    try {
      const buf = await readFile(filePath);
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(num)}.pdf"`,
          "Cache-Control": "private, max-age=60",
        },
      });
    } catch {
      /* siguiente candidato */
    }
  }

  return NextResponse.json(
    {
      error: `No se encontró «${num}.pdf» en la raíz ni en «${num}\\${num}.pdf» (servidor).`,
    },
    { status: 404 }
  );
}
