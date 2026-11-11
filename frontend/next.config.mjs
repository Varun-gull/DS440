import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/profile/resume": [
      "./node_modules/pdf-parse/dist/worker/**/*",
      "./node_modules/pdf-parse/dist/pdf-parse/*/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker*.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
    ],
    "/profile": [
      "./node_modules/pdf-parse/dist/worker/**/*",
      "./node_modules/pdf-parse/dist/pdf-parse/*/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker*.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
    ] }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
