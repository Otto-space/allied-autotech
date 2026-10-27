import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import { expect, it } from "vitest";
import { clientAddress } from "../../src/common/middleware/client-address.js";
import { assertApiEnvironment, env } from "../../src/config/env.js";
const secret = Buffer.alloc(32, 31).toString("base64");
it("refuses missing proof keys and mixed forwarding trust at startup", () => {
  const runtime = {
    ...env,
    CLIENT_IP_SOURCE: "digitalocean" as const,
    FRONTEND_PROXY_SECRET: secret,
    TRUST_PROXY_HOPS: 0,
    TRUST_PROXY_CIDRS: undefined,
  };
  expect(() =>
    assertApiEnvironment({ ...runtime, FRONTEND_PROXY_SECRET: undefined }),
  ).toThrow("FRONTEND_PROXY_SECRET");
  expect(() => assertApiEnvironment({ ...runtime, TRUST_PROXY_HOPS: 1 })).toThrow(
    "proxy trust disabled",
  );
  expect(() => assertApiEnvironment(runtime)).not.toThrow();
});
function app(source: "socket" | "digitalocean" = "digitalocean") {
  const a = express();
  a.use(clientAddress(source, secret));
  a.all("/{*path}", (req, res) => res.json({ ip: req.ip }));
  a.use(
    (
      err: { statusCode?: number },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(err.statusCode ?? 500).end();
    },
  );
  return a;
}
function proof(
  ip = "198.51.100.23",
  time = String(Math.floor(Date.now() / 1000)),
  method = "GET",
  path = "/api/v1/public/services",
) {
  return {
    "x-allied-client-ip": ip,
    "x-allied-client-time": time,
    "x-allied-client-proof": createHmac("sha256", Buffer.from(secret, "base64"))
      .update(`allied-client-v1\n${method}\n${path}\n${ip}\n${time}`)
      .digest("hex"),
  };
}
it("uses the documented DO address, never forwarded alternatives", async () => {
  const r = await request(app())
    .get("/api/v1/public/services")
    .set("do-connecting-ip", "203.0.113.12")
    .set("x-forwarded-for", "198.51.100.9");
  expect(r.status).toBe(200);
  expect(r.body.ip).toBe("203.0.113.12");
});
it("accepts signed Vercel client IP instead of its egress IP", async () => {
  const r = await request(app())
    .get("/api/v1/public/services")
    .set(proof())
    .set("do-connecting-ip", "203.0.113.12");
  expect(r.status).toBe(200);
  expect(r.body.ip).toBe("198.51.100.23");
});
it.each([
  proof("not-an-ip"),
  proof(undefined, "1000000000"),
  proof(undefined, undefined, "POST"),
  proof(undefined, undefined, undefined, "/another"),
  { "x-allied-client-ip": "198.51.100.24" },
  { ...proof(), "x-allied-client-proof": "0".repeat(64) },
])("rejects forged, stale, incomplete or wrongly bound proof %j", async (headers) => {
  expect((await request(app()).get("/api/v1/public/services").set(headers)).status).toBe(
    403,
  );
});
it("fails closed without a valid provider address and preserves health/socket behavior", async () => {
  expect((await request(app()).get("/api/v1/public/services")).status).toBe(503);
  expect((await request(app()).get("/api/v1/health/ready")).status).toBe(200);
  const r = await request(app("socket"))
    .get("/api/v1/public/services")
    .set("do-connecting-ip", "198.51.100.9");
  expect(r.status).toBe(200);
  expect(r.body.ip).not.toBe("198.51.100.9");
});
