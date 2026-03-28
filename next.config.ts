import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Ayuda en algunos despliegues con payloads grandes (imagen en JSON). */
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
