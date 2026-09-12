import autoTable from "jspdf-autotable";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

import { formatPesoKg, resolvePesoKg } from "@/lib/albaranes-ocr";
import { formatFechaEsCorta } from "@/lib/produccion-date-format";

export type ResiduosAgrupacion = "detalle" | "proveedor" | "material" | "mes";

const AGRUPACION_LABEL: Record<ResiduosAgrupacion, string> = {
  detalle: "Detalle (recepción)",
  proveedor: "Por proveedor",
  material: "Por material",
  mes: "Por mes",
};

function formatKgInforme(kg: number | null | undefined): string {
  const formatted = formatPesoKg(kg);
  if (formatted) return formatted;
  if (kg == null || !(kg > 0)) return "—";
  return `${kg.toLocaleString("es-ES", { maximumFractionDigits: 1 })} kg`;
}

export type ResiduosAnalisisFiltros = {
  desdeYmd: string;
  hastaYmd: string;
  proveedorId: string | null;
  materialQuery: string;
};

export type ResiduosEntradaRow = {
  recepcionId: string;
  fechaRecepcion: string;
  albaran: string;
  proveedorId: string | null;
  proveedor: string;
  material: string;
  gramaje: number | null;
  formato: string | null;
  hojas: number;
  kg: number | null;
  otNumero: string | null;
};

export type ResiduosAgrupadoRow = {
  clave: string;
  proveedor: string;
  material: string;
  hojas: number;
  kg: number;
  recepciones: number;
  albaranes: number;
};

function unwrapJoinRow<T extends Record<string, unknown>>(
  raw: unknown
): T | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return (raw[0] as T | undefined) ?? null;
  return raw as T;
}

function ymdFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function mesLabel(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return format(d, "MMMM yyyy", { locale: esLocale });
}

export async function fetchResiduosEntradasPapel(
  supabase: SupabaseClient,
  filtros: ResiduosAnalisisFiltros
): Promise<ResiduosEntradaRow[]> {
  const desde = `${filtros.desdeYmd}T00:00:00.000Z`;
  const hasta = `${filtros.hastaYmd}T23:59:59.999Z`;

  let q = supabase
    .from("prod_recepciones_material")
    .select(
      `id, fecha_recepcion, albaran_proveedor, material_nombre, gramaje, formato,
       hojas_recibidas, cantidad_peso, cantidad_peso_unidad, proveedor_id,
       prod_proveedores(nombre),
       prod_compra_material(ot_numero, material, gramaje, tamano_hoja)`
    )
    .gte("fecha_recepcion", desde)
    .lte("fecha_recepcion", hasta)
    .order("fecha_recepcion", { ascending: true });

  if (filtros.proveedorId) {
    q = q.eq("proveedor_id", filtros.proveedorId);
  }

  const { data, error } = await q;
  if (error) throw error;

  const materialQ = filtros.materialQuery.trim().toLowerCase();
  const rows: ResiduosEntradaRow[] = [];

  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const compra = unwrapJoinRow<Record<string, unknown>>(raw.prod_compra_material);
    const proveedor = unwrapJoinRow<{ nombre?: string | null }>(raw.prod_proveedores);
    const hojas =
      typeof raw.hojas_recibidas === "number" ? raw.hojas_recibidas : 0;
    const gramaje =
      typeof raw.gramaje === "number"
        ? raw.gramaje
        : typeof compra?.gramaje === "number"
          ? compra.gramaje
          : null;
    const formato =
      typeof raw.formato === "string" && raw.formato.trim()
        ? raw.formato.trim()
        : typeof compra?.tamano_hoja === "string"
          ? compra.tamano_hoja.trim()
          : null;
    const material =
      (typeof raw.material_nombre === "string" && raw.material_nombre.trim()) ||
      (typeof compra?.material === "string" && compra.material.trim()) ||
      "—";

    if (materialQ && !material.toLowerCase().includes(materialQ)) continue;

    const kg = resolvePesoKg({
      cantidad_peso:
        typeof raw.cantidad_peso === "number" ? raw.cantidad_peso : null,
      cantidad_peso_unidad:
        raw.cantidad_peso_unidad === "kg" || raw.cantidad_peso_unidad === "tn"
          ? raw.cantidad_peso_unidad
          : null,
      hojas,
      gramaje,
      formato,
    });

    rows.push({
      recepcionId: String(raw.id ?? ""),
      fechaRecepcion: String(raw.fecha_recepcion ?? ""),
      albaran:
        typeof raw.albaran_proveedor === "string" && raw.albaran_proveedor.trim()
          ? raw.albaran_proveedor.trim()
          : "—",
      proveedorId:
        typeof raw.proveedor_id === "string" ? raw.proveedor_id : null,
      proveedor: proveedor?.nombre?.trim() || "—",
      material,
      gramaje,
      formato,
      hojas,
      kg,
      otNumero:
        typeof compra?.ot_numero === "string" && compra.ot_numero.trim()
          ? compra.ot_numero.trim()
          : null,
    });
  }

  return rows;
}

