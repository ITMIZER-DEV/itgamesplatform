import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // Só afeta o `next dev`: libera abrir o front de desenvolvimento pela Tailscale (celular, tablet do juiz).
  allowedDevOrigins: ["100.114.54.84"],
  // O proxy /api-proxy corta em 30 s por padrão e devolve 502; a importação da programação pode passar disso
  experimental: {
    proxyTimeout: 120_000,
  },
  async rewrites() {
    const apiTarget = process.env.API_INTERNAL_URL || "http://api:3333";
    return [
      {
        source: "/api-proxy/:path*",
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;

