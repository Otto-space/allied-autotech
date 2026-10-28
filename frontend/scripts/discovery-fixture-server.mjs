// Explicit local-only demonstration API. No persistence, outgoing requests or real submissions.
import { createServer } from "node:http";
import { discoveryResponse } from "../tests/fixtures/discovery-response.mjs";

if (
  !process.argv.includes("--demo") ||
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL
) {
  throw new Error(
    "Use --demo only in a local development environment. Hosted/production use is forbidden.",
  );
}
let mode = "populated";
const port = Number(process.env.DISCOVERY_FIXTURE_PORT ?? 5021);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid local fixture port");
const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET") {
    res.writeHead(405);
    return res.end(JSON.stringify({ success: false, error: { code: "DEMO_READ_ONLY" } }));
  }
  if (url.pathname === "/__fixture") {
    const next = url.searchParams.get("mode");
    if (["populated", "empty", "error", "no-fitment"].includes(next)) mode = next;
    return res.end(JSON.stringify({ mode, fictional: true, persistent: false }));
  }
  if (url.pathname.endsWith("/auth/session")) {
    res.writeHead(401);
    return res.end(JSON.stringify({ success: false, error: { code: "UNAUTHORIZED" } }));
  }
  if (!url.pathname.startsWith("/api/v1/public/") || mode === "error") {
    res.writeHead(mode === "error" ? 503 : 404);
    return res.end(
      JSON.stringify({ success: false, error: { code: "DEMO_UNAVAILABLE" } }),
    );
  }
  const data = discoveryResponse(url, mode);
  if (!data) res.writeHead(404);
  res.end(
    JSON.stringify(
      data
        ? {
            success: true,
            data,
            message: "FICTIONAL LOCAL DEMO — no real availability",
            meta: { requestId: "local-discovery-demo" },
          }
        : { success: false, error: { code: "NOT_FOUND" } },
    ),
  );
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Read-only fictional demo API: http://127.0.0.1:${port}; 20 products, 12 vehicles, 5 categories, 3 makes, 6 models, 4 services and 3 synthetic reviews. No database writes.`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.closeAllConnections();
    server.close();
  });
