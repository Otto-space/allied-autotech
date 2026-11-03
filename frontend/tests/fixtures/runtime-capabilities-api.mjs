// Loopback-only browser fixture. No database, credentials, delivery or provider calls.
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const group = {
  id: "37ec8bcf-7edc-4ec7-a185-ec849d71c5de",
  name: "Synthetic wheel maintenance",
  slug: "synthetic-wheel-maintenance",
  description: "An isolated service group for availability regression tests.",
  image: null,
};
const services = [1, 2].map((number) => ({
  id: `00000000-0000-4000-8000-00000000000${number}`,
  name: `Synthetic wheel service ${number}`,
  slug: `synthetic-wheel-service-${number}`,
  description: "Isolated browser fixture; no real appointment or offer.",
  shortDescription: "Synthetic service information.",
  pricingType: "FIXED",
  priceKobo: "100000",
  currency: "NGN",
  durationMinutes: 30,
  version: 0,
  category: group,
  image: null,
}));

export function createRuntimeCapabilityApi() {
  let settings = {
    mode: "browse_enquiries",
    checkoutApproved: true,
    bookingRequestsEnabled: true,
    productPurchasesEnabled: true,
    fail: false,
  };
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const send = (status, data) => {
      response.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(data));
    };
    const success = (data) =>
      send(200, {
        success: true,
        message: "Isolated browser fixture",
        meta: { requestId: "runtime-capability-fixture" },
        data,
      });
    if (request.method === "POST" && url.pathname === "/__capabilities") {
      try {
        let body = "";
        for await (const chunk of request) {
          body += chunk;
          if (Buffer.byteLength(body) > 1024) {
            send(413, { success: false });
            return;
          }
        }
        const value = JSON.parse(body);
        const keys = Object.keys(settings);
        if (
          !value ||
          Array.isArray(value) ||
          !["full", "browse_enquiries", "catalogue"].includes(value.mode) ||
          Object.keys(value).some((key) => !keys.includes(key)) ||
          keys.some(
            (key) => key !== "mode" && key in value && typeof value[key] !== "boolean",
          )
        )
          throw Error("Invalid fixture controls");
        settings = {
          mode: value.mode,
          checkoutApproved: value.checkoutApproved !== false,
          bookingRequestsEnabled: value.bookingRequestsEnabled !== false,
          productPurchasesEnabled: value.productPurchasesEnabled !== false,
          fail: value.fail === true,
        };
        send(200, { success: true });
      } catch {
        if (!response.writableEnded) send(400, { success: false });
      }
      return;
    }
    if (request.method !== "GET") {
      send(405, { success: false, error: { code: "FIXTURE_READ_ONLY" } });
      return;
    }
    if (url.pathname === "/__health") {
      success({ fixture: true });
      return;
    }
    if (url.pathname === "/api/v1/public/capabilities") {
      if (settings.fail) {
        send(503, { success: false, error: { code: "DATABASE_UNAVAILABLE" } });
        return;
      }
      success({
        scope: "POLICY_SUMMARY",
        serverTime: new Date().toISOString(),
        release: {
          mode: settings.mode,
          customerAccountsEnabled: settings.mode !== "catalogue",
          enquiriesEnabled: settings.mode !== "catalogue",
          bookingRequestsEnabled:
            settings.mode === "full" && settings.bookingRequestsEnabled,
          inspectionRequestsEnabled:
            settings.mode === "full" && settings.bookingRequestsEnabled,
        },
        checkoutEnabled:
          settings.mode === "full" &&
          settings.checkoutApproved &&
          settings.productPurchasesEnabled,
        vehicleDeposits: { enabled: false },
      });
      return;
    }
    if (url.pathname === "/api/v1/public/services/categories") {
      success({ items: [group] });
      return;
    }
    if (url.pathname === `/api/v1/public/services/categories/${group.id}`) {
      success(group);
      return;
    }
    if (url.pathname === "/api/v1/public/services/discovery") {
      success({ items: services, totalMatches: services.length });
      return;
    }
    if (url.pathname === "/api/v1/public/services") {
      success({ items: services });
      return;
    }
    const service = services.find(
      (entry) => url.pathname === `/api/v1/public/services/${entry.id}`,
    );
    if (service) {
      success(service);
      return;
    }
    if (url.pathname === "/api/v1/public/learning/catalogue") {
      success({
        accessKey: "a".repeat(64),
        audience: "public",
        contentVersion: 1,
        mode: settings.mode,
        flags: { guides: false, practice: false, ai: false },
        articles: [],
        guides: [],
        scenarios: [],
      });
      return;
    }
    if (url.pathname.startsWith("/api/v1/public/")) {
      success({ items: [], totalMatches: 0 });
      return;
    }
    send(401, { success: false, error: { code: "UNAUTHENTICATED" } });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createRuntimeCapabilityApi();
  server.listen(5024, "127.0.0.1", () => console.log("Loopback fixture ready on 5024"));
  process.on("SIGTERM", () => server.close());
  process.on("SIGINT", () => server.close());
}
