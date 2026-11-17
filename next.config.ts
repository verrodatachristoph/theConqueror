import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Travel-plan HTML is uploaded through a server action; the 1 MB default
    // is far too small for a self-contained page with inlined assets.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
