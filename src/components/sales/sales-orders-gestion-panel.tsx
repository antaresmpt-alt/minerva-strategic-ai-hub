"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileDown,
  FileSpreadsheet,
  FileText,
  Search,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildGestionCsv,
  buildGestionPdfBlob,
  buildGestionXlsxBlob,
  downloadBlob,
  gestionExportBasename,
} from "@/lib/sales-gestion-export";
import {
  compareFechaEntrega,
  formatPedidoId,
  getGestionCategoria,
  type GestionCategoria,
  type GestionEstadoFilter,
} from "@/lib/sales-gestion-status";
import { cn } from "@/lib/utils";
import type { SalesOrderRow } from "@/types/sales";

type SortKey = "pedido" | "cliente" | "comercial" | "fecha" | "estado";

function GestionEstadoBadge({ categoria }: { categoria: GestionCategoria }) {
  if (categoria === "retrasado") {
    return (
      <Badge variant="destructive" className="font-normal">
        Retrasado
      </Badge>
    );
  }
  if (categoria === "en_curso") {
    return (
      <Badge className="border border-sky-300/80 bg-sky-50 font-normal text-sky-950 dark:bg-sky-950/40 dark:text-sky-100">
        En curso
      </Badge>
    );
  }
  if (categoria === "no_empezado") {
    return (
      <Badge variant="secondary" className="font-normal text-slate-700">
        No empezado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-normal text-slate-600">
      Cerrado
    </Badge>
  );
}

function SortIcon({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  if (!active) {
    return <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />;
  }
  return dir === "asc" ? (
    <ArrowUp className="size-3.5" aria-hidden />
  ) : (
    <ArrowDown className="size-3.5" aria-hidden />
  );
}

export function SalesOrdersGestionPanel({ rows }: { rows: SalesOrderRow[] }) {
  const [search, setSearch] = useState("");
  const [comercial, setComercial] = useState<string>("__all__");
  const [estadoFilter, setEstadoFilter] = useState<GestionEstadoFilter>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const comercialOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const c = (r.comercial ?? "").trim() || "Sin asignar";
      set.add(c);
    }
    const sorted = [...set].sort((a, b) => a.localeCompare(b, "es"));
    return [
      { value: "__all__", label: "Todos los comerciales" },
      ...sorted.map((c) => ({ value: c, label: c })),
    ];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (comercial !== "__all__") {
        const label = (r.comercial ?? "").trim() || "Sin asignar";
        if (label !== comercial) return false;
      }
      const cat = getGestionCategoria(r);
      if (estadoFilter !== "todos") {
        if (estadoFilter === "retrasado" && cat !== "retrasado") return false;
        if (estadoFilter === "en_curso" && cat !== "en_curso") return false;
        if (estadoFilter === "no_empezado" && cat !== "no_empezado") return false;
      }
      if (!q) return true;
      const idStr = String(r.idPedido ?? "");
      const pedidoStr = formatPedidoId(r).toLowerCase();
      const cliente = (r.cliente ?? "").toLowerCase();
      return (
        idStr.includes(q) ||
        pedidoStr.includes(q) ||
        cliente.includes(q)
      );
    });
  }, [rows, search, comercial, estadoFilter]);

  const kpis = useMemo(() => {
    let retrasados = 0;
    let enCurso = 0;
    let noEmpezados = 0;
    for (const r of filtered) {
      const c = getGestionCategoria(r);
      if (c === "retrasado") retrasados += 1;
      else if (c === "en_curso") enCurso += 1;
      else if (c === "no_empezado") noEmpezados += 1;
    }
    return {
      total: filtered.length,
      retrasados,
      enCurso,
      noEmpezados,
    };
  }, [filtered]);

  const sortedRows = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "pedido":
          cmp = formatPedidoId(a).localeCompare(formatPedidoId(b), "es", {
            numeric: true,
          });
          break;
        case "cliente":
          cmp = (a.cliente ?? "").localeCompare(b.cliente ?? "", "es");
          break;
        case "comercial":
          cmp = (a.comercial ?? "").localeCompare(b.comercial ?? "", "es");
          break;
        case "fecha":
          cmp = compareFechaEntrega(a, b);
          break;
        case "estado": {
          const la = getGestionCategoria(a);
          const lb = getGestionCategoria(b);
          cmp = la.localeCompare(lb);
          break;
        }
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "fecha" ? "asc" : "asc");
    }
  };

  const exportCsv = () => {
    const name = gestionExportBasename();
    const csv = buildGestionCsv(sortedRows);
    downloadBlob(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
      `${name}.csv`
    );
  };

  const exportExcel = () => {
    downloadBlob(buildGestionXlsxBlob(sortedRows), `${gestionExportBasename()}.xlsx`);
  };

  const exportPdf = () => {
    downloadBlob(buildGestionPdfBlob(sortedRows), `${gestionExportBasename()}.pdf`);
  };

  const estadoFilterOptions: { value: GestionEstadoFilter; label: string }[] = [
    { value: "todos", label: "Todos" },
    { value: "retrasado", label: "Retrasado" },
    { value: "en_curso", label: "En curso" },
    { value: "no_empezado", label: "No empezado" },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Total trabajos</CardDescription>
            <CardTitle className="font-heading text-3xl tabular-nums text-[#002147]">
              {kpis.total}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>En curso (en fecha)</CardDescription>
            <CardTitle className="font-heading text-3xl tabular-nums text-sky-800">
              {kpis.enCurso}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>No empezados</CardDescription>
            <CardTitle className="font-heading text-3xl tabular-nums text-slate-600">
              {kpis.noEmpezados}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-red-200/90 bg-gradient-to-br from-red-50/90 to-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-900/80">Retrasados</CardDescription>
            <CardTitle className="font-heading text-3xl tabular-nums text-red-700">
              {kpis.retrasados}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card className="border-slate-200/80 bg-white shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-[#002147]">
            Filtros y exportación
          </CardTitle>
          <CardDescription>
            Los KPI superiores se recalculan según filtros. CSV, Excel y PDF incluyen
            únicamente las filas visibles en la tabla.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="grid min-w-0 flex-1 gap-1.5">
            <label
              htmlFor="gestion-search"
              className="text-xs font-medium text-slate-600"
            >
              Buscar cliente o Nº pedido
            </label>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
              <Input
                id="gestion-search"
                placeholder="Cliente, ID interno o referencia…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          </div>
          <NativeSelect
            label="Comercial"
            options={comercialOptions}
            value={comercial}
            onChange={(e) => setComercial(e.target.value)}
            className="min-w-[12rem] lg:w-56"
          />
          <NativeSelect
            label="Estado"
            options={estadoFilterOptions}
            value={estadoFilter}
            onChange={(e) =>
              setEstadoFilter(e.target.value as GestionEstadoFilter)
            }
            className="min-w-[12rem] lg:w-48"
          />
          <div className="flex flex-wrap items-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-9 gap-2 border border-[#002147]/15 bg-[#002147]/5 text-[#002147] hover:bg-[#002147]/10"
              onClick={exportCsv}
              disabled={sortedRows.length === 0}
              title="Descargar CSV (UTF-8 con BOM)"
            >
              <FileText className="size-4 shrink-0" aria-hidden />
              CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-9 gap-2 border border-[#002147]/15 bg-[#002147]/5 text-[#002147] hover:bg-[#002147]/10"
              onClick={exportExcel}
              disabled={sortedRows.length === 0}
              title="Descargar Excel (.xlsx)"
            >
              <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
              Excel
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-9 gap-2 border border-[#002147]/15 bg-[#002147]/5 text-[#002147] hover:bg-[#002147]/10"
              onClick={exportPdf}
              disabled={sortedRows.length === 0}
              title="Descargar PDF (tabla horizontal)"
            >
              <FileDown className="size-4 shrink-0" aria-hidden />
              PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/80 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-base text-[#002147]">
            Listado de pedidos
          </CardTitle>
          <CardDescription>
            {sortedRows.length} pedido
            {sortedRows.length === 1 ? "" : "s"} · pulsa cabeceras para ordenar
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                  <TableHead className="min-w-[7rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-[#002147]"
                      onClick={() => toggleSort("pedido")}
                    >
                      Nº Pedido
                      <SortIcon
                        active={sortKey === "pedido"}
                        dir={sortDir}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[10rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-[#002147]"
                      onClick={() => toggleSort("cliente")}
                    >
                      Cliente
                      <SortIcon
                        active={sortKey === "cliente"}
                        dir={sortDir}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[8rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-[#002147]"
                      onClick={() => toggleSort("comercial")}
                    >
                      Comercial
                      <SortIcon
                        active={sortKey === "comercial"}
                        dir={sortDir}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-[8rem]">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-[#002147]"
                      onClick={() => toggleSort("fecha")}
                    >
                      Fecha prevista
                      <SortIcon
                        active={sortKey === "fecha"}
                        dir={sortDir}
                      />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-[#002147]"
                      onClick={() => toggleSort("estado")}
                    >
                      Estado
                      <SortIcon
                        active={sortKey === "estado"}
                        dir={sortDir}
                      />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground py-10 text-center text-sm"
                    >
                      No hay pedidos que coincidan con los filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedRows.map((row) => {
                    const cat = getGestionCategoria(row);
                    return (
                      <TableRow
                        key={`${row.idPedido}-${formatPedidoId(row)}`}
                        className={cn(
                          cat === "retrasado" && "bg-red-50/50"
                        )}
                      >
                        <TableCell className="font-mono text-xs tabular-nums">
                          {formatPedidoId(row) || "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <span className="line-clamp-2 text-sm">
                            {row.cliente?.trim() || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.comercial?.trim() || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm tabular-nums">
                          {row.fechaEntrega?.trim() || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <GestionEstadoBadge categoria={cat} />
                            {row.estado?.trim() ? (
                              <span className="text-muted-foreground max-w-[14rem] truncate text-[10px] leading-tight">
                                ERP: {row.estado}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
