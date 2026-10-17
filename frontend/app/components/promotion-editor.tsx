"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import type { Promotion } from "@/lib/api/promotion-schemas";
import {
  clearPromotionPending,
  markPromotionPending,
  parsePromotionDetail,
  pendingPromotionKey,
  promotionSnapshot,
  readPromotionPending,
} from "@/lib/admin/promotion-detail";
import {
  promotionBody,
  promotionFormDraftKey,
  type PromotionValues,
} from "@/lib/forms/promotion";
import { draftIdentity, draftKey, forgetDraft } from "@/lib/forms/drafts";
import { formatKobo } from "@/lib/format/money";
import { promotionDiscount, formatPromotionDate } from "./promotion-summary";
import { PromotionForm } from "./promotion-form";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
export function PromotionEditor({
  current,
  owner,
  role,
  disabled = false,
  onRefresh,
  onObserved,
}: {
  current: Promotion;
  owner: string;
  role: string;
  disabled?: boolean;
  onRefresh: () => void;
  onObserved: (value: Promotion) => void;
}) {
  const [base, setBase] = useState(current),
    [editorRevision, setEditorRevision] = useState(0);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const key = pendingPromotionKey(owner, role, current.id);
  const [pending, setPending] = useState(() => readPromotionPending(key));
  const [checking, setChecking] = useState(false),
    [message, setMessage] = useState<string>(),
    [recoveryMessage, setRecoveryMessage] = useState<string>();
  const active = useRef(true),
    request = useRef<AbortController | null>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const changed = promotionSnapshot(current) !== promotionSnapshot(base);
  async function verifiedCurrent(signal: AbortSignal) {
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
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    return parsePromotionDetail(
      (await apiRequest(`/admin/promotions/${current.id}`, { signal })).data,
      current.id,
    );
  }
  function clearFormDraft() {
    forgetDraft(
      draftKey(
        `${owner}:${role}`,
        `/admin/promotions/${current.id}`,
        promotionFormDraftKey(current.id),
      ),
    );
  }
  async function loadCurrent() {
    if (disabled || checking || request.current || proposal) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setMessage(undefined);
    setRecoveryMessage(undefined);
    try {
      const observed = await verifiedCurrent(controller.signal);
      if (pending && pending !== "unknown" && observed.version < pending.version)
        throw Error("Unexpected older promotion record");
      if (
        !active.current ||
        controller.signal.aborted ||
        draftIdentity() !== `${owner}:${role}`
      )
        return;
      clearPromotionPending(key);
      clearFormDraft();
      setBase(observed);
      setPending(undefined);
      setEditorRevision((v) => v + 1);
      setRecoveryMessage(
        "Current saved settings loaded. The previous save outcome is not proven by this read. Review these settings before another change. Nothing was resent.",
      );
      heading.current?.focus();
      onObserved(observed);
    } catch (error) {
      if (
        error instanceof ApiError &&
        [401, 403, 404].includes(error.status) &&
        active.current
      )
        onRefresh();
      if (active.current)
        setRecoveryMessage(
          "Current settings could not be loaded safely. The editor remains locked. Nothing was resent.",
        );
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  function review(value: PromotionValues) {
    if (disabled || proposal || pending || changed || checking || !active.current) return;
    const body = promotionBody(value, base);
    const optionalMoney = (value: string | null | undefined) =>
      value == null ? "Not set" : formatKobo(value);
    setMessage(undefined);
    setRecoveryMessage(undefined);
    setProposal({
      title: "Review promotion changes",
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
        { label: "Minimum subtotal", value: optionalMoney(body.minimumOrderAmountKobo) },
        { label: "Discount cap", value: optionalMoney(body.maximumDiscountAmountKobo) },
        { label: "Total usage limit", value: body.usageLimit?.toString() ?? "Not set" },
        {
          label: "Per-customer limit",
          value: body.perCustomerLimit?.toString() ?? "Not set",
        },
        { label: "Starts", value: formatPromotionDate(body.startsAt) },
        { label: "Ends", value: formatPromotionDate(body.endsAt) },
        { label: "Configuration", value: body.isActive ? "Enabled" : "Disabled" },
        { label: "Record version", value: String(base.version) },
      ],
      retryAfterRejection: false,
      onUncertain: () => {
        if (active.current) setPending(readPromotionPending(key));
      },
      submit: async () => {
        if (request.current || !active.current) throw Error("Editing is blocked");
        const controller = new AbortController();
        request.current = controller;
        let posted = false;
        try {
          const latest = await verifiedCurrent(controller.signal);
          if (promotionSnapshot(latest) !== promotionSnapshot(base)) {
            onObserved(latest);
            throw new ApiError(409, { error: { code: "STALE_VERSION" } });
          }
          if (
            !active.current ||
            controller.signal.aborted ||
            draftIdentity() !== `${owner}:${role}`
          )
            throw Error("Session changed");
          markPromotionPending(owner, role, base.id, base.version);
          posted = true;
          setPending({ version: base.version });
          const saved = parsePromotionDetail(
            (
              await apiRequest(`/admin/promotions/${base.id}`, {
                method: "PATCH",
                csrf: true,
                body: { ...body, expectedVersion: base.version },
                signal: controller.signal,
              })
            ).data,
            base.id,
          );
          const matches = Object.entries(body).every(([key, value]) => {
            const actual = saved[key as keyof typeof body];
            return (key === "startsAt" || key === "endsAt") &&
              typeof value === "string" &&
              typeof actual === "string"
              ? Date.parse(actual) === Date.parse(value)
              : actual === value;
          });
          if (!matches || saved.version !== base.version + 1)
            throw Error("Unexpected promotion change result");
          if (
            !active.current ||
            controller.signal.aborted ||
            draftIdentity() !== `${owner}:${role}`
          )
            throw Error("Session changed");
          clearPromotionPending(key);
          clearFormDraft();
          setPending(undefined);
          setBase(saved);
          onObserved(saved);
        } catch (error) {
          if (posted && error instanceof ApiError && [408, 429].includes(error.status))
            throw Error("The update response needs reconciliation");
          if (
            posted &&
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) {
            clearPromotionPending(key);
            if (active.current) setPending(undefined);
            if (active.current) onRefresh();
          }
          if (
            !posted &&
            error instanceof ApiError &&
            [401, 403].includes(error.status) &&
            active.current
          )
            onRefresh();
          throw error;
        } finally {
          request.current = null;
        }
      },
    });
  }
  return (
    <section className="pc-editor" aria-labelledby="promotion-editor-title">
      <h2 id="promotion-editor-title" ref={heading} tabIndex={-1}>
        Edit promotion
      </h2>
      <Feedback message={message} tone="success" toast="Promotion change recorded." />
      {recoveryMessage && (
        <p className="notice" role="status">
          {recoveryMessage}
        </p>
      )}
      {pending ? (
        <div className="pc-recovery" role="status">
          <h3>Check the previous save</h3>
          <p>
            The save could not be confirmed. This editor stays locked through reload and
            will not resend the request. Load the current saved settings before making
            another change; the previous form draft will be replaced.
          </p>
          <button
            className="button secondary"
            disabled={disabled || checking || !!proposal}
            onClick={() => void loadCurrent()}
          >
            {checking ? "Loading current settings…" : "Load current settings"}
          </button>
        </div>
      ) : (
        changed && (
          <div className="pc-recovery">
            <h3>This promotion has changed</h3>
            <p>
              Your draft is preserved. Reload the current saved settings before editing
              again; this replaces the previous draft.
            </p>
            <button
              className="button secondary"
              disabled={disabled || checking || !!proposal}
              onClick={() => void loadCurrent()}
            >
              {checking ? "Loading current settings…" : "Reload promotion editor"}
            </button>
          </div>
        )
      )}
      <PromotionForm
        key={`${base.version}:${editorRevision}`}
        item={base}
        grouped
        disabled={disabled || !!pending || changed || checking}
        onReview={review}
      />
      {proposal && (
        <MutationReview
          proposal={proposal}
          exposeBusyState
          onClose={() => {
            setProposal(null);
            if (pending || changed) queueMicrotask(() => heading.current?.focus());
          }}
          onSuccess={() => setMessage("Promotion changes confirmed.")}
        />
      )}
    </section>
  );
}
