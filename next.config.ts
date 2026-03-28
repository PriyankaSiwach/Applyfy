import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin workspace root when a parent directory has another lockfile so `.env.local` loads from this app.
  turbopack: {
    root: path.join(__dirname),
  },
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "mammoth", "canvas"],
};

export default nextConfig;
