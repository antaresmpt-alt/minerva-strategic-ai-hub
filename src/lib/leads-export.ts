import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";

import { escapeCsvField } from "@/lib/sales-delivery-timing";
import type { LeadRow } from "@/types/leads";

const NAVY: [number, number, number] = [0, 33, 71];

function rowToRecord(lead: LeadRow): Record<string, string | number> {
  return {
    ID_Lead: lead.idLead,
    Empresa: lead.empresa,
    Contacto: lead.contacto,
    Cargo: lead.cargo,
    Email: lead.email,
    Telefono: lead.telefono,
    Origen: lead.origen,
    Tema_Interes: lead.temaInteres,
    Comercial: lead.comercial,
    Estado: lead.estado,
    Prioridad: lead.prioridad,
    Ultimo_Contacto: lead.ultimoContacto,
    Proxima_Accion: lead.proximaAccion,
  };
}

export function buildLeadsCsv(leads: LeadRow[]): string {
  const header = [
    "ID_Lead",
    "Empresa",
    "Contacto",
    "Cargo",
    "Email",
    "Telefono",
    "Origen",
    "Tema_Interes",
    "Comercial",
    "Estado",
    "Prioridad",
    "Ultimo_Contacto",
    "Proxima_Accion",
  ];
  const lines = [header.join(",")];
  for (const lead of leads) {
    const r = rowToRecord(lead);
    const line = header.map((k) =>
      escapeCsvField(String(r[k] ?? ""))
    );
    lines.push(line.join(","));
  }
  return lines.join("\r\n");
}

export function buildLeadsXlsxBlob(leads: LeadRow[]): Blob {
  const records = leads.map((l) => rowToRecord(l));
  const ws =
    records.length > 0
      ? XLSX.utils.json_to_sheet(records)
      : XLSX.utils.aoa_to_sheet([
          [
            "ID_Lead",
            "Empresa",
            "Contacto",
            "Cargo",
            "Email",
            "Telefono",
            "Origen",
            "Tema_Interes",
            "Comercial",
            "Estado",
            "Prioridad",
            "Ultimo_Contacto",
            "Proxima_Accion",
          ],
        ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  const buf = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array",
    compression: true,
  });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function trunc(s: string, n: number): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

export function buildLeadsPdfBlob(leads: LeadRow[]): Blob {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const pageW = 297;
  const pageH = 210;
  const margin = 8;
  let y = margin;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Minerva · Gestión de leads", margin, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    `${new Date().toLocaleString("es-ES")} · ${leads.length} registro(s)`,
    margin,
    14
  );
  doc.setTextColor(0, 0, 0);

  y = 20;
  const rowH = 4.8;
  const fs = 6.5;
  const col = {
    emp: { x: margin, w: 42 },
    con: { x: 52, w: 28 },
    com: { x: 82, w: 26 },
    est: { x: 110, w: 24 },
    pri: { x: 136, w: 18 },
    ult: { x: 156, w: 22 },
    prox: { x: 180, w: pageW - margin - 180 },
  };

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 3.5, pageW - margin * 2, rowH, "F");
  doc.setFontSize(fs);
  doc.setFont("helvetica", "bold");
  doc.text("Empresa", col.emp.x, y);
  doc.text("Contacto", col.con.x, y);
  doc.text("Comercial", col.com.x, y);
  doc.text("Estado", col.est.x, y);
  doc.text("Prior.", col.pri.x, y);
  doc.text("Último", col.ult.x, y);
  doc.text("Próxima acción", col.prox.x, y);
  doc.setFont("helvetica", "normal");
  y += rowH + 0.5;

  for (const lead of leads) {
    if (y > pageH - margin - rowH) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(fs);
    doc.text(trunc(lead.empresa, 36), col.emp.x, y, { maxWidth: col.emp.w });
    doc.text(trunc(lead.contacto, 22), col.con.x, y, { maxWidth: col.con.w });
    doc.text(trunc(lead.comercial, 20), col.com.x, y, { maxWidth: col.com.w });
    doc.text(trunc(lead.estado, 18), col.est.x, y, { maxWidth: col.est.w });
    doc.text(trunc(lead.prioridad, 10), col.pri.x, y, { maxWidth: col.pri.w });
    doc.text(trunc(lead.ultimoContacto, 14), col.ult.x, y, {
      maxWidth: col.ult.w,
    });
    doc.text(trunc(lead.proximaAccion, 48), col.prox.x, y, {
      maxWidth: col.prox.w,
    });
    y += rowH;
  }

  doc.setFontSize(6);
  doc.setTextColor(90, 90, 90);
  doc.text("MINERVA Strategic AI Hub · Uso interno", margin, pageH - 5);

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function leadsExportBasename(): string {
  return `minerva-leads-${new Date().toISOString().slice(0, 10)}`;
}
