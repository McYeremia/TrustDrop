import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output → minimal self-contained server for the Cloud Run container.
  output: "standalone",
};

export default nextConfig;
