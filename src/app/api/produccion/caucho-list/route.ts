import { readFile, readdir } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

/** Mismo criterio que troquel-pdf: SIN_REF_001, TAG00025, etc. */
const NUM_TROQUEL_SAFE = /^[\w.\-]+$/;

/** Convierte barras invertidas en `/` para analizar la cadena sin alterar el significado. */
function normalizeSlashesForNode(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Patrón obligatorio: [num_troquel] + '_' + resto (evita TAG005 vs TAG00518).
 * Extensiones: .pdf / .ai (cualquier capitalización).
 */
function matchesCauchoPattern(fileName: string, num: string): boolean {
  const n = num.trim().toLowerCase();
  const lower = fileName.toLowerCase();
  const isPdf = lower.endsWith(".pdf");
  const isAi = lower.endsWith(".ai");
  if (!isPdf && !isAi) return false;
  return lower.startsWith(`${n}_`);
}

function isSafeSingleFileName(fname: string): boolean {
  const b = path.basename(fname);
  if (b !== fname) return false;
  if (!fname.length || fname === "." || fname === "..") return false;
  if (fname.includes("..")) return false;
  return true;
}

/** Limpia la ruta base (espacios finales, NBSP, etc.). No altera D:\ ni D:/. */
function sanitizeConfigPath(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/\u00a0/g, " ")
    .trim()
    .replace(/[\s\u200b\uFEFF]+$/g, "");
}

/**
 * Resuelve la carpeta configurada sin anteponer process.cwd().
 * - `D:/...` y `C:/...` no son absolutas para path.posix → path.resolve() las mezclaría con el proyecto.
 * - Usamos path.win32.isAbsolute + letra de unidad + UNC.
 */
function resolveConfiguredBasePath(cleaned: string): string {
  const unified = normalizeSlashesForNode(cleaned);
  const winPath = unified.replace(/\//g, "\\");

  if (/^[a-zA-Z]:/.test(unified)) {
    return path.win32.normalize(winPath);
  }

  if (unified.startsWith("//")) {
    return path.win32.normalize(winPath);
  }

  if (path.win32.isAbsolute(winPath)) {
    return path.win32.normalize(winPath);
  }

  if (path.posix.isAbsolute(unified)) {
    return path.normalize(unified);
  }

  return path.resolve(unified);
}

function jsonError(
  status: number,
  message: string,
  attemptedPath: string | null
) {
  return NextResponse.json(
    { error: message, attemptedPath: attemptedPath ?? undefined },
    { status }
  );
}

function notFoundForTroquel(num: string, attemptedPath: string) {
  return NextResponse.json(
    {
      error: `No se ha encontrado información en el path configurado para el troquel ${num}. Por favor, revise que los archivos existen en el directorio de Barniz.`,
      attemptedPath,
    },
    { status: 404 }
  );
}

export async function GET(req: NextRequest) {
  const num = req.nextUrl.searchParams.get("num")?.trim() ?? "";
  const fileParam = req.nextUrl.searchParams.get("file")?.trim() ?? "";

  if (!num || !NUM_TROQUEL_SAFE.test(num)) {
    return jsonError(400, "Número de troquel no válido.", null);
  }

  const supabase = await createServerSupabaseClient();
  const { data: config, error: cfgErr } = await supabase
    .from("prod_troqueles_config")
    .select("caucho_path")
    .limit(1)
    .maybeSingle();

  if (cfgErr) {
    return jsonError(500, cfgErr.message, null);
  }

  const rawBase = sanitizeConfigPath(config?.caucho_path);
  if (!rawBase) {
    return jsonError(
      400,
      "Configura la carpeta de cauchos en Troqueles (prod_troqueles_config.caucho_path).",
      null
    );
  }

  const resolvedBase = resolveConfiguredBasePath(rawBase);

  console.log("[produccion/caucho-list] lectura", {
    num_troquel: num,
    rawBase,
    resolvedBase,
    cwd: process.cwd(),
  });

  if (fileParam) {
    if (!isSafeSingleFileName(fileParam) || !matchesCauchoPattern(fileParam, num)) {
      return jsonError(400, "Nombre de archivo no válido.", resolvedBase);
    }
    const fullPath = path.join(resolvedBase, fileParam);
    try {
      const buf = await readFile(fullPath);
      const body = new Uint8Array(buf);
      const lower = fileParam.toLowerCase();
      const isPdf = lower.endsWith(".pdf");
      const contentType = isPdf ? "application/pdf" : "application/octet-stream";
      return new NextResponse(body, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(fileParam)}"`,
          "Cache-Control": "private, max-age=60",
        },
      });
    } catch (err) {
      console.error("[produccion/caucho-list] readFile falló", resolvedBase, fileParam, err);
      return notFoundForTroquel(num, resolvedBase);
    }
  }

  let entries: import("fs").Dirent[];
  try {
    entries = await readdir(resolvedBase, { withFileTypes: true });
  } catch (err) {
    console.error("[produccion/caucho-list] readdir falló", { resolvedBase, err });
    return notFoundForTroquel(num, resolvedBase);
  }

  const totalFiles = entries.filter((e) => e.isFile()).length;
  console.log("[produccion/caucho-list] readdir OK", {
    resolvedBase,
    totalEntradas: entries.length,
    totalArchivosEnCarpeta: totalFiles,
  });

  const files: string[] = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!matchesCauchoPattern(e.name, num)) continue;
    files.push(e.name);
  }
  files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  console.log("[produccion/caucho-list] coincidencias troquel", {
    num,
    patron: `${num}_*.pdf|.ai`,
    coincidencias: files.length,
  });

  if (files.length === 0) {
    return notFoundForTroquel(num, resolvedBase);
  }

  return NextResponse.json({ files });
}
