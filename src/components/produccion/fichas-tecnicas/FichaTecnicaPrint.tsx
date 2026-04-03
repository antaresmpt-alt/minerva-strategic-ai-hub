"use client";

import { HardDrive, Printer } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import { useReactToPrint } from "react-to-print";

import { Button } from "@/components/ui/button";
import { formatFechaEsLarga } from "@/lib/produccion-date-format";
import { cn } from "@/lib/utils";

export type FichaTecnicaPrintData = {
  ot: number;
  cliente: string;
  trabajo: string;
  gramaje: string | null;
  tipo_material: string | null;
  formato: string | null;
  pasadas: string | null;
  tipo_impresion: string | null;
  densidad_1: number | string | null;
  densidad_2: number | string | null;
  densidad_3: number | string | null;
  densidad_4: number | string | null;
  densidad_5: number | string | null;
  densidad_6: number | string | null;
  densidad_7: number | string | null;
  densidad_8: number | string | null;
  notas: string | null;
  ruta_backup?: string | null;
  fecha: string | null;
  maquinista: string | null;
  proveedor?: string | null;
  acabado?: string | null;
  caucho?: string | null;
};

function cell(v: unknown): string {
  const s = String(v ?? "").trim();
  return s === "0" || s === "0.00" || !s ? "—" : s;
}

function cellDens(v: number | string | null | undefined): string {
  const s = String(v ?? "").trim();
  if (!s || s === "0" || s === "0.00") return "—";
  return s;
}

type FichaTecnicaPrintProps = {
  data: FichaTecnicaPrintData;
  className?: string;
  showToolbar?: boolean;
  compact?: boolean;
};

export type FichaTecnicaPrintHandle = {
  print: () => void;
};

