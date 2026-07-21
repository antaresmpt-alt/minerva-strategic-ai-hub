"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import styles from "./calendario-cafe-easter-egg.module.css";

export const CALENDARIO_CAFE_EASTER_EGG_EMAIL = "produccion@minervaglobal.es";

function CoffeeMakerAnimation() {
  return (
    <div className={styles.cafeScene} aria-hidden>
      <div className={styles.machine}>
        <span className={styles.machineLight} />
        <div className={styles.spout}>
          <div className={styles.stream} />
        </div>
      </div>
      <div className={styles.cupWrap}>
        <div className={styles.steam} />
        <div className={styles.cup}>
          <div className={styles.liquid} />
          <div className={styles.cupHandle} />
        </div>
      </div>
    </div>
  );
}

type CalendarioCafeEasterEggDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otNumero: string;
  otherDayLabel: string;
  onAddAnyway: () => void;
};

export function CalendarioCafeEasterEggDialog({
  open,
  onOpenChange,
  otNumero,
  otherDayLabel,
  onAddAnyway,
}: CalendarioCafeEasterEggDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-[#002147]">
            Carlos, ya has entrado esa OT…
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600">
            La OT <span className="font-mono font-semibold">{otNumero}</span> ya
            está planificada el <span className="font-medium">{otherDayLabel}</span>.
            ¿Necesitas un café?
          </DialogDescription>
        </DialogHeader>

        <CoffeeMakerAnimation />

        <p className="text-xs text-slate-500">
          (Aviso interno de test — puedes añadirla igualmente en este día.)
        </p>

        <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:justify-center">
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              onAddAnyway();
              onOpenChange(false);
            }}
          >
            Sigo planificando
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Me tomo el café ☕
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
