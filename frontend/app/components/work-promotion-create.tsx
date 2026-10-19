"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, ClipboardList, Layers, Tag } from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { promotionSchema } from "@/lib/api/promotion-schemas";
import {
  clearPromotionCreation,
  newPromotionCreation,
  parsePromotionReceipt,
  promotionCreationActive,
  readPromotionCreation,
  savePromotionCreation,
  type PromotionCreationIntent,
  type PromotionCreationState,
} from "@/lib/admin/promotion-creation";
import { draftIdentity, draftKey, forgetDraft } from "@/lib/forms/drafts";
import {
  promotionBody,
  promotionFormDraftKey,
  type PromotionValues,
} from "@/lib/forms/promotion";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { PromotionForm } from "./promotion-form";
import { formatPromotionDate, promotionDiscount } from "./promotion-summary";

export function WorkPromotionCreate() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Create promotion</h1>
        <Feedback message="Administrator access is required to manage promotions." />
      </>
    );
  return (
    <CreationWorkspace
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function CreationWorkspace({ owner, role }: { owner: string; role: string }) {
  const [recovery, setRecovery] = useState<PromotionCreationState | undefined>(() =>
    readPromotionCreation(owner, role),
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [checking, setChecking] = useState(false),
    [message, setMessage] = useState<string>();
  const active = useRef(true),
    request = useRef<AbortController | null>(null),
    resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  async function verifyAccess(signal: AbortSignal) {
    const access = parseOwnStaffProfile(
      (await apiRequest("/staff/profile", { signal })).data,
    );
    if (
      access.id !== owner ||
      access.role !== role ||
      access.status !== "ACTIVE" ||
      !["ADMIN", "SUPER_ADMIN"].includes(access.role) ||
      draftIdentity() !== `${owner}:${role}` ||
      !active.current ||
      signal.aborted
    )
      throw Error("Current administrator access could not be confirmed");
  }
  function confirmed(intent: PromotionCreationIntent, promotionId: string) {
    const state = {
      kind: "confirmed" as const,
      owner: intent.owner,
      role: intent.role,
      key: intent.key,
      promotionId,
    };
    savePromotionCreation(state);
    forgetDraft(
      draftKey(`${owner}:${role}`, "/admin/promotions/new", promotionFormDraftKey()),
    );
    if (active.current) {
      setRecovery(state);
      setMessage(undefined);
    }
  }
  function review(values: PromotionValues, retry?: PromotionCreationIntent) {
    if (proposal || checking || (recovery && !retry) || !active.current) return;
    const intent = retry ?? newPromotionCreation(owner, role, values),
      body = promotionBody(intent.values);
    let sent = !!retry;
    const money = (value: string | null | undefined) =>
      value == null ? "Not set" : formatKobo(value);
    setProposal({
      title: retry ? "Review original promotion request" : "Review new promotion",
      description:
        "These settings affect future checkout eligibility. Existing order discount snapshots stay unchanged. Enabling a promotion does not guarantee eligibility or reserve its use.",
      facts: [
        { label: "Name", value: body.name },
        { label: "Code", value: body.code ?? "None; not redeemable by customers" },
        { label: "Description", value: body.description ?? "Not recorded" },
        {
          label: "Discount",
          value: promotionDiscount({
            discountType: body.discountType,
            percentageBasisPoints: body.percentageBasisPoints ?? null,
            fixedAmountKobo: body.fixedAmountKobo ?? null,
          }),
        },
        { label: "Minimum subtotal", value: money(body.minimumOrderAmountKobo) },
        { label: "Discount cap", value: money(body.maximumDiscountAmountKobo) },
        { label: "Total usage limit", value: body.usageLimit?.toString() ?? "Not set" },
        {
          label: "Per-customer limit",
          value: body.perCustomerLimit?.toString() ?? "Not set",
        },
        { label: "Starts", value: formatPromotionDate(body.startsAt) },
        { label: "Ends", value: formatPromotionDate(body.endsAt) },
        { label: "Configuration", value: body.isActive ? "Enabled" : "Disabled" },
      ],
      retrySafely: true,
      retryAfterRejection: false,
      onUncertain: () => {
        if (active.current) setRecovery(readPromotionCreation(owner, role));
      },
      submit: async () => {
        if (request.current || !active.current) throw Error("Creation is blocked");
        const controller = new AbortController();
        request.current = controller;
        const wasRetry = sent;
        let posted = false;
        try {
          await verifyAccess(controller.signal);
          if (!promotionCreationActive(intent.key))
            throw Error("The recovery window has ended. Check saved promotions.");
          savePromotionCreation(intent);
          sent = true;
          posted = true;
          if (active.current) setRecovery(intent);
          const response = await apiRequest("/admin/promotions", {
            method: "POST",
            csrf: true,
            body,
            idempotencyKey: intent.key,
            signal: controller.signal,
          });
          const saved = promotionSchema
            .safeExtend({ replayed: z.boolean() })
            .parse(response.data);
          if (
            !saved.replayed &&
            (saved.version !== 0 ||
              !Object.entries(body).every(([key, value]) => {
                const actual = saved[key as keyof typeof body];
                return (key === "startsAt" || key === "endsAt") &&
                  typeof value === "string" &&
                  typeof actual === "string"
                  ? Date.parse(actual) === Date.parse(value)
                  : actual === value;
              }))
          )
            throw Error("Unexpected promotion creation result");
          if (
            !active.current ||
            controller.signal.aborted ||
            draftIdentity() !== `${owner}:${role}`
          )
            throw Error("Session changed");
          confirmed(intent, saved.id);
        } catch (error) {
          // A later rejected retry cannot disprove an earlier committed request.
          if (posted && error instanceof ApiError && [408, 429].includes(error.status))
            throw Error("The creation response needs reconciliation");
          if (
            posted &&
            !wasRetry &&
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            clearPromotionCreation(owner, role);
            sent = false;
            if (active.current) setRecovery(undefined);
          }
          throw error;
        } finally {
          request.current = null;
        }
      },
    });
  }
  async function checkSaved() {
    if (
      request.current ||
      checking ||
      typeof recovery !== "object" ||
      recovery.kind !== "pending"
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setMessage(undefined);
    try {
      await verifyAccess(controller.signal);
      const receipt = parsePromotionReceipt(
        (
          await apiRequest(`/admin/promotions/creation-receipts/${recovery.key}`, {
            signal: controller.signal,
          })
        ).data,
        recovery.key,
      );
      if (!active.current || controller.signal.aborted) return;
      if (receipt.promotionId) {
        confirmed(recovery, receipt.promotionId);
        resultHeading.current?.focus();
      } else
        setMessage(
          "No committed receipt is visible yet. Keep this request reference and review the original request to retry safely. Nothing was resent.",
        );
    } catch {
      if (active.current)
        setMessage(
          "The saved promotion could not be confirmed. Check your promotion records. This form remains locked and nothing was resent.",
        );
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  const saved =
    typeof recovery === "object" && recovery.kind === "confirmed" ? recovery : undefined;
  const pending =
    typeof recovery === "object" && recovery.kind === "pending" ? recovery : undefined;
  return (
    <div className="work-promotion-create">
      <nav className="pc-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin/promotions">Promotions</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">Create promotion</span>
      </nav>
      <header className="pc-header">
        <div>
          <h1>Create promotion</h1>
          <p>Set the offer, schedule and limits before reviewing.</p>
        </div>
        <Link className="pc-back" href="/admin/promotions">
          <ArrowLeft aria-hidden="true" />
          Back to promotions
        </Link>
      </header>
      <div className="pc-layout">
        <section className="pc-editor" aria-labelledby="pc-settings-title">
          <h2 id="pc-settings-title" ref={resultHeading} tabIndex={-1}>
            {saved ? "Promotion creation confirmed" : "Promotion settings"}
          </h2>
          {saved ? (
            <div className="pc-result" role="status">
              <h3>Promotion created</h3>
              <p>
                A saved promotion is linked to this request. Review its current settings
                before making further changes.
              </p>
              <Link className="button" href={`/admin/promotions/${saved.promotionId}`}>
                View created promotion
              </Link>
              <button
                className="button secondary"
                onClick={() => {
                  clearPromotionCreation(owner, role);
                  setRecovery(undefined);
                }}
              >
                Create another promotion
              </button>
            </div>
          ) : (
            <>
              {recovery && (
                <div className="pc-recovery" role="status">
                  <h3>{pending ? "Check the previous save" : "Creation needs review"}</h3>
                  <p>
                    {pending
                      ? "The previous save needs to be checked before another promotion is created. Reloading this page will keep this request locked."
                      : "The previous request could not be read safely. Check saved promotions before creating another offer. This form remains locked."}
                  </p>
                  {pending && (
                    <>
                      <button
                        className="button secondary"
                        disabled={checking || !!proposal}
                        onClick={() => void checkSaved()}
                      >
                        {checking ? "Checking saved promotion…" : "Check saved promotion"}
                      </button>
                      <button
                        className="button secondary"
                        disabled={
                          checking || !!proposal || !promotionCreationActive(pending.key)
                        }
                        onClick={() => review(pending.values, pending)}
                      >
                        Review original request
                      </button>
                      {!promotionCreationActive(pending.key) && (
                        <p>
                          The 24-hour retry window has ended. Check saved promotions; this
                          request will not be resent.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
              <Feedback message={message} />
              <PromotionForm
                grouped
                disabled={!!recovery || checking}
                onReview={review}
              />
            </>
          )}
        </section>
        <aside className="pc-guidance" aria-labelledby="pc-guidance-title">
          <h2 id="pc-guidance-title">Before you save</h2>
          <div>
            <ClipboardList aria-hidden="true" />
            <section>
              <h3>Review first</h3>
              <p>
                Review the exact amounts, dates and limits before creating this promotion.
              </p>
            </section>
          </div>
          <div>
            <Tag aria-hidden="true" />
            <section>
              <h3>Customer redemption</h3>
              <p>
                A code is required for customer redemption. Promotions without a code are
                not automatically applied.
              </p>
            </section>
          </div>
          <div>
            <Layers aria-hidden="true" />
            <section>
              <h3>Existing orders</h3>
              <p>Existing order discounts stay unchanged.</p>
            </section>
          </div>
        </aside>
      </div>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Create promotion"
          exposeBusyState
          onClose={() => {
            setProposal(null);
            if (recovery) queueMicrotask(() => resultHeading.current?.focus());
          }}
          onSuccess={() => resultHeading.current?.focus()}
        />
      )}
    </div>
  );
}
