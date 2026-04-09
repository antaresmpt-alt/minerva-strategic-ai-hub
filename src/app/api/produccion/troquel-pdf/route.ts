import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

/** Incluye SIN_REF_001, TAG00025, etc. */
const NUM_TROQUEL_SAFE = /^[\w.\-]+$/;

function isPdfOrAi(fileName: string): boolean {
  const l = fileName.toLowerCase();
  return l.endsWith(".pdf") || l.endsWith(".ai");
}

/** Archivo en carpeta: empieza por el código del troquel (sin distinguir mayúsculas) y termina en .pdf o .ai */
function fileMatchesTroquelPrefix(fileName: string, numLower: string): boolean {
  if (!isPdfOrAi(fileName)) return false;
  return fileName.toLowerCase().startsWith(numLower);
}

type MatchEntry = { fullPath: string; name: string; mtimeMs: number };

async function listMatchingFilesInDir(
  dir: string,
  num: string
): Promise<MatchEntry[]> {
  const numLower = num.trim().toLowerCase();
  let entries: import("fs").Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: MatchEntry[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!fileMatchesTroquelPrefix(e.name, numLower)) continue;
    const fullPath = path.join(dir, e.name);
    try {
      const st = await stat(fullPath);
      out.push({ fullPath, name: e.name, mtimeMs: st.mtimeMs });
    } catch {
      /* omitir */
    }
  }
  return out;
}

/** Varios candidatos: fecha de modificación más reciente; empate → nombre más corto. */
function pickBestMatch(matches: MatchEntry[]): MatchEntry | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  const sorted = [...matches].sort((a, b) => {
    if (b.mtimeMs !== a.mtimeMs) return b.mtimeMs - a.mtimeMs;
    return a.name.length - b.name.length;
  });
  return sorted[0];
}

type FoundFile = {
  buf: Buffer;
  filename: string;
  resolvedPath: string;
  assetKind: "pdf" | "illustrator";
};

/**
 * Nivel 1: raíz `base` — archivos que empiezan por `num` y terminan en .pdf/.ai.
 * Nivel 2: subcarpeta exacta `base/num` — misma regla dentro.
 */
async function findTroquelFile(
  base: string,
  num: string
): Promise<FoundFile | null> {
  const n = num.trim();

  const rootMatches = await listMatchingFilesInDir(base, n);
  const bestRoot = pickBestMatch(rootMatches);
  if (bestRoot) {
    const buf = await readFile(bestRoot.fullPath);
    const isAi = bestRoot.name.toLowerCase().endsWith(".ai");
    return {
      buf,
      filename: bestRoot.name,
      resolvedPath: bestRoot.fullPath,
      assetKind: isAi ? "illustrator" : "pdf",
    };
  }

  const subDir = path.join(base, n);
  try {
    const st = await stat(subDir);
    if (!st.isDirectory()) return null;
  } catch {
    return null;
  }

  const subMatches = await listMatchingFilesInDir(subDir, n);
  const bestSub = pickBestMatch(subMatches);
  if (!bestSub) return null;
  const buf = await readFile(bestSub.fullPath);
  const isAi = bestSub.name.toLowerCase().endsWith(".ai");
  return {
    buf,
    filename: bestSub.name,
    resolvedPath: bestSub.fullPath,
    assetKind: isAi ? "illustrator" : "pdf",
  };
}

/** Carpeta Nivel 2 para pista manual si no hay archivo (misma ruta en todos los OS). */
function level2FolderHint(base: string, num: string): string {
  return path.join(base.trim(), num.trim());
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

  const found = await findTroquelFile(base, num);
  if (!found) {
    const hint = level2FolderHint(base, num);
    return NextResponse.json(
      {
        error: `No se encontró ningún archivo que empiece por «${num}» y termine en .pdf o .ai` +
          ` en la raíz ni en la carpeta «${num}».`,
        localizarHint: hint,
      },
      { status: 404 }
    );
  }

  const isPdf = found.assetKind === "pdf";
  const body = new Uint8Array(found.buf);

  return new NextResponse(body, {
    headers: {
      "Content-Type": isPdf ? "application/pdf" : "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(found.filename)}"`,
      "Cache-Control": "private, max-age=60",
      "X-Asset-Kind": isPdf ? "pdf" : "illustrator",
      "X-Resolved-Path": encodeURIComponent(found.resolvedPath),
    },
  });
}
