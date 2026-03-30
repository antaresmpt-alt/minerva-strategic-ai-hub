"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  FileDown,
  FileSpreadsheet,
  FileText,
  Search,
  Upload,
  Wand2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeadEmailAiDialog } from "@/components/sales/lead-email-ai-dialog";
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
  buildLeadsCsv,
  buildLeadsPdfBlob,
  buildLeadsXlsxBlob,
  downloadBlob,
  leadsExportBasename,
} from "@/lib/leads-export";
import {
  isEstadoPresupuesto,
  isLeadDormido,
  isPrioridadAlta,
} from "@/lib/leads-kpi";
import { parseLeadsArrayBuffer, parseLeadsFile } from "@/lib/leads-parse";
import { cn } from "@/lib/utils";
import type { LeadRow } from "@/types/leads";

const DEMO_URL = "/data/leads_minerva_v1.xlsx";

const FILE_ACCEPT =
  ".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

const ESTADO_OPTIONS = [
  { value: "__all__", label: "Todos" },
  { value: "Nuevo", label: "Nuevo" },
  { value: "Contactado", label: "Contactado" },
  { value: "Reunión", label: "Reunión" },
  { value: "Presupuesto", label: "Presupuesto" },
  { value: "Ganado", label: "Ganado" },
  { value: "Perdido", label: "Perdido" },
] as const;

