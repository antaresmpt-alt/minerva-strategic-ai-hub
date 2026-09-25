"use client";

import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { errorMessageFromUnknown } from "@/lib/error-message";
import {
  collectImportLookupKeys,
  downloadStockArticulosPlantilla,
  fingerprintStockImportFile,
  importTagFromFingerprint,
  parseStockArticulosExcel,
  validateStockArticulosImportRows,
  type RefCatalogRow,
  type StockArticulosImportDraftRow,
  type StockArticulosImportSemaforo,
} from "@/lib/stock-articulos-excel-import";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchAllInChunks } from "@/lib/supabase-query-chunks";

const supabase = createSupabaseBrowserClient();

type StockArticulosImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void>;
};

function semaforoClass(s: StockArticulosImportSemaforo): string {
  if (s === "verde") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "rojo") return "bg-red-100 text-red-800 border-red-200";
  return "bg-amber-100 text-amber-900 border-amber-200";
}

function semaforoLabel(s: StockArticulosImportSemaforo): string {
  if (s === "verde") return "OK";
  if (s === "rojo") return "Error";
  return "Aviso";
}

function rowStatusLabel(r: StockArticulosImportDraftRow): string {
  if (r.importResult === "created") return "Creada";
  if (r.importResult === "error") return "Falló";
  return semaforoLabel(r.semaforo);
}

function rowStatusClass(r: StockArticulosImportDraftRow): string {
  if (r.importResult === "created") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (r.importResult === "error") {
    return "bg-red-100 text-red-800 border-red-200";
  }
  return semaforoClass(r.semaforo);
}

