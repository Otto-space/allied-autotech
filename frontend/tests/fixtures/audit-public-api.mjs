// Loopback-only synthetic public data. Never deploy this fixture or import it from application code.
import { createRuntimeCapabilityApi } from "./runtime-capabilities-api.mjs";
import { listing } from "./public-account-actions.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const image = readFileSync(
  fileURLToPath(
    new URL("../../public/images/workshop/workshop-hero-01.jpg", import.meta.url),
  ),
);
export const issue =
  "Synthetic owner statement: air conditioning leaks after sustained use. Further diagnosis is required. No repair or independent inspection is claimed. Confirm the full condition before making an enquiry.";
const record = {
  ...listing,
  title: "Synthetic test vehicle",
  vehicle: {
    ...listing.vehicle,
    ownerReportedIssues: issue,
    images: [
      {
        id: "a9000000-0000-4000-8000-000000000077",
        url: "/api/v1/public/vehicles/images/a9000000-0000-4000-8000-000000000077",
        altText: "Isolated layout fixture photograph",
        isPrimary: true,
        width: 1200,
        height: 900,
      },
    ],
  },
};
const server = createRuntimeCapabilityApi(),
  original = server.listeners("request")[0];
server.removeAllListeners("request");
server.on("request", (req, res) => {
  const u = new URL(req.url, "http://127.0.0.1");
  if (req.method !== "GET") return original(req, res);
  if (u.pathname.startsWith("/api/v1/public/vehicles/images/")) {
    res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "no-store" });
    res.end(image);
    return;
  }
  let data;
  if (
    u.pathname === "/api/v1/public/vehicles" ||
    u.pathname === "/api/v1/public/vehicles/discovery"
  )
    data = { items: [record], totalMatches: 1 };
  if (u.pathname === "/api/v1/public/services/discovery")
    data = { items: [], totalMatches: 0 };
  if (data) {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(
      JSON.stringify({
        success: true,
        message: "Isolated synthetic audit fixture",
        meta: { requestId: "audit-public" },
        data,
      }),
    );
    return;
  }
  return original(req, res);
});
server.listen(5024, "127.0.0.1", () =>
  console.log("Synthetic audit public fixture ready on loopback 5024"),
);
process.on("SIGINT", () => server.close());
process.on("SIGTERM", () => server.close());
