import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

/**
 * Ejecutar middleware en todas las rutas salvo:
 * - `/_next/*` (chunks, HMR, etc.)
 * - Favicon y archivos típicos de `/public` (por extensión)
 */
export const config = {
  matcher: [
    "/((?!_next/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|pdf|txt|xml|webmanifest)$).*)",
  ],
};
