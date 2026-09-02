"use client";

import { Loader2, ScanSearch, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { albaranParaRecepcion } from "@/lib/albaran-placeholders";
import { filesToAlbaranOcrParts } from "@/lib/albaranes-ocr-files";
import {
  patchOcrDraftRow,
  type AlbaranOcrCompra,
  type AlbaranOcrDraftRow,
  type AlbaranOcrProveedor,
} from "@/lib/albaranes-ocr";
import {
  estadoMaterialDesdeEstadoCompra,
  esEstadoMaterialStopBloqueado,
} from "@/lib/compras-material-estados";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { useHubStore } from "@/lib/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const supabase = createSupabaseBrowserClient();

const TABLE_COMPRA = "prod_compra_material";
const TABLE_RECEPCION = "prod_recepciones_material";
const TABLE_DESPACHADAS = "produccion_ot_despachadas";

type AlbaranesOcrDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (count: number) => void;
};

function semaforoClass(s: AlbaranOcrDraftRow["semaforo"]): string {
  if (s === "verde") return "bg-emerald-100 text-emerald-800";
  if (s === "rojo") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-900";
}

export function AlbaranesOcrDialog({
  open,
  onClose,
  onCreated,
}: AlbaranesOcrDialogProps) {
  const globalModel = useHubStore((s) => s.globalModel);
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<AlbaranOcrDraftRow[]>([]);
  const [proveedores, setProveedores] = useState<AlbaranOcrProveedor[]>([]);
  const [compras, setCompras] = useState<AlbaranOcrCompra[]>([]);
  const [albaranesExistentes, setAlbaranesExistentes] = useState<Set<string>>(
    () => new Set()
  );

  const reset = useCallback(() => {
    setFiles([]);
    setRows([]);
    setProveedores([]);
    setCompras([]);
    setAlbaranesExistentes(new Set());
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const patchRow = useCallback(
    (id: string, patch: Partial<AlbaranOcrDraftRow>) => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? patchOcrDraftRow(r, patch, compras, albaranesExistentes)
            : r
        )
      );
    },
    [compras, albaranesExistentes]
  );

  const included = useMemo(() => rows.filter((r) => r.included), [rows]);

  const interpretar = useCallback(async () => {
    if (files.length === 0) {
      toast.error("Selecciona un PDF o fotos de albarán.");
      return;
    }
    setLoading(true);
    setRows([]);
    try {
      const parts = await filesToAlbaranOcrParts(files);
      if (parts.length === 0) {
        throw new Error("No se pudo leer ningún fichero.");
      }
      const res = await fetch("/api/gemini/albaranes-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: parts, model: globalModel }),
      });
      const data = (await res.json()) as {
        error?: string;
        rows?: AlbaranOcrDraftRow[];
        proveedores?: AlbaranOcrProveedor[];
        compras?: AlbaranOcrCompra[];
        albaranesExistentes?: string[];
      };
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      const nextRows = Array.isArray(data.rows) ? data.rows : [];
      if (nextRows.length === 0) {
        throw new Error("No se leyeron líneas. Prueba fotos más nítidas.");
      }
      setProveedores(data.proveedores ?? []);
      setCompras(data.compras ?? []);
      setAlbaranesExistentes(
        new Set((data.albaranesExistentes ?? []).map((s) => s.toLowerCase()))
      );
      setRows(nextRows);
      toast.success(
        `${nextRows.length} línea${nextRows.length === 1 ? "" : "s"} leída${nextRows.length === 1 ? "" : "s"}. Revisa antes de confirmar.`
      );
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo interpretar."));
    } finally {
      setLoading(false);
    }
  }, [files, globalModel]);

  const confirmar = useCallback(async () => {
    const toSave = rows.filter((r) => r.included);
    if (toSave.length === 0) {
      toast.error("Marca al menos una línea.");
      return;
    }
    for (const r of toSave) {
      const alb = albaranParaRecepcion(r.albaran);
      if (!alb || alb === "-") {
        toast.error("Todas las líneas incluidas necesitan nº de albarán.");
        return;
      }
      if (!r.proveedor_id) {
        toast.error(`Elige proveedor en el albarán ${r.albaran}.`);
        return;
      }
      if (!r.material.trim()) {
        toast.error(`Falta el material en ${r.albaran}.`);
        return;
      }
      if (r.hojas == null || r.hojas <= 0) {
        toast.error(`Faltan las hojas en ${r.albaran}.`);
        return;
      }
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const recepcionadoPorUuid =
        typeof user?.id === "string" && /^[0-9a-f-]{36}$/i.test(user.id.trim())
          ? user.id.trim()
          : null;
      const recepcionadoPorNombre =
        (user?.user_metadata?.full_name as string | undefined)?.trim() ||
        (user?.user_metadata?.name as string | undefined)?.trim() ||
        null;
      const ahora = new Date().toISOString();
      const usedCompraIds = new Set<string>();

      for (const r of toSave) {
        const alb = albaranParaRecepcion(r.albaran);
        const esOc = Boolean(r.compra_id) && !r.es_stock;
        const notasParts = [
          "[OCR albarán]",
          r.notas.trim() || null,
          r.ot_numero && !esOc ? `OT ${r.ot_numero}` : null,
        ].filter(Boolean);

        const insertRow: Record<string, unknown> = {
          compra_id: esOc ? r.compra_id : null,
          tipo_recepcion: esOc ? "oc" : "stock_libre",
          proveedor_id: r.proveedor_id,
          material_nombre: r.material.trim(),
          gramaje: r.gramaje,
          formato: r.formato.trim() || null,
          fecha_recepcion: r.fecha
            ? `${r.fecha}T12:00:00.000Z`
            : ahora,
          albaran_proveedor: alb,
          hojas_recibidas: r.hojas,
          palets_recibidos: r.palets && r.palets > 0 ? r.palets : 1,
          cantidad_peso: r.kilos,
          cantidad_peso_unidad: r.kilos != null ? "kg" : null,
          estado_recepcion: "Total",
          notas: notasParts.join(" · ") || null,
          recepcionado_por: recepcionadoPorUuid,
          recepcionado_por_email: user?.email ?? null,
          recepcionado_por_nombre: recepcionadoPorNombre,
        };

        const { error: rErr } = await supabase
          .from(TABLE_RECEPCION)
          .insert(insertRow as never);
        if (rErr) throw rErr;

        if (esOc && r.compra_id && !usedCompraIds.has(r.compra_id)) {
          usedCompraIds.add(r.compra_id);
          const compra = r.compras_candidatas.find((c) => c.id === r.compra_id);
          const { error: upErr } = await supabase
            .from(TABLE_COMPRA)
            .update({
              estado: "Recibido",
              albaran_proveedor: alb,
              fecha_recepcion: ahora,
            })
            .eq("id", r.compra_id);
          if (upErr) throw upErr;

          const ot = (compra?.ot_numero ?? r.ot_numero).replace(/\D/g, "");
          const mat = estadoMaterialDesdeEstadoCompra("Recibido");
          if (ot && mat) {
            const { data: desp } = await supabase
              .from(TABLE_DESPACHADAS)
              .select("estado_material")
              .eq("ot_numero", ot)
              .maybeSingle();
            const current = (desp as { estado_material?: string | null } | null)
              ?.estado_material;
            if (!esEstadoMaterialStopBloqueado(current)) {
              await supabase
                .from(TABLE_DESPACHADAS)
                .update({ estado_material: mat })
                .eq("ot_numero", ot);
            }
          }
        }
      }

      toast.success(
        `${toSave.length} entrada${toSave.length === 1 ? "" : "s"} creada${toSave.length === 1 ? "" : "s"} en Pendientes. Ya puedes cartelar.`
      );
      reset();
      onCreated(toSave.length);
      onClose();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudieron guardar las entradas."));
    } finally {
      setSaving(false);
    }
  }, [onClose, onCreated, reset, rows]);

  const proveedorOptions = useMemo(
    () => [
      { value: "", label: "— proveedor —" },
      ...proveedores.map((p) => ({ value: p.id, label: p.nombre })),
    ],
    [proveedores]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !loading && !saving) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[min(94vh,920px)] w-[calc(100%-1rem)] max-w-[min(98vw,1600px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(98vw,1600px)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanSearch className="size-4 text-[#C69C2B]" aria-hidden />
            OCR albaranes de entrada
          </DialogTitle>
          <DialogDescription>
            Sube el PDF o las fotos. La IA propone líneas; tú corriges y confirmas.
            No se crean cartelas: las entradas van a Pendientes de cartelar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png"
              multiple
              className="max-w-md text-xs"
              disabled={loading || saving}
              onChange={(e) => {
                const list = e.target.files;
                setFiles(list ? Array.from(list) : []);
                setRows([]);
              }}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => void interpretar()}
              disabled={loading || saving || files.length === 0}
              className="gap-1.5"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              Interpretar
            </Button>
            {files.length > 0 ? (
              <span className="text-xs text-slate-500">
                {files.length} fichero{files.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          {rows.length === 0 && !loading ? (
            <p className="text-sm text-slate-500">
              Acepta un PDF con varios albaranes o fotos de cada uno. Usa Gemini
              Flash o Pro (el selector de arriba del Hub).
            </p>
          ) : null}

          {loading ? (
            <div className="flex flex-1 items-center justify-center py-12 text-sm text-slate-500">
              <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
              Leyendo albaranes…
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200">
              <Table className="min-w-[1480px]">
                <TableHeader>
                  <TableRow className="bg-slate-50/90">
                    <TableHead className="w-8 px-2 text-xs">OK</TableHead>
                    <TableHead className="min-w-[9rem] px-2 text-xs"> </TableHead>
                    <TableHead className="min-w-[12rem] px-2 text-xs">
                      Proveedor
                    </TableHead>
                    <TableHead className="min-w-[8.5rem] px-2 text-xs">
                      Albarán
                    </TableHead>
                    <TableHead className="min-w-[6.5rem] px-2 text-xs">OT</TableHead>
                    <TableHead className="w-14 px-2 text-xs">STOCK</TableHead>
                    <TableHead className="min-w-[16rem] px-2 text-xs">
                      Material
                    </TableHead>
                    <TableHead className="w-16 px-2 text-xs">Gr.</TableHead>
                    <TableHead className="min-w-[5.5rem] px-2 text-xs">
                      Formato
                    </TableHead>
                    <TableHead className="w-14 px-2 text-xs">Pal.</TableHead>
                    <TableHead className="w-16 px-2 text-xs">Kg</TableHead>
                    <TableHead className="w-20 px-2 text-xs">Hojas</TableHead>
                    <TableHead className="min-w-[16rem] px-2 text-xs">
                      Compra Minerva
                    </TableHead>
                    <TableHead className="w-8 px-2 text-xs"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="align-top">
                      <TableCell className="px-2 pt-2">
                        <input
                          type="checkbox"
                          className="size-4 rounded border"
                          checked={r.included}
                          onChange={(e) =>
                            patchRow(r.id, { included: e.target.checked })
                          }
                          aria-label={`Incluir ${r.albaran || "línea"}`}
                        />
                      </TableCell>
                      <TableCell className="px-2 pt-2">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${semaforoClass(r.semaforo)}`}
                        >
                          {r.semaforo}
                        </span>
                        {r.avisos.length > 0 ? (
                          <p className="mt-1 max-w-[11rem] text-[10px] leading-snug text-amber-800">
                            {r.avisos[0]}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-2 pt-1">
                        <NativeSelect
                          className="h-8 min-w-[11rem] text-xs"
                          value={r.proveedor_id ?? ""}
                          options={proveedorOptions}
                          onChange={(e) => {
                            const id = e.target.value || null;
                            const nombre =
                              proveedores.find((p) => p.id === id)?.nombre ??
                              null;
                            patchRow(r.id, {
                              proveedor_id: id,
                              proveedor_nombre: nombre,
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-2 pt-1">
                        <Input
                          className="h-8 text-xs"
                          value={r.albaran}
                          onChange={(e) =>
                            patchRow(r.id, { albaran: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="px-2 pt-1">
                        <Input
                          className="h-8 text-xs"
                          value={r.ot_numero}
                          placeholder="—"
                          onChange={(e) =>
                            patchRow(r.id, {
                              ot_numero: e.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                          disabled={r.es_stock}
                        />
                      </TableCell>
                      <TableCell className="px-2 pt-2 text-center">
                        <input
                          type="checkbox"
                          className="size-4 rounded border"
                          checked={r.es_stock}
                          onChange={(e) =>
                            patchRow(r.id, { es_stock: e.target.checked })
                          }
                          aria-label="Stock libre"
                        />
                      </TableCell>
                      <TableCell className="px-2 pt-1">
                        <Input
                          className="h-8 text-xs"
                          value={r.material}
                          onChange={(e) =>
                            patchRow(r.id, { material: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="px-2 pt-1">
                        <Input
                          className="h-8 px-1 text-xs"
                          value={r.gramaje ?? ""}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(/\D/g, ""));
                            patchRow(r.id, {
                              gramaje: Number.isFinite(n) && n > 0 ? n : null,
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-2 pt-1">
                        <Input
                          className="h-8 px-1 text-xs"
                          value={r.formato}
                          onChange={(e) =>
                            patchRow(r.id, { formato: e.target.value })
                          }
                        />
                      </TableCell>
                      <TableCell className="px-2 pt-1">
                        <Input
                          className="h-8 px-1 text-xs"
                          value={r.palets ?? ""}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(/\D/g, ""));
                            patchRow(r.id, {
                              palets: Number.isFinite(n) && n > 0 ? n : 1,
                              hojas_origen: r.hojas_origen,
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-2 pt-1">
                        <Input
                          className="h-8 px-1 text-xs"
                          value={r.kilos ?? ""}
                          onChange={(e) => {
                            const t = e.target.value.replace(",", ".");
                            const n = Number(t);
                            patchRow(r.id, {
                              kilos: Number.isFinite(n) && n > 0 ? n : null,
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-2 pt-1">
                        <Input
                          className="h-8 px-1 text-xs"
                          value={r.hojas ?? ""}
                          onChange={(e) => {
                            const n = Number(e.target.value.replace(/\D/g, ""));
                            patchRow(r.id, {
                              hojas: Number.isFinite(n) && n > 0 ? n : null,
                              hojas_origen: "manual",
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="px-2 pt-1">
                        {r.es_stock ? (
                          <span className="text-[11px] text-slate-500">
                            Stock libre
                          </span>
                        ) : (
                          <NativeSelect
                            className="h-8 min-w-[15rem] text-xs"
                            value={r.compra_id ?? ""}
                            options={[
                              { value: "", label: "— sin compra —" },
                              ...r.compras_candidatas.map((c) => ({
                                value: c.id,
                                label: `${c.num_compra || c.ot_numero || c.id.slice(0, 6)} · ${c.material ?? ""}`.trim(),
                              })),
                            ]}
                            onChange={(e) =>
                              patchRow(r.id, {
                                compra_id: e.target.value || null,
                              })
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className="px-2 pt-2">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-red-600"
                          title="Quitar línea"
                          onClick={() =>
                            setRows((prev) => prev.filter((x) => x.id !== r.id))
                          }
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </div>

        <DialogFooter className="sm:flex-row sm:justify-between">
          <p className="text-xs text-slate-500">
            {included.length} línea{included.length === 1 ? "" : "s"} a crear
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onClose();
              }}
              disabled={loading || saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void confirmar()}
              disabled={loading || saving || included.length === 0}
            >
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              Confirmar entradas
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
