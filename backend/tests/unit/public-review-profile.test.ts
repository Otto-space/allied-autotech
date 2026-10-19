import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { MediaStoragePort } from "../../src/providers/storage/media-storage.port.js";
import {
  PublicReviewProfiles,
  publicReviewer,
} from "../../src/modules/support/public-review-profile.js";
import { SupportRepository } from "../../src/modules/support/support.repository.js";
import { createPublicSupportRouter } from "../../src/modules/support/support.routes.js";
import { mediaError } from "../../src/modules/media/media.errors.js";

const id = "a7100000-0000-4000-8000-000000000001";

describe("approved public reviewer profiles", () => {
  it("projects a name and review-scoped portrait without private profile fields", () => {
    const customer = {
      firstName: " Ada ",
      lastName: " Okafor ",
      mediaVersion: 2,
      mediaImages: [{ id: "private-image-id" }],
      phone: "private-contact",
      userId: "private-owner-id",
    };
    expect(publicReviewer(id, customer)).toEqual({
      displayName: "Ada Okafor",
      photoUrl: `/api/v1/public/support/reviews/${id}/photo?v=2`,
    });
    expect(
      publicReviewer(id, {
        firstName: "",
        lastName: "",
        mediaVersion: 0,
        mediaImages: [],
      }),
    ).toEqual({
      displayName: "Customer",
      photoUrl: null,
    });
  });

  it("publishes only an approved-review projection and preserves list pagination", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id,
        rating: 3,
        customer: {
          firstName: "Ada",
          lastName: "Okafor",
          mediaVersion: 0,
          mediaImages: [],
          phone: "private-contact",
        },
      },
    ]);
    const database = { review: { findMany } } as unknown as PrismaClient;
    const rows = await new SupportRepository(database).listPublicReviews({ limit: 3 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "APPROVED" }, take: 4 }),
    );
    expect(rows).toEqual([
      { id, rating: 3, reviewer: { displayName: "Ada Okafor", photoUrl: null } },
    ]);
    expect(JSON.stringify(rows)).not.toContain("private-contact");
    const selection = findMany.mock.calls[0][0].select;
    expect(selection.customer.select).toEqual({
      firstName: true,
      lastName: true,
      mediaVersion: true,
      mediaImages: { select: { id: true }, take: 1 },
    });
    expect(selection).not.toHaveProperty("moderationNote");
  });

  it("reads only a profile image attached to a currently approved review", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      customer: {
        mediaImages: [
          {
            asset: {
              objectKey: "owned-profile-image",
              sizeBytes: 4,
              mimeType: "image/webp",
            },
          },
        ],
      },
    });
    const read = vi.fn().mockResolvedValue(Buffer.from("webp"));
    const database = { review: { findFirst } } as unknown as PrismaClient;
    const storage = { read } as unknown as MediaStoragePort;
    expect(await new PublicReviewProfiles(database, storage).read(id)).toEqual({
      bytes: Buffer.from("webp"),
      mimeType: "image/webp",
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, status: "APPROVED" } }),
    );
    expect(read).toHaveBeenCalledWith("owned-profile-image", 4);
  });

  it.each([null, { customer: { mediaImages: [] } }])(
    "withholds unavailable review portraits before storage access",
    async (row) => {
      const database = {
        review: { findFirst: vi.fn().mockResolvedValue(row) },
      } as unknown as PrismaClient;
      const read = vi.fn();
      await expect(
        new PublicReviewProfiles(database, { read } as unknown as MediaStoragePort).read(
          id,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(read).not.toHaveBeenCalled();
    },
  );

  it("serves no-store image content, rechecks each request and validates review IDs", async () => {
    const read = vi
      .fn()
      .mockResolvedValue({ bytes: Buffer.from("webp"), mimeType: "image/webp" });
    const app = express();
    app.use(
      "/public/support",
      createPublicSupportRouter({ read } as unknown as PublicReviewProfiles),
    );
    app.use(
      (
        error: { statusCode?: number },
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction,
      ) => res.status(error.statusCode ?? 500).json({ error: "Unavailable" }),
    );
    const response = await request(app)
      .get(`/public/support/reviews/${id}/photo`)
      .expect(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["content-type"]).toContain("image/webp");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    read.mockRejectedValueOnce(mediaError("NOT_FOUND", 404));
    await request(app).get(`/public/support/reviews/${id}/photo`).expect(404);
    await request(app).get("/public/support/reviews/not-a-review/photo").expect(422);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
