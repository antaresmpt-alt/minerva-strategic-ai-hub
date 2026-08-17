import { extractCantidadProducida } from "@/lib/prod-ot-cierre";
import type { HojaRutaData } from "@/lib/hoja-ruta/hoja-ruta-query";
import { fmtCantidad } from "@/lib/hoja-ruta/hoja-ruta-formatters";

export type CierreCalidadAviso = {
  id: string;
  message: string;
};

/** Umbral acordado en Bloque 6.x: aviso fuerte, no bloquea cierre. */
const RATIO_SOBREPRODUCCION = 1.15;
const RATIO_SUBPRODUCCION = 0.5;

/**
 * Avisos de calidad de datos antes de archivar en Producidas.
 * Informativos — no impiden cerrar la OT.
 */
export function buildCierreCalidadAvisos(data: HojaRutaData): CierreCalidadAviso[] {
  const avisos: CierreCalidadAviso[] = [];
  const pedida = data.cantidad;
  const producida = extractCantidadProducida(data.pasos);
  const gramaje = data.despacho?.gramaje;
  const material = data.despacho?.material?.trim();

  if (!material) {
    avisos.push({
      id: "material_vacio",
      message: "Material de despacho vacío — revisa la ficha antes de archivar.",
    });
  }

  if (gramaje == null || gramaje <= 0) {
    avisos.push({
      id: "gramaje_cero",
      message: "Gramaje en despacho es 0 o no informado.",
    });
  }

  if (
    pedida != null &&
    pedida > 0 &&
    producida != null &&
    producida > pedida * RATIO_SOBREPRODUCCION
  ) {
    avisos.push({
      id: "sobreproduccion",
      message: `Producida (${fmtCantidad(producida)}) supera claramente el pedido (${fmtCantidad(pedida)}).`,
    });
  }

  if (
    pedida != null &&
    pedida > 0 &&
    producida != null &&
    producida > 0 &&
    producida < pedida * RATIO_SUBPRODUCCION
  ) {
    avisos.push({
      id: "subproduccion",
      message: `Producida (${fmtCantidad(producida)}) es menos de la mitad del pedido (${fmtCantidad(pedida)}).`,
    });
  }

  const conIncidencia = data.pasos.filter((p) =>
    String(p.ejecucion?.incidencia ?? "").trim(),
  );
  if (conIncidencia.length > 0) {
    const nombres = conIncidencia
      .map((p) => p.procesoNombre ?? "Proceso")
      .slice(0, 3)
      .join(", ");
    avisos.push({
      id: "incidencias_abiertas",
      message: `Hay incidencias registradas en: ${nombres}${conIncidencia.length > 3 ? "…" : ""}.`,
    });
  }

  return avisos;
}