function normalizeOt(ot: unknown): number {
  if (typeof ot === "number" && Number.isFinite(ot)) return ot;
  const n = Number(ot);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Impresión en una sola hoja: @page sin margen (evita sumar con el diálogo de Chrome);
 * márgenes internos en .ficha-print-root. Sin page-break-inside en la tabla maestra (causa hoja en blanco).
 */
export const FICHA_PRINT_PAGE_STYLE = `
  @media print {
    @page {
      size: A4 portrait;
      margin: 0 !important;
    }
    html,
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm !important;
      max-width: 210mm !important;
      height: auto !important;
      min-height: 0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: ui-sans-serif, system-ui, "Inter", "Segoe UI", Helvetica, Arial, sans-serif;
    }
    .ficha-print-root {
      width: 210mm !important;
      max-width: 210mm !important;
      min-height: 0 !important;
      height: auto !important;
      max-height: 297mm !important;
      padding: 10mm !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      margin: 0 !important;
      font-size: 10pt;
      line-height: 1.35;
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .ficha-print-dens-table {
      page-break-inside: avoid;
    }
    .ficha-print-notas-td {
      height: 220px !important;
      max-height: 220px !important;
      vertical-align: top !important;
    }
    .ficha-batch-break {
      break-after: page;
      page-break-after: always;
    }
    .ficha-print-batch-host {
      margin: 0 !important;
      padding: 0 !important;
      width: 210mm !important;
      max-width: 210mm !important;
      height: auto !important;
      min-height: 0 !important;
      background: transparent !important;
    }
  }
`;

function TechCell({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact: boolean;
}) {
  return (
    <td
      className={cn(
        "border border-slate-300 bg-white px-2 py-1.5 align-top print:border-neutral-400",
        compact && "py-1"
      )}
    >
      <div className="text-[9px] font-medium uppercase tracking-wide text-slate-500 print:text-neutral-600">
        {label}
      </div>
      <div
        className={cn(
          "font-semibold leading-tight text-[#002147] print:text-black",
          compact ? "text-xs" : "text-sm"
        )}
      >
        {value}
      </div>
    </td>
  );
}

export const FichaTecnicaPrint = forwardRef<
  FichaTecnicaPrintHandle,
  FichaTecnicaPrintProps
>(function FichaTecnicaPrint(
  { data, className, showToolbar = true, compact = false },
  ref
) {
  const printRef = useRef<HTMLDivElement>(null);
  const ot = normalizeOt(data?.ot);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Ficha-OT-${ot || "sin-ot"}`,
    pageStyle: FICHA_PRINT_PAGE_STYLE,
  });

  const runPrint = useCallback(() => {
    if (!printRef.current) return;
    void handlePrint();
  }, [handlePrint]);

  useImperativeHandle(
    ref,
    () => ({
      print: runPrint,
    }),
    [runPrint]
  );

  const fechaLabel = data?.fecha
    ? formatFechaEsLarga(`${data.fecha}T12:00:00`)
    : "—";

  const densidades = [
    data?.densidad_1,
    data?.densidad_2,
    data?.densidad_3,
    data?.densidad_4,
    data?.densidad_5,
    data?.densidad_6,
    data?.densidad_7,
    data?.densidad_8,
  ];

  const c = compact;

  return (
    <div className={cn("space-y-3", className)}>
      {showToolbar ? (
        <div className="print:hidden flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-2 border-[#002147]/20 bg-white"
            onClick={() => runPrint()}
          >
            <Printer className="size-4" aria-hidden />
            Imprimir
          </Button>
        </div>
      ) : null}

      <div
        ref={printRef}
        className={cn(
          "ficha-print-root text-[#002147]",
          "mx-auto w-full max-w-4xl rounded-lg border-2 border-slate-800 bg-white p-3 font-sans text-sm shadow-sm",
          "print:w-[210mm] print:max-w-[210mm] print:rounded-none print:border-0 print:p-0 print:shadow-none"
        )}
      >
        <table
          className="ficha-master w-full border-collapse text-[#002147]"
          style={{ width: "100%", borderCollapse: "collapse" }}
        >
          <tbody>
            {/* Cabecera: Cliente / Trabajo | logo+título | OT */}
            <tr>
              <td
                className="border border-slate-800 align-top p-2 print:border-black"
                style={{ width: "36%" }}
              >
                <div className="mb-2 text-[9px] font-medium uppercase text-slate-500 print:text-neutral-600">
                  Cliente
                </div>
                <div className="text-sm font-semibold leading-snug print:text-black">
                  {cell(data?.cliente)}
                </div>
                <div className="mt-2 text-[9px] font-medium uppercase text-slate-500 print:text-neutral-600">
                  Trabajo
                </div>
                <div className="text-sm font-semibold leading-snug print:text-black">
                  {cell(data?.trabajo)}
                </div>
              </td>
              <td
                className="border border-slate-800 align-middle p-2 print:border-black"
                style={{ width: "34%" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/minerva-logo.svg"
                  alt=""
                  className="mb-1 h-8 w-auto object-contain object-left print:h-9"
                />
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-700 print:text-black">
                  Minerva · Producción
                </div>
                <div className="text-[9px] text-slate-500 print:text-neutral-600">
                  Ficha técnica de taller
                </div>
              </td>
              <td
                className="border border-black bg-black align-middle p-2 text-center print:border-black print:bg-black"
                style={{ width: "30%" }}
              >
                <div className="text-[8px] font-semibold uppercase tracking-widest text-white/80">
                  OT
                </div>
                <div className="font-heading text-3xl font-bold tabular-nums leading-none text-white print:text-white">
                  {ot}
                </div>
              </td>
            </tr>

            {/* Datos técnicos fila 1: 4 columnas */}
            <tr>
              <td className="border border-slate-800 p-0 print:border-black" colSpan={3}>
                <table
                  className="w-full border-collapse"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <tbody>
                    <tr>
                      <TechCell
                        label="Material"
                        value={cell(data?.tipo_material)}
                        compact={c}
                      />
                      <TechCell
                        label="Gramaje"
                        value={cell(data?.gramaje)}
                        compact={c}
                      />
                      <TechCell
                        label="Formato"
                        value={cell(data?.formato)}
                        compact={c}
                      />
                      <TechCell
                        label="Pasadas"
                        value={cell(data?.pasadas)}
                        compact={c}
                      />
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Datos técnicos fila 2 */}
            <tr>
              <td className="border border-slate-800 p-0 print:border-black" colSpan={3}>
                <table
                  className="w-full border-collapse"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <tbody>
                    <tr>
                      <TechCell
                        label="Proveedor"
                        value={cell(data?.proveedor)}
                        compact={c}
                      />
                      <TechCell
                        label="Tipo impresión"
                        value={cell(data?.tipo_impresion)}
                        compact={c}
                      />
                      <TechCell
                        label="Acabado"
                        value={cell(data?.acabado)}
                        compact={c}
                      />
                      <TechCell
                        label="Caucho"
                        value={cell(data?.caucho)}
                        compact={c}
                      />
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Densidades 4×2 */}
            <tr>
              <td className="border border-slate-800 p-0 print:border-black" colSpan={3}>
                <div className="bg-slate-50 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-700 print:bg-white print:text-black">
                  Densidades (tintas)
                </div>
                <table
                  className="ficha-print-dens-table w-full border-collapse"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <tbody>
                    {[0, 1].map((row) => (
                      <tr key={row}>
                        {[0, 1, 2, 3].map((col) => {
                          const i = row * 4 + col;
                          const d = densidades[i];
                          return (
                            <td
                              key={i}
                              className="relative border border-black bg-white py-3 text-center align-middle print:border-black"
                              style={{ height: "2.75rem", minHeight: "2.75rem" }}
                            >
                              <span className="absolute left-1 top-0.5 text-[8px] font-bold text-slate-500 print:text-neutral-600">
                                {i + 1}
                              </span>
                              <span className="text-lg font-bold tabular-nums text-[#002147] print:text-black">
                                {cellDens(d)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* Notas: altura fija */}
            <tr>
              <td
                className="ficha-print-notas-td border border-slate-800 align-top p-2 print:border-black"
                colSpan={3}
                style={{
                  height: "220px",
                  maxHeight: "220px",
                  verticalAlign: "top",
                }}
              >
                <div className="mb-1 border-b border-slate-200 pb-1 text-[9px] font-bold uppercase tracking-wide text-slate-600 print:border-neutral-300 print:text-black">
                  Notas (maquinista)
                </div>
                <div
                  className="overflow-hidden whitespace-pre-wrap text-xs leading-relaxed text-slate-800 print:text-neutral-900"
                  style={{
                    maxHeight: "180px",
                    backgroundImage: `repeating-linear-gradient(
                      transparent,
                      transparent 1.35em,
                      rgba(15, 23, 42, 0.07) 1.35em,
                      rgba(15, 23, 42, 0.07) calc(1.35em + 1px)
                    )`,
                    backgroundSize: "100% 1.4em",
                  }}
                >
                  {data?.notas?.trim() ? data.notas : "\u00a0"}
                </div>
              </td>
            </tr>

            {data?.ruta_backup?.trim() ? (
              <tr>
                <td
                  className="border border-slate-300 border-dashed p-1 text-[7px] leading-tight text-slate-600 print:border-neutral-400"
                  colSpan={3}
                >
                  <table
                    className="w-full border-collapse"
                    style={{ width: "100%", borderCollapse: "collapse" }}
                  >
                    <tbody>
                      <tr>
                        <td className="w-6 align-top pr-1">
                          <HardDrive
                            className="size-3 opacity-70"
                            aria-hidden
                          />
                        </td>
                        <td className="break-all font-mono align-top text-slate-700 print:text-black">
                          {data.ruta_backup.trim()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            ) : null}

            {/* Pie: última fila — Maquinista y Fecha */}
            <tr>
              <td
                className="border border-slate-800 bg-slate-50 p-2 text-xs print:border-black print:bg-white"
                colSpan={3}
              >
                <table
                  className="w-full border-collapse"
                  style={{ width: "100%", borderCollapse: "collapse" }}
                >
                  <tbody>
                    <tr>
                      <td className="align-middle text-left">
                        <span className="text-slate-500 print:text-neutral-600">
                          Maquinista:{" "}
                        </span>
                        <span className="font-semibold text-[#002147] print:text-black">
                          {cell(data?.maquinista)}
                        </span>
                      </td>
                      <td className="align-middle text-right">
                        <span className="text-slate-500 print:text-neutral-600">
                          Fecha:{" "}
                        </span>
                        <span className="font-semibold tabular-nums text-[#002147] print:text-black">
                          {fechaLabel}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-1 text-center text-[7px] text-slate-400 print:text-neutral-500">
                  Minerva Strategic AI Hub · Producción
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
});

FichaTecnicaPrint.displayName = "FichaTecnicaPrint";
