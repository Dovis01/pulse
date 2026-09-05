import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is for the Docker self-host mode; Vercel builds
  // with its own runtime and must not emit standalone files.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
