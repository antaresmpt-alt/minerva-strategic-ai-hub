"use client";

import { FileSpreadsheet, FileText, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  exportMetaProposalDocx,
  exportMetaProposalPdf,
  exportMetaProposalXlsx,
} from "@/lib/meta-proposal-export";
import type { MetaProposalPayload } from "@/lib/meta-proposal-types";

export function MetaProposalExports({
  payload,
}: {
  payload: MetaProposalPayload;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 rounded-lg border-[#002147]/35"
        onClick={() => exportMetaProposalPdf(payload)}
      >
        <Presentation className="size-4 text-[#C69C2B]" aria-hidden />
        PDF
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 rounded-lg border-[#002147]/35"
        onClick={() => void exportMetaProposalDocx(payload)}
      >
        <FileText className="size-4 text-[#C69C2B]" aria-hidden />
        Word
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 rounded-lg border-[#002147]/35"
        onClick={() => exportMetaProposalXlsx(payload)}
      >
        <FileSpreadsheet className="size-4 text-[#C69C2B]" aria-hidden />
        Excel
      </Button>
    </div>
  );
}
