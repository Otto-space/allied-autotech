import { afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-vercel-forwarded-for": "198.51.100.23",
      "x-allied-client-ip": "203.0.113.1",
    }),
}));
import { publicData } from "@/lib/api/public-server";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("signs the actual backend route for SSR catalogue reads, independently of a page URL", async () => {
  const secret = Buffer.alloc(32, 31).toString("base64");
  vi.stubEnv("FRONTEND_PROXY_SECRET", secret);
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("BACKEND_ORIGIN", "https://backend.example.com");
  vi.stubEnv("PRIVATE_TESTING_ENABLED", "false");
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true, data: { items: [] } }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  await publicData("/public/services?limit=3", (value) => value);
  const [url, options] = fetcher.mock.calls[0]!;
  expect(url).toBe("https://backend.example.com/api/v1/public/services?limit=3");
  expect(options.headers["x-allied-client-ip"]).toBe("198.51.100.23");
  expect(options.headers["x-allied-client-proof"]).toBe(
    createHmac("sha256", Buffer.from(secret, "base64"))
      .update(
        `allied-client-v1\nGET\n/api/v1/public/services\n198.51.100.23\n${options.headers["x-allied-client-time"]}`,
      )
      .digest("hex"),
  );
  expect(options.redirect).toBe("error");
});
