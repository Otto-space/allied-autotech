import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";
import { backendOrigin } from "./lib/backend-origin";
import { validateDeploymentConfig } from "./lib/deployment-config";

validateDeploymentConfig();

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Vercel packages Next.js routes itself; other hosts keep the standalone server.
  ...(process.env.VERCEL === "1" ? {} : { output: "standalone" as const }),
  poweredByHeader: false,
  turbopack: {
    root: projectRoot,
  },
  async rewrites() {
    const origin = backendOrigin();
    return [
      {
        source: "/api/v1/:path*",
        destination: origin ? `${origin}/api/v1/:path*` : "/api/backend-unavailable",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/push-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/brand/:asset(allied-mark-red.png|allied-email-profile.png)",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "cross-origin" }],
      },
    ];
  },
};

export default nextConfig;
