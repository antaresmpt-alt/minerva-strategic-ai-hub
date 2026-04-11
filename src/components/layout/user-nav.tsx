"use client";

import Link from "next/link";
import { LogOut, Settings, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatRoleLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export type UserNavProps = {
  email: string;
  role: string | null;
  showSettingsLink?: boolean;
};

function initialFromEmail(email: string): string {
  const c = email.trim().charAt(0);
  return c ? c.toUpperCase() : "?";
}

export function UserNav({
  email,
  role,
  showSettingsLink = false,
}: UserNavProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const isPrivileged = role === "admin" || role === "gerencia";

  const onSignOut = useCallback(async () => {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }, [router]);

  const roleLabel = useMemo(() => formatRoleLabel(role), [role]);

  return (
    <div className="externos-plan-print-hide pointer-events-none fixed top-3 right-3 z-[100] flex items-center gap-2 sm:top-4 sm:right-4">
      {showSettingsLink && (
        <div className="pointer-events-auto">
          <Link
            href="/settings"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-sm" }),
              "size-10 border-[var(--minerva-navy)]/25 bg-card/95 text-[var(--minerva-navy)] shadow-sm backdrop-blur-sm hover:bg-muted/80"
            )}
            aria-label="Configuración"
            title="Configuración"
          >
            <Settings className="size-[1.15rem]" aria-hidden />
          </Link>
        </div>
      )}

      <div className="pointer-events-auto">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 shadow-sm ring-2 ring-offset-2 ring-offset-background outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-ring/60",
              isPrivileged
                ? "ring-[var(--minerva-gold)] hover:ring-[var(--minerva-gold)]"
                : "ring-[var(--minerva-navy)]/35 hover:ring-[var(--minerva-navy)]/50"
            )}
            aria-label="Menú de usuario"
          >
            <Avatar
              className={cn(
                "size-9 border-2 bg-card",
                isPrivileged
                  ? "border-[var(--minerva-gold)]"
                  : "border-[var(--minerva-navy)]/40"
              )}
            >
              <AvatarFallback
                className={cn(
                  "bg-card text-[0.85rem] font-semibold tracking-tight",
                  isPrivileged
                    ? "text-[var(--minerva-navy)]"
                    : "text-slate-600"
                )}
              >
                {initialFromEmail(email)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="bottom"
            sideOffset={8}
            className="w-72 border-border/80 shadow-lg"
          >
            <div className="space-y-3 px-2 py-2">
              <div className="flex items-start gap-2.5">
                <UserRound
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    Correo
                  </p>
                  <p className="truncate text-sm text-foreground" title={email}>
                    {email}
                  </p>
                </div>
              </div>
              <div className="space-y-1.5 pl-6">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Rol
                </p>
                <span
                  className={cn(
                    "inline-flex max-w-full items-center rounded-md border px-2 py-1 text-xs font-medium",
                    isPrivileged
                      ? "border-[var(--minerva-gold)]/55 bg-amber-50/90 text-[var(--minerva-navy)] dark:bg-amber-950/40 dark:text-amber-100"
                      : "border-slate-200 bg-slate-100/90 text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200"
                  )}
                >
                  {roleLabel}
                </span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="gap-2"
              disabled={signingOut}
              onClick={() => void onSignOut()}
            >
              <LogOut className="size-4" aria-hidden />
              {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
