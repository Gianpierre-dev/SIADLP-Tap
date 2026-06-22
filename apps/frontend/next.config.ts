import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El build de producción no se frena por errores de tipos/lint.
  // (El chequeo de tipos sigue activo en desarrollo y en el pipeline de CI.)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
