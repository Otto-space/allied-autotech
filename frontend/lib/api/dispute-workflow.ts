"use client";
import { z } from "zod";
import { disputeSchema } from "./operations-schemas";
import { apiRequest } from "./client";
import type { RequestBody } from "./contracts";
import { prepareSignedUpload, type UploadOptions } from "./signed-upload";
import { validatePaymentEvidence } from "./payment-evidence";
import type { MutationProposal } from "@/app/components/mutation-review";
import { formatKobo } from "@/lib/format/money";
const date = z.iso.datetime({ offset: true }).nullable();
export const disputeWorkSchema = disputeSchema.extend({
  openedAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  responseDueAt: date,
  respondedAt: date,
  resolvedAt: date,
  primaryUserId: z.uuid().nullable(),
  backupUserId: z.uuid().nullable(),
  primaryOperator: z.object({ id: z.uuid(), label: z.string() }).nullable(),
  backupOperator: z.object({ id: z.uuid(), label: z.string() }).nullable(),
  acknowledgedAt: date,
  acknowledgedByUserId: z.uuid().nullable(),
  acknowledgementDueAt: date,
  providerSubmissionReference: z.string().nullable(),
  evidenceChecklist: z
    .object({
      invoice: z.literal(true),
      fulfillmentOrHandoverProof: z.literal(true),
      relevantCustomerMessages: z.literal(true),
      note: z.string(),
    })
    .nullable(),
});
export type DisputeWork = z.infer<typeof disputeWorkSchema>;
export const parseDisputeWork = (value: unknown) =>
  z
    .object({ items: z.array(disputeWorkSchema), nextCursor: z.uuid().nullable() })
    .parse(value);
export type DisputeChange =
  | { action: "assign"; body: RequestBody<"/staff/disputes/{id}/assign", "post"> }
  | {
      action: "acknowledge";
      body: RequestBody<"/staff/disputes/{id}/acknowledge", "post">;
    }
  | { action: "evidence"; body: RequestBody<"/staff/disputes/{id}/evidence", "post"> }
  | {
      action: "submission";
      body: RequestBody<"/staff/disputes/{id}/submission", "post">;
    };
export function disputeProposal(
  record: DisputeWork,
  change: DisputeChange,
  details: Pick<MutationProposal, "title" | "description" | "facts">,
  verify: (saved: DisputeWork) => boolean,
): MutationProposal {
  return {
    ...details,
    facts: [
      { label: "Dispute", value: record.providerDisputeId },
      { label: "Disputed amount", value: formatKobo(record.amountKobo) },
      ...details.facts,
    ],
    retryAfterRejection: false,
    submit: async () => {
      const saved = disputeWorkSchema.parse(
        (
          await apiRequest(`/staff/disputes/${record.id}/${change.action}`, {
            method: "POST",
            csrf: true,
            body: { ...change.body, expectedUpdatedAt: record.updatedAt },
          })
        ).data,
      );
      if (
        saved.id !== record.id ||
        saved.paymentAttemptId !== record.paymentAttemptId ||
        saved.amountKobo !== record.amountKobo ||
        saved.status !== record.status ||
        !verify(saved)
      )
        throw new Error("Unexpected dispute action result");
    },
  };
}
export function prepareDisputeEvidence(options: UploadOptions & { disputeId: string }) {
  const mimeType = validatePaymentEvidence(options.file);
  return prepareSignedUpload({
    ...options,
    prepare: async (metadata) => {
      const body: RequestBody<"/staff/disputes/{id}/evidence-upload", "post"> = {
        ...metadata,
        mimeType,
      };
      const result = await apiRequest(
        `/staff/disputes/${options.disputeId}/evidence-upload`,
        { method: "POST", csrf: true, body, signal: options.signal },
      );
      const saved = z
        .object({ evidenceToken: z.string().min(80).max(4096), upload: z.unknown() })
        .parse(result.data);
      return { token: saved.evidenceToken, upload: saved.upload };
    },
  });
}
