import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

describe("Express proxy trust dependency regression", () => {
  it.each(["::ffff:10.0.0.0/8", "::/1"])(
    "does not trust every IPv4 peer through the IPv6 subnet %s",
    async (subnet) => {
      const app = express();
      app.set("trust proxy", [subnet]);
      app.get("/ip", (req, res) => res.json({ ip: req.ip }));
      const response = await request(app)
        .get("/ip")
        .set("X-Forwarded-For", "203.0.113.7");
      expect(response.status).toBe(200);
      expect(response.body.ip).not.toBe("203.0.113.7");
    },
  );
  it("still honors a correctly scoped mapped IPv4 loopback proxy", async () => {
    const app = express();
    app.set("trust proxy", ["::ffff:127.0.0.0/104"]);
    app.get("/ip", (req, res) => res.json({ ip: req.ip }));
    const response = await request(app).get("/ip").set("X-Forwarded-For", "203.0.113.7");
    expect(response.status).toBe(200);
    expect(response.body.ip).toBe("203.0.113.7");
  });
});
