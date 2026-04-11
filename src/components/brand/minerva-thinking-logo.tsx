"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

type MinervaThinkingLogoProps = {
  size?: number;
  className?: string;
  /** When false, mark decorative (pair with visible status text). */
  decorative?: boolean;
};

export function MinervaThinkingLogo({
  size = 40,
  className,
  decorative = true,
}: MinervaThinkingLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 animate-spin overflow-hidden rounded-full",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden={decorative ? true : undefined}
    >
      <Image
        src="/images/brand-minerva-round.png"
        alt={decorative ? "" : "Generando…"}
        width={size}
        height={size}
        className="size-full object-contain"
      />
    </span>
  );
}
