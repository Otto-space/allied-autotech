import { createServer, type Server } from "node:http";
import { Router } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ endpoint: "http://127.0.0.1:1" }));
vi.mock("../../src/config/env.js", async (original) => {
  const value = await original<typeof import("../../src/config/env.js")>();
  return {
    ...value,
    env: {
      ...value.env,
      OBJECT_STORAGE_BUCKET: "synthetic-private-bucket",
      OBJECT_STORAGE_REGION: "us-east-1",
      OBJECT_STORAGE_FORCE_PATH_STYLE: true,
      OBJECT_STORAGE_ACCESS_KEY_ID: "synthetic-only-access",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "synthetic-only-secret",
      get OBJECT_STORAGE_ENDPOINT() {
        return storage.endpoint;
      },
    },
  };
});
import { S3ObjectStorageAdapter } from "../../src/providers/storage/s3-object-storage.adapter.js";
import { createApp } from "../../src/app.js";
const file = {
  key: "private/synthetic-only",
  sizeBytes: 128,
  mimeType: "application/pdf",
  checksumSha256: "a".repeat(64),
};
let server: Server, adapter: S3ObjectStorageAdapter;
let mode = "valid",
  closed = 0;
const requests: { method: string | undefined; range: string | undefined }[] = [];
beforeAll(async () => {
  server = createServer((req, res) => {
    requests.push({ method: req.method, range: req.headers.range });
    res.on("close", () => closed++);
    if (mode === "missing") {
      res.writeHead(404, { "content-type": "application/xml" });
      res.end(
        "<Error><Code>NoSuchKey</Code><Message>Private object details</Message></Error>",
      );
      return;
    }
    if (mode === "denied") {
      res.writeHead(403, { "content-type": "application/xml" });
      res.end(
        "<Error><Code>AccessDenied</Code><Message>Private endpoint and credentials</Message></Error>",
      );
      return;
    }
    if (req.method === "HEAD") {
      res.writeHead(200, {
        "content-length": 128,
        "content-type": "application/pdf",
        "x-amz-checksum-sha256": Buffer.from(file.checksumSha256, "hex").toString(
          "base64",
        ),
      });
      res.end();
      return;
    }
    if (mode === "stall") {
      res.writeHead(200, { "content-type": "application/pdf" });
      res.write("%PDF-");
      return;
    }
    if (mode === "oversized") {
      res.writeHead(200, { "content-length": 128 });
      res.write("%PDF-");
      return;
    }
    if (mode === "chunked-large") {
      res.writeHead(200);
      res.write(Buffer.alloc(128));
      return;
    }
    const bytes = Buffer.from("%PDF-test-file!!");
    res.writeHead(req.headers.range ? 206 : 200, {
      "content-length": bytes.length,
      "content-type": "application/pdf",
    });
    res.end(bytes);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected loopback port");
  storage.endpoint = `http://127.0.0.1:${address.port}`;
  adapter = new S3ObjectStorageAdapter();
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
describe("S3 HTTP response boundaries", () => {
  it("uses real SDK metadata and range requests and retains bounded media bytes", async () => {
    mode = "valid";
    requests.length = 0;
    await expect(adapter.verifyObject(file)).resolves.toBe(true);
    expect(requests).toEqual([
      { method: "HEAD", range: undefined },
      { method: "GET", range: "bytes=0-15" },
    ]);
    await expect(adapter.read(file.key, 16)).resolves.toEqual(
      Buffer.from("%PDF-test-file!!"),
    );
  });
  it.each(["oversized", "chunked-large"])(
    "closes %s HTTP bodies without waiting for the server to finish",
    async (value) => {
      mode = value;
      const before = closed;
      await expect(adapter.read(file.key, 16)).rejects.toMatchObject({
        code: "MEDIA_TOO_LARGE",
        statusCode: 422,
      });
      await vi.waitFor(() => expect(closed).toBeGreaterThan(before));
      await expect(adapter.verifyObject(file)).resolves.toBe(false);
    },
  );
  it("maps permission/configuration faults to safe retryable errors without leaking details", async () => {
    mode = "denied";
    const error = await adapter.verifyObject(file).catch((error) => error);
    expect(error).toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      statusCode: 503,
      retryable: true,
    });
    expect(String(error)).not.toMatch(/endpoint|credentials|AccessDenied/);
    const router = Router().post("/storage-verification-probe", async (_req, res) => {
      res.json({ verified: await adapter.verifyObject(file) });
    });
    const response = await request(createApp({ apiRouter: router }))
      .post("/api/v1/storage-verification-probe")
      .send({});
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "PROVIDER_UNAVAILABLE" },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /endpoint|credentials|AccessDenied|synthetic-private-bucket|synthetic-only/,
    );
    mode = "missing";
    await expect(adapter.verifyObject(file)).resolves.toBe(false);
    await expect(adapter.read(file.key, 16)).rejects.toMatchObject({
      code: "MEDIA_OBJECT_MISSING",
      statusCode: 404,
    });
  });
  it("aborts a real body stalled after response headers within the complete operation deadline", async () => {
    mode = "stall";
    const before = closed,
      started = Date.now();
    await expect(adapter.read(file.key, 16)).rejects.toMatchObject({
      code: "MEDIA_STORAGE_UNAVAILABLE",
      statusCode: 503,
    });
    expect(Date.now() - started).toBeLessThan(23000);
    expect(Date.now() - started).toBeGreaterThanOrEqual(19000);
    await vi.waitFor(() => expect(closed).toBeGreaterThan(before));
  }, 30000);
});
