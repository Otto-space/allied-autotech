"use client";
import { useCallback, useState } from "react";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
const previewSchema = z.object({
  revision: z.string().regex(/^[0-9a-f]{64}$/),
  groups: z
    .array(
      z.object({
        id: z.uuid().nullable(),
        name: z.string(),
        action: z.enum(["create", "reuse"]),
        isActive: z.boolean(),
      }),
    )
    .length(8),
  tyre: z
    .object({ id: z.uuid(), name: z.string(), categoryId: z.uuid().nullable() })
    .nullable(),
});
const resultSchema = z
  .object({
    created: z.number().int().min(0).max(8),
    reused: z.number().int().min(0).max(8),
    assigned: z.boolean(),
    serviceId: z.uuid().nullable(),
    categoryIds: z.array(z.uuid()).length(8),
  })
  .refine((r) => r.created + r.reused === 8 && new Set(r.categoryIds).size === 8);
export function OwnerServiceStructure({
  onSaved,
  disabled,
}: {
  onSaved: () => void;
  disabled: boolean;
}) {
  const [proposal, setProposal] = useState<MutationProposal>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reset = useCallback(() => {
    setProposal(undefined);
    setMessage("");
    setError("");
  }, []);
  const operation = useAccountMutation(reset);
  async function review() {
    const controller = operation.begin();
    if (!controller) return;
    setError("");
    setMessage("");
    try {
      const plan = previewSchema.parse(
        (
          await apiRequest("/admin/service-categories/owner-structure", {
            signal: controller.signal,
          })
        ).data,
      );
      if (controller.signal.aborted) return;
      setProposal({
        title: "Review owner service groups",
        description:
          "Create missing groups and reuse existing records. Existing descriptions, URLs and visibility stay as recorded. Tyre Change is assigned only if it has no group. Prices, durations and bookings stay unchanged.",
        facts: [
          ...plan.groups.map((g) => ({
            label: g.name,
            value:
              g.action === "create"
                ? "Create and publish group"
                : g.isActive
                  ? "Reuse published group"
                  : "Reuse inactive group; it stays hidden",
          })),
          {
            label: "Tyre Change",
            value: plan.tyre
              ? plan.tyre.categoryId
                ? "Keep its existing group"
                : "Assign to Tyre & Wheel Maintenance"
              : "Not found; no service will be created",
          },
        ],
        retryAfterRejection: false,
        onUncertain: () =>
          setError(
            "The result is uncertain. Close this review and review the current groups again before continuing.",
          ),
        submit: async () => {
          const write = operation.begin();
          if (!write) throw Error("Another operation is in progress.");
          try {
            const receipt = resultSchema.parse(
              (
                await apiRequest("/admin/service-categories/owner-structure", {
                  method: "POST",
                  csrf: true,
                  body: { expectedRevision: plan.revision },
                  signal: write.signal,
                })
              ).data,
            );
            if (write.signal.aborted)
              throw new DOMException("Account changed", "AbortError");
            setMessage(
              `Service groups saved: ${receipt.created} created, ${receipt.reused} reused.${receipt.assigned ? " Tyre Change is now grouped under Tyre & Wheel Maintenance." : ""}`,
            );
          } finally {
            operation.finish(write);
          }
        },
      });
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "The service groups could not be reviewed.",
        );
    } finally {
      operation.finish(controller);
    }
  }
  return (
    <section aria-label="Owner service structure">
      <button
        className="button secondary"
        type="button"
        disabled={disabled}
        aria-disabled={operation.busy}
        aria-busy={operation.busy}
        onClick={review}
      >
        Review owner service groups
      </button>
      <Feedback message={error} />
      <Feedback message={message} tone="success" />
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Apply service groups"
          onClose={() => setProposal(undefined)}
          onSuccess={onSaved}
        />
      )}
    </section>
  );
}
