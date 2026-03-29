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
  /** Use larger frame for raster module marks (PNG), or circular avatar for chatbot. */
  iconFrame?: "glyph" | "module" | "avatar";
  actionLabel: string;
  href?: string;
  disabled?: boolean;
};

export function ModuleCard({
  title,
  description,
  icon,
  iconFrame = "glyph",
  actionLabel,
  href,
  disabled,
}: ModuleCardProps) {
  const isDisabled = disabled || !href;

  return (
    <Card
      className={cn(
        "flex h-full flex-col border-border/80 bg-card/95 shadow-md ring-1 ring-foreground/[0.06] backdrop-blur-sm transition-shadow hover:shadow-lg",
        isDisabled && "opacity-90"
      )}
    >
      <CardHeader className="gap-3">
        <div
          className={cn(
            "flex items-center justify-center rounded-xl",
            iconFrame === "glyph" &&
              "size-12 bg-primary/[0.07] text-primary ring-1 ring-primary/10",
            iconFrame === "module" &&
              "min-h-[6.25rem] w-full max-w-[9.5rem] bg-transparent p-0 ring-0",
            iconFrame === "avatar" &&
              "size-20 shrink-0 overflow-hidden rounded-full bg-muted/60 p-0.5 ring-2 ring-[#002147]/12"
          )}
        >
          {icon}
        </div>
        <CardTitle className="text-lg leading-snug">{title}</CardTitle>
        <CardDescription className="text-pretty leading-relaxed">
          {description}
        </CardDescription>
      </CardHeader>
      <div className="min-h-0 flex-1" aria-hidden />
      <CardFooter className="mt-auto border-t border-border/60 bg-muted/30">
        {isDisabled ? (
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
            href={href}
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
