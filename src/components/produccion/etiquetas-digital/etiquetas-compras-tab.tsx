"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EtiquetasCompraDialog } from "@/components/produccion/etiquetas-digital/etiquetas-compra-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, type Option } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  buildEtiquetasComprasSolicitudEmail,
  buildGmailComposeUrl,
  DEFAULT_EMAIL_PLANTILLA_ETIQUETAS_COMPRAS,
  fetchEmailPlantillasProduccion,
  type EmailPlantillaBloques,
} from "@/lib/email-plantillas-produccion";
import {
  exportEtiquetasComprasExcel,
  exportEtiquetasComprasPdf,
} from "@/lib/etiquetas-compras-export";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ProdEtiquetasCatalogRow } from "@/types/prod-etiquetas-catalogo";
import type {
  ProdEtiquetasCompraComunicacionRow,
  ProdEtiquetasCompraRow,
} from "@/types/prod-etiquetas-compras";
import { cn } from "@/lib/utils";

const TABLE = "prod_etiquetas_compras";
const CATALOG_TABLE = "prod_etiquetas_catalogo";
const TABLE_COMUNICACION = "prod_etiquetas_compras_comunicacion";

const MIGRATION_ETIQUETAS_COMPRAS_HINT =
  "En Supabase → SQL Editor, ejecuta las migraciones del repo: 20260515120000_prod_etiquetas_compras_catalogo.sql y 20260516100000_prod_etiquetas_compras_enviado_comunicacion.sql (pega el contenido de cada archivo). Tras unos segundos, pulsa Actualizar.";

function isMissingEtiquetasTablesMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  if (!m.includes("schema cache")) return false;
  return (
    m.includes("prod_etiquetas_catalogo") ||
    m.includes("prod_etiquetas_compras")
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + "T12:00:00");
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  }
  return iso;
}

function coerceEtiquetasCompraRow(
  raw: Record<string, unknown>
): ProdEtiquetasCompraRow {
  const r = raw as ProdEtiquetasCompraRow;
  return {
    ...r,
    enviado: Boolean((raw as { enviado?: boolean }).enviado),
    enviado_at: (raw as { enviado_at?: string | null }).enviado_at ?? null,
  };
}

type EtqComprasSortKey =
  | "producto"
  | "propietario"
  | "fecha_pedido"
  | "fecha_llegada"
  | "equipo"
  | "marca";

type EtqComprasTableSort = {
  key: EtqComprasSortKey | null;
  dir: "asc" | "desc";
};

function sortDateMs(iso: string | null | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null;
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = new Date(s.slice(0, 10) + "T12:00:00").getTime();
    return Number.isNaN(t) ? null : t;
  }
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

function compareEtqComprasRows(
  a: ProdEtiquetasCompraRow,
  b: ProdEtiquetasCompraRow,
  key: EtqComprasSortKey
): number {
  switch (key) {
    case "producto":
      return a.producto.localeCompare(b.producto, "es", {
        numeric: true,
        sensitivity: "base",
      });
    case "propietario": {
      const la = a.propietario === "RITA" ? "Rita" : "Hugo";
      const lb = b.propietario === "RITA" ? "Rita" : "Hugo";
      return la.localeCompare(lb, "es", { sensitivity: "base" });
    }
    case "fecha_pedido": {
      const ta = sortDateMs(a.fecha_pedido);
      const tb = sortDateMs(b.fecha_pedido);
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return ta - tb;
    }
    case "fecha_llegada": {
      const ta = sortDateMs(a.fecha_llegada);
      const tb = sortDateMs(b.fecha_llegada);
      if (ta == null && tb == null) return 0;
      if (ta == null) return 1;
      if (tb == null) return -1;
      return ta - tb;
    }
    case "equipo":
      return (a.equipo || "").localeCompare(b.equipo || "", "es", {
        numeric: true,
        sensitivity: "base",
      });
    case "marca":
      return (a.marca || "").localeCompare(b.marca || "", "es", {
        numeric: true,
        sensitivity: "base",
      });
    default:
      return 0;
  }
}

