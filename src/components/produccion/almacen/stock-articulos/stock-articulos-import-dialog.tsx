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
  downloadStockArticulosPlantilla,
  fingerprintStockImportFile,
  importTagFromFingerprint,
  parseStockArticulosExcel,
  validateStockArticulosImportRows,
  type StockArticulosImportDraftRow,
  type StockArticulosImportSemaforo,
} from "@/lib/stock-articulos-excel-import";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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

      const [{ data: refs }, { data: notasRows }, { data: loteKeys }] =
        await Promise.all([
          supabase
            .from("prod_referencias")
            .select("id, codigo, referencia_cliente, cliente")
            .limit(20000),
          supabase
            .from("prod_stock_articulos")
            .select("notas")
            .ilike("notas", "%[import:%")
            .limit(5000),
          supabase
            .from("prod_stock_articulos")
            .select("referencia_id, cantidad_actual, ot_origen")
            .limit(8000),
        ]);

      const tagSet = new Set<string>();
      for (const n of notasRows ?? []) {
        const m = String(n.notas ?? "").match(/\[import:[a-f0-9]+\]/i);
        if (m?.[0]) tagSet.add(m[0].toLowerCase());
      }

      const existingLoteKeys = new Set<string>();
      for (const l of loteKeys ?? []) {
        const rid = typeof l.referencia_id === "string" ? l.referencia_id : "";
        const qty =
          typeof l.cantidad_actual === "number" ? l.cantidad_actual : null;
        const ot = typeof l.ot_origen === "string" ? l.ot_origen : "";
        if (rid && qty != null) existingLoteKeys.add(`${rid}|${qty}|${ot}`);
      }

      const validated = validateStockArticulosImportRows(
        parsed.rows,
        (refs ?? []) as {
          id: string;
          codigo: string;
          referencia_cliente: string | null;
          cliente: string | null;
        }[],
        {
          fileTag: tag,
          existingImportTags: tagSet,
          existingLoteKeys,
        }
      );

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

  const importables = rows.filter((r) => r.semaforo !== "rojo" && r.payload);
  const rojos = rows.filter((r) => r.semaforo === "rojo").length;

  async function confirmImport() {
    if (importables.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }
    if (rojos > 0) {
      const ok = window.confirm(
        `Hay ${rojos} fila(s) en rojo que se omitirán. ¿Importar las ${importables.length} restantes?`
      );
      if (!ok) return;
    }

    setImporting(true);
    let okCount = 0;
    let failCount = 0;
    try {
      for (const row of importables) {
        if (!row.payload) continue;
        const { error } = await supabase.rpc("prod_stock_articulos_alta_lote", {
          ...row.payload,
        });
        if (error) {
          failCount += 1;
          toast.error(`Fila ${row.rowIndex}: ${error.message}`);
        } else {
          okCount += 1;
        }
      }
      if (okCount > 0) {
        toast.success(`${okCount} lote(s) creados.`);
        await onImported();
        handleClose(false);
      }
      if (failCount > 0 && okCount === 0) {
        toast.error("Ninguna fila se pudo importar.");
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#002147]">
            <FileSpreadsheet className="size-4 text-[#C69C2B]" />
            Importar stock (Excel)
          </DialogTitle>
          <DialogDescription>
            Descarga la plantilla, rellénala y súbela. Revisa el semáforo
            (verde OK / amarillo aviso / rojo error) y confirma. Cada fila llama
            a alta de lote; las rojas no se importan.
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
            </span>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            Sube un Excel o descarga la plantilla (incluye 2 filas de ejemplo y
            listas de unidad/proceso).
          </p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="w-12 text-xs">Fila</TableHead>
                  <TableHead className="w-16 text-xs">Estado</TableHead>
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
                      r.semaforo === "rojo"
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
                        className={semaforoClass(r.semaforo)}
                      >
                        {semaforoLabel(r.semaforo)}
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
                      {r.mensajes.length ? r.mensajes.join(" · ") : "—"}
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
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={importing || importables.length === 0}
            onClick={() => void confirmImport()}
          >
            {importing ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : null}
            Confirmar import ({importables.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
