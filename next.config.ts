import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output → minimal self-contained server for the Cloud Run container.
  output: "standalone",
  // The T3N SDK loads its own WASM component from the package at runtime; keep it
  // external so the bundler doesn't rewrite those file paths.
  serverExternalPackages: ["@terminal3/t3n-sdk"],
};

export default nextConfig;