function EtiquetasComprasSortHeader({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  columnKey: EtqComprasSortKey;
  sortKey: EtqComprasSortKey | null;
  sortDir: "asc" | "desc";
  onSort: (k: EtqComprasSortKey) => void;
  className?: string;
}) {
  const sorted = sortKey === columnKey;
  return (
    <button
      type="button"
      title={`Ordenar por ${label}`}
      className={cn(
        "-mx-0.5 inline-flex max-w-full min-w-0 items-center gap-0.5 rounded px-0.5 py-0.5 text-left font-semibold text-[#002147] hover:bg-slate-100/90 hover:text-slate-800",
        sorted && "text-[#002147]",
        className
      )}
      onClick={() => onSort(columnKey)}
    >
      <span className="min-w-0 shrink truncate">{label}</span>
      <span
        className="inline-flex size-3 shrink-0 items-center justify-center"
        aria-hidden
      >
        {sorted && sortDir === "asc" ? (
          <ArrowUp className="size-3 text-[#002147]" strokeWidth={2.25} />
        ) : sorted && sortDir === "desc" ? (
          <ArrowDown className="size-3 text-[#002147]" strokeWidth={2.25} />
        ) : (
          <ArrowUpDown className="size-3 text-slate-300" strokeWidth={2} />
        )}
      </span>
    </button>
  );
}

type PendingEtiquetasCorreo = {
  ids: string[];
  asunto: string;
  cuerpo: string;
};

