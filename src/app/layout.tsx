import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";

import { UserNav } from "@/components/layout/user-nav";
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
        {profile ? (
          <UserNav email={profile.email} role={profile.role} />
        ) : null}
        {children}
      </body>
    </html>
  );
}
