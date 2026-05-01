import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** Directorio de esta app (evita que Turbopack tome un lockfile en un carpeta padre como raíz). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** Evita que el bundler rompa la resolución del worker de pdf.js (pdf-parse). */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  /* Ayuda en algunos despliegues con payloads grandes (imagen en JSON). */
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    let supabaseHost = "";
    try {
      supabaseHost = new URL(supabaseUrl).hostname;
    } catch {
      /* vacío: CSP sin host Supabase concreto */
    }
    const connectExtras = supabaseHost
      ? ` https://${supabaseHost} wss://${supabaseHost}`
      : " https://*.supabase.co wss://*.supabase.co";

    const securityHeaders: { key: string; value: string }[] = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value:
          "camera=(), microphone=(), geolocation=(), interest-cohort=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          `connect-src 'self'${connectExtras} https://*.googleapis.com https://generativelanguage.googleapis.com https://api.anthropic.com https://api.openai.com https://huggingface.co`,
        ].join("; "),
      },
    ];

    if (process.env.NODE_ENV === "production") {
      securityHeaders.unshift({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
