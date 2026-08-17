"use client";

import { GitCompare, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildProducidaVersionDiff,
  versionsForOt,
} from "@/lib/prod-ot-producidas-versiones";
import type { ProdOtProducidaRow } from "@/types/prod-ot-producidas";

export function ProducidaVersionesCompareDialog({
  open,
  onOpenChange,
  otNumero,
  allRows,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otNumero: string | null;
  allRows: ProdOtProducidaRow[];
}) {
  const versions = useMemo(
    () => (otNumero ? versionsForOt(allRows, otNumero) : []),
    [allRows, otNumero],
  );

  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");

  const leftRow = versions.find((v) => v.id === leftId) ?? null;
  const rightRow = versions.find((v) => v.id === rightId) ?? null;

  const diff = useMemo(() => {
    if (!leftRow || !rightRow) return [];
    return buildProducidaVersionDiff(leftRow, rightRow);
  }, [leftRow, rightRow]);

  const changedCount = diff.filter((d) => d.changed).length;

  const initSelection = () => {
    if (versions.length < 2) return;
    const sorted = [...versions].sort((a, b) => a.version - b.version);
    setLeftId(sorted[0]!.id);
    setRightId(sorted[sorted.length - 1]!.id);
  };

  const handleOpenChange = (next: boolean) => {
    if (next && versions.length >= 2) {
      initSelection();
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(92vh,720px)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="size-5" />
            Comparar versiones ·{" "}
            <span className="font-mono text-sm">{otNumero ?? ""}</span>
          </DialogTitle>
          <DialogDescription>
            Diff de columnas planas entre dos cierres de la misma OT (Bloque 6.x).
          </DialogDescription>
        </DialogHeader>

        {versions.length < 2 ? (
          <p className="py-6 text-sm text-slate-500">
            Esta OT solo tiene una versión archivada.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Versión A</Label>
                <Select
                  value={leftId}
                  onValueChange={(v) => setLeftId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.version} · {v.cerrada_at?.slice(0, 10) ?? "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Versión B</Label>
                <Select
                  value={rightId}
                  onValueChange={(v) => setRightId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.version} · {v.cerrada_at?.slice(0, 10) ?? "—"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {leftRow && rightRow ? (
              <div className="overflow-hidden rounded-md border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {changedCount} campo{changedCount === 1 ? "" : "s"} distinto
                  {changedCount === 1 ? "" : "s"}
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">Campo</th>
                      <th className="px-2 py-1.5">v{leftRow.version}</th>
                      <th className="px-2 py-1.5">v{rightRow.version}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.map((row) => (
                      <tr
                        key={row.label}
                        className={
                          row.changed
                            ? "border-t border-amber-100 bg-amber-50/60"
                            : "border-t border-slate-100"
                        }
                      >
                        <td className="px-2 py-1.5 font-medium text-slate-700">
                          {row.label}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-slate-800">
                          {row.left}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-slate-800">
                          {row.right}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Elige dos versiones…
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
