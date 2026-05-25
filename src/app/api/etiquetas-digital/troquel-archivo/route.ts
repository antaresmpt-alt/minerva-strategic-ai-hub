import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const ALLOWED_EXTENSIONS = [".pdf", ".tif", ".tiff", ".jpg", ".jpeg", ".png"];
type FolderMatchType = "exact" | "normalized" | "byCode";

function getContentType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function isAllowedFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function normalizeFileNameForMatch(fileName: string): string {
  return fileName
    .normalize("NFC")
    .replace(/\u00d7/g, "x")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
}

async function listAllowedFiles(dirPath: string) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    if (!isAllowedFile(entry.name)) continue;

    const filePath = path.join(dirPath, entry.name);
    const fileStat = await stat(filePath);
    files.push({
      name: entry.name,
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
      extension: path.extname(entry.name).slice(1).toLowerCase(),
    });
  }

  return files.sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" })
  );
}

function normalizeTroquelCodigoForFolder(codigo: string | null | undefined): string {
  const digits = String(codigo ?? "").replace(/\D/g, "");
  return digits ? digits.padStart(4, "0").slice(-4) : "";
}

async function isDirectory(dirPath: string): Promise<boolean> {
  try {
    const dirStat = await stat(dirPath);
    return dirStat.isDirectory();
  } catch {
    return false;
  }
}

async function resolveTroquelFolder(
  basePath: string,
  carpetaOriginal: string,
  codigo: string | null | undefined
): Promise<{ folderPath: string; matchType: FolderMatchType }> {
  const exactPath = path.join(basePath, carpetaOriginal);
  if (
    validatePathTraversal(basePath, exactPath) &&
    (await isDirectory(exactPath))
  ) {
    return { folderPath: exactPath, matchType: "exact" };
  }

  const entries = await readdir(basePath, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory());
  const originalKey = normalizeFileNameForMatch(carpetaOriginal);
  const normalizedMatch = directories.find(
    (entry) => normalizeFileNameForMatch(entry.name) === originalKey
  );
  if (normalizedMatch) {
    return {
      folderPath: path.join(basePath, normalizedMatch.name),
      matchType: "normalized",
    };
  }

  const codigoNormalizado = normalizeTroquelCodigoForFolder(codigo);
  const prefix = codigoNormalizado ? `troq ${codigoNormalizado}` : "";
  const byCodeMatches = prefix
    ? directories.filter((entry) =>
        normalizeFileNameForMatch(entry.name).startsWith(prefix)
      )
    : [];

  if (byCodeMatches.length === 1) {
    return {
      folderPath: path.join(basePath, byCodeMatches[0].name),
      matchType: "byCode",
    };
  }

  if (byCodeMatches.length > 1) {
    throw new Error(
      `Hay varias carpetas que empiezan por TROQ ${codigoNormalizado}: ${byCodeMatches
        .map((entry) => entry.name)
        .join(" | ")}`
    );
  }

  throw new Error(`No se encontró la carpeta "${carpetaOriginal}".`);
}

async function resolveRealFilePath(
  dirPath: string,
  requestedFileName: string
): Promise<{ fileName: string; fullPath: string } | null> {
  const requestedKey = normalizeFileNameForMatch(requestedFileName);
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    if (!isAllowedFile(entry.name)) continue;
    if (normalizeFileNameForMatch(entry.name) !== requestedKey) continue;

    return {
      fileName: entry.name,
      fullPath: path.join(dirPath, entry.name),
    };
  }

  return null;
}

/**
 * Valida que la ruta final no escape del directorio base (path traversal).
 * Convierte ambas rutas a absolutas y verifica que fullPath empiece por base.
 */
function validatePathTraversal(base: string, fullPath: string): boolean {
  const absBase = path.resolve(base);
  const absFull = path.resolve(fullPath);
  return absFull === absBase || absFull.startsWith(`${absBase}${path.sep}`);
}

