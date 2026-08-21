"use client";

/**
 * Bloque 9.8.6 — Redespacho asistido (MVP).
 * Tras asignar cartela libre → OT, ofrece abrir el lápiz de despacho
 * (forceMode) a roles oficina/admin/gerencia. Sin merge automático aún.
 */

import { useEffect, useState } from "react";

import { DespachoWizardDialog } from "@/components/produccion/ots/despacho-wizard-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Mismo set que ROLES_FORZADO del wizard / liberar STOP. */
export const ROLES_REDESPACHO_ASISTIDO = new Set([
  "admin",
  "oficina_tecnica",
  "gerencia",
]);

export function puedeOfrecerRedespachoAsistido(
  userRole: string | null | undefined
): boolean {
  return userRole != null && ROLES_REDESPACHO_ASISTIDO.has(userRole);
}

export type RedespachoAsistidoOffer = {
  otNumero: string;
  /** Ej. "ALLYKING · 300 gr · 72X102" */
  materialLabel: string;
  idStock: number;
};

type Props = {
  offer: RedespachoAsistidoOffer | null;
  userRole: string | null;
  onDismiss: () => void;
  /** Tras guardar redespacho (opcional: refrescar listados). */
  onDespachado?: () => void;
};

export function RedespachoAsistidoHost({
  offer,
  userRole,
  onDismiss,
  onDespachado,
}: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pendingOt, setPendingOt] = useState<string | null>(null);

  useEffect(() => {
    if (!offer) {
      setWizardOpen(false);
      setPendingOt(null);
    }
  }, [offer]);

  if (!offer) return null;

  const askOpen = !wizardOpen;

  return (
    <>
      <Dialog
        open={askOpen}
        onOpenChange={(o) => {
          if (!o) onDismiss();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>¿Actualizar despacho?</DialogTitle>
            <DialogDescription className="space-y-2 text-sm leading-relaxed">
              <span className="block">
                Se ha asignado cartela{" "}
                <span className="font-mono font-semibold text-slate-800">
                  #{offer.idStock}
                </span>
                {offer.materialLabel ? (
                  <>
                    {" "}
                    (
                    <span className="font-medium text-slate-700">
                      {offer.materialLabel}
                    </span>
                    )
                  </>
                ) : null}{" "}
                a OT{" "}
                <span className="font-mono font-semibold text-slate-800">
                  {offer.otNumero}
                </span>
                .
              </span>
              <span className="block text-slate-600">
                Si el formato o material del despacho ya no coinciden, conviene
                abrir el lápiz ahora (mismo flujo que en OTs Despachadas). Los
                cortes especiales de Miguel siguen siendo texto humano.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onDismiss}>
              Ahora no
            </Button>
            <Button
              type="button"
              className="bg-[#002147] hover:bg-[#003366]"
              onClick={() => {
                setPendingOt(offer.otNumero);
                setWizardOpen(true);
              }}
            >
              Abrir lápiz despacho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DespachoWizardDialog
        open={wizardOpen}
        onOpenChange={(o) => {
          setWizardOpen(o);
          if (!o) onDismiss();
        }}
        initialOt={pendingOt ?? offer.otNumero}
        forceMode
        userRole={userRole}
        onDespachado={() => {
          onDespachado?.();
          onDismiss();
        }}
      />
    </>
  );
}
