"use client";

import { Loader2, Receipt, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  aplicarConciliacionFacturaAlbaran,
  fetchAlbaranConciliacionContext,
  prorratearImporteFacturaPorHojas,
  type AlbaranConciliacionContext,
} from "@/lib/conciliar-factura-albaran";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function parseEuroInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatEuro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function ConciliarFacturaDialogBody({
  initialAlbaran,
  onClose,
  onApplied,
}: {
  initialAlbaran?: string;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [albaranQuery, setAlbaranQuery] = useState(initialAlbaran?.trim() ?? "");
  const [importeInput, setImporteInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ctx, setCtx] = useState<AlbaranConciliacionContext | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, [supabase]);

  const load = useCallback(async () => {
    const q = albaranQuery.trim();
    if (!q) {
      setCtx(null);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAlbaranConciliacionContext(supabase, q);
      setCtx(data);
      if (!data) {
        toast.error("No se encontró recepción con ese albarán.");
        setImporteInput("");
        return;
      }
      if (data.importeFacturaRegistrado != null) {
        setImporteInput(String(data.importeFacturaRegistrado).replace(".", ","));
      } else {
        setImporteInput("");
      }
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "Error al buscar albarán"));
      setCtx(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, albaranQuery]);

  useEffect(() => {
    if (!initialAlbaran?.trim()) return;
    void load();
  }, [initialAlbaran, load]);

  const importePreview = parseEuroInput(importeInput);
  const previewCostes = useMemo(() => {
    if (!ctx || importePreview == null) return new Map<string, number>();
    return prorratearImporteFacturaPorHojas(importePreview, ctx.palets);
  }, [ctx, importePreview]);

  const paletsConCostePrevio = ctx?.palets.filter((p) => (p.coste ?? 0) > 0).length ?? 0;

  async function handleApply() {
    const importe = parseEuroInput(importeInput);
    if (importe == null) {
      toast.error("Indica el importe total de la factura.");
      return;
    }
    setSaving(true);
    try {
      const res = await aplicarConciliacionFacturaAlbaran(supabase, {
        albaranProveedor: albaranQuery.trim(),
        importeTotalEur: importe,
        userEmail,
      });
      toast.success(
        `Factura aplicada: ${formatEuro(res.importeTotal)} en ${res.paletsActualizados} cartela${res.paletsActualizados !== 1 ? "s" : ""}.`
      );
      onApplied?.();
      onClose();
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "No se pudo conciliar la factura"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1 space-y-1">
          <Label htmlFor="conciliar-albaran" className="text-xs">
            Nº albarán proveedor
          </Label>
          <Input
            id="conciliar-albaran"
            placeholder="Ej. LAB-98045-P1"
            value={albaranQuery}
            onChange={(e) => setAlbaranQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load();
            }}
            className="h-9 font-mono text-sm"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          disabled={loading || !albaranQuery.trim()}
          onClick={() => void load()}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Buscar
        </Button>
      </div>

      {ctx && (
        <div className="mt-3 space-y-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <strong>{ctx.recepciones.length}</strong> línea
            {ctx.recepciones.length !== 1 ? "s" : ""} recepción ·{" "}
            <strong>{ctx.palets.length}</strong> cartela
            {ctx.palets.length !== 1 ? "s" : ""} ·{" "}
            <strong>{ctx.hojasTotal.toLocaleString("es-ES")}</strong> hojas
            {ctx.importeFacturaRegistrado != null ? (
              <>
                {" "}
                · factura registrada:{" "}
                <strong>{formatEuro(ctx.importeFacturaRegistrado)}</strong>
                {ctx.recepciones[0]?.importe_factura_at ? (
                  <>
                    {" "}
                    (
                    {formatFechaEsCorta(ctx.recepciones[0].importe_factura_at)}
                    )
                  </>
                ) : null}
              </>
            ) : null}
          </div>

          {ctx.palets.length === 0 && ctx.paletsPrueba.length > 0 ? (
            <p className="text-sm text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              Hay {ctx.paletsPrueba.length} cartela
              {ctx.paletsPrueba.length !== 1 ? "s" : ""} de{" "}
              <strong>prueba</strong> (Id ≥ 99000) ligada
              {ctx.paletsPrueba.length !== 1 ? "s" : ""} a este albarán, pero la
              conciliación de factura solo aplica a cartelas de producción.
              Cartela de nuevo sin marcar «Cartela de prueba», o usa un albarán
              con cartelas reales.
            </p>
          ) : ctx.palets.length === 0 ? (
            <p className="text-sm text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              Hay recepción pero aún no hay cartelas carteladas para este albarán.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="conciliar-importe" className="text-xs">
                    Importe total factura (€)
                  </Label>
                  <Input
                    id="conciliar-importe"
                    inputMode="decimal"
                    placeholder="Ej. 593,00"
                    value={importeInput}
                    onChange={(e) => setImporteInput(e.target.value)}
                    className="h-9 tabular-nums"
                  />
                </div>
                <div className="flex items-end text-xs text-slate-500 pb-2">
                  Se prorratea por hojas a cada cartela del albarán. Si al cartelar
                  ya se puso coste, la factura de Emma lo sustituye.
                </div>
              </div>

              {paletsConCostePrevio > 0 && importePreview != null ? (
                <p className="text-xs text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  {paletsConCostePrevio} cartela
                  {paletsConCostePrevio !== 1 ? "s" : ""} ya tenía coste — se
                  actualizará con el prorrateo de la factura.
                </p>
              ) : null}

              <div className="max-h-[min(40vh,320px)] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cartela</TableHead>
                      <TableHead>OT</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Hojas</TableHead>
                      <TableHead className="text-right">Coste actual</TableHead>
                      <TableHead className="text-right">Nuevo coste</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ctx.palets.map((p) => {
                      const recep = ctx.recepciones.find(
                        (r) => r.id === p.recepcion_id
                      );
                      const nuevo = previewCostes.get(p.id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs">
                            #{p.id_stock}
                          </TableCell>
                          <TableCell className="text-xs">
                            {recep?.ot_numero ?? "—"}
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate text-xs">
                            {p.material_nombre ?? recep?.material_nombre ?? "—"}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {p.cantidad_inicial.toLocaleString("es-ES")}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {formatEuro(p.coste)}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums font-medium text-[#002147]">
                            {nuevo != null ? formatEuro(nuevo) : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}

      {!loading && albaranQuery.trim() && ctx == null && (
        <p className="mt-3 text-sm text-slate-500">
          Pulsa Buscar para cargar recepciones y cartelas del albarán.
        </p>
      )}

      <DialogFooter className="mt-4 gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="gap-1.5"
          disabled={
            saving ||
            loading ||
            !ctx ||
            ctx.palets.length === 0 ||
            importePreview == null
          }
          onClick={() => void handleApply()}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Receipt className="size-4" />
          )}
          Aplicar factura
        </Button>
      </DialogFooter>
    </>
  );
}

export function ConciliarFacturaDialog({
  open,
  onOpenChange,
  initialAlbaran,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialAlbaran?: string;
  onApplied?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#002147]">
            <Receipt className="size-5" />
            Conciliar factura por albarán
          </DialogTitle>
          <DialogDescription>
            Emma registra el importe de factura y se prorratea el coste a las
            cartelas del albarán. Si al cartelar ya se indicó coste, se
            sustituye por el de la factura.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ConciliarFacturaDialogBody
            initialAlbaran={initialAlbaran}
            onClose={() => onOpenChange(false)}
            onApplied={onApplied}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
