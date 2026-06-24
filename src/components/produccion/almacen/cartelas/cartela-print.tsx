"use client";

import { forwardRef } from "react";

import type { ProdStockPaletConOts } from "@/types/prod-stock";

interface CartelaPrintProps {
  palet: ProdStockPaletConOts;
  copies?: number;
}

/**
 * Componente de cartela imprimible (§7.4).
 * Diseñado para window.print(): tamaño A6 apaisado aprox, legible en almacén.
 * Se renderizan `copies` copias iguales (default 2 por palet — Ramón C1).
 */
export const CartelaPrint = forwardRef<HTMLDivElement, CartelaPrintProps>(
  function CartelaPrint({ palet, copies = 2 }, ref) {
    const otsText =
      palet.ots.length > 0 ? palet.ots.join(" · ") : "(stock libre)";

    const fecha = new Date(palet.created_at).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    return (
      <div ref={ref} className="cartela-print-root print:block hidden">
        <style>{`
          @media print {
            @page { size: A6 landscape; margin: 8mm; }
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
            className="cartela-box border-2 border-black p-4 font-mono"
            style={{ width: "148mm", minHeight: "95mm", marginBottom: "4mm" }}
          >
            {/* ID Stock — grande y central */}
            <div className="text-center mb-2">
              <span className="text-4xl font-black tracking-widest">
                {palet.id_stock.toLocaleString("es-ES")}
              </span>
            </div>

            <hr className="border-black mb-2" />

            {/* Material */}
            <div className="text-lg font-bold leading-tight mb-1">
              {palet.material_nombre ?? palet.descripcion_material ?? "—"}
              {palet.gramaje ? ` ${palet.gramaje} gr` : ""}
              {palet.formato ? ` · ${palet.formato}` : ""}
            </div>
            {palet.marca && (
              <div className="text-sm mb-1">
                {palet.marca}
                {palet.es_fsc && (
                  <span className="ml-2 border border-black px-1 text-xs font-bold">FSC</span>
                )}
                {palet.es_pefc && (
                  <span className="ml-1 border border-black px-1 text-xs font-bold">PEFC</span>
                )}
              </div>
            )}

            <hr className="border-black my-2" />

            {/* Cantidades */}
            <div className="flex justify-between items-baseline mb-2">
              <div className="text-sm text-gray-500">
                inicial: {palet.cantidad_inicial.toLocaleString("es-ES")} h
              </div>
              <div className="text-2xl font-black">
                ▶ {palet.cantidad_actual.toLocaleString("es-ES")} h ◀
              </div>
            </div>

            <hr className="border-black mb-2" />

            {/* OTs */}
            <div className="text-sm mb-1">
              <span className="font-semibold">OT(s): </span>
              {otsText}
            </div>
            <div className="text-xs text-gray-600 italic mb-1">
              (sin cantidad por OT)
            </div>

            {/* Albarán + Fecha */}
            <div className="flex justify-between text-xs mt-2">
              <span>
                {palet.nota_entrega ? `Albarán: ${palet.nota_entrega}` : ""}
              </span>
              <span>{fecha}</span>
            </div>

            {palet.ubicacion_fila && (
              <div className="text-xs text-gray-600 mt-1">
                Fila: {palet.ubicacion_fila}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
);
