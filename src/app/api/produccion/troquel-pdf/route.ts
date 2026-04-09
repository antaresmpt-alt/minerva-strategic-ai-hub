import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

/** Incluye SIN_REF_001, TAG00025, etc. */
const NUM_TROQUEL_SAFE = /^[\w.\-]+$/;

async function tryReadPdfCandidates(
  base: string,
  num: string
): Promise<Buffer | null> {
  const candidates = [
    path.join(base, `${num}.pdf`),
    path.join(base, num, `${num}.pdf`),
  ];
  for (const filePath of candidates) {
    try {
      return await readFile(filePath);
    } catch {
      /* siguiente */
    }
  }
  return null;
}

/** Busca `.ai` exacto o prefijo `num*.ai` en raíz y en `base/num`. */
async function tryReadAiCandidates(
  base: string,
  num: string
): Promise<{ buf: Buffer; filename: string } | null> {
  const n = num.trim();
  const nLower = n.toLowerCase();

  const exact = [path.join(base, `${n}.ai`), path.join(base, n, `${n}.ai`)];
  for (const fp of exact) {
    try {
      const buf = await readFile(fp);
      return { buf, filename: path.basename(fp) };
    } catch {
      /* */
    }
  }

  async function scanDir(
    dir: string
  ): Promise<{ buf: Buffer; filename: string } | null> {
    let entries: import("fs").Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    const aiFiles = entries
      .filter(
        (e) =>
          e.isFile() &&
          e.name.toLowerCase().endsWith(".ai") &&
          e.name.toLowerCase().startsWith(nLower)
      )
      .map((e) => e.name)
      .sort((a, b) => a.length - b.length);
    for (const name of aiFiles) {
      const fp = path.join(dir, name);
      try {
        const buf = await readFile(fp);
        return { buf, filename: name };
      } catch {
        /* */
      }
    }
    return null;
  }

  const inRoot = await scanDir(base);
  if (inRoot) return inRoot;

  const sub = path.join(base, n);
  try {
    const st = await stat(sub);
    if (st.isDirectory()) return scanDir(sub);
  } catch {
    return null;
  }
  return null;
}

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

  const pdfBuf = await tryReadPdfCandidates(base, num);
  if (pdfBuf) {
    return new NextResponse(new Uint8Array(pdfBuf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(num)}.pdf"`,
        "Cache-Control": "private, max-age=60",
        "X-Asset-Kind": "pdf",
      },
    });
  }

  const ai = await tryReadAiCandidates(base, num);
  if (ai) {
    return new NextResponse(new Uint8Array(ai.buf), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(ai.filename)}"`,
        "Cache-Control": "private, max-age=60",
        "X-Asset-Kind": "illustrator",
      },
    });
  }

  return NextResponse.json(
    {
      error: `No se encontró «${num}.pdf» ni «${num}.ai» en la raíz, en carpeta «${num}», ni archivos «${num}*.ai» (servidor).`,
    },
    { status: 404 }
  );
}