const PRIORIDAD_OPTIONS = [
  { value: "__all__", label: "Todas" },
  { value: "Alta", label: "Alta" },
  { value: "Media", label: "Media" },
  { value: "Baja", label: "Baja" },
] as const;

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function PrioridadBadge({ value }: { value: string }) {
  const n = norm(value);
  if (n === "alta") {
    return (
      <Badge variant="destructive" className="font-normal">
        {value || "—"}
      </Badge>
    );
  }
  if (n === "media") {
    return (
      <Badge
        variant="warning"
        className="border-amber-400/60 bg-amber-100 font-normal text-amber-950 dark:text-amber-50"
      >
        {value || "—"}
      </Badge>
    );
  }
  if (n === "baja") {
    return (
      <Badge variant="secondary" className="font-normal">
        {value || "—"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-normal">
      {value || "—"}
    </Badge>
  );
}

function EstadoLeadBadge({ value }: { value: string }) {
  const n = norm(value);
  if (n === "ganado") {
    return (
      <Badge variant="success" className="font-normal">
        {value || "—"}
      </Badge>
    );
  }
  if (n === "perdido") {
    return (
      <Badge variant="destructive" className="font-normal">
        {value || "—"}
      </Badge>
    );
  }
  if (n === "nuevo") {
    return (
      <Badge variant="secondary" className="font-normal text-slate-700">
        {value || "—"}
      </Badge>
    );
  }
  if (n === "presupuesto" || n === "reunion") {
    return (
      <Badge className="border border-sky-300/80 bg-sky-50 font-normal text-sky-950 dark:bg-sky-950/50">
        {value || "—"}
      </Badge>
    );
  }
  if (n === "contactado") {
    return (
      <Badge
        variant="outline"
        className="border-indigo-200 bg-indigo-50/90 font-normal text-indigo-950"
      >
        {value || "—"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-normal">
      {value || "—"}
    </Badge>
  );
}

export function LeadsManagementPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [leadsData, setLeadsData] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [comercial, setComercial] = useState("__all__");
  const [estadoF, setEstadoF] = useState("__all__");
  const [prioridadF, setPrioridadF] = useState("__all__");
  const [emailLead, setEmailLead] = useState<LeadRow | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const comercialOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of leadsData) {
      set.add((r.comercial ?? "").trim() || "Sin asignar");
    }
    const sorted = [...set].sort((a, b) => a.localeCompare(b, "es"));
    return [
      { value: "__all__", label: "Todos los comerciales" },
      ...sorted.map((c) => ({ value: c, label: c })),
    ];
  }, [leadsData]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leadsData.filter((lead) => {
      if (comercial !== "__all__") {
        const lab = (lead.comercial ?? "").trim() || "Sin asignar";
        if (lab !== comercial) return false;
      }
      if (estadoF !== "__all__") {
        if (norm(lead.estado) !== norm(estadoF)) return false;
      }
      if (prioridadF !== "__all__") {
        if (norm(lead.prioridad) !== norm(prioridadF)) return false;
      }
      if (!q) return true;
      const emp = (lead.empresa ?? "").toLowerCase();
      const con = (lead.contacto ?? "").toLowerCase();
      return emp.includes(q) || con.includes(q);
    });
  }, [leadsData, search, comercial, estadoF, prioridadF]);

  const kpis = useMemo(() => {
    const total = filteredLeads.length;
    let calientes = 0;
    let presupuesto = 0;
    let dormidos = 0;
    for (const l of filteredLeads) {
      if (isPrioridadAlta(l)) calientes += 1;
      if (isEstadoPresupuesto(l)) presupuesto += 1;
      if (isLeadDormido(l)) dormidos += 1;
    }
    return { total, calientes, presupuesto, dormidos };
  }, [filteredLeads]);

  const applyRows = useCallback((rows: LeadRow[], label: string) => {
    setLeadsData(rows);
    setSourceLabel(label);
    setError(null);
  }, []);

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await parseLeadsFile(f);
        if (rows.length === 0) {
          setError("No se encontraron filas válidas en el archivo.");
          setLeadsData([]);
          setSourceLabel(null);
          return;
        }
        applyRows(rows, f.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al leer el archivo");
        setLeadsData([]);
        setSourceLabel(null);
      } finally {
        setLoading(false);
      }
    },
    [applyRows]
  );

  const loadDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(DEMO_URL);
      if (!res.ok) {
        throw new Error(`No se pudo cargar el ejemplo (${res.status}).`);
      }
      const buf = await res.arrayBuffer();
      const rows = parseLeadsArrayBuffer(buf);
      if (rows.length === 0) {
        setError("El archivo de ejemplo no contiene datos.");
        setLeadsData([]);
        setSourceLabel(null);
        return;
      }
      applyRows(rows, "Datos de ejemplo (leads)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el ejemplo");
      setLeadsData([]);
      setSourceLabel(null);
    } finally {
      setLoading(false);
    }
  }, [applyRows]);

  const exportCsv = () => {
    const name = leadsExportBasename();
    const csv = buildLeadsCsv(filteredLeads);
    downloadBlob(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
      `${name}.csv`
    );
  };
  const exportXlsx = () =>
    downloadBlob(buildLeadsXlsxBlob(filteredLeads), `${leadsExportBasename()}.xlsx`);
  const exportPdf = () =>
    downloadBlob(buildLeadsPdfBlob(filteredLeads), `${leadsExportBasename()}.pdf`);

  return (
    <div className="space-y-6">
      <Card className="border-slate-200/80 bg-white/90 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#002147]">
            Carga de leads
          </CardTitle>
          <CardDescription>
            Excel o CSV con columnas: ID_Lead, Empresa, Contacto, Cargo, Email,
            Telefono, Origen, Tema_Interes, Comercial, Estado, Prioridad,
            Ultimo_Contacto, Proxima_Accion.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            type="button"
            variant="default"
            className="gap-2 bg-[#002147] hover:bg-[#002147]/90"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            <Upload className="size-4" aria-hidden />
            Subir Excel / CSV de leads
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-[#002147]/25"
            onClick={() => void loadDemo()}
            disabled={loading}
          >
            Cargar datos de ejemplo
          </Button>
          {sourceLabel ? (
            <p className="text-muted-foreground text-xs sm:ml-auto">
              Origen:{" "}
              <span className="font-medium text-slate-700">{sourceLabel}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <input
        ref={fileRef}
        type="file"
        accept={FILE_ACCEPT}
        className="sr-only"
        onChange={onFile}
      />

      {error ? (
        <Card className="border-red-200 bg-red-50/80">
          <CardContent className="pt-4 text-sm text-red-800">{error}</CardContent>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-muted-foreground text-sm">Procesando archivo…</p>
      ) : null}

      {leadsData.length > 0 ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Total leads</CardDescription>
                <CardTitle className="font-heading text-3xl tabular-nums text-[#002147]">
                  {kpis.total}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Oportunidades calientes</CardDescription>
                <CardTitle className="font-heading text-3xl tabular-nums text-red-700">
                  {kpis.calientes}
                </CardTitle>
                <p className="text-muted-foreground text-[11px]">
                  Prioridad &quot;Alta&quot;
                </p>
              </CardHeader>
            </Card>
            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Presupuestos activos</CardDescription>
                <CardTitle className="font-heading text-3xl tabular-nums text-sky-800">
                  {kpis.presupuesto}
                </CardTitle>
                <p className="text-muted-foreground text-[11px]">
                  Estado &quot;Presupuesto&quot;
                </p>
              </CardHeader>
            </Card>
            <Card className="border-orange-300/90 bg-gradient-to-br from-orange-50/95 to-amber-50/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-orange-900/90">
                  Leads dormidos
                </CardDescription>
                <CardTitle className="font-heading text-3xl tabular-nums text-orange-800">
                  {kpis.dormidos}
                </CardTitle>
                <p className="text-[11px] text-orange-900/80">
                  Contactado/Reunión y sin contacto &gt; 7 días
                </p>
              </CardHeader>
            </Card>
          </section>

          <Card className="border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base text-[#002147]">
                Filtros y exportación
              </CardTitle>
              <CardDescription>
                CSV, Excel y PDF reflejan solo los leads filtrados en la tabla.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
              <div className="grid min-w-0 flex-1 gap-1.5">
                <label
                  htmlFor="leads-search"
                  className="text-xs font-medium text-slate-600"
                >
                  Buscar en empresa o contacto
                </label>
                <div className="relative">
                  <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    id="leads-search"
                    placeholder="Nombre de empresa o persona…"
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
                options={[...ESTADO_OPTIONS]}
                value={estadoF}
                onChange={(e) => setEstadoF(e.target.value)}
                className="min-w-[12rem] lg:w-48"
              />
              <NativeSelect
                label="Prioridad"
                options={[...PRIORIDAD_OPTIONS]}
                value={prioridadF}
                onChange={(e) => setPrioridadF(e.target.value)}
                className="min-w-[10rem] lg:w-40"
              />
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 gap-2 border border-[#002147]/15 bg-[#002147]/5 text-[#002147] hover:bg-[#002147]/10"
                  onClick={exportCsv}
                  disabled={filteredLeads.length === 0}
                >
                  <FileText className="size-4 shrink-0" aria-hidden />
                  CSV
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 gap-2 border border-[#002147]/15 bg-[#002147]/5 text-[#002147] hover:bg-[#002147]/10"
                  onClick={exportXlsx}
                  disabled={filteredLeads.length === 0}
                >
                  <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
                  Excel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 gap-2 border border-[#002147]/15 bg-[#002147]/5 text-[#002147] hover:bg-[#002147]/10"
                  onClick={exportPdf}
                  disabled={filteredLeads.length === 0}
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
                Pipeline de leads
              </CardTitle>
              <CardDescription>
                {filteredLeads.length} lead
                {filteredLeads.length === 1 ? "" : "s"} mostrado(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                      <TableHead className="min-w-[10rem]">Empresa</TableHead>
                      <TableHead className="min-w-[8rem]">Contacto</TableHead>
                      <TableHead className="min-w-[7rem]">Comercial</TableHead>
                      <TableHead className="min-w-[7rem]">Estado</TableHead>
                      <TableHead className="min-w-[6rem]">Prioridad</TableHead>
                      <TableHead className="min-w-[7rem]">
                        Último contacto
                      </TableHead>
                      <TableHead className="min-w-[10rem]">
                        Próxima acción
                      </TableHead>
                      <TableHead className="w-[4.5rem] text-center">
                        IA
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead, idx) => (
                      <TableRow
                        key={`${lead.idLead}-${idx}`}
                        className={cn(
                          isLeadDormido(lead) && "bg-orange-50/40"
                        )}
                      >
                        <TableCell className="max-w-[220px] text-sm font-medium">
                          <span className="line-clamp-2">{lead.empresa || "—"}</span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {lead.contacto || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {lead.comercial || "—"}
                        </TableCell>
                        <TableCell>
                          <EstadoLeadBadge value={lead.estado} />
                        </TableCell>
                        <TableCell>
                          <PrioridadBadge value={lead.prioridad} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm tabular-nums text-slate-700">
                          {lead.ultimoContacto || "—"}
                        </TableCell>
                        <TableCell className="max-w-[240px] text-sm">
                          <span className="line-clamp-2">
                            {lead.proximaAccion || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="size-8 border-[#002147]/20 text-[#002147] hover:bg-[#002147]/10"
                            title="Redactar email con IA"
                            aria-label="Redactar email con IA"
                            onClick={() => {
                              setEmailLead(lead);
                              setEmailOpen(true);
                            }}
                          >
                            <Wand2 className="size-3.5" aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : !loading && !error ? (
        <p className="text-muted-foreground text-center text-sm">
          Sube un archivo de leads o usa &quot;Cargar datos de ejemplo&quot; para ver
          KPIs y tabla.
        </p>
      ) : null}

      <LeadEmailAiDialog
        lead={emailLead}
        open={emailOpen}
        onOpenChange={(o) => {
          setEmailOpen(o);
          if (!o) setEmailLead(null);
        }}
      />
    </div>
  );
}
