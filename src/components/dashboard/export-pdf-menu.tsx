"use client";

import { Download, FileText, FolderOpen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportCleanPdf, exportSessionPdf } from "@/lib/pdf-export";
import {
  type AppMode,
  getChatForMode,
  getReportForMode,
  useHubStore,
} from "@/lib/store";

const TITLES: Record<AppMode, string> = {
  strategic: "Análisis Estratégico",
  pmax: "Generador PMAX",
  slides: "Estructura de Slides",
  creativo: "Creativo IA",
  metaProposal: "Propuesta Meta Ads",
  semCreativeLab: "SEM Creative Lab",
};

export function ExportPdfMenu({ mode }: { mode: AppMode }) {
  const store = useHubStore();
  const report = getReportForMode(mode, store);
  const chat = getChatForMode(mode, store);

  if (!report?.trim()) return null;

  const title = TITLES[mode];

  /** Sesión completa: análisis inicial guardado + informe del módulo activo (si aplica). */
  const reportForSession =
    mode === "strategic"
      ? report
      : `## Análisis estratégico (informe inicial guardado)\n\n${store.strategicAnalysis ?? ""}\n\n## ${title}\n\n${report}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#002147]/35 bg-white px-3 text-sm font-medium text-[#002147] outline-none transition hover:bg-[#002147]/5 focus-visible:ring-2 focus-visible:ring-[#C69C2B]/50"
      >
        <Download className="size-4 text-[#C69C2B]" aria-hidden />
        Exportar PDF
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[240px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Opciones de exportación</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2"
            onClick={() => exportCleanPdf({ title, body: report })}
          >
            <FileText className="size-4 opacity-70" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Informe limpio</span>
              <span className="text-muted-foreground text-xs">
                Solo el contenido del módulo actual
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() =>
              exportSessionPdf({
                title,
                report: reportForSession,
                chat: chat.map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
              })
            }
          >
            <FolderOpen className="size-4 opacity-70" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Sesión completa</span>
              <span className="text-muted-foreground text-xs">
                Informe + chat de profundización
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
