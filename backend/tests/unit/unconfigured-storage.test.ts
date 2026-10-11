import { Router } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/env.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/config/env.js")>();
  return { ...original, env: { ...original.env, OBJECT_STORAGE_BUCKET: undefined } };
});

import { createApp } from "../../src/app.js";
import { objectStorage } from "../../src/providers/storage/s3-object-storage.adapter.js";

const upload = {
  key: "private/synthetic-evidence",
  mimeType: "application/pdf",
  sizeBytes: 128,
  checksumSha256: "a".repeat(64),
};
const operations = {
  prepare: () => objectStorage.createUpload(upload),
  verify: () => objectStorage.verifyObject(upload),
  download: () => objectStorage.createDownload(upload.key, "evidence.pdf"),
  view: () => objectStorage.createView(upload.key),
};

describe("unconfigured private object storage", () => {
  it.each(Object.entries(operations))("fails closed for %s", async (_name, operation) => {
    await expect(operation()).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      statusCode: 503,
    });
  });

  it("returns a safe HTTP error instead of a fabricated successful verification", async () => {
    const router = Router().post("/storage-probe", async (_req, res) => {
      res.json({ verified: await objectStorage.verifyObject(upload) });
    });
    const response = await request(createApp({ apiRouter: router }))
      .post("/api/v1/storage-probe")
      .send({});
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "PROVIDER_UNAVAILABLE" },
    });
    expect(response.body).not.toHaveProperty("data");
    expect(JSON.stringify(response.body)).not.toMatch(
      /storage\.invalid|private\/|bucket|credential/i,
    );
    expect(response.headers["cache-control"]).toContain("no-store");
  });
});
