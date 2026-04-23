"use client";

import { Loader2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  TABLE_PROD_CONFIGURACION,
  TEMPLATE_OPTIMUS_EXTRACTION_MODE_DEFAULT,
  TEMPLATE_OPTIMUS_REGEX_RULES,
} from "@/lib/email-plantillas-produccion";
import { fuzzyMatchBestIdByScore } from "@/lib/externos-fuzzy-match";
import {
  PRIORIDAD_NORMAL,
  PRIORIDAD_URGENTE,
  parseDateLikeToYmd,
  prioridadSugeridaDesdeTexto,
  splitOptimusReferencia5Plus2,
} from "@/lib/externos-optimus-import";
import { GLOBAL_MODEL_IDS, type GlobalModelId } from "@/lib/global-model";
import {
  DEFAULT_OPTIMUS_REGEX_RULES,
  safeParseOptimusRegexRules,
  type OptimusExtractionMode,
  type OptimusRegexRules,
} from "@/lib/optimus-regex-rules";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ProveedorRow = { id: string; nombre: string };
type AcabadoRow = { id: string; nombre: string };
type OtGeneralRow = { num_pedido: string; cliente: string | null };
type ExtractedRow = {
  referencia: string;
  ot_raw: string;
  id_pedido: number;
  num_operacion: number;
  proveedor_nombre_detectado: string;
  trabajo_titulo: string;
  unidades: number | null;
  fecha_envio: string;
  fecha_prevista: string;
  observaciones: string | null;
  raw_text?: string | null;
  prioridad_sugerida: string;
};

type ReanalyzePatch = {
  trabajo_titulo: string;
  observaciones: string;
  fecha_envio: string;
  fecha_prevista: string;
  unidades: string;
  prioridad: string;
  proveedor_id: string;
  acabado_id: string;
  source_text: string;
};

type AiChangedField =
  | "trabajo_titulo"
  | "observaciones"
  | "fecha_envio"
  | "fecha_prevista"
  | "unidades"
  | "prioridad"
  | "proveedor_id"
  | "acabado_id";

type DraftRow = {
  key: string;
  selected: boolean;
  referencia: string;
  ot_raw: string;
  id_pedido: number;
  num_operacion: number;
  cliente_nombre: string;
  trabajo_titulo: string;
  proveedor_nombre_detectado: string;
  proveedor_id: string;
  acabado_id: string;
  unidades: string;
  fecha_envio: string;
  fecha_prevista: string;
  prioridad: string;
  observaciones: string;
  source_text: string;
};

function dateInputToTimestamptz(ymd: string): string | null {
  const t = ymd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [y, m, d] = t.split("-").map(Number);
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function isBlankValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return !Number.isFinite(v);
  return false;
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyAlias(input: string, aliases: Record<string, string>): string {
  const k = normalizeKey(input);
  for (const [from, to] of Object.entries(aliases)) {
    if (k.includes(normalizeKey(from))) return to;
  }
  return input;
}

function buildRegexList(patterns: string[]): RegExp[] {
  return patterns
    .map((p) => {
      try {
        return new RegExp(p, "im");
      } catch {
        return null;
      }
    })
    .filter((x): x is RegExp => x != null);
}

function firstCaptured(text: string, patterns: string[]): string {
  for (const re of buildRegexList(patterns)) {
    const m = text.match(re);
    const v = m?.[1] ?? "";
    if (v.trim()) return v.trim();
  }
  return "";
}

function extractReferencesByRules(text: string, rules: OptimusRegexRules): string[] {
  const raw = firstCaptured(text, rules.referenciaPatterns);
  if (!raw) return [];
  return raw
    .split(/[\/,;|]+/g)
    .map((x) => x.replace(/\D/g, "").trim())
    .filter((x) => x.length >= 5);
}

function inferTrabajoTitulo(text: string): string {
  const otParen = text.match(/O\/T:\s*\d+\s*\(([^)]+)\)/i)?.[1]?.trim() ?? "";
  if (otParen && !/(presupuesto|núm|num)/i.test(otParen)) return otParen;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const ln of lines) {
    if (ln.length < 12) continue;
    if (/^(dir\.|pagina|data|comprador|refer[eè]ncia)/i.test(ln)) continue;
    if (/\d{3,}.*[a-zA-Z]/.test(ln) || /[a-zA-Z].*\d{3,}/.test(ln)) return ln;
  }
  return "";
}

