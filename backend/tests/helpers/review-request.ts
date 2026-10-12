import { randomUUID } from "node:crypto";
export const newReviewRequestKey = (issuedAt = Date.now()) =>
  `review-v1.${issuedAt}.${randomUUID()}`;
