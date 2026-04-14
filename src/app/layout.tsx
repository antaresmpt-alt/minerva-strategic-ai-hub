import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";

import { UserNav } from "@/components/layout/user-nav";
import { AppProviders } from "@/components/providers/app-providers";
import { AppToaster } from "@/components/ui/app-toaster";
import { canAccessSettings } from "@/lib/permissions";
import { getCurrentUserProfile } from "@/lib/supabase/server";

import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const montserrat = Montserrat({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Minerva Strategic AI Hub",
  description:
    "Hub de consultoría estratégica B2B con IA: análisis, PMAX y estructura ejecutiva.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getCurrentUserProfile();

  return (
    <html
      lang="es"
      className={`${inter.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppProviders>
          <AppToaster />
          {profile ? (
            <UserNav
              email={profile.email}
              role={profile.role}
              showSettingsLink={canAccessSettings(profile.role)}
            />
          ) : null}
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
