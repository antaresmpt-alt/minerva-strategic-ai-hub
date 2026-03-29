"use client";

import { useState, type RefObject } from "react";
import { Download, LayoutDashboard, Table2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportSalesReportPdf, type SalesPdfExportMode } from "@/lib/sales-export-pdf";
import { cn } from "@/lib/utils";

type SalesPdfExportMenuProps = {
  dashboardRef: RefObject<HTMLDivElement | null>;
  fullRef: RefObject<HTMLDivElement | null>;
  sourceLabel: string | null;
  disabled?: boolean;
};

export function SalesPdfExportMenu({
  dashboardRef,
  fullRef,
  sourceLabel,
  disabled,
}: SalesPdfExportMenuProps) {
  const [busy, setBusy] = useState(false);

  const run = async (mode: SalesPdfExportMode) => {
    const el =
      mode === "dashboard" ? dashboardRef.current : fullRef.current;
    if (!el || busy) return;
    setBusy(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const safe = (sourceLabel ?? "informe").replace(/[^\w.-]+/g, "_").slice(0, 48);
      await exportSalesReportPdf({
        element: el,
        mode,
        title: `Minerva Sales Intelligence · ${sourceLabel ?? "informe"}`,
        filename: `minerva-ventas-${mode === "dashboard" ? "graficos" : "completo"}-${safe}-${stamp}.pdf`,
      });
    } catch (e) {
      console.error(e);
      window.alert(
        e instanceof Error
          ? `No se pudo generar el PDF: ${e.message}`
          : "No se pudo generar el PDF."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || busy}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#002147]/35 bg-white/90 px-3 text-sm font-medium text-[#002147] outline-none backdrop-blur-sm transition hover:bg-[#002147]/5 focus-visible:ring-2 focus-visible:ring-[#C69C2B]/50 disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <Download className="size-4 text-[#C69C2B]" aria-hidden />
        {busy ? "Generando…" : "Descargar PDF"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[260px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Exportar informe</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2"
            onClick={() => void run("dashboard")}
          >
            <LayoutDashboard className="size-4 opacity-70" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Solo dashboard</span>
              <span className="text-muted-foreground text-xs">
                KPIs y gráficos · ancho completo, varias páginas si hace falta
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={() => void run("full")}>
            <Table2 className="size-4 opacity-70" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Dashboard + tabla</span>
              <span className="text-muted-foreground text-xs">
                Incluye tabla operativa · A4 apaisado, varias páginas si hace falta
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