export function agruparResiduosEntradas(
  rows: ResiduosEntradaRow[],
  agrupacion: ResiduosAgrupacion
): ResiduosAgrupadoRow[] {
  if (agrupacion === "detalle") {
    return rows.map((r) => ({
      clave: r.recepcionId,
      proveedor: r.proveedor,
      material: `${r.material}${r.formato ? ` · ${r.formato}` : ""}${r.gramaje ? ` · ${r.gramaje}g` : ""}`,
      hojas: r.hojas,
      kg: r.kg ?? 0,
      recepciones: 1,
      albaranes: 1,
    }));
  }

  const map = new Map<string, ResiduosAgrupadoRow & { albaranSet: Set<string> }>();

  for (const r of rows) {
    let clave: string;
    let materialLabel = r.material;
    switch (agrupacion) {
      case "proveedor":
        clave = r.proveedorId ?? r.proveedor;
        break;
      case "material":
        clave = `${r.material}|${r.formato ?? ""}|${r.gramaje ?? ""}`;
        materialLabel = `${r.material}${r.formato ? ` · ${r.formato}` : ""}${r.gramaje ? ` · ${r.gramaje}g` : ""}`;
        break;
      case "mes":
        clave = ymdFromIso(r.fechaRecepcion).slice(0, 7);
        materialLabel = mesLabel(ymdFromIso(r.fechaRecepcion));
        break;
      default:
        clave = r.recepcionId;
    }

    const prev = map.get(clave);
    if (!prev) {
      map.set(clave, {
        clave,
        proveedor: agrupacion === "mes" ? "—" : r.proveedor,
        material: agrupacion === "material" ? materialLabel : agrupacion === "mes" ? materialLabel : "Varios",
        hojas: r.hojas,
        kg: r.kg ?? 0,
        recepciones: 1,
        albaranes: 1,
        albaranSet: new Set([r.albaran]),
      });
      continue;
    }
    prev.hojas += r.hojas;
    prev.kg += r.kg ?? 0;
    prev.recepciones += 1;
    prev.albaranSet.add(r.albaran);
    prev.albaranes = prev.albaranSet.size;
  }

  return [...map.values()]
    .map(({ albaranSet: _, ...rest }) => rest)
    .sort((a, b) => b.kg - a.kg || b.hojas - a.hojas);
}

export function totalesResiduosEntradas(rows: ResiduosEntradaRow[]) {
  const hojas = rows.reduce((acc, r) => acc + r.hojas, 0);
  const kg = rows.reduce((acc, r) => acc + (r.kg ?? 0), 0);
  const albaranes = new Set(rows.map((r) => r.albaran)).size;
  return { hojas, kg, recepciones: rows.length, albaranes };
}

