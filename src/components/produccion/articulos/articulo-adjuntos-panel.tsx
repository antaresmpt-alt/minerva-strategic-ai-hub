"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  ADJUNTO_ACCEPT,
  ADJUNTO_HINT,
  isImageStoragePath,
  isPdfStoragePath,
  publicUrlForStoragePath,
  removeReferenciaAdjunto,
  uploadReferenciaAdjunto,
  type ReferenciaAdjuntoTipo,
} from "@/lib/prod-referencia-adjuntos";

type SlotProps = {
  referenciaId: string;
  codigo: string;
  tipo: ReferenciaAdjuntoTipo;
  label: string;
  hint: string;
  accept: string;
  path: string | null;
  onPathChange: (path: string | null) => void;
  canRemove?: boolean;
};

function AdjuntoSlot({
  referenciaId,
  codigo,
  tipo,
  label,
  hint,
  accept,
  path,
  onPathChange,
  canRemove = true,
}: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createSupabaseBrowserClient();
  const [busy, setBusy] = useState(false);

  const url = path
    ? path.startsWith("http")
      ? path
      : publicUrlForStoragePath(supabase, path)
    : null;

  const onPick = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setBusy(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const res = await uploadReferenciaAdjunto(supabase, {
          referenciaId,
          codigo,
          tipo,
          file,
          userId: user?.id ?? null,
        });
        onPathChange(res.storagePath);
        toast.success(`${label} subido`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error subiendo archivo");
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [codigo, label, onPathChange, referenciaId, supabase, tipo],
  );

  const onRemove = useCallback(async () => {
    if (!path) return;
    if (!window.confirm(`¿Quitar ${label.toLowerCase()}?`)) return;
    setBusy(true);
    try {
      await removeReferenciaAdjunto(supabase, { referenciaId, tipo });
      onPathChange(null);
      toast.success(`${label} eliminado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  }, [label, onPathChange, path, referenciaId, supabase, tipo]);

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-slate-700">{label}</Label>
        {busy ? <Loader2 className="size-3.5 animate-spin text-slate-400" /> : null}
      </div>
      <p className="mb-2 text-[10px] text-slate-400">{hint}</p>
      {path ? (
        <div className="mb-2 space-y-1.5">
          <p className="truncate font-mono text-[10px] text-slate-500" title={path}>
            {path}
            {isPdfStoragePath(path) ? " · PDF" : isImageStoragePath(path) ? " · imagen" : ""}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 rounded-md border border-input bg-background px-2 text-[11px] hover:bg-accent"
              >
                <ExternalLink className="size-3" />
                Abrir
              </a>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <FileUp className="size-3" />
              Sustituir
            </Button>
            {canRemove ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-[11px] text-red-600"
                disabled={busy}
                onClick={() => void onRemove()}
              >
                <Trash2 className="size-3" />
                Quitar
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="size-3.5" />
          Subir archivo
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
    </div>
  );
}

export function ArticuloAdjuntosPanel({
  referenciaId,
  codigo,
  fotoProductoPath,
  fotoTroquelPath,
  onFotoProductoChange,
  onFotoTroquelChange,
}: {
  referenciaId: string | null;
  codigo: string;
  fotoProductoPath: string | null;
  fotoTroquelPath: string | null;
  onFotoProductoChange: (path: string | null) => void;
  onFotoTroquelChange: (path: string | null) => void;
}) {
  if (!referenciaId) {
    return (
      <p className="text-[11px] text-slate-500">
        Guarda el artículo primero para poder subir adjuntos (foto producto o
        perfil de troquel: PDF, JPG, PNG, BMP…).
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <AdjuntoSlot
        referenciaId={referenciaId}
        codigo={codigo}
        tipo="foto_producto"
        label="Foto producto"
        hint={ADJUNTO_HINT}
        accept={ADJUNTO_ACCEPT}
        path={fotoProductoPath}
        onPathChange={onFotoProductoChange}
      />
      <AdjuntoSlot
        referenciaId={referenciaId}
        codigo={codigo}
        tipo="perfil_troquel"
        label="Troquel / perfil"
        hint={ADJUNTO_HINT}
        accept={ADJUNTO_ACCEPT}
        path={fotoTroquelPath}
        onPathChange={onFotoTroquelChange}
      />
    </div>
  );
}
