"use client";

import { forwardRef } from "react";

import type { ProdStockPaletConOts } from "@/types/prod-stock";

interface CartelaPrintProps {
  palet: ProdStockPaletConOts;
  copies?: number;
  /** Nombre proveedor (estilo Optimus); no persistido en prod_stock_palets. */
  proveedorNombre?: string | null;
}

/**
 * Cartela imprimible estilo Optimus (§7.4 + referencia scan).
 * ID Stock = elemento visual dominante. Layout A6 apaisado, `copies` copias (default 2).
 */
export const CartelaPrint = forwardRef<HTMLDivElement, CartelaPrintProps>(
  function CartelaPrint({ palet, copies = 2, proveedorNombre }, ref) {
    const otsText = palet.ots.length > 0 ? palet.ots.join(" · ") : "(stock libre)";

    // Desglose ATP (9.2): reservas duras (con cantidad) vs libre calculado.
    const reservasDuras = (palet.otsReservas ?? []).filter(
      (r) => r.cantidad_reservada != null && r.cantidad_reservada > 0
    );
    const reservadaTotal = reservasDuras.reduce(
      (acc, r) => acc + (r.cantidad_reservada ?? 0),
      0
    );
    const hayReservaDura = reservasDuras.length > 0;
    const libreCalc = Math.max(palet.cantidad_actual - reservadaTotal, 0);

    const fecha = new Date(palet.created_at).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const hora = new Date(palet.created_at).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const refLoteDisplay = palet.ref_lote ?? palet.ref_lote_proveedor ?? null;
    const idStockFormatted = palet.id_stock.toLocaleString("es-ES");

    return (
      <div ref={ref} className="cartela-print-root print:block hidden">
        <style>{`
          @media print {
            @page { size: A6 landscape; margin: 5mm; }
            body * { visibility: hidden; }
            .cartela-print-root,
            .cartela-print-root * { visibility: visible; }
            .cartela-print-root { position: fixed; top: 0; left: 0; width: 100%; }
            .cartela-box { page-break-after: always; }
            .cartela-box:last-child { page-break-after: avoid; }
          }
        `}</style>

        {Array.from({ length: copies }).map((_, i) => (
          <div
            key={i}
            className="cartela-box border-2 border-black font-mono flex flex-col"
            style={{ width: "148mm", minHeight: "100mm", marginBottom: "4mm" }}
          >
            {/* ID STOCK — dominante, centrado (estilo Optimus) */}
            <div className="text-center py-3 px-2 border-b-2 border-black bg-white">
              <div
                className="font-black leading-none tracking-wider"
                style={{ fontSize: "3.25rem" }}
              >
                {idStockFormatted}
              </div>
              {palet.codigo_articulo && (
                <div className="text-xs text-gray-600 mt-1">
                  Cód. Artículo: {palet.codigo_articulo}
                </div>
              )}
            </div>

            {/* Material + marca */}
            <div className="px-3 py-2 border-b border-black">
              <div className="text-base font-bold leading-tight">
                {palet.material_nombre ?? palet.descripcion_material ?? "—"}
                {palet.gramaje ? ` ${palet.gramaje} gr` : ""}
                {palet.formato ? ` · ${palet.formato}` : ""}
              </div>
              {palet.marca && (
                <div className="text-sm text-gray-700 mt-0.5">{palet.marca}</div>
              )}
              <div className="flex gap-2 mt-1">
                {palet.es_fsc && (
                  <span className="text-xs border border-black px-1 font-bold">FSC</span>
                )}
                {palet.es_pefc && (
                  <span className="text-xs border border-black px-1 font-bold">PEFC</span>
                )}
                {palet.ubicacion_fila && (
                  <span className="text-xs border border-black px-1 font-bold ml-auto">
                    {palet.ubicacion_fila}
                  </span>
                )}
              </div>
            </div>

            {/* Cantidad actual — grande */}
            <div className="flex items-baseline justify-between px-3 py-2 border-b border-black">
              <div className="text-xs text-gray-500">
                inicial: {palet.cantidad_inicial.toLocaleString("es-ES")} h
              </div>
              <div className="text-3xl font-black">
                {palet.cantidad_actual.toLocaleString("es-ES")}
                <span className="text-sm font-normal ml-1">h</span>
              </div>
            </div>

            {/* OT + desglose ATP (reservado/libre) si hay reservas duras */}
            <div className="px-3 py-1.5 border-b border-black text-sm">
              <span className="font-bold text-xs uppercase">OT: </span>
              {otsText}
              {hayReservaDura && (
                <div className="mt-1 space-y-0.5 text-xs">
                  {reservasDuras.map((r) => (
                    <div key={r.ot_numero}>
                      →{" "}
                      <span className="font-bold">
                        {(r.cantidad_reservada ?? 0).toLocaleString("es-ES")}
                      </span>{" "}
                      reservadas · OT {r.ot_numero}
                    </div>
                  ))}
                  <div>
                    →{" "}
                    <span className="font-bold">
                      {libreCalc.toLocaleString("es-ES")}
                    </span>{" "}
                    libres
                  </div>
                </div>
              )}
            </div>

            {/* Ref. Lote estilo Optimus */}
            {refLoteDisplay && (
              <div className="px-3 py-2 border-b border-black">
                <div className="text-xs font-bold uppercase tracking-wide text-gray-600">
                  Ref. Lote
                </div>
                <div className="text-sm font-semibold leading-snug mt-0.5">
                  {refLoteDisplay}
                </div>
                {palet.ref_lote_proveedor && palet.ref_lote && (
                  <div className="text-xs text-gray-500 mt-1">
                    Lote prov.: {palet.ref_lote_proveedor}
                  </div>
                )}
              </div>
            )}

            {/* Pie: proveedor + albarán + fecha */}
            <div className="mt-auto flex justify-between items-end px-3 py-2 text-xs">
              <div>
                {proveedorNombre && (
                  <div className="mb-0.5">
                    <span className="font-bold">Proveedor: </span>
                    {proveedorNombre}
                  </div>
                )}
                {palet.nota_entrega && (
                  <div>
                    <span className="font-bold">Nota Entrega: </span>
                    {palet.nota_entrega}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="font-bold">Recibido: </span>
                {fecha} {hora}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
);
