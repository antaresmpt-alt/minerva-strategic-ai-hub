"use client";

import {
  FileSpreadsheet,
  Loader2,
  Printer,
  Recycle,
} from "lucide-react";
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
import { NativeSelect } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPesoKg } from "@/lib/albaranes-ocr";
import { errorMessageFromUnknown } from "@/lib/error-message";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";
import {
  agruparResiduosEntradas,
  exportResiduosEntradasExcel,
  exportResiduosEntradasPdf,
  fetchResiduosEntradasPapel,
  periodoLabelFromYmd,
  totalesResiduosEntradas,
  type ResiduosAgrupacion,
  type ResiduosEntradaRow,
} from "@/lib/residuos-analisis";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type ProveedorOption = { id: string; nombre: string };

const AGRUPACION_OPTIONS: { value: ResiduosAgrupacion; label: string }[] = [
  { value: "detalle", label: "Detalle (recepción)" },
  { value: "proveedor", label: "Por proveedor" },
  { value: "material", label: "Por material" },
  { value: "mes", label: "Por mes" },
];

function ymdToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function ymdMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-[#002147] bg-[#002147] text-white"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

function ResiduosAnalisisDialogBody({
  proveedores,
  onClose,
}: {
  proveedores: ProveedorOption[];
  onClose: () => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [desdeYmd, setDesdeYmd] = useState(ymdMonthStart);
  const [hastaYmd, setHastaYmd] = useState(ymdToday);
  const [proveedorId, setProveedorId] = useState("");
  const [materialQuery, setMaterialQuery] = useState("");
  const [materialQueryDebounced, setMaterialQueryDebounced] = useState("");
  const [agrupacion, setAgrupacion] = useState<ResiduosAgrupacion>("proveedor");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ResiduosEntradaRow[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(
      () => setMaterialQueryDebounced(materialQuery.trim()),
      400
    );
    return () => window.clearTimeout(t);
  }, [materialQuery]);

  const periodoLabel = useMemo(
    () => periodoLabelFromYmd(desdeYmd, hastaYmd),
    [desdeYmd, hastaYmd]
  );

  const agrupado = useMemo(
    () => agruparResiduosEntradas(rows, agrupacion),
    [rows, agrupacion]
  );

  const totales = useMemo(() => totalesResiduosEntradas(rows), [rows]);

  const load = useCallback(async () => {
    if (!desdeYmd || !hastaYmd) {
      toast.error("Indica periodo desde/hasta.");
      return;
    }
    if (desdeYmd > hastaYmd) {
      toast.error("La fecha «desde» no puede ser posterior a «hasta».");
      return;
    }
    setLoading(true);
    try {
      const data = await fetchResiduosEntradasPapel(supabase, {
        desdeYmd,
        hastaYmd,
        proveedorId: proveedorId.trim() || null,
        materialQuery: materialQueryDebounced,
      });
      setRows(data);
      setLoadedOnce(true);
    } catch (e) {
      toast.error(errorMessageFromUnknown(e, "Error al cargar recepciones"));
    } finally {
      setLoading(false);
    }
  }, [supabase, desdeYmd, hastaYmd, proveedorId, materialQueryDebounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const proveedorOptions = useMemo(
    () => [
      { value: "", label: "Todos los proveedores" },
      ...proveedores.map((p) => ({ value: p.id, label: p.nombre })),
    ],
    [proveedores]
  );

  function handleExportExcel() {
    if (rows.length === 0) {
      toast.error("No hay datos para exportar.");
      return;
    }
    exportResiduosEntradasExcel(rows, agrupado, agrupacion, periodoLabel);
    toast.success("Excel descargado.");
  }

  function handleExportPdf() {
    if (rows.length === 0) {
      toast.error("No hay datos para exportar.");
      return;
    }
    exportResiduosEntradasPdf(rows, agrupado, agrupacion, periodoLabel);
    toast.success("PDF descargado.");
  }

  const isDetalle = agrupacion === "detalle";

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="residuos-desde" className="text-xs">
            Desde
          </Label>
          <Input
            id="residuos-desde"
            type="date"
            value={desdeYmd}
            onChange={(e) => setDesdeYmd(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="residuos-hasta" className="text-xs">
            Hasta
          </Label>
          <Input
            id="residuos-hasta"
            type="date"
            value={hastaYmd}
            onChange={(e) => setHastaYmd(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <NativeSelect
            label="Proveedor"
            options={proveedorOptions}
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="residuos-material" className="text-xs">
            Material (filtro texto)
          </Label>
          <Input
            id="residuos-material"
            placeholder="Ej. offset, couché…"
            value={materialQuery}
            onChange={(e) => setMaterialQuery(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Agrupación</Label>
          <div className="flex flex-wrap gap-1.5">
            {AGRUPACION_OPTIONS.map((opt) => (
              <OptionButton
                key={opt.value}
                active={agrupacion === opt.value}
                onClick={() => setAgrupacion(opt.value)}
              >
                {opt.label}
              </OptionButton>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <span>
          <strong>{totales.recepciones}</strong> recep.
        </span>
        <span aria-hidden>·</span>
        <span>
          <strong>{totales.albaranes}</strong> albaranes
        </span>
        <span aria-hidden>·</span>
        <span>
          <strong>{totales.hojas.toLocaleString("es-ES")}</strong> hojas
        </span>
        <span aria-hidden>·</span>
        <span>
          <strong>{formatPesoKg(totales.kg) ?? "—"}</strong>
        </span>
        {loading && (
          <span className="ml-auto inline-flex items-center gap-1 text-slate-500">
            <Loader2 className="size-3 animate-spin" />
            Cargando…
          </span>
        )}
      </div>

      <div className="mt-3 max-h-[min(50vh,420px)] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {isDetalle ? (
                <>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Albarán</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>OT</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Hojas</TableHead>
                  <TableHead className="text-right">Kg</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Material / periodo</TableHead>
                  <TableHead className="text-right">Hojas</TableHead>
                  <TableHead className="text-right">Kg</TableHead>
                  <TableHead className="text-right">Recep.</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && loadedOnce && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isDetalle ? 7 : 6}
                  className="py-8 text-center text-sm text-slate-500"
                >
                  Sin recepciones en el periodo con los filtros actuales.
                </TableCell>
              </TableRow>
            )}
            {isDetalle
              ? rows.map((r) => (
                  <TableRow key={r.recepcionId}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatFechaEsCorta(r.fechaRecepcion)}
                    </TableCell>
                    <TableCell className="text-xs">{r.albaran}</TableCell>
                    <TableCell className="text-xs">{r.proveedor}</TableCell>
                    <TableCell className="text-xs">{r.otNumero ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs">
                      {r.material}
                      {r.formato ? ` · ${r.formato}` : ""}
                      {r.gramaje ? ` · ${r.gramaje}g` : ""}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {r.hojas.toLocaleString("es-ES")}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatPesoKg(r.kg) ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              : agrupado.map((r) => (
                  <TableRow key={r.clave}>
                    <TableCell className="text-xs">{r.clave}</TableCell>
                    <TableCell className="text-xs">{r.proveedor}</TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs">
                      {r.material}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {r.hojas.toLocaleString("es-ES")}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatPesoKg(r.kg) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {r.recepciones}
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      <p className="mt-2 text-[11px] text-slate-500">
        Entradas de materia prima (papel/cartón) registradas en recepciones.
        Uso interno para preparar declaraciones de residuos.
      </p>

      <DialogFooter className="mt-4 gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          disabled={loading || rows.length === 0}
          onClick={handleExportExcel}
        >
          <FileSpreadsheet className="size-4" />
          Excel
        </Button>
        <Button
          type="button"
          className="gap-1.5"
          disabled={loading || rows.length === 0}
          onClick={handleExportPdf}
        >
          <Printer className="size-4" />
          PDF
        </Button>
      </DialogFooter>
    </>
  );
}

export function ResiduosAnalisisDialog({
  open,
  onOpenChange,
  proveedores,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proveedores?: ProveedorOption[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [loadedProveedores, setLoadedProveedores] = useState<ProveedorOption[]>(
    proveedores ?? []
  );

  useEffect(() => {
    if (proveedores && proveedores.length > 0) {
      setLoadedProveedores(proveedores);
      return;
    }
    if (!open) return;
    void (async () => {
      const { data, error } = await supabase
        .from("prod_proveedores")
        .select("id, nombre")
        .order("nombre", { ascending: true });
      if (error) {
        toast.error("No se pudieron cargar proveedores.");
        return;
      }
      setLoadedProveedores(
        (data ?? []).map((p) => ({
          id: String(p.id),
          nombre: String(p.nombre ?? "").trim() || "Sin nombre",
        }))
      );
    })();
  }, [open, proveedores, supabase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#002147]">
            <Recycle className="size-5" />
            Análisis residuos — entradas papel/cartón
          </DialogTitle>
          <DialogDescription>
            Recepciones de almacén agrupadas por periodo, proveedor o material.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ResiduosAnalisisDialogBody
            proveedores={loadedProveedores}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