export function exportResiduosEntradasExcel(
  detalle: ResiduosEntradaRow[],
  agrupado: ResiduosAgrupadoRow[],
  agrupacion: ResiduosAgrupacion,
  periodoLabel: string
) {
  const tot = totalesResiduosEntradas(detalle);
  const resumen = [
    { Campo: "Periodo", Valor: periodoLabel },
    { Campo: "Recepciones", Valor: tot.recepciones },
    { Campo: "Albaranes", Valor: tot.albaranes },
    { Campo: "Hojas", Valor: tot.hojas },
    { Campo: "Kg", Valor: Math.round(tot.kg * 100) / 100 },
    { Campo: "Toneladas", Valor: Math.round((tot.kg / 1000) * 1000) / 1000 },
  ];

  const detalleSheet = detalle.map((r) => ({
    Fecha: formatFechaEsCorta(r.fechaRecepcion),
    Albarán: r.albaran,
    Proveedor: r.proveedor,
    OT: r.otNumero ?? "",
    Material: r.material,
    Gramaje: r.gramaje ?? "",
    Formato: r.formato ?? "",
    Hojas: r.hojas,
    Kg: r.kg != null ? Math.round(r.kg * 100) / 100 : "",
  }));

  const agrupadoSheet = [
    ...agrupado.map((r) => ({
      Clave: r.clave,
      Proveedor: r.proveedor,
      Material: r.material,
      Hojas: r.hojas,
      Kg: Math.round(r.kg * 100) / 100,
      Toneladas: Math.round((r.kg / 1000) * 1000) / 1000,
      Recepciones: r.recepciones,
      Albaranes: r.albaranes,
    })),
    {
      Clave: "TOTAL",
      Proveedor: "",
      Material: "",
      Hojas: tot.hojas,
      Kg: Math.round(tot.kg * 100) / 100,
      Toneladas: Math.round((tot.kg / 1000) * 1000) / 1000,
      Recepciones: tot.recepciones,
      Albaranes: tot.albaranes,
    },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(agrupadoSheet),
    agrupacion === "detalle" ? "Detalle" : "Agrupado"
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalleSheet), "Detalle");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `residuos-entradas-papel-${stamp}.xlsx`);
}

export function exportResiduosEntradasPdf(
  detalle: ResiduosEntradaRow[],
  agrupado: ResiduosAgrupadoRow[],
  agrupacion: ResiduosAgrupacion,
  periodoLabel: string
) {
  const tot = totalesResiduosEntradas(detalle);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setTextColor(0, 33, 71);
  doc.setFontSize(13);
  doc.text("Entradas materia prima (papel/cartón) — Minerva Hub", 10, 12);
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Periodo: ${periodoLabel}`, 10, 18);
  doc.text(`Vista: ${AGRUPACION_LABEL[agrupacion]}`, 10, 23);
  doc.text(
    `Recepciones: ${tot.recepciones} · Albaranes: ${tot.albaranes} · Hojas: ${tot.hojas.toLocaleString("es-ES")} · Peso total: ${formatKgInforme(tot.kg)}`,
    10,
    28
  );
  doc.text(
    `Generado: ${new Date().toLocaleString("es-ES")} · Uso interno (preparación declaraciones)`,
    10,
    33
  );

  const isDetalle = agrupacion === "detalle";
  const head = isDetalle
    ? [["Fecha", "Albarán", "Proveedor", "OT", "Material", "Formato", "Hojas", "Peso"]]
    : [["Grupo", "Proveedor", "Material / periodo", "Hojas", "Peso", "Recep.", "Alb."]];

  const body = isDetalle
    ? detalle.map((r) => [
        formatFechaEsCorta(r.fechaRecepcion),
        r.albaran,
        r.proveedor,
        r.otNumero ?? "—",
        r.material,
        r.formato ?? "—",
        r.hojas.toLocaleString("es-ES"),
        formatKgInforme(r.kg),
      ])
    : agrupado.map((r) => [
        r.clave,
        r.proveedor,
        r.material,
        r.hojas.toLocaleString("es-ES"),
        formatKgInforme(r.kg),
        String(r.recepciones),
        String(r.albaranes),
      ]);

  const foot = isDetalle
    ? [
        [
          "TOTAL",
          "",
          "",
          "",
          "",
          "",
          tot.hojas.toLocaleString("es-ES"),
          formatKgInforme(tot.kg),
        ],
      ]
    : [
        [
          "TOTAL",
          "",
          "",
          tot.hojas.toLocaleString("es-ES"),
          formatKgInforme(tot.kg),
          String(tot.recepciones),
          String(tot.albaranes),
        ],
      ];

  autoTable(doc, {
    head,
    body,
    foot,
    startY: 37,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [0, 33, 71] },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [0, 33, 71],
      fontStyle: "bold",
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`residuos-entradas-papel-${stamp}.pdf`);
}

export function periodoLabelFromYmd(desdeYmd: string, hastaYmd: string): string {
  if (desdeYmd === hastaYmd) return formatFechaEsCorta(desdeYmd);
  return `${formatFechaEsCorta(desdeYmd)} – ${formatFechaEsCorta(hastaYmd)}`;
}
