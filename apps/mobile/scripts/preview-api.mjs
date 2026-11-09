import { createServer } from "node:http";

// Local emulator verification fixture, not the real backend. Empty service
// response contains no invented inventory. Capabilities deliberately unavailable.
const server = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "private, no-store");
  if (request.method === "GET" && request.url === "/api/v1/public/services") {
    response.end(
      JSON.stringify({
        success: true,
        message: "Local empty verification fixture",
        data: { items: [] },
        meta: { requestId: "local-fixture" },
      }),
    );
    return;
  }
  response.statusCode = 503;
  response.end(
    JSON.stringify({
      success: false,
      message: "Local verification fixture: availability is intentionally unavailable.",
      error: { code: "SERVICE_UNAVAILABLE" },
      meta: { requestId: "local-fixture" },
    }),
  );
});
server.listen(5155, "127.0.0.1", () =>
  console.log(
    "Local mock verification API on 127.0.0.1:5155; not the application backend.",
  ),
);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
