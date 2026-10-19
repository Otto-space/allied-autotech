import { prisma } from "../../config/database.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { MediaStoragePort } from "../../providers/storage/media-storage.port.js";
import { mediaStorage } from "../../providers/storage/s3-object-storage.adapter.js";
import { mediaError } from "../media/media.errors.js";
import { MediaService } from "../media/media.service.js";

export function publicReviewer(
  reviewId: string,
  customer: {
    firstName: string;
    lastName: string;
    mediaVersion: number;
    mediaImages: { id: string }[];
  },
) {
  return {
    displayName:
      [customer.firstName.trim(), customer.lastName.trim()].filter(Boolean).join(" ") ||
      "Customer",
    photoUrl: customer.mediaImages.length
      ? `/api/v1/public/support/reviews/${reviewId}/photo?v=${customer.mediaVersion}`
      : null,
  };
}

/** Public portraits are reachable only through a currently approved review. */
export class PublicReviewProfiles {
  private readonly media: MediaService;
  constructor(
    private readonly database: PrismaClient = prisma,
    storage: MediaStoragePort = mediaStorage,
  ) {
    this.media = new MediaService(database, storage);
  }

  async read(reviewId: string) {
    const review = await this.database.review.findFirst({
      where: { id: reviewId, status: "APPROVED" },
      select: {
        customer: {
          select: {
            mediaImages: {
              take: 1,
              select: {
                asset: { select: { objectKey: true, sizeBytes: true, mimeType: true } },
              },
            },
          },
        },
      },
    });
    const image = review?.customer.mediaImages[0];
    if (!image) throw mediaError("NOT_FOUND", 404);
    return { bytes: await this.media.read(image.asset), mimeType: image.asset.mimeType };
  }
}
