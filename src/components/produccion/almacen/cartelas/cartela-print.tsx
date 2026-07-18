"use client";

import {
  tituloFromRefLote,
  truncateCartelaTitulo,
} from "@/lib/cartela-print-trigger";
import type { ProdStockPaletConOts } from "@/types/prod-stock";

interface CartelaPrintProps {
  palet: ProdStockPaletConOts;
  copies?: number;
  /** Nombre proveedor (estilo Optimus); no persistido en prod_stock_palets. */
  proveedorNombre?: string | null;
  /** Título de trabajo por OT (prod_ots_general / compra). */
  otTitulos?: Record<string, string>;
}

function resolveOtTitulo(
  ot: string,
  otTitulos: Record<string, string> | undefined,
  refLote: string | null
): string | null {
  const fromMeta = otTitulos?.[ot]?.trim();
  if (fromMeta) return fromMeta;
  return tituloFromRefLote(refLote, ot);
}

/**
 * Cartela imprimible estilo Optimus (§7.4 + referencia scan).
 * ID Stock = elemento visual dominante. Layout A6 apaisado, `copies` copias (default 1).
 */
export function CartelaPrint({
  palet,
  copies = 1,
  proveedorNombre,
  otTitulos,
}: CartelaPrintProps) {
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

    const refLoteDisplay = palet.ref_lote ?? palet.ref_lote_proveedor ?? null;

    /** Evita repetir OT + "→ N reservadas · OT X" + "→ 0 libres" cuando no aporta. */
    const mostrarDesgloseAtp =
      hayReservaDura &&
      !(
        palet.ots.length === 1 &&
        reservasDuras.length === 1 &&
        reservasDuras[0]!.cantidad_reservada === palet.cantidad_actual &&
        libreCalc === 0
      ) &&
      !(libreCalc === 0 && reservasDuras.length <= 1 && palet.ots.length <= 1);

    const fecha = new Date(palet.created_at).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const hora = new Date(palet.created_at).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const idStockFormatted = palet.id_stock.toLocaleString("es-ES");

    return (
      <div className="cartela-print-group">
        {Array.from({ length: copies }).map((_, i) => (
          <div
            key={i}
            className="cartela-box border-2 border-black font-mono flex flex-col"
            style={{
              width: "148mm",
              height: "100mm",
              maxHeight: "100mm",
              overflow: "hidden",
              marginBottom: "4mm",
            }}
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
                  <span className="text-xs border border-black px-1 font-bold">
                    FSC
                  </span>
                )}
                {palet.es_pefc && (
                  <span className="text-xs border border-black px-1 font-bold">
                    PEFC
                  </span>
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

            {/* OT(s) + título trabajo + desglose ATP si aporta */}
            <div className="px-3 py-1.5 border-b border-black text-sm">
              {palet.ots.length === 0 ? (
                <div>
                  <span className="font-bold text-xs uppercase">OT: </span>
                  (stock libre)
                </div>
              ) : (
                <div className="space-y-0.5">
                  {palet.ots.map((ot) => {
                    const titulo = resolveOtTitulo(
                      ot,
                      otTitulos,
                      palet.ref_lote
                    );
                    return (
                      <div key={ot} className="leading-snug">
                        <span className="font-bold text-xs uppercase">OT: </span>
                        <span className="font-semibold">{ot}</span>
                        {titulo ? (
                          <span className="text-[10px] text-gray-700 ml-1.5 font-normal">
                            {truncateCartelaTitulo(titulo)}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
              {mostrarDesgloseAtp && (
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
                  {libreCalc > 0 && (
                    <div>
                      →{" "}
                      <span className="font-bold">
                        {libreCalc.toLocaleString("es-ES")}
                      </span>{" "}
                      libres
                    </div>
                  )}
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