export async function GET(req: NextRequest) {
  const troquelId = req.nextUrl.searchParams.get("troquel_id");
  const archivo = req.nextUrl.searchParams.get("archivo");

  if (!troquelId) {
    return NextResponse.json(
      { error: "Falta el parámetro troquel_id." },
      { status: 400 }
    );
  }

  if (archivo && !isAllowedFile(archivo)) {
    return NextResponse.json(
      {
        error: `Tipo de archivo no permitido. Extensiones válidas: ${ALLOWED_EXTENSIONS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Detectar path traversal en el nombre del archivo
  if (
    archivo &&
    (archivo.includes("..") || archivo.includes("/") || archivo.includes("\\"))
  ) {
    return NextResponse.json(
      { error: "Nombre de archivo no válido (path traversal detectado)." },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();

  // 1. Obtener config
  const { data: config, error: cfgErr } = await supabase
    .from("prod_troqueles_config")
    .select("etiquetas_troqueles_path")
    .limit(1)
    .maybeSingle();

  if (cfgErr) {
    return NextResponse.json({ error: cfgErr.message }, { status: 500 });
  }

  const basePath = config?.etiquetas_troqueles_path?.trim();
  if (!basePath) {
    return NextResponse.json(
      {
        error:
          "Configura la carpeta de troqueles de etiquetas en la pestaña Troqueles etiq. (Configuración de ubicación).",
      },
      { status: 400 }
    );
  }

  // 2. Obtener troquel
  const { data: troquel, error: troquelErr } = await supabase
    .from("prod_etiquetas_troqueles")
    .select("codigo, carpeta_original")
    .eq("id", troquelId)
    .maybeSingle();

  if (troquelErr) {
    return NextResponse.json({ error: troquelErr.message }, { status: 500 });
  }

  if (!troquel) {
    return NextResponse.json(
      { error: "Troquel no encontrado." },
      { status: 404 }
    );
  }

  const carpetaOriginal = (troquel.carpeta_original || "").trim();
  if (!carpetaOriginal) {
    return NextResponse.json(
      { error: "Este troquel no tiene carpeta original informada." },
      { status: 400 }
    );
  }

  let resolvedFolder: { folderPath: string; matchType: FolderMatchType };
  try {
    resolvedFolder = await resolveTroquelFolder(
      basePath,
      carpetaOriginal,
      troquel.codigo as string | null | undefined
    );
  } catch (err: any) {
    const attemptedFolderPath = path.join(basePath, carpetaOriginal);
    return NextResponse.json(
      {
        error: `No se pudo resolver la carpeta del troquel: ${err.message || "desconocido"}`,
        localizarHint: attemptedFolderPath,
      },
      { status: 404 }
    );
  }

  const folderPath = resolvedFolder.folderPath;
  if (!validatePathTraversal(basePath, folderPath)) {
    return NextResponse.json(
      { error: "Acceso denegado: path traversal detectado." },
      { status: 403 }
    );
  }

  if (!archivo) {
    try {
      const files = await listAllowedFiles(folderPath);
      return NextResponse.json({
        files,
        folderPath,
        folderMatchType: resolvedFolder.matchType,
        configuredFolderPath: path.join(basePath, carpetaOriginal),
      });
    } catch (err: any) {
      return NextResponse.json(
        {
          error: `No se pudo listar la carpeta del troquel: ${err.message || "desconocido"}`,
          localizarHint: folderPath,
        },
        { status: 404 }
      );
    }
  }

  // 3. Construir ruta completa: basePath + carpeta_original + archivo
  const fullPath = path.join(basePath, carpetaOriginal, archivo);

  // 4. Validar path traversal
  if (!validatePathTraversal(basePath, fullPath)) {
    return NextResponse.json(
      { error: "Acceso denegado: path traversal detectado." },
      { status: 403 }
    );
  }

  // 5. Leer el archivo. Si falla, re-resolvemos contra `readdir`: algunos
  // nombres venidos de Mac/Acrobat mezclan Unicode visualmente idéntico.
  let buffer: Buffer;
  let resolvedFileName = archivo;
  let resolvedFullPath = fullPath;
  try {
    buffer = await readFile(resolvedFullPath);
  } catch (err: any) {
    try {
      const resolved = await resolveRealFilePath(folderPath, archivo);
      if (!resolved || !validatePathTraversal(basePath, resolved.fullPath)) {
        throw err;
      }

      resolvedFileName = resolved.fileName;
      resolvedFullPath = resolved.fullPath;
      buffer = await readFile(resolvedFullPath);
    } catch {
      return NextResponse.json(
        {
          error: `No se pudo leer el archivo: ${err.message || "desconocido"}`,
          localizarHint: fullPath,
        },
        { status: 404 }
      );
    }
  }

  // 6. Servir el archivo
  const contentType = getContentType(resolvedFileName);
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(resolvedFileName)}"`,
      "Cache-Control": "private, max-age=60",
      "X-Resolved-Path": encodeURIComponent(resolvedFullPath),
      "X-Folder-Match-Type": resolvedFolder.matchType,
    },
  });
}