export function EtiquetasComprasTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<ProdEtiquetasCompraRow[]>([]);
  const [catalog, setCatalog] = useState<ProdEtiquetasCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroProp, setFiltroProp] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<ProdEtiquetasCompraRow | null>(
    null
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [plantillaEmail, setPlantillaEmail] = useState<EmailPlantillaBloques>(
    () => ({ ...DEFAULT_EMAIL_PLANTILLA_ETIQUETAS_COMPRAS })
  );
  const [correoConfirmOpen, setCorreoConfirmOpen] = useState(false);
  const [pendingCorreo, setPendingCorreo] =
    useState<PendingEtiquetasCorreo | null>(null);
  const [correoSaving, setCorreoSaving] = useState(false);

  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logCompraId, setLogCompraId] = useState<string | null>(null);
  const [logRows, setLogRows] = useState<ProdEtiquetasCompraComunicacionRow[]>(
    []
  );
  const [logLoading, setLogLoading] = useState(false);

  const [tableSort, setTableSort] = useState<EtqComprasTableSort>({
    key: null,
    dir: "asc",
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [rRows, rCat] = await Promise.all([
      supabase
        .from(TABLE)
        .select("*")
        .order("fecha_pedido", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from(CATALOG_TABLE)
        .select("id, categoria, grupo, label, activo, orden")
        .order("categoria")
        .order("grupo")
        .order("orden")
        .order("label"),
    ]);
    setLoading(false);

    if (rRows.error) {
      setRows([]);
    } else {
      setRows(
        (rRows.data ?? []).map((x) =>
          coerceEtiquetasCompraRow(x as Record<string, unknown>)
        )
      );
    }
    if (rCat.error) {
      console.warn("[etiquetas catalog]", rCat.error.message);
      setCatalog([]);
    } else {
      setCatalog((rCat.data ?? []) as ProdEtiquetasCatalogRow[]);
    }

    const err = rRows.error ?? rCat.error;
    if (err) {
      const combined = [rRows.error?.message, rCat.error?.message]
        .filter(Boolean)
        .join(" ");
      if (isMissingEtiquetasTablesMessage(combined)) {
        toast.error("Faltan tablas en la base de datos", {
          id: "etq-compras-missing-ddl",
          description: MIGRATION_ETIQUETAS_COMPRAS_HINT,
        });
      } else {
        toast.error("No se pudo cargar la pestaña Compras", {
          id: "etq-compras-load-err",
          description: err.message,
        });
      }
    }
  }, [supabase]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void (async () => {
      try {
        const { etiquetasCompras } =
          await fetchEmailPlantillasProduccion(supabase);
        setPlantillaEmail(etiquetasCompras);
      } catch {
        /* default */
      }
    })();
  }, [supabase]);

  const filtradas = useMemo(() => {
    let list = [...rows];
    const q = filtroTexto.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const blob = [
          r.producto,
          r.marca,
          r.equipo,
          r.tipo_linea,
          r.propietario,
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      });
    }
    if (filtroProp === "RITA" || filtroProp === "HUGO") {
      list = list.filter((r) => r.propietario === filtroProp);
    }
    if (
      filtroPrioridad === "ALTA" ||
      filtroPrioridad === "MEDIA" ||
      filtroPrioridad === "BAJA"
    ) {
      list = list.filter((r) => r.prioridad === filtroPrioridad);
    }
    if (soloPendientes) {
      list = list.filter((r) => !r.recibido);
    }
    return list;
  }, [rows, filtroTexto, filtroProp, filtroPrioridad, soloPendientes]);

  const filtradasOrdenadas = useMemo(() => {
    const sk = tableSort.key;
    if (sk == null) return filtradas;
    const list = [...filtradas];
    const mult = tableSort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => compareEtqComprasRows(a, b, sk) * mult);
    return list;
  }, [filtradas, tableSort]);

  const handleSortColumn = useCallback((key: EtqComprasSortKey) => {
    setTableSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: "asc" };
    });
  }, []);

  useEffect(() => {
    const allowed = new Set(filtradas.map((r) => r.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (allowed.has(id)) next.add(id);
      }
      if (next.size === prev.size) {
        let same = true;
        for (const id of prev) {
          if (!next.has(id)) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return next;
    });
  }, [filtradas]);

  const selectedRowsSorted = useMemo(() => {
    const picked = filtradas.filter((r) => selectedIds.has(r.id));
    return [...picked].sort((a, b) => {
      const da = String(a.fecha_pedido ?? "").localeCompare(
        String(b.fecha_pedido ?? "")
      );
      if (da !== 0) return -da;
      return String(b.created_at ?? "").localeCompare(
        String(a.created_at ?? "")
      );
    });
  }, [filtradas, selectedIds]);

  const allFilteredSelected =
    filtradas.length > 0 && filtradas.every((r) => selectedIds.has(r.id));
  const someFilteredSelected = filtradas.some((r) => selectedIds.has(r.id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  const propOptions: Option[] = useMemo(
    () => [
      { value: "", label: "— Todos —" },
      { value: "RITA", label: "Rita" },
      { value: "HUGO", label: "Hugo" },
    ],
    []
  );

  const prioridadOptions: Option[] = useMemo(
    () => [
      { value: "", label: "— Todas —" },
      { value: "ALTA", label: "Alta" },
      { value: "MEDIA", label: "Media" },
      { value: "BAJA", label: "Baja" },
    ],
    []
  );

  const exportFiltersLabel = useMemo(() => {
    const propL =
      filtroProp === "RITA"
        ? "Rita"
        : filtroProp === "HUGO"
          ? "Hugo"
          : "Todos";
    const priL =
      filtroPrioridad === "ALTA"
        ? "Alta"
        : filtroPrioridad === "MEDIA"
          ? "Media"
          : filtroPrioridad === "BAJA"
            ? "Baja"
            : "Todas";
    return {
      buscar: filtroTexto,
      propietarioLabel: propL,
      prioridadLabel: priL,
      soloPendientes,
    };
  }, [filtroProp, filtroPrioridad, filtroTexto, soloPendientes]);

  const toggleSelectAllFiltered = useCallback(() => {
    setSelectedIds((prev) => {
      if (filtradas.length === 0) return prev;
      const allSel = filtradas.every((r) => prev.has(r.id));
      if (allSel) return new Set();
      return new Set(filtradas.map((r) => r.id));
    });
  }, [filtradas]);

  const toggleRowSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleRecibido = useCallback(
    async (r: ProdEtiquetasCompraRow, next: boolean) => {
      const prev = r.recibido;
      setRows((list) =>
        list.map((x) => (x.id === r.id ? { ...x, recibido: next } : x))
      );
      const { error } = await supabase
        .from(TABLE)
        .update({ recibido: next })
        .eq("id", r.id);
      if (error) {
        setRows((list) =>
          list.map((x) => (x.id === r.id ? { ...x, recibido: prev } : x))
        );
        toast.error(error.message);
        return;
      }
      toast.success(
        next ? "Marcado como recibido." : "Marcado como pendiente."
      );
    },
    [supabase]
  );

  const abrirGmailYModalConfirm = useCallback(async () => {
    if (selectedRowsSorted.length === 0) {
      toast.error("Selecciona al menos una fila.");
      return;
    }
    setCorreoSaving(true);
    try {
      const res = await fetch("/api/etiquetas-digital/compras-mail-config");
      const data = (await res.json()) as { emails?: string[]; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "No se pudieron leer los destinatarios.");
        return;
      }
      const emails = Array.isArray(data.emails)
        ? data.emails.map((s) => String(s).trim()).filter(Boolean)
        : [];
      const to = emails.join(",");
      if (!to) {
        toast.message("Sin destinatarios", {
          description:
            "Configura correos en Ajustes → Recursos de producción → Etiquetas digital → pestaña Correo y plantilla.",
        });
        return;
      }

      const { subject, body } = buildEtiquetasComprasSolicitudEmail(
        selectedRowsSorted,
        plantillaEmail
      );
      window.open(
        buildGmailComposeUrl(to, subject, body),
        "_blank",
        "noopener,noreferrer"
      );
      setPendingCorreo({
        ids: selectedRowsSorted.map((r) => r.id),
        asunto: subject,
        cuerpo: body,
      });
      setCorreoConfirmOpen(true);
      toast.message("Gmail abierto en una pestaña nueva", {
        description:
          "Si ya has enviado el mail, confirma aquí para marcar las líneas y guardar el historial.",
      });
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "No se pudo abrir el correo."
      );
    } finally {
      setCorreoSaving(false);
    }
  }, [plantillaEmail, selectedRowsSorted]);

  const confirmarEnvioCorreo = useCallback(async () => {
    if (!pendingCorreo) return;
    setCorreoSaving(true);
    try {
      const now = new Date().toISOString();
      const { ids, asunto, cuerpo } = pendingCorreo;

      const { error: u1 } = await supabase
        .from(TABLE)
        .update({ enviado: true, enviado_at: now })
        .in("id", ids);
      if (u1) throw u1;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const enviadoPor =
        typeof user?.id === "string" && user.id.trim().length > 0
          ? user.id.trim()
          : null;

      const { error: logErr } = await supabase.from(TABLE_COMUNICACION).insert({
        compra_ids: ids,
        asunto,
        cuerpo,
        enviado_por: enviadoPor,
      });
      if (logErr) {
        console.error("[prod_etiquetas_compras_comunicacion]", logErr);
        toast.warning(
          `Envío marcado, pero no se guardó el historial: ${logErr.message}`
        );
      }

      toast.success(
        ids.length > 1
          ? `Confirmado (${ids.length} líneas).`
          : "Confirmado: línea marcada como enviada."
      );
      setCorreoConfirmOpen(false);
      setPendingCorreo(null);
      setSelectedIds(new Set());
      void loadAll();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : "No se pudo confirmar el envío."
      );
    } finally {
      setCorreoSaving(false);
    }
  }, [loadAll, pendingCorreo, supabase]);

  const openLogDialog = useCallback(
    async (compraId: string) => {
      setLogCompraId(compraId);
      setLogDialogOpen(true);
      setLogRows([]);
      setLogLoading(true);
      const { data, error } = await supabase
        .from(TABLE_COMUNICACION)
        .select("id, compra_ids, asunto, cuerpo, enviado_por, created_at")
        .contains("compra_ids", [compraId])
        .order("created_at", { ascending: false })
        .limit(12);
      setLogLoading(false);
      if (error) {
        console.error("[etiquetas compras comunicacion]", error);
        toast.error(error.message);
        return;
      }
      setLogRows((data ?? []) as ProdEtiquetasCompraComunicacionRow[]);
    },
    [supabase]
  );

  const exportExcel = useCallback(() => {
    if (filtradas.length === 0) {
      toast.error("No hay filas que exportar.");
      return;
    }
    exportEtiquetasComprasExcel(filtradasOrdenadas, exportFiltersLabel);
    toast.success(`Excel descargado (${filtradasOrdenadas.length} fila(s) de la vista actual).`);
  }, [exportFiltersLabel, filtradasOrdenadas]);

  const exportPdf = useCallback(() => {
    if (filtradasOrdenadas.length === 0) {
      toast.error("No hay filas que exportar.");
      return;
    }
    exportEtiquetasComprasPdf(filtradasOrdenadas, exportFiltersLabel);
    toast.success(`PDF descargado (${filtradasOrdenadas.length} fila(s)).`);
  }, [exportFiltersLabel, filtradasOrdenadas]);

  const logProductLabel = useMemo(() => {
    if (!logCompraId) return "";
    const r = rows.find((x) => x.id === logCompraId);
    return r?.producto?.trim() || "Línea";
  }, [logCompraId, rows]);

  return (
    <div className="flex w-full min-w-0 max-w-[100vw] flex-col gap-3">
      <EtiquetasCompraDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditingRow(null);
        }}
        row={editingRow}
        catalog={catalog}
        onSaved={() => void loadAll()}
      />

      <Dialog
        open={correoConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCorreoConfirmOpen(false);
            setPendingCorreo(null);
          }
        }}
      >
        <DialogContent className="max-w-md gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b border-slate-100 px-4 py-3">
            <DialogTitle className="text-base text-[#002147]">
              ¿Has enviado el correo?
            </DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-relaxed">
              Si ya enviaste el mensaje en Gmail, confirma para marcar las líneas
              seleccionadas y registrar el envío en el historial.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={correoSaving}
              onClick={() => {
                setCorreoConfirmOpen(false);
                setPendingCorreo(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={correoSaving || !pendingCorreo}
              className="bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700 hover:text-white"
              onClick={() => void confirmarEnvioCorreo()}
            >
              {correoSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Guardando…
                </>
              ) : (
                "Sí, confirmar envío"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={logDialogOpen}
        onOpenChange={(o) => {
          setLogDialogOpen(o);
          if (!o) {
            setLogCompraId(null);
            setLogRows([]);
          }
        }}
      >
        <DialogContent className="max-h-[min(90vh,560px)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-slate-100 px-4 py-3">
            <DialogTitle className="text-base text-[#002147]">
              Historial de correo
            </DialogTitle>
            <DialogDescription className="line-clamp-2 text-xs">
              {logProductLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,420px)] space-y-3 overflow-y-auto px-4 py-3">
            {logLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Cargando…
              </div>
            ) : logRows.length === 0 ? (
              <p className="text-sm text-slate-600">
                No hay envíos registrados para esta línea.
              </p>
            ) : (
              logRows.map((log) => (
                <div
                  key={log.id}
                  className="rounded-md border border-slate-200 bg-slate-50/80 p-2 text-xs"
                >
                  <p className="font-semibold text-[#002147]">
                    {log.asunto?.trim() || "—"}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                    {fmtDate(log.created_at)}
                  </p>
                  <Textarea
                    readOnly
                    className="mt-2 min-h-[5rem] resize-none bg-white font-mono text-[11px]"
                    value={log.cuerpo ?? ""}
                  />
                </div>
              ))
            )}
          </div>
          <DialogFooter className="border-t border-slate-100 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLogDialogOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#002147]">Compras</h2>
          <p className="text-xs text-slate-600">
            Seguimiento de pedidos del departamento. Datos en{" "}
            <code className="rounded bg-slate-100 px-1">{TABLE}</code>. Listas
            en{" "}
            <code className="rounded bg-slate-100 px-1">{CATALOG_TABLE}</code>{" "}
            (Ajustes → Recursos → Etiquetas digital).
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={correoSaving || selectedRowsSorted.length === 0}
            onClick={() => void abrirGmailYModalConfirm()}
          >
            {correoSaving ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Mail className="size-4" aria-hidden />
            )}
            Abrir Gmail
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={filtradas.length === 0}
            onClick={exportExcel}
          >
            <FileSpreadsheet className="size-4" aria-hidden />
            Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={filtradas.length === 0}
            onClick={exportPdf}
          >
            <Download className="size-4" aria-hidden />
            PDF
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="bg-[#002147]"
            onClick={() => {
              setEditingRow(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Nueva línea
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={loading}
            onClick={() => void loadAll()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 rounded-lg border border-slate-200/90 bg-white/90 p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
        <div className="grid min-w-0 gap-2 sm:col-span-2 lg:col-span-5">
          <Label htmlFor="etq-cp-buscar" className="text-xs">
            Buscar
          </Label>
          <Input
            id="etq-cp-buscar"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Producto, marca, equipo…"
            className="h-9"
          />
        </div>
        <div className="grid w-full gap-2 sm:col-span-1 lg:col-span-2">
          <Label className="text-xs">Propietario</Label>
          <NativeSelect
            value={filtroProp}
            onChange={(e) => setFiltroProp(e.target.value)}
            options={propOptions}
          />
        </div>
        <div className="grid w-full gap-2 sm:col-span-1 lg:col-span-2">
          <Label className="text-xs">Prioridad</Label>
          <NativeSelect
            value={filtroPrioridad}
            onChange={(e) => setFiltroPrioridad(e.target.value)}
            options={prioridadOptions}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 lg:col-span-3">
          <input
            type="checkbox"
            className="size-4 rounded border-slate-300"
            checked={soloPendientes}
            onChange={(e) => setSoloPendientes(e.target.checked)}
          />
          Solo pendientes (sin recibir)
        </label>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : filtradas.length === 0 ? (
        <Alert className="border-slate-200 bg-slate-50/90">
          <AlertTitle>Sin filas</AlertTitle>
          <AlertDescription className="text-sm">
            {rows.length === 0
              ? "Aún no hay líneas de compra. Pulsa «Nueva línea»."
              : "Ninguna fila coincide con los filtros."}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200/90 bg-white shadow-sm">
          <Table className="min-w-[1040px] text-xs">
            <TableHeader>
              <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                <TableHead className="w-9 px-1 text-center font-semibold text-[#002147]">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="size-3.5 cursor-pointer rounded border-slate-300 accent-[#002147]"
                    checked={allFilteredSelected}
                    title="Seleccionar vista filtrada"
                    aria-label="Seleccionar todas las filas visibles"
                    onChange={() => toggleSelectAllFiltered()}
                  />
                </TableHead>
                <TableHead className="w-10 px-1 text-center font-semibold text-[#002147]">
                  <span className="sr-only">Historial correo</span>
                </TableHead>
                <TableHead className="w-10 px-1 text-center font-semibold text-[#002147]">
                  <span className="sr-only">Editar</span>
                </TableHead>
                <TableHead className="font-semibold text-[#002147]">
                  <EtiquetasComprasSortHeader
                    label="Producto"
                    columnKey="producto"
                    sortKey={tableSort.key}
                    sortDir={tableSort.dir}
                    onSort={handleSortColumn}
                  />
                </TableHead>
                <TableHead className="text-right font-semibold text-[#002147]">
                  Ud.
                </TableHead>
                <TableHead className="w-12 text-center font-semibold text-[#002147]">
                  Rec.
                </TableHead>
                <TableHead className="w-12 text-center font-semibold text-[#002147]">
                  Env.
                </TableHead>
                <TableHead className="font-semibold text-[#002147]">
                  <EtiquetasComprasSortHeader
                    label="Prop."
                    columnKey="propietario"
                    sortKey={tableSort.key}
                    sortDir={tableSort.dir}
                    onSort={handleSortColumn}
                  />
                </TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-[#002147]">
                  <EtiquetasComprasSortHeader
                    label="F. pedido"
                    columnKey="fecha_pedido"
                    sortKey={tableSort.key}
                    sortDir={tableSort.dir}
                    onSort={handleSortColumn}
                    className="whitespace-nowrap"
                  />
                </TableHead>
                <TableHead className="whitespace-nowrap font-semibold text-[#002147]">
                  <EtiquetasComprasSortHeader
                    label="F. llegada"
                    columnKey="fecha_llegada"
                    sortKey={tableSort.key}
                    sortDir={tableSort.dir}
                    onSort={handleSortColumn}
                    className="whitespace-nowrap"
                  />
                </TableHead>
                <TableHead className="font-semibold text-[#002147]">
                  <EtiquetasComprasSortHeader
                    label="Equipo"
                    columnKey="equipo"
                    sortKey={tableSort.key}
                    sortDir={tableSort.dir}
                    onSort={handleSortColumn}
                  />
                </TableHead>
                <TableHead className="font-semibold text-[#002147]">
                  Tipo
                </TableHead>
                <TableHead className="font-semibold text-[#002147]">
                  <EtiquetasComprasSortHeader
                    label="Marca"
                    columnKey="marca"
                    sortKey={tableSort.key}
                    sortDir={tableSort.dir}
                    onSort={handleSortColumn}
                  />
                </TableHead>
                <TableHead className="font-semibold text-[#002147]">
                  Pri.
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradasOrdenadas.map((r, i) => (
                <TableRow
                  key={r.id}
                  className={cn(
                    i % 2 === 1 ? "bg-slate-50/50" : "bg-white",
                    "border-slate-100"
                  )}
                >
                  <TableCell className="w-9 px-1 text-center align-middle">
                    <input
                      type="checkbox"
                      className="size-3.5 cursor-pointer rounded border-slate-300 accent-[#002147]"
                      checked={selectedIds.has(r.id)}
                      aria-label={`Seleccionar ${r.producto}`}
                      onChange={() => toggleRowSelected(r.id)}
                    />
                  </TableCell>
                  <TableCell className="w-10 px-1 text-center align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-slate-600 hover:bg-slate-100"
                      aria-label="Ver historial de correo"
                      onClick={() => void openLogDialog(r.id)}
                    >
                      <Eye className="size-3.5" aria-hidden />
                    </Button>
                  </TableCell>
                  <TableCell className="w-10 px-1 text-center align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-[#002147] hover:bg-slate-100"
                      aria-label="Editar"
                      onClick={() => {
                        setEditingRow(r);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                  </TableCell>
                  <TableCell className="max-w-[14rem] font-medium text-[#002147]">
                    <span className="line-clamp-2" title={r.producto}>
                      {r.producto}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.unidad}
                  </TableCell>
                  <TableCell className="px-1 text-center align-middle">
                    <input
                      type="checkbox"
                      className="size-3.5 cursor-pointer rounded border-slate-300 accent-[#002147]"
                      checked={r.recibido}
                      title={r.recibido ? "Recibido" : "Pendiente"}
                      aria-label={`Recibido: ${r.producto}`}
                      onChange={(e) => {
                        void toggleRecibido(r, e.target.checked);
                      }}
                    />
                  </TableCell>
                  <TableCell
                    className="px-1 text-center align-middle tabular-nums text-[10px]"
                    title={
                      r.enviado && r.enviado_at
                        ? `Enviado ${fmtDate(r.enviado_at)}`
                        : r.enviado
                          ? "Enviado"
                          : "No enviado"
                    }
                  >
                    {r.enviado ? "Sí" : "—"}
                  </TableCell>
                  <TableCell>
                    {r.propietario === "RITA" ? "Rita" : "Hugo"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {fmtDate(r.fecha_pedido)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {fmtDate(r.fecha_llegada)}
                  </TableCell>
                  <TableCell className="max-w-[8rem] truncate" title={r.equipo}>
                    {r.equipo || "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-[10px] text-slate-700">
                    {r.tipo_linea}
                  </TableCell>
                  <TableCell className="max-w-[8rem] truncate">{r.marca}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.prioridad === "ALTA"
                      ? "Alta"
                      : r.prioridad === "BAJA"
                        ? "Baja"
                        : "Media"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
