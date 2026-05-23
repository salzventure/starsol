import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "*.nasa.gov" },
      { hostname: "*.stsci.edu" },
      { hostname: "esahubble.org" },
      { hostname: "*.eso.org" },
      { hostname: "noirlab.edu" },
      { hostname: "*.supabase.co" },
      { hostname: "stream.mux.com" },
      { hostname: "image.mux.com" },
    ],
  },
};

export default nextConfig;