function extractRowsWithRules(fileText: string, rules: OptimusRegexRules): ExtractedRow[] {
  const text = String(fileText ?? "");
  const refs = extractReferencesByRules(text, rules);
  if (refs.length === 0) return [];
  const proveedorRaw =
    firstCaptured(text, rules.proveedorPatterns) ||
    text.split(/\r?\n/).map((x) => x.trim()).find((x) => x.length > 2) ||
    "";
  const proveedorNombre = applyAlias(proveedorRaw, rules.proveedorAliases);
  const trabajo = inferTrabajoTitulo(text);
  const acabadoRaw = firstCaptured(text, rules.acabadoPatterns);
  const acabadoAlias = applyAlias(acabadoRaw, rules.acabadoAliases);
  const oc = (text.match(/Ordre\s+de\s+Compra\s*:\s*([0-9]+)/i)?.[1] ?? "").trim();
  const comprador = (text.match(/Comprador\s*:\s*([^\n\r]+)/i)?.[1] ?? "").trim();
  const unidadesRaw = firstCaptured(text, rules.unidadesPatterns).replace(/\./g, "");
  const unidades = Number.isFinite(Number(unidadesRaw))
    ? Math.trunc(Number(unidadesRaw))
    : null;
  const fechaEnvio = parseDateLikeToYmd(firstCaptured(text, rules.fechaEnvioPatterns));
  const fechaPrev = parseDateLikeToYmd(firstCaptured(text, rules.fechaPrevistaPatterns));
  const today = new Date();
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(today.getDate()).padStart(2, "0")}`;
  const envio = fechaEnvio || todayYmd;
  const prevista = fechaPrev || envio;
  const observaciones = `OC-${oc || "00000"} | Comprador: ${comprador || "N/D"} | ${
    acabadoAlias || "N/D"
  }`;
  return refs
    .map((r) => {
      const split = splitOptimusReferencia5Plus2(r);
      if (!split) return null;
      return {
        referencia: r,
        ot_raw: split.ot,
        id_pedido: split.idPedido,
        num_operacion: split.numOperacion,
        proveedor_nombre_detectado: proveedorNombre,
        trabajo_titulo: trabajo,
        unidades,
        fecha_envio: envio,
        fecha_prevista: prevista,
        observaciones,
        raw_text: text,
        prioridad_sugerida: prioridadSugeridaDesdeTexto(text),
      };
    })
    .filter((x): x is ExtractedRow => x != null);
}

export function ImportacionOptimusTab() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [proveedores, setProveedores] = useState<ProveedorRow[]>([]);
  const [acabados, setAcabados] = useState<AcabadoRow[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzingRowKeys, setReanalyzingRowKeys] = useState<string[]>([]);
  const [reanalyzeOnlyFillEmpty, setReanalyzeOnlyFillEmpty] = useState(true);
  const [aiChangedByRow, setAiChangedByRow] = useState<
    Record<string, AiChangedField[]>
  >({});
  const [extractionMode, setExtractionMode] =
    useState<OptimusExtractionMode>("rules");
  const [modelId, setModelId] = useState<GlobalModelId>("gemini-1.5-flash");
  const [rulesCfg, setRulesCfg] = useState<OptimusRegexRules>(
    DEFAULT_OPTIMUS_REGEX_RULES
  );
  const fileRef = useRef<HTMLInputElement>(null);

  function markAiChanged(rowKey: string, fields: AiChangedField[]) {
    if (fields.length === 0) return;
    setAiChangedByRow((prev) => {
      const curr = prev[rowKey] ?? [];
      const next = [...new Set([...curr, ...fields])];
      return { ...prev, [rowKey]: next };
    });
  }

  function clearAiChangedField(rowKey: string, field: AiChangedField) {
    setAiChangedByRow((prev) => {
      const curr = prev[rowKey] ?? [];
      if (!curr.includes(field)) return prev;
      const next = curr.filter((f) => f !== field);
      if (next.length === 0) {
        const clone = { ...prev };
        delete clone[rowKey];
        return clone;
      }
      return { ...prev, [rowKey]: next };
    });
  }

  function isAiChanged(rowKey: string, field: AiChangedField): boolean {
    return (aiChangedByRow[rowKey] ?? []).includes(field);
  }

  function aiChangedCellClass(rowKey: string, field: AiChangedField): string {
    return isAiChanged(rowKey, field)
      ? "bg-amber-50 transition-colors duration-1000 dark:bg-amber-900/20"
      : "";
  }

  async function loadCatalogs() {
    const [{ data: provs, error: provErr }, { data: acabs, error: acabErr }] =
      await Promise.all([
        supabase.from("prod_proveedores").select("id,nombre"),
        supabase.from("prod_cat_acabados").select("id,nombre"),
      ]);
    if (provErr) throw provErr;
    if (acabErr) throw acabErr;
    return {
      proveedores: (provs ?? []) as ProveedorRow[],
      acabados: (acabs ?? []) as AcabadoRow[],
    };
  }

  async function loadImportSettings(): Promise<{
    rules: OptimusRegexRules;
    mode: OptimusExtractionMode;
  }> {
    const { data, error } = await supabase
      .from(TABLE_PROD_CONFIGURACION)
      .select("clave,valor")
      .in("clave", [
        TEMPLATE_OPTIMUS_REGEX_RULES,
        TEMPLATE_OPTIMUS_EXTRACTION_MODE_DEFAULT,
      ]);
    if (error) throw error;
    const rows = (data ?? []) as Array<{ clave?: string; valor?: string | null }>;
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.clave) map.set(r.clave, String(r.valor ?? ""));
    }
    const parsedRules = safeParseOptimusRegexRules(
      map.get(TEMPLATE_OPTIMUS_REGEX_RULES)
    );
    const mode = (map.get(TEMPLATE_OPTIMUS_EXTRACTION_MODE_DEFAULT) ?? "")
      .trim()
      .toLowerCase();
    const parsedMode: OptimusExtractionMode = mode === "ai" ? "ai" : "rules";
    setExtractionMode(parsedMode);
    setRulesCfg(parsedRules);
    return { rules: parsedRules, mode: parsedMode };
  }

  async function enrichDraftRows(
    extracted: ExtractedRow[],
    proveedores: ProveedorRow[],
    acabados: AcabadoRow[],
    rules: OptimusRegexRules
  ): Promise<DraftRow[]> {
    const otKeys = [...new Set(extracted.map((r) => r.ot_raw).filter(Boolean))];
    let clienteByOt = new Map<string, string>();
    if (otKeys.length > 0) {
      const { data: otsData, error: otErr } = await supabase
        .from("prod_ots_general")
        .select("num_pedido,cliente")
        .in("num_pedido", otKeys);
      if (otErr) throw otErr;
      clienteByOt = new Map(
        ((otsData ?? []) as OtGeneralRow[]).map((r) => [
          String(r.num_pedido ?? "").trim(),
          String(r.cliente ?? "").trim(),
        ])
      );
    }
    return extracted.map((r) => {
      const proveedorNeedle = applyAlias(
        r.proveedor_nombre_detectado,
        rules.proveedorAliases
      );
      const proveedorMatch = proveedorNeedle
        ? fuzzyMatchBestIdByScore(proveedorNeedle, proveedores)
        : { id: "", score: 0 };
      const proveedor_id =
        proveedorMatch.score >= rules.autoMatchThreshold ? proveedorMatch.id : "";
      const acabadoNeedle = applyAlias(
        `${r.trabajo_titulo ?? ""} ${r.observaciones ?? ""}`.trim(),
        rules.acabadoAliases
      );
      const acabadoMatch = acabadoNeedle
        ? fuzzyMatchBestIdByScore(acabadoNeedle, acabados)
        : { id: "", score: 0 };
      const acabado_id =
        acabadoMatch.score >= rules.autoMatchThreshold ? acabadoMatch.id : "";
      const prioridad =
        String(r.prioridad_sugerida ?? "").trim() === PRIORIDAD_URGENTE
          ? PRIORIDAD_URGENTE
          : PRIORIDAD_NORMAL;
      return {
        key: crypto.randomUUID(),
        selected: true,
        referencia: r.referencia,
        ot_raw: r.ot_raw,
        id_pedido: r.id_pedido,
        num_operacion: r.num_operacion,
        cliente_nombre: clienteByOt.get(r.ot_raw) ?? "",
        trabajo_titulo: r.trabajo_titulo ?? "",
        proveedor_nombre_detectado: r.proveedor_nombre_detectado ?? "",
        proveedor_id,
        acabado_id,
        unidades: r.unidades == null ? "" : String(r.unidades),
        fecha_envio: r.fecha_envio ?? "",
        fecha_prevista: r.fecha_prevista ?? "",
        prioridad,
        observaciones: r.observaciones ?? "",
        source_text: String(r.raw_text ?? "").trim(),
      };
    });
  }

  async function extractWithAi(files: File[]): Promise<ExtractedRow[]> {
    const payload = await Promise.all(
      files.map(async (f) => ({ filename: f.name, text: await f.text() }))
    );
    const res = await fetch("/api/gemini/produccion-externos-optimus-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: payload, model: modelId }),
    });
    const data = (await res.json()) as { error?: string; rows?: ExtractedRow[] };
    if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
    return Array.isArray(data.rows) ? data.rows : [];
  }

  async function parseFiles(files: File[]) {
    if (files.length === 0) return;
    const txtFiles = files.filter((f) => f.name.toLowerCase().endsWith(".txt"));
    if (txtFiles.length === 0) {
      toast.error("Selecciona al menos un archivo .txt");
      return;
    }
    setLoading(true);
    try {
      const [{ proveedores, acabados }, settings] = await Promise.all([
        loadCatalogs(),
        loadImportSettings(),
      ]);
      setProveedores(proveedores);
      setAcabados(acabados);
      let extracted: ExtractedRow[] = [];
      const effectiveMode = extractionMode ?? settings.mode;
      if (effectiveMode === "ai") {
        try {
          extracted = await extractWithAi(txtFiles);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/503|high demand|saturad/i.test(msg)) {
            const fallback = window.confirm(
              "La IA está saturada. ¿Quieres procesar con reglas manuales?"
            );
            if (fallback) {
              const buffers = await Promise.all(txtFiles.map((f) => f.text()));
              extracted = buffers.flatMap((t) => extractRowsWithRules(t, settings.rules));
            } else {
              throw e;
            }
          } else {
            throw e;
          }
        }
      } else {
        const buffers = await Promise.all(txtFiles.map((f) => f.text()));
        extracted = buffers.flatMap((t) => extractRowsWithRules(t, settings.rules));
      }
      if (extracted.length === 0) {
        toast.error("No se extrajeron filas válidas de los .txt.");
        return;
      }
      const draftRows = await enrichDraftRows(
        extracted,
        proveedores,
        acabados,
        settings.rules
      );

      setRows((prev) => [...prev, ...draftRows]);
      setAiChangedByRow({});
      toast.success(`${draftRows.length} fila(s) añadidas al borrador.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al procesar archivos");
    } finally {
      setLoading(false);
    }
  }

  async function reanalyzeSelectedWithAi() {
    const targets = rows.filter((r) => r.selected);
    if (targets.length === 0) {
      toast.error("Selecciona al menos una fila para reanalizar.");
      return;
    }
    setReanalyzing(true);
    try {
      const { proveedores, acabados } = await loadCatalogs();
      const updates = await Promise.all(
        targets.map(async (row) => {
          setReanalyzingRowKeys((prev) =>
            prev.includes(row.key) ? prev : [...prev, row.key]
          );
          const fallbackText = [
            `OT: ${row.ot_raw}`,
            `Proveedor: ${row.proveedor_nombre_detectado}`,
            `Trabajo: ${row.trabajo_titulo}`,
            `Observaciones: ${row.observaciones}`,
            `Unidades: ${row.unidades}`,
          ].join("\n");
          const text = row.source_text?.trim() || fallbackText;
          const res = await fetch("/api/gemini/produccion-externos-optimus-import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: modelId,
              files: [{ filename: `reanalyze-${row.key}.txt`, text }],
            }),
          });
          const data = (await res.json()) as { error?: string; rows?: ExtractedRow[] };
          if (!res.ok) {
            throw new Error(data.error ?? `Error ${res.status}`);
          }
          const candidates = Array.isArray(data.rows) ? data.rows : [];
          if (candidates.length === 0) return { key: row.key, patch: null as null };
          const picked =
            candidates.find((c) => c.ot_raw === row.ot_raw) ??
            candidates.find((c) => c.id_pedido === row.id_pedido) ??
            candidates[0]!;
          const proveedorNeedle = applyAlias(
            picked.proveedor_nombre_detectado ?? "",
            rulesCfg.proveedorAliases
          );
          const provMatch = proveedorNeedle
            ? fuzzyMatchBestIdByScore(proveedorNeedle, proveedores)
            : { id: "", score: 0 };
          const acabadoNeedle = applyAlias(
            `${picked.trabajo_titulo ?? ""} ${picked.observaciones ?? ""}`.trim(),
            rulesCfg.acabadoAliases
          );
          const acabMatch = acabadoNeedle
            ? fuzzyMatchBestIdByScore(acabadoNeedle, acabados)
            : { id: "", score: 0 };
          const patch: ReanalyzePatch = {
            trabajo_titulo: picked.trabajo_titulo || row.trabajo_titulo,
            observaciones: picked.observaciones || row.observaciones,
            fecha_envio: picked.fecha_envio || row.fecha_envio,
            fecha_prevista: picked.fecha_prevista || row.fecha_prevista,
            unidades: picked.unidades == null ? row.unidades : String(picked.unidades),
            prioridad:
              picked.prioridad_sugerida === PRIORIDAD_URGENTE
                ? PRIORIDAD_URGENTE
                : PRIORIDAD_NORMAL,
            proveedor_id:
              provMatch.score >= rulesCfg.autoMatchThreshold
                ? provMatch.id
                : row.proveedor_id,
            acabado_id:
              acabMatch.score >= rulesCfg.autoMatchThreshold
                ? acabMatch.id
                : row.acabado_id,
            source_text: picked.raw_text?.trim() || row.source_text,
          };
          return {
            key: row.key,
            patch,
          };
        }).map(async (job, idx) => {
          try {
            return await job;
          } finally {
            const key = targets[idx]?.key;
            if (key) {
              setReanalyzingRowKeys((prev) => prev.filter((k) => k !== key));
            }
          }
        })
      );
      const patchByKey = new Map(
        updates
          .filter((u) => u.patch != null)
          .map((u) => [u.key, u.patch] as const)
      );
      let updatedCount = 0;
      const changedMap = new Map<string, AiChangedField[]>();
      setRows((prev) =>
        prev.map((r) => {
          const p = patchByKey.get(r.key);
          if (!p) return r;
          if (!reanalyzeOnlyFillEmpty) {
            const changedFields: AiChangedField[] = [];
            const changed = Object.entries(p).some(([k, v]) => {
              const current = (r as Record<string, unknown>)[k];
              const didChange = String(current ?? "") !== String(v ?? "");
              if (
                didChange &&
                (k === "trabajo_titulo" ||
                  k === "observaciones" ||
                  k === "fecha_envio" ||
                  k === "fecha_prevista" ||
                  k === "unidades" ||
                  k === "prioridad" ||
                  k === "proveedor_id" ||
                  k === "acabado_id")
              ) {
                changedFields.push(k);
              }
              return didChange;
            });
            if (changed) updatedCount += 1;
            if (changedFields.length > 0) {
              changedMap.set(r.key, [...new Set(changedFields)]);
            }
            return { ...r, ...p };
          }
          const merged: DraftRow = { ...r };
          let changed = false;
          const changedFields: AiChangedField[] = [];
          (Object.keys(p) as Array<keyof ReanalyzePatch>).forEach((k) => {
            const current = merged[k as keyof DraftRow];
            const incoming = p[k];
            if (isBlankValue(current) && !isBlankValue(incoming)) {
              (merged as Record<string, unknown>)[k] = incoming;
              changed = true;
              if (
                k === "trabajo_titulo" ||
                k === "observaciones" ||
                k === "fecha_envio" ||
                k === "fecha_prevista" ||
                k === "unidades" ||
                k === "prioridad" ||
                k === "proveedor_id" ||
                k === "acabado_id"
              ) {
                changedFields.push(k);
              }
            }
          });
          if (changed) updatedCount += 1;
          if (changedFields.length > 0) {
            changedMap.set(r.key, [...new Set(changedFields)]);
          }
          return merged;
        })
      );
      if (changedMap.size > 0) {
        for (const [k, fields] of changedMap.entries()) {
          markAiChanged(k, fields);
        }
      }
      const unchanged = targets.length - updatedCount;
      toast.success(
        `Reanalizadas ${targets.length} fila(s): ${updatedCount} actualizadas, ${unchanged} sin cambios.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reanalizar.");
    } finally {
      setReanalyzing(false);
      setReanalyzingRowKeys([]);
    }
  }

  useEffect(() => {
    void loadImportSettings().catch(() => {
      /* defaults locales */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirmImport() {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) {
      toast.error("Selecciona al menos una fila para importar.");
      return;
    }
    const invalid = selected.filter(
      (r) =>
        !r.ot_raw.trim() ||
        !Number.isFinite(r.id_pedido) ||
        !Number.isFinite(r.num_operacion) ||
        !r.trabajo_titulo.trim() ||
        !r.proveedor_id ||
        !r.acabado_id
    );
    if (invalid.length > 0) {
      toast.error(
        "Revisa OT/Op/Trabajo/Proveedor/Acabado en las filas seleccionadas."
      );
      return;
    }
    setSaving(true);
    try {
      const payload = selected.map((r) => {
        const unidadesN = Number(r.unidades.trim().replace(",", "."));
        return {
          id_pedido: r.id_pedido,
          OT: r.ot_raw.trim(),
          num_operacion: Math.trunc(r.num_operacion),
          cliente_nombre: r.cliente_nombre.trim() || null,
          trabajo_titulo: r.trabajo_titulo.trim(),
          proveedor_id: r.proveedor_id,
          acabado_id: r.acabado_id,
          unidades: Number.isFinite(unidadesN) ? Math.trunc(unidadesN) : null,
          fecha_envio: dateInputToTimestamptz(r.fecha_envio),
          fecha_prevista: dateInputToTimestamptz(r.fecha_prevista),
          prioridad: r.prioridad.trim() || PRIORIDAD_NORMAL,
          observaciones: r.observaciones.trim() || null,
          estado: "Pendiente",
        };
      });
      const { error } = await supabase.from("prod_seguimiento_externos").insert(payload);
      if (error) throw error;
      const imported = new Set(selected.map((r) => r.key));
      setRows((prev) => prev.filter((r) => !imported.has(r.key)));
      setAiChangedByRow({});
      toast.success(`Importadas ${payload.length} fila(s) a Seguimiento.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg text-[#002147]">Importación Optimus</CardTitle>
        <CardDescription>
          Arrastra varios <code>.txt</code>, revisa el borrador editable y confirma la
          importación a <code>prod_seguimiento_externos</code>.
        </CardDescription>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">
              Modo extracción
            </label>
            <select
              className="h-9 w-full rounded border bg-background px-2 text-sm"
              value={extractionMode}
              onChange={(e) =>
                setExtractionMode(
                  e.target.value === "ai" ? "ai" : "rules"
                )
              }
              disabled={loading}
            >
              <option value="rules">Reglas (sin IA)</option>
              <option value="ai">IA</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Modelo IA</label>
            <select
              className="h-9 w-full rounded border bg-background px-2 text-sm"
              value={modelId}
              onChange={(e) =>
                setModelId((e.target.value as GlobalModelId) ?? "gemini-1.5-flash")
              }
              disabled={loading || extractionMode !== "ai"}
            >
              {GLOBAL_MODEL_IDS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".txt,text/plain"
          className="hidden"
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            void parseFiles(list);
            e.target.value = "";
          }}
        />
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const list = Array.from(e.dataTransfer.files ?? []);
            void parseFiles(list);
          }}
          className="rounded-lg border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center"
        >
          <UploadCloud className="mx-auto mb-2 size-6 text-slate-500" aria-hidden />
          <p className="text-sm text-slate-700">
            Arrastra aquí múltiples <strong>.txt</strong> de Optimus
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
            Seleccionar archivos
          </Button>
        </div>

        {rows.length > 0 ? (
          <>
            <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
              <Table className="min-w-[84rem] text-xs">
                <TableHeader>
                  <TableRow className="bg-slate-50/90">
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        checked={rows.every((r) => r.selected)}
                        onChange={(e) =>
                          setRows((prev) => prev.map((r) => ({ ...r, selected: e.target.checked })))
                        }
                      />
                    </TableHead>
                    <TableHead>OT</TableHead>
                    <TableHead>Op</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Trabajo</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Acabado</TableHead>
                    <TableHead>Unidades</TableHead>
                    <TableHead>Fecha envío</TableHead>
                    <TableHead>Fecha prevista</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key ? { ...r, selected: e.target.checked } : r
                                )
                              )
                            }
                          />
                          {reanalyzingRowKeys.includes(row.key) ? (
                            <Loader2 className="size-3 animate-spin text-slate-500" aria-hidden />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-7 w-28 min-w-[7rem] font-mono"
                          value={row.ot_raw ?? ""}
                          placeholder="OT"
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.key === row.key
                                  ? {
                                      ...r,
                                      ot_raw: e.target.value,
                                      id_pedido:
                                        Number(
                                          e.target.value.replace(/\D/g, "").slice(0, 5)
                                        ) || r.id_pedido,
                                    }
                                  : r
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-7 w-16"
                          value={String(row.num_operacion)}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.key === row.key
                                  ? { ...r, num_operacion: Number(e.target.value) || 1 }
                                  : r
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-7 min-w-[12rem]"
                          value={row.cliente_nombre}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r) =>
                                r.key === row.key ? { ...r, cliente_nombre: e.target.value } : r
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className={`h-7 min-w-[14rem] ${aiChangedCellClass(row.key, "trabajo_titulo")}`}
                          value={row.trabajo_titulo}
                          title={
                            isAiChanged(row.key, "trabajo_titulo")
                              ? "Este valor ha sido extraído por la IA"
                              : undefined
                          }
                          onChange={(e) =>
                            {
                              clearAiChangedField(row.key, "trabajo_titulo");
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key
                                    ? { ...r, trabajo_titulo: e.target.value }
                                    : r
                                )
                              );
                            }
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className={`h-7 min-w-[12rem] rounded border bg-background px-2 ${aiChangedCellClass(row.key, "proveedor_id")}`}
                          value={row.proveedor_id}
                          title={
                            isAiChanged(row.key, "proveedor_id")
                              ? "Este valor ha sido extraído por la IA"
                              : undefined
                          }
                          onChange={(e) =>
                            {
                              clearAiChangedField(row.key, "proveedor_id");
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key
                                    ? { ...r, proveedor_id: e.target.value }
                                    : r
                                )
                              );
                            }
                          }
                        >
                          <option value="">—</option>
                          {proveedores.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select
                          className={`h-7 min-w-[12rem] rounded border bg-background px-2 ${aiChangedCellClass(row.key, "acabado_id")}`}
                          value={row.acabado_id}
                          title={
                            isAiChanged(row.key, "acabado_id")
                              ? "Este valor ha sido extraído por la IA"
                              : undefined
                          }
                          onChange={(e) =>
                            {
                              clearAiChangedField(row.key, "acabado_id");
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key
                                    ? { ...r, acabado_id: e.target.value }
                                    : r
                                )
                              );
                            }
                          }
                        >
                          <option value="">—</option>
                          {acabados.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nombre}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className={`h-7 w-24 ${aiChangedCellClass(row.key, "unidades")}`}
                          value={row.unidades}
                          title={
                            isAiChanged(row.key, "unidades")
                              ? "Este valor ha sido extraído por la IA"
                              : undefined
                          }
                          onChange={(e) =>
                            {
                              clearAiChangedField(row.key, "unidades");
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key ? { ...r, unidades: e.target.value } : r
                                )
                              );
                            }
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          className={`h-7 min-w-[9rem] ${aiChangedCellClass(row.key, "fecha_envio")}`}
                          value={row.fecha_envio}
                          title={
                            isAiChanged(row.key, "fecha_envio")
                              ? "Este valor ha sido extraído por la IA"
                              : undefined
                          }
                          onChange={(e) =>
                            {
                              clearAiChangedField(row.key, "fecha_envio");
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key
                                    ? { ...r, fecha_envio: e.target.value }
                                    : r
                                )
                              );
                            }
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="date"
                          className={`h-7 min-w-[9rem] ${aiChangedCellClass(row.key, "fecha_prevista")}`}
                          value={row.fecha_prevista}
                          title={
                            isAiChanged(row.key, "fecha_prevista")
                              ? "Este valor ha sido extraído por la IA"
                              : undefined
                          }
                          onChange={(e) =>
                            {
                              clearAiChangedField(row.key, "fecha_prevista");
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key
                                    ? { ...r, fecha_prevista: e.target.value }
                                    : r
                                )
                              );
                            }
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className={`h-7 min-w-[8rem] rounded border bg-background px-2 ${aiChangedCellClass(row.key, "prioridad")}`}
                          value={row.prioridad}
                          title={
                            isAiChanged(row.key, "prioridad")
                              ? "Este valor ha sido extraído por la IA"
                              : undefined
                          }
                          onChange={(e) =>
                            {
                              clearAiChangedField(row.key, "prioridad");
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key ? { ...r, prioridad: e.target.value } : r
                                )
                              );
                            }
                          }
                        >
                          <option value="Urgente">Urgente</option>
                          <option value="Normal">Normal</option>
                          <option value="Programado">Programado</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <Textarea
                          className={`min-h-[2rem] min-w-[14rem] text-[11px] ${aiChangedCellClass(row.key, "observaciones")}`}
                          value={row.observaciones}
                          title={
                            isAiChanged(row.key, "observaciones")
                              ? "Este valor ha sido extraído por la IA"
                              : undefined
                          }
                          onChange={(e) =>
                            {
                              clearAiChangedField(row.key, "observaciones");
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.key === row.key
                                    ? { ...r, observaciones: e.target.value }
                                    : r
                                )
                              );
                            }
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void confirmImport()} disabled={saving}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
                Confirmar e Importar Selección
              </Button>
              <label className="inline-flex items-center gap-2 rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={reanalyzeOnlyFillEmpty}
                  onChange={(e) => setReanalyzeOnlyFillEmpty(e.target.checked)}
                  disabled={saving || reanalyzing}
                />
                Solo rellenar campos vacíos
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void reanalyzeSelectedWithAi()}
                disabled={saving || reanalyzing}
              >
                {reanalyzing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : null}
                Reanalizar selección con IA
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRows([]);
                  setAiChangedByRow({});
                }}
                disabled={saving}
              >
                Limpiar borrador
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

