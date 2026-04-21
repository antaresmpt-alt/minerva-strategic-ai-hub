"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AuditLogRow = {
  id: string;
  tabla_afectada: string;
  accion: string;
  registro_id: string | null;
  detalle: string | null;
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
};

const PAGE_SIZE = 50;

export function LogsTab() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [accion, setAccion] = useState("");
  const [tabla, setTabla] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("pageSize", String(PAGE_SIZE));
      if (q.trim()) sp.set("q", q.trim());
      if (accion) sp.set("accion", accion);
      if (tabla) sp.set("tabla", tabla);
      if (from) sp.set("from", from);
      if (to) sp.set("to", `${to}T23:59:59.999Z`);

      const res = await fetch(`/api/admin/logs?${sp.toString()}`);
      const data = (await res.json()) as {
        rows?: AuditLogRow[];
        total?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "No se pudieron cargar los logs.");
        setRows([]);
        setTotal(0);
        return;
      }
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("Error de red al cargar logs.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [accion, from, page, q, tabla, to]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const accionOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.accion).filter(Boolean));
    return [
      { value: "", label: "Todas" },
      ...[...set].sort().map((a) => ({ value: a, label: a })),
    ];
  }, [rows]);

  const tablaOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.tabla_afectada).filter(Boolean));
    return [
      { value: "", label: "Todas" },
      ...[...set].sort().map((t) => ({ value: t, label: t })),
    ];
  }, [rows]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Auditoría de acciones en la app (borrados, etc.). Ordenado por fecha
        descendente.
      </p>

      <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Label htmlFor="logs-q">Buscar</Label>
          <Input
            id="logs-q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="actor, registro, detalle…"
            className="h-9"
          />
        </div>
        <NativeSelect
          label="Acción"
          options={accionOptions}
          value={accion}
          onChange={(e) => setAccion(e.target.value)}
          className="h-9"
        />
        <NativeSelect
          label="Tabla"
          options={tablaOptions}
          value={tabla}
          onChange={(e) => setTabla(e.target.value)}
          className="h-9"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="logs-from">Desde</Label>
            <Input
              id="logs-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <Label htmlFor="logs-to">Hasta</Label>
            <Input
              id="logs-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setPage(1);
            void loadLogs();
          }}
          disabled={loading}
        >
          Aplicar filtros
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setQ("");
            setAccion("");
            setTabla("");
            setFrom("");
            setTo("");
            setPage(1);
          }}
          disabled={loading}
        >
          Limpiar
        </Button>
        <span className="text-xs text-muted-foreground">
          {total} registro(s)
        </span>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Tabla</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Cargando logs…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Sin resultados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(r.created_at).toLocaleString("es-ES")}
                  </TableCell>
                  <TableCell className="font-medium">{r.accion}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.tabla_afectada}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.registro_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.actor_email ?? r.actor_id ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[34rem] whitespace-pre-wrap text-xs leading-snug">
                    {r.detalle ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {page} de {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}

