import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import type { MetaProposalPayload } from "@/lib/meta-proposal-types";

const NAVY: [number, number, number] = [0, 33, 71];
const GOLD: [number, number, number] = [198, 156, 43];
const MARGIN = 18;
const PAGE_W = 210;
const PAGE_H = 297;

function proposalToPlainText(p: MetaProposalPayload): string {
  const lines: string[] = [];
  lines.push("ANÁLISIS DEL NEGOCIO");
  lines.push("");
  lines.push(`Resumen: ${p.businessAnalysis.summary}`);
  lines.push(`Problemas que resuelve: ${p.businessAnalysis.problemsSolved}`);
  lines.push(`Propuesta de valor: ${p.businessAnalysis.uniqueValue}`);
  lines.push(`Buyer persona: ${p.businessAnalysis.buyerPersona}`);
  lines.push("");
  lines.push("ESTRATEGIA DE CAMPAÑAS");
  lines.push("");
  for (const c of p.campaigns) {
    lines.push(`— ${c.campaignName} (objetivo: ${c.objectiveId})`);
    for (const a of c.adSets) {
      lines.push(`  Conjunto: ${a.name}`);
      lines.push(`  Segmentación: ${a.targeting}`);
      let i = 1;
      for (const ad of a.ads) {
        lines.push(`  Anuncio ${i}:`);
        lines.push(`  ${ad.copy}`);
        lines.push(`  (Prompt imagen: ${ad.imagePrompt})`);
        i += 1;
      }
    }
    lines.push("");
  }
  lines.push("MÁS IDEAS VISUALES");
  p.visualIdeas.forEach((v, i) => lines.push(`${i + 1}. ${v}`));
  lines.push("");
  lines.push("MÉTRICAS (KPIs)");
  p.kpis.forEach((k) => lines.push(`• ${k.metric}: ${k.whatToWatch}`));
  lines.push("");
  lines.push("RECOMENDACIONES");
  p.recommendations.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
  return lines.join("\n");
}

export function exportMetaProposalPdf(p: MetaProposalPayload) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text("MINERVA STRATEGIC AI HUB", MARGIN, 12);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Propuesta Meta Ads", MARGIN, 22);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, 30, PAGE_W - MARGIN, 30);

  const body = proposalToPlainText(p);
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(body, PAGE_W - MARGIN * 2);
  let y = 40;
  const lh = 5;
  for (const line of lines) {
    if (y > PAGE_H - MARGIN - 8) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, MARGIN, y);
    y += lh;
  }
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(
    "MINERVA Strategic AI Hub — Documento generado para presentación al cliente.",
    MARGIN,
    PAGE_H - 10
  );
  doc.save("minerva-propuesta-meta-ads.pdf");
}

export async function exportMetaProposalDocx(p: MetaProposalPayload) {
  const children: Paragraph[] = [
    new Paragraph({
      text: "Propuesta Meta Ads (Facebook / Instagram)",
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      text: "Análisis del negocio",
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Resumen: ", bold: true }),
        new TextRun(p.businessAnalysis.summary),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Problemas que resuelve: ", bold: true }),
        new TextRun(p.businessAnalysis.problemsSolved),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Valor diferencial: ", bold: true }),
        new TextRun(p.businessAnalysis.uniqueValue),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Buyer persona: ", bold: true }),
        new TextRun(p.businessAnalysis.buyerPersona),
      ],
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      text: "Estrategia de campañas",
      heading: HeadingLevel.HEADING_1,
    }),
  ];

  for (const c of p.campaigns) {
    children.push(
      new Paragraph({
        text: c.campaignName,
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Objetivo (id): ", bold: true }),
          new TextRun(c.objectiveId),
        ],
      })
    );
    for (const a of c.adSets) {
      children.push(
        new Paragraph({
          text: a.name,
          heading: HeadingLevel.HEADING_3,
        }),
        new Paragraph({
          children: [
            new TextRun({ text: "Segmentación: ", bold: true }),
            new TextRun(a.targeting),
          ],
        })
      );
      let n = 1;
      for (const ad of a.ads) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Anuncio ${n}`, bold: true }),
            ],
          }),
          new Paragraph(ad.copy),
          new Paragraph({
            children: [
              new TextRun({ text: "Prompt creativo: ", italics: true }),
              new TextRun({ text: ad.imagePrompt, italics: true }),
            ],
          })
        );
        n += 1;
      }
    }
  }

  children.push(
    new Paragraph({ text: "" }),
    new Paragraph({
      text: "Más ideas visuales",
      heading: HeadingLevel.HEADING_1,
    })
  );
  for (const v of p.visualIdeas) {
    children.push(new Paragraph({ text: `• ${v}` }));
  }

  children.push(
    new Paragraph({ text: "" }),
    new Paragraph({
      text: "Métricas (KPIs)",
      heading: HeadingLevel.HEADING_1,
    })
  );
  for (const k of p.kpis) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${k.metric}: `, bold: true }),
          new TextRun(k.whatToWatch),
        ],
      })
    );
  }

  children.push(
    new Paragraph({ text: "" }),
    new Paragraph({
      text: "Recomendaciones adicionales",
      heading: HeadingLevel.HEADING_1,
    })
  );
  for (const r of p.recommendations) {
    children.push(new Paragraph({ text: `• ${r}` }));
  }

  const doc = new Document({
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "minerva-propuesta-meta-ads.docx";
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMetaProposalXlsx(p: MetaProposalPayload) {
  const wb = XLSX.utils.book_new();

  const summary = [
    ["Sección", "Contenido"],
    ["Resumen", p.businessAnalysis.summary],
    ["Problemas que resuelve", p.businessAnalysis.problemsSolved],
    ["Valor diferencial", p.businessAnalysis.uniqueValue],
    ["Buyer persona", p.businessAnalysis.buyerPersona],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summary),
    "Análisis"
  );

  const kpiSheet = XLSX.utils.aoa_to_sheet([
    ["Métrica", "Qué vigilar"],
    ...p.kpis.map((k) => [k.metric, k.whatToWatch]),
  ]);
  XLSX.utils.book_append_sheet(wb, kpiSheet, "KPIs");

  const campRows: (string | number)[][] = [
    [
      "Campaña",
      "Objetivo id",
      "Conjunto",
      "Segmentación",
      "Anuncio #",
      "Copy",
      "Prompt imagen",
    ],
  ];
  for (const c of p.campaigns) {
    for (const a of c.adSets) {
      let n = 1;
      for (const ad of a.ads) {
        campRows.push([
          c.campaignName,
          c.objectiveId,
          a.name,
          a.targeting,
          n,
          ad.copy,
          ad.imagePrompt,
        ]);
        n += 1;
      }
    }
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(campRows),
    "Campañas"
  );

  const ideas = [["Idea"], ...p.visualIdeas.map((v) => [v])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ideas), "Ideas");

  XLSX.writeFile(wb, "minerva-propuesta-meta-ads.xlsx");
}
