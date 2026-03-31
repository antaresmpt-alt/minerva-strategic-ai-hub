import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** Directorio de esta app (evita que Turbopack tome un lockfile en un carpeta padre como raíz). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* Ayuda en algunos despliegues con payloads grandes (imagen en JSON). */
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
