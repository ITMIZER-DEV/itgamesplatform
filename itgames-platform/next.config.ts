import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

