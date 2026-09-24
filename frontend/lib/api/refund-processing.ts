"use client";
import { z } from "zod";
import { refundSchema } from "./staff-payment-schemas";
import { apiRequest } from "./client";
import type { RequestBody } from "./contracts";
import { prepareSignedUpload, type UploadOptions } from "./signed-upload";
import { validatePaymentEvidence } from "./payment-evidence";
const date = z.iso.datetime({ offset: true }).nullable();
export const refundProcessingSchema = refundSchema.extend({
  paymentAttempt: z.object({ provider: z.enum(["MANUAL", "PAYSTACK", "MONNIFY"]) }),
  authorizationKind: z.string(),
  dueAt: date,
  clockStatus: z.string(),
  transferredByUserId: z.uuid().nullable(),
  transferRecordedAt: date,
  bankTransferAt: date,
  checkedByUserId: z.uuid().nullable(),
  checkedAt: date,
});
export type ProcessingRefund = z.infer<typeof refundProcessingSchema>;
export const parseProcessingRefunds = (value: unknown) =>
  z
    .object({ items: z.array(refundProcessingSchema), nextCursor: z.uuid().optional() })
    .parse(value);
export const refundActionSchema = z.object({
  id: z.uuid(),
  status: z.enum(["PROCESSING", "SUCCEEDED", "NEEDS_ATTENTION"]),
  amountKobo: z.string().regex(/^\d+$/),
  bankReference: z.string().nullable(),
  transferredAt: date,
  transferredByUserId: z.uuid().nullable(),
  checkedAt: date,
  checkedByUserId: z.uuid().nullable(),
});
export const refundEvidenceSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  amountKobo: z.string().regex(/^\d+$/),
  bankReference: z.string().min(3),
  transferredAt: z.iso.datetime({ offset: true }),
  beneficiary: z.object({
    bankName: z.string().min(2),
    accountName: z.string().min(2),
    accountNumber: z.string().regex(/^\d{10}$/),
  }),
});
export function prepareRefundEvidence(options: UploadOptions & { refundId: string }) {
  const mimeType = validatePaymentEvidence(options.file);
  return prepareSignedUpload({
    ...options,
    prepare: async (metadata) => {
      const body: RequestBody<"/staff/refunds/{refundId}/evidence-upload", "post"> = {
        ...metadata,
        mimeType,
      };
      const result = await apiRequest(
        `/staff/refunds/${options.refundId}/evidence-upload`,
        { method: "POST", csrf: true, body, signal: options.signal },
      );
      const response = z
        .object({ evidenceToken: z.string().min(80).max(4096), upload: z.unknown() })
        .parse(result.data);
      return { token: response.evidenceToken, upload: response.upload };
    },
  });
}
