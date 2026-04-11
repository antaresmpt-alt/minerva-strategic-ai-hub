"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ModuleCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  /** `module`: marca PNG grande (misma caja para todos los módulos del hub). */
  iconFrame?: "glyph" | "module";
  /** Por defecto: textura de mármol (`/images/marmol-tarjetas.png`) con velo claro para legibilidad. */
  surface?: "default" | "marble";
  actionLabel: string;
  href?: string;
  disabled?: boolean;
  /** Si es `false`, el módulo se muestra en escala de grises y el CTA abre `onAccessDenied` en lugar de navegar. */
  accessAllowed?: boolean;
  onAccessDenied?: () => void;
};

export function ModuleCard({
  title,
  description,
  icon,
  iconFrame = "glyph",
  surface = "marble",
  actionLabel,
  href,
  disabled,
  accessAllowed = true,
  onAccessDenied,
}: ModuleCardProps) {
  const locked = accessAllowed === false;
  const isDisabled = (!locked && (disabled || !href)) || (locked && !onAccessDenied);
  const marble = surface === "marble";

  return (
    <Card
      className={cn(
        "flex h-full flex-col border-border/80 shadow-md ring-1 ring-foreground/[0.06] transition-shadow hover:shadow-lg",
        marble
          ? "module-card-marble"
          : "bg-card/95 backdrop-blur-sm",
        locked && "opacity-[0.88] grayscale",
        isDisabled && !locked && "opacity-90"
      )}
    >
      <CardHeader className="gap-3 text-center justify-items-center">
        <div
          className={cn(
            "flex items-center justify-center rounded-xl",
            iconFrame === "glyph" &&
              "mx-auto size-12 bg-primary/[0.07] text-primary ring-1 ring-primary/10",
            iconFrame === "module" &&
              "mx-auto min-h-[8rem] w-full max-w-[12rem] bg-transparent p-0 ring-0"
          )}
        >
          {icon}
        </div>
        <CardTitle className="text-lg leading-snug">{title}</CardTitle>
        <CardDescription className="text-pretty leading-relaxed text-center">
          {description}
        </CardDescription>
      </CardHeader>
      <div className="min-h-0 flex-1" aria-hidden />
      <CardFooter
        className={cn(
          "mt-auto border-t border-border/60",
          marble
            ? "border-border/50 bg-card/[0.5] backdrop-blur-[2px]"
            : "bg-muted/30",
        )}
      >
        {locked ? (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full cursor-pointer"
            onClick={() => onAccessDenied?.()}
          >
            {actionLabel}
          </Button>
        ) : isDisabled ? (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled
          >
            {actionLabel}
          </Button>
        ) : (
          <Link
            href={href!}
            className={buttonVariants({
              variant: "default",
              size: "lg",
              className: "w-full no-underline",
            })}
          >
            {actionLabel}
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