export function StockArticulosImportDialog({
  open,
  onOpenChange,
  onImported,
}: StockArticulosImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileTag, setFileTag] = useState<string | null>(null);
  const [rows, setRows] = useState<StockArticulosImportDraftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const reset = useCallback(() => {
    setFileName(null);
    setFileTag(null);
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  async function handleFile(file: File) {
    setLoading(true);
    try {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
        toast.error("Solo se admiten archivos Excel (.xlsx).");
        return;
      }

      const fp = await fingerprintStockImportFile(file);
      const tag = importTagFromFingerprint(fp);
      const buf = await file.arrayBuffer();
      const parsed = parseStockArticulosExcel(buf);
      if (parsed.error) {
        toast.error(parsed.error);
        reset();
        return;
      }
      if (parsed.rows.length === 0) {
        toast.error("No hay filas para importar.");
        reset();
        return;
      }

      const { codigos, refsCliente } = collectImportLookupKeys(parsed.rows);

      const [byCodigo, byRefCliente] = await Promise.all([
        codigos.length
          ? fetchAllInChunks(codigos, 100, async (chunk) => {
              const { data, error } = await supabase
                .from("prod_referencias")
                .select("id, codigo, referencia_cliente, cliente")
                .in("codigo", chunk);
              if (error) throw error;
              return (data ?? []) as RefCatalogRow[];
            })
          : Promise.resolve([] as RefCatalogRow[]),
        refsCliente.length
          ? fetchAllInChunks(refsCliente, 100, async (chunk) => {
              const { data, error } = await supabase
                .from("prod_referencias")
                .select("id, codigo, referencia_cliente, cliente")
                .in("referencia_cliente", chunk);
              if (error) throw error;
              return (data ?? []) as RefCatalogRow[];
            })
          : Promise.resolve([] as RefCatalogRow[]),
      ]);

      const catalogById = new Map<string, RefCatalogRow>();
      for (const r of [...byCodigo, ...byRefCliente]) {
        catalogById.set(r.id, r);
      }
      const catalog = [...catalogById.values()];

      // Anti-doble: solo comprobar si ESTE tag ya aparece (no traer todas las notas).
      const { data: tagHit, error: tagErr } = await supabase
        .from("prod_stock_articulos")
        .select("id")
        .ilike("notas", `%${tag}%`)
        .limit(1);
      if (tagErr) throw tagErr;
      const tagSet = new Set<string>();
      if ((tagHit ?? []).length > 0) tagSet.add(tag.toLowerCase());

      const refIds = catalog.map((c) => c.id);
      const loteRows =
        refIds.length > 0
          ? await fetchAllInChunks(refIds, 100, async (chunk) => {
              const { data, error } = await supabase
                .from("prod_stock_articulos")
                .select("referencia_id, cantidad_actual, ot_origen")
                .in("referencia_id", chunk);
              if (error) throw error;
              return data ?? [];
            })
          : [];

      const existingLoteKeys = new Set<string>();
      for (const l of loteRows) {
        const rid = typeof l.referencia_id === "string" ? l.referencia_id : "";
        const qty =
          typeof l.cantidad_actual === "number" ? l.cantidad_actual : null;
        const ot = typeof l.ot_origen === "string" ? l.ot_origen : "";
        if (rid && qty != null) existingLoteKeys.add(`${rid}|${qty}|${ot}`);
      }

      const validated = validateStockArticulosImportRows(parsed.rows, catalog, {
        fileTag: tag,
        existingImportTags: tagSet,
        existingLoteKeys,
      });

      setFileName(file.name);
      setFileTag(tag);
      setRows(validated);

      const rojosN = validated.filter((r) => r.semaforo === "rojo").length;
      const amarillosN = validated.filter(
        (r) => r.semaforo === "amarillo"
      ).length;
      if (tagSet.has(tag.toLowerCase())) {
        toast.message(
          "Este archivo ya se importó antes (mismo contenido). Revisa avisos amarillos."
        );
      }
      toast.success(
        `${validated.length} filas · ${rojosN} error · ${amarillosN} aviso`
      );
    } catch (e) {
      toast.error(`No se pudo leer el Excel: ${errorMessageFromUnknown(e)}`);
      reset();
    } finally {
      setLoading(false);
    }
  }

  const pendingImport = rows.filter(
    (r) =>
      r.semaforo !== "rojo" &&
      r.payload &&
      r.importResult !== "created"
  );
  const failedImport = rows.filter((r) => r.importResult === "error");
  const createdCount = rows.filter((r) => r.importResult === "created").length;
  const rojos = rows.filter(
    (r) => r.semaforo === "rojo" && !r.importResult
  ).length;
  const isRetry = failedImport.length > 0 || createdCount > 0;

  async function confirmImport() {
    // Primera pasada: todas las válidas. Reintento: solo las que fallaron.
    const toRun = isRetry
      ? rows.filter((r) => r.importResult === "error" && r.payload)
      : pendingImport;

    if (toRun.length === 0) {
      toast.error(
        isRetry
          ? "No hay filas fallidas para reintentar."
          : "No hay filas válidas para importar."
      );
      return;
    }
    if (!isRetry && rojos > 0) {
      const ok = window.confirm(
        `Hay ${rojos} fila(s) en rojo que se omitirán. ¿Importar las ${toRun.length} restantes?`
      );
      if (!ok) return;
    }

    setImporting(true);
    let okCount = 0;
    let failCount = 0;
    try {
      const next = [...rows];
      for (const row of toRun) {
        if (!row.payload) continue;
        const idx = next.findIndex((r) => r.rowIndex === row.rowIndex);
        if (idx < 0) continue;
        const { error } = await supabase.rpc("prod_stock_articulos_alta_lote", {
          ...row.payload,
        });
        if (error) {
          failCount += 1;
          next[idx] = {
            ...next[idx]!,
            importResult: "error",
            importError: error.message,
            mensajes: [
              ...next[idx]!.mensajes.filter(
                (m) => !m.startsWith("Importación:")
              ),
              `Importación: ${error.message}`,
            ],
          };
        } else {
          okCount += 1;
          next[idx] = {
            ...next[idx]!,
            importResult: "created",
            importError: undefined,
            mensajes: [
              ...next[idx]!.mensajes.filter(
                (m) => !m.startsWith("Importación:")
              ),
              "Importación: lote creado.",
            ],
          };
        }
        setRows([...next]);
      }

      if (okCount > 0) {
        toast.success(`${okCount} lote(s) creados.`);
        await onImported();
      }
      if (failCount > 0) {
        toast.error(
          `${failCount} fila(s) fallaron. Revisa la tabla y reintenta las fallidas.`
        );
      }
      // Diálogo permanece abierto para ver ✅/❌ y reintentar.
    } finally {
      setImporting(false);
    }
  }

  const confirmLabel = isRetry
    ? `Reintentar fallidas (${failedImport.length})`
    : `Confirmar import (${pendingImport.length})`;
  const confirmDisabled =
    importing ||
    (isRetry ? failedImport.length === 0 : pendingImport.length === 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#002147]">
            <FileSpreadsheet className="size-4 text-[#C69C2B]" />
            Importar stock (Excel)
          </DialogTitle>
          <DialogDescription>
            Descarga la plantilla, rellena la hoja Stock y súbela. Semáforo
            verde/amarillo/rojo; tras confirmar, cada fila muestra creada o
            error (el diálogo no se cierra). Las rojas no se importan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => downloadStockArticulosPlantilla()}
          >
            <Download className="size-4 mr-1.5" />
            Descargar plantilla
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading || importing}
            onClick={() => fileRef.current?.click()}
          >
            {loading ? (
              <Loader2 className="size-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="size-4 mr-1.5" />
            )}
            Subir Excel
          </Button>
          {fileName ? (
            <span className="text-xs text-slate-500 self-center">
              {fileName}
              {fileTag ? ` · ${fileTag}` : ""}
              {createdCount > 0
                ? ` · ${createdCount} creadas`
                : ""}
            </span>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            Sube un Excel o descarga la plantilla (hoja Stock vacía + hoja
            Ejemplo + listas de unidad/proceso).
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="w-12 text-xs">Fila</TableHead>
                  <TableHead className="w-20 text-xs">Estado</TableHead>
                  <TableHead className="text-xs">Ref.</TableHead>
                  <TableHead className="text-xs text-right">Cant.</TableHead>
                  <TableHead className="text-xs">Ud.</TableHead>
                  <TableHead className="text-xs">Proceso</TableHead>
                  <TableHead className="text-xs">Mensajes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.rowIndex}
                    className={
                      r.importResult === "created"
                        ? "bg-emerald-50/50"
                        : r.importResult === "error" || r.semaforo === "rojo"
                          ? "bg-red-50/40"
                          : r.semaforo === "amarillo"
                            ? "bg-amber-50/30"
                            : undefined
                    }
                  >
                    <TableCell className="text-xs tabular-nums">
                      {r.rowIndex}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={rowStatusClass(r)}
                      >
                        {r.importResult === "created"
                          ? "Creada"
                          : r.importResult === "error"
                            ? "Falló"
                            : rowStatusLabel(r)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {r.resolved?.codigo ??
                        (r.referencia_minerva ||
                          r.referencia_cliente ||
                          "—")}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      {r.cantidad || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.unidad || "—"}</TableCell>
                    <TableCell className="text-xs">{r.proceso || "—"}</TableCell>
                    <TableCell className="text-xs text-slate-600 max-w-[280px]">
                      {r.importError
                        ? r.importError
                        : r.mensajes.length
                          ? r.mensajes.join(" · ")
                          : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={importing}
          >
            {createdCount > 0 ? "Cerrar" : "Cancelar"}
          </Button>
          <Button
            type="button"
            disabled={confirmDisabled}
            onClick={() => void confirmImport()}
          >
            {importing ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
