"use client";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  SESSION_CHANGED,
  type RequestOptions,
} from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { purchaseRequest, subscribePurchaseAccess } from "@/lib/purchase/client";
import { WORKFORCE_ACCESS_CHANGED } from "@/lib/workforce-invalidation";
import { parseWorkPayment, parsePaymentRefund } from "@/lib/admin/work-payments";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import {
  parseSupplySummary,
  selectedSupplyRanges,
  supplyRangeSignature,
  supplyChoice,
  supplyKind,
  supplyKindLabels,
  supplyChoiceLabels,
  supplyRefundLabels,
  supplyChoiceLocked,
  remainingSupplyRefundAmount,
  type SupplySummary,
  type SupplyOrder,
} from "@/lib/order-supply-concerns";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import styles from "./order-supply-concerns.module.css";

type Props = {
  order: SupplyOrder & {
    paymentReferences?: { id: string; paymentNumber: string; status: string }[];
  };
  audience: "customer" | "guest" | "staff";
  administrator?: boolean;
  actorUserId?: string;
  disabled?: boolean;
  onSaved: () => void;
  onBusyChange?: (value: boolean) => void;
};
type Review = {
  reset?: () => void;
  action: "raise" | "choice" | "refund";
  body: Record<string, unknown>;
  title: string;
  facts: { label: string; value: string }[];
};
const paragraph = (value: FormDataEntryValue | null, optional = false) => {
  const text = String(value ?? "").trim();
  return optional && !text
    ? undefined
    : z
        .string()
        .min(12)
        .max(1000)
        .refine((value) => !/[\x00-\x1f\x7f]/.test(value))
        .parse(text);
};
export function OrderSupplyConcerns(props: Props) {
  if (props.order.supplyConcernCapabilityVersion !== 1) return null;
  return <SupplyPanel key={`${props.audience}:${props.order.id}`} {...props} />;
}
function SupplyPanel({
  order,
  audience,
  administrator = false,
  actorUserId,
  disabled = false,
  onSaved,
  onBusyChange,
}: Props) {
  const id = useId(),
    staff = audience === "staff";
  const path = `/${audience === "guest" ? "purchase" : staff ? "staff" : "customers"}/orders/${order.id}/supply-exceptions`;
  const [summary, setSummary] = useState<SupplySummary>(),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string>(),
    [notice, setNotice] = useState<string>(),
    [changed, setChanged] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [revision, setRevision] = useState(0),
    [focusRefundId, setFocusRefundId] = useState<string>();
  const alive = useRef(true),
    write = useRef<AbortController | null>(null),
    pending = useRef<MutationProposal | null>(null);
  const [actionError, setActionError] = useState(false);
  const request = useCallback(
    (endpoint: string, options: RequestOptions = {}) =>
      audience === "guest"
        ? purchaseRequest(endpoint, options)
        : apiRequest(endpoint, { ...options, csrf: options.method === "POST" }),
    [audience],
  );
  const discard = useCallback(() => {
    alive.current = false;
    write.current?.abort();
    pending.current = null;
    setProposal(null);
    setSummary(undefined);
    setFocusRefundId(undefined);
    setNotice(undefined);
    setError(undefined);
    setChanged(true);
  }, []);
  useEffect(() => {
    alive.current = true;
    window.addEventListener(SESSION_CHANGED, discard);
    window.addEventListener(WORKFORCE_ACCESS_CHANGED, discard);
    const unsubscribe =
      audience === "guest" ? subscribePurchaseAccess(discard) : () => {};
    return () => {
      alive.current = false;
      write.current?.abort();
      pending.current = null;
      window.removeEventListener(SESSION_CHANGED, discard);
      window.removeEventListener(WORKFORCE_ACCESS_CHANGED, discard);
      unsubscribe();
    };
  }, [audience, discard]);
  useEffect(() => {
    const abort = new AbortController();
    void Promise.resolve()
      .then(() => {
        if (!abort.signal.aborted && alive.current) setLoading(true);
        return request(path, { signal: abort.signal });
      })
      .then((result) => {
        const data = parseSupplySummary(result.data, order);
        if (!abort.signal.aborted && alive.current) {
          setSummary(data);
          setError(undefined);
        }
      })
      .catch((cause) => {
        if (!abort.signal.aborted && alive.current) {
          if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) {
            discard();
          }
          setError(
            "Supply details could not be confirmed. Retry before making another request.",
          );
        }
      })
      .finally(() => {
        if (!abort.signal.aborted && alive.current) setLoading(false);
      });
    return () => abort.abort();
    // Item identities/quantities are immutable. The actual order version revalidates this view.
  }, [path, request, order, revision, discard]);
  // Wait for the intentional save's refresh and dialog focus restoration. Passive
  // reads never set this target, so refresh/navigation cannot steal focus.
  useEffect(() => {
    if (!focusRefundId || proposal || loading || disabled || changed || error) return;
    const frame = requestAnimationFrame(() => {
      if (!alive.current) return;
      const link = document.getElementById(`${id}-refund-${focusRefundId}`);
      if (!link) return;
      link.focus({ preventScroll: true });
      link.scrollIntoView({ block: "nearest" });
      setFocusRefundId(undefined);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRefundId, proposal, loading, disabled, changed, error, summary, id]);
  const blocked =
    disabled ||
    loading ||
    changed ||
    uncertain ||
    !!error ||
    !summary ||
    summary.orderVersion !== order.version ||
    !!proposal;
  function review(change: Review) {
    if (blocked || !summary) return;
    setActionError(false);
    setError(undefined);
    setNotice(undefined);
    const expected = summary.orderVersion,
      nonce = crypto.randomUUID();
    const body =
      change.action === "refund"
        ? change.body
        : { ...change.body, expectedVersion: expected, idempotencyKey: nonce };
    const confirmed = (data: SupplySummary) =>
      change.action === "choice"
        ? data.items.some(
            (row) =>
              row.id === body.supplyExceptionId &&
              row.supplyRemedyChoices.some(
                (choice) =>
                  choice.orderVersion === expected &&
                  choice.choice === body.choice &&
                  choice.customerNote === String(body.customerNote ?? ""),
              ),
          )
        : change.action === "raise" &&
          data.items.some(
            (row) =>
              row.kind === body.kind &&
              row.customerNote === body.customerNote &&
              row.reason === body.reason &&
              supplyRangeSignature(row.affectedLines) ===
                supplyRangeSignature(
                  body.affectedLines as SupplySummary["items"][number]["affectedLines"],
                ),
          );
    let confirmedRefundId: string | undefined;
    const next: MutationProposal = {
      title: change.title,
      description:
        "Review this order and actual affected goods. This request does not accept a substitute, approve money, confirm a bank receipt or authorise collection.",
      facts: change.facts,
      retrySafely: true,
      retryAfterRejection: false,
      onUncertain: () => {
        if (alive.current) setUncertain(true);
      },
      onConfirmed: () => {
        pending.current = null;
        if (alive.current) {
          setUncertain(false);
          change.reset?.();
          if (confirmedRefundId) setFocusRefundId(confirmedRefundId);
        }
      },
      submit: async () => {
        if (!alive.current) return;
        const abort = new AbortController();
        write.current = abort;
        onBusyChange?.(true);
        try {
          const fresh = parseSupplySummary(
            (await request(path, { signal: abort.signal })).data,
            order,
          );
          if (!alive.current) return;
          if (change.action !== "refund" && confirmed(fresh)) {
            setSummary(fresh);
            return;
          }
          if (change.action !== "refund" && fresh.orderVersion !== expected) {
            setSummary(fresh);
            setError(
              "The order changed. Close the review, refresh this order and review the current facts.",
            );
            throw new ApiError(409, { error: { code: "CONFLICT" } });
          }
          const response =
            change.action === "refund"
              ? await apiRequest("/staff/payments/refunds", {
                  method: "POST",
                  csrf: true,
                  idempotencyKey: nonce,
                  body,
                  signal: abort.signal,
                })
              : await request(path + (change.action === "choice" ? "/choice" : ""), {
                  method: "POST",
                  body,
                  signal: abort.signal,
                });
          if (!alive.current) return;
          if (change.action === "refund") {
            const envelope = z
              .object({ refund: z.unknown(), replayed: z.boolean() })
              .parse(response.data);
            const receipt = parsePaymentRefund(envelope.refund);
            if (
              receipt.requestedByUserId !== actorUserId ||
              receipt.paymentAttemptId !== body.paymentAttemptId ||
              receipt.supplyRemedyChoiceId !== body.supplyRemedyChoiceId ||
              receipt.amountKobo !== body.amountKobo ||
              receipt.reason !== body.reason ||
              (!envelope.replayed && receipt.status !== "REQUESTED")
            )
              throw Error("Unconfirmed refund receipt");
            confirmedRefundId = receipt.id;
            setSummary((previous) =>
              previous
                ? {
                    ...previous,
                    items: previous.items.map((row) => ({
                      ...row,
                      supplyRemedyChoices: row.supplyRemedyChoices.map((choice) =>
                        choice.id !== body.supplyRemedyChoiceId
                          ? choice
                          : {
                              ...choice,
                              refunds: [
                                {
                                  id: receipt.id,
                                  amountKobo: receipt.amountKobo,
                                  currency: receipt.currency,
                                  status: receipt.status,
                                  requestedAt: receipt.requestedAt,
                                  processedAt: receipt.processedAt,
                                },
                                ...choice.refunds.filter(
                                  (refund) => refund.id !== receipt.id,
                                ),
                              ].slice(0, 25),
                            },
                      ),
                    })),
                  }
                : previous,
            );
          } else {
            const saved = parseSupplySummary(response.data, order);
            if (saved.orderVersion < expected + 1 || !confirmed(saved))
              throw Error("Unconfirmed supply receipt");
            setSummary(saved);
          }
        } finally {
          if (alive.current) onBusyChange?.(false);
        }
      },
    };
    pending.current = next;
    setProposal(next);
  }
  function invalid() {
    setActionError(true);
    setError(
      "Check the selected goods, whole-unit quantities, notes and explicit confirmation before reviewing.",
    );
  }
  if (changed)
    return (
      <section className={`card ${styles.section}`}>
        <Feedback message="Your access changed. Reload this order before continuing." />
      </section>
    );
  if (!staff && !summary?.items.length && !loading && !error) return null;
  return (
    <section
      className={`card ${styles.section}`}
      aria-labelledby={`${id}-title`}
      data-order-supply-concerns
    >
      <h2 id={`${id}-title`}>Order supply review</h2>
      <p>
        Keep the original order and Care history together. A remedy request is separate
        from payment, financial approval and physical collection.
      </p>
      {loading && <p role="status">Checking supply details...</p>}
      <Feedback message={error} scrollToMessage={actionError} />
      <Feedback message={notice} tone="info" scrollToMessage />
      {summary && summary.orderVersion !== order.version && (
        <Feedback
          message="This order changed. Refresh the order before another request."
          tone="info"
        />
      )}
      {uncertain && (
        <Feedback message="The earlier outcome is uncertain. Review the original request using its existing reference; do not start another one." />
      )}
      <div className="actions">
        <button
          className="button secondary"
          disabled={loading || !!proposal}
          onClick={() => {
            setActionError(false);
            setRevision((value) => value + 1);
            onSaved();
          }}
        >
          Refresh supply details
        </button>
        {uncertain && !proposal && (
          <button
            className="button secondary"
            onClick={() => setProposal(pending.current)}
          >
            Review original request
          </button>
        )}
      </div>
      {summary?.items.map((row) => (
        <article className={styles.case} key={row.id} aria-labelledby={`${id}-${row.id}`}>
          <h3 id={`${id}-${row.id}`}>{supplyKindLabels[row.kind]}</h3>
          <p>{row.customerNote}</p>
          <ul>
            {row.affectedLines.map((line) => (
              <li key={`${line.orderItemId}:${line.offset}`}>
                {order.items.find((item) => item.id === line.orderItemId)!.productName}:{" "}
                {line.quantity} affected unit{line.quantity === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
          {row.monetaryBasis.status === "SAVED_ORDER_ALLOCATION" &&
          row.monetaryBasis.amounts ? (
            <p>
              Saved affected amount for review:{" "}
              <strong>{formatKobo(row.monetaryBasis.amounts.totalKobo)}</strong>,
              including saved VAT of {formatKobo(row.monetaryBasis.amounts.taxKobo)}. This
              is not financial approval.
            </p>
          ) : (
            <p>
              {row.kind === "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE"
                ? "Technical assessment is required; no general return or warranty entitlement is assumed."
                : "Finance must review the original invoice and any attributable charges before a refund amount can be requested."}
            </p>
          )}
          {staff && administrator && row.reason && (
            <details>
              <summary>Internal concern note</summary>
              <p>{row.reason}</p>
            </details>
          )}
          <p>
            Care case:{" "}
            <Link
              href={
                staff
                  ? `/admin/support/enquiries/${row.enquiryId}`
                  : audience === "customer"
                    ? `/dashboard/support/enquiries/${row.enquiryId}`
                    : "/contact#enquiry"
              }
            >
              {audience === "guest" ? "Contact Customer Care" : "Open this Care case"}
            </Link>
          </p>
          {row.supplyRemedyChoices.map((choice, index) => (
            <details key={choice.id} open={index === 0}>
              <summary>
                {index === 0 ? "Latest request" : "Earlier request"}:{" "}
                {supplyChoiceLabels[choice.choice]} -{" "}
                {formatBusinessDate(choice.createdAt)}
              </summary>
              {choice.customerNote && <p>{choice.customerNote}</p>}
              {choice.choice === "SUITABLE_ALTERNATIVE_REVIEW" && (
                <p>
                  This asks Care to find an offer. No product, price, store credit or new
                  payment has been accepted.
                </p>
              )}
              {choice.choice === "REFUND_REVIEW" && (
                <p>
                  A refund review request is not money returned. A separate authorised
                  operator must approve financial action.
                </p>
              )}
              {choice.refunds.length > 0 && (
                <ul>
                  {choice.refunds.map((refund) => (
                    <li key={refund.id}>
                      {formatKobo(refund.amountKobo)}: {supplyRefundLabels[refund.status]}
                      {refund.status === "SUCCEEDED" && (
                        <>
                          . Bank posting times may vary; contact Care if funds have not
                          arrived.
                        </>
                      )}
                      {staff && (
                        <>
                          .{" "}
                          <Link
                            id={`${id}-refund-${refund.id}`}
                            href={`/admin/refunds?refundId=${refund.id}`}
                          >
                            Open refund record
                          </Link>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {choice.hasMoreRefunds && (
                <p>
                  Additional refund history needs financial review before another request.
                </p>
              )}
            </details>
          ))}
          {row.hasMoreChoices && (
            <p>
              More request history is retained. Ask Customer Care to review the complete
              case.
            </p>
          )}
          {!staff && !supplyChoiceLocked(row) && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (blocked) return;
                try {
                  const element = event.currentTarget;
                  const form = new FormData(element),
                    choice = supplyChoice.parse(form.get("choice"));
                  if (
                    (row.kind === "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE") !==
                    (choice === "TECHNICAL_REVIEW")
                  )
                    throw Error("Assessment required");
                  z.literal("on").parse(form.get("confirmed"));
                  const note = paragraph(form.get("customerNote"), true);
                  review({
                    action: "choice",
                    reset: () => element.reset(),
                    title: "Send this remedy request?",
                    body: {
                      supplyExceptionId: row.id,
                      choice,
                      ...(note ? { customerNote: note } : {}),
                      statementVersion: summary.choiceStatementVersion,
                      choiceConfirmed: true,
                    },
                    facts: [
                      { label: "Preferred next step", value: supplyChoiceLabels[choice] },
                      { label: "Your note", value: note ?? "No additional note" },
                    ],
                  });
                } catch {
                  invalid();
                }
              }}
            >
              <fieldset className={styles.fields} disabled={blocked}>
                <legend>Your preferred next step</legend>
                <label>
                  Request
                  <select className="input" name="choice" required defaultValue="">
                    <option value="" disabled>
                      Choose a next step
                    </option>
                    {row.kind === "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE" ? (
                      <option value="TECHNICAL_REVIEW">
                        Request technical assessment
                      </option>
                    ) : (
                      <>
                        <option value="REFUND_REVIEW">Request refund review</option>
                        <option value="SUITABLE_ALTERNATIVE_REVIEW">
                          Ask for a suitable alternative
                        </option>
                      </>
                    )}
                  </select>
                </label>
                <label>
                  Your note (optional, one paragraph, 12-1,000 characters)
                  <textarea
                    className="input"
                    name="customerNote"
                    minLength={12}
                    maxLength={1000}
                  />
                </label>
                <label className={styles.check}>
                  <input type="checkbox" name="confirmed" required />I am requesting
                  review. This does not accept a substitute, approve a payment or confirm
                  a refund.
                </label>
                <button className="button" type="submit">
                  Review remedy request
                </button>
              </fieldset>
            </form>
          )}
          {!staff && supplyChoiceLocked(row) && (
            <p>
              A financial request or additional history needs reconciliation before
              another choice. Contact this Care case to discuss a change.
            </p>
          )}
          {staff && administrator && actorUserId && (
            <SupplyRefundForm
              order={order}
              row={row}
              disabled={blocked}
              review={review}
            />
          )}
        </article>
      ))}
      {summary?.hasMore && (
        <p>
          More supply concerns are retained. Customer Care must inspect the complete
          history.
        </p>
      )}
      {staff && summary && !summary.items.length && (
        <p>No supply concern has been recorded for this order.</p>
      )}
      {staff && administrator && summary && order.status !== "CANCELLED" && (
        <details
          onToggle={(event) => {
            if (event.currentTarget.open)
              event.currentTarget
                .querySelector("form")
                ?.scrollIntoView({ block: "nearest" });
          }}
        >
          <summary>Record a supply concern</summary>
          <SupplyIntake
            order={order}
            disabled={blocked}
            review={review}
            invalid={invalid}
          />
        </details>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          disabledReason={
            changed
              ? "Your access changed."
              : disabled
                ? "Wait for this order's current action or refresh to finish."
                : undefined
          }
          onClose={() => setProposal(null)}
          confirmLabel="Confirm request"
          onSuccess={() => {
            setNotice(
              "Request record checked. Read the current Care and refund status below; collection and money returned remain separate.",
            );
            setRevision((value) => value + 1);
            onSaved();
          }}
        />
      )}
    </section>
  );
}
function SupplyIntake({
  order,
  disabled,
  review,
  invalid,
}: {
  order: SupplyOrder;
  disabled: boolean;
  review: (change: Review) => void;
  invalid: () => void;
}) {
  const id = useId(),
    [selected, setSelected] = useState<string[]>([]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        try {
          const element = event.currentTarget;
          const form = new FormData(element),
            lines = selectedSupplyRanges(form, order.items),
            kind = supplyKind.parse(form.get("kind")),
            customerNote = paragraph(form.get("customerNote"))!,
            reason = paragraph(form.get("reason"))!;
          z.literal("on").parse(form.get("confirmed"));
          review({
            action: "raise",
            reset: () => {
              element.reset();
              setSelected([]);
            },
            title: "Record these actual affected goods?",
            body: {
              kind,
              affectedLines: lines,
              customerNote,
              reason,
              actualConcernConfirmed: true,
            },
            facts: [
              { label: "Concern", value: supplyKindLabels[kind] },
              { label: "Customer update", value: customerNote },
              { label: "Internal note", value: reason },
              ...lines.map((line, index) => ({
                label: `Affected goods ${index + 1}`,
                value: `${order.items.find((item) => item.id === line.orderItemId)!.productName}: ${line.quantity} unit(s), starting at unit ${line.offset + 1}`,
              })),
            ],
          });
        } catch {
          invalid();
        }
      }}
    >
      <fieldset className={styles.fields} disabled={disabled}>
        <legend>Record an actual supply concern</legend>
        <p>
          This retains an owned Care case. It does not prove technical fault, accept a
          remedy or authorise money movement. Unit positions are counts within the
          original order line, not serial numbers.
        </p>
        <label>
          Concern type
          <select className="input" name="kind" required defaultValue="">
            <option value="" disabled>
              Choose the actual concern
            </option>
            {Object.entries(supplyKindLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {order.items.map((item) => (
          <fieldset className={styles.fields} key={item.id}>
            <legend>{item.productName}</legend>
            <label className={styles.check}>
              <input
                type="checkbox"
                name="affected"
                value={item.id}
                checked={selected.includes(item.id)}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setSelected((values) =>
                    checked
                      ? [...values, item.id]
                      : values.filter((value) => value !== item.id),
                  );
                  if (checked)
                    requestAnimationFrame(() =>
                      document
                        .getElementById(`${id}-${item.id}`)
                        ?.scrollIntoView({ block: "nearest" }),
                    );
                }}
              />
              Affected goods - {item.quantity} ordered
            </label>
            <div id={`${id}-${item.id}`}>
              <label>
                First affected unit (1-based)
                <input
                  className="input"
                  type="number"
                  name={`${item.id}-first`}
                  min={1}
                  max={item.quantity}
                  step={1}
                  defaultValue={1}
                  required
                  disabled={!selected.includes(item.id)}
                />
              </label>
              <label>
                Affected quantity
                <input
                  className="input"
                  type="number"
                  name={`${item.id}-quantity`}
                  min={1}
                  max={item.quantity}
                  step={1}
                  defaultValue={1}
                  required
                  disabled={!selected.includes(item.id)}
                />
              </label>
            </div>
          </fieldset>
        ))}
        <label>
          Customer-facing concern
          <textarea
            className="input"
            name="customerNote"
            minLength={12}
            maxLength={1000}
            required
          />
        </label>
        <label>
          Internal evidence note (not shown to the customer)
          <textarea
            className="input"
            name="reason"
            minLength={12}
            maxLength={1000}
            required
          />
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="confirmed" required />I checked these actual goods
          and quantities. This records a concern, not a refund approval.
        </label>
        <button className="button" type="submit">
          Review supply concern
        </button>
      </fieldset>
    </form>
  );
}
function SupplyRefundForm({
  order,
  row,
  disabled,
  review,
}: {
  order: Props["order"];
  row: SupplySummary["items"][number];
  disabled: boolean;
  review: (change: Review) => void;
}) {
  const [paymentId, setPaymentId] = useState(""),
    [formError, setFormError] = useState<string>();
  const parse = useCallback(
    (value: unknown) => {
      const payment = parseWorkPayment(value);
      if (payment.id !== paymentId || payment.orderId !== order.id)
        throw Error("Wrong payment scope");
      return payment;
    },
    [paymentId, order.id],
  );
  const payment = useResource(paymentId ? `/staff/payments/${paymentId}` : null, parse);
  const amount = remainingSupplyRefundAmount(row),
    latest = row.supplyRemedyChoices[0],
    ready =
      payment.data &&
      payment.data.id === paymentId &&
      !payment.loading &&
      !payment.refreshing &&
      !payment.error &&
      !payment.refreshError;
  if (!latest || latest.choice !== "REFUND_REVIEW") return null;
  if (amount === null)
    return (
      <p>
        Finance must reconcile the complete original amount, charges and history before
        requesting money.
      </p>
    );
  if (amount === "0")
    return (
      <p>
        The affected amount is already committed to the refund records above. Read their
        actual statuses; this does not confirm settlement.
      </p>
    );
  if (!order.paymentReferences?.length)
    return (
      <p>
        No order payment reference is available for a financial request. Check the
        original payment record before taking action.
      </p>
    );
  const captures = ready
    ? payment.data!.attempts.filter(
        (attempt) =>
          attempt.status === "SUCCESSFUL" &&
          attempt.verificationStatus === "VERIFIED" &&
          attempt.paidAt &&
          attempt.verifiedAt,
      )
    : [];
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || !ready || !payment.data) return;
        const form = new FormData(event.currentTarget),
          attempt = captures.find((attempt) => attempt.id === form.get("attempt"));
        if (!attempt || form.get("confirmed") !== "on") return;
        const requested =
          BigInt(amount) < BigInt(attempt.amountKobo) ? amount : attempt.amountKobo;
        let reason: string;
        try {
          reason = paragraph(form.get("reason"))!;
        } catch {
          setFormError(
            "Use one paragraph of 12-1,000 characters for the financial reason.",
          );
          return;
        }
        setFormError(undefined);
        review({
          action: "refund",
          title: "Request this affected-portion refund?",
          body: {
            paymentAttemptId: attempt.id,
            supplyRemedyChoiceId: latest.id,
            amountKobo: requested,
            reason,
          },
          facts: [
            { label: "Original payment", value: payment.data.paymentNumber },
            {
              label: "Verified capture",
              value: `${attempt.provider}, attempt ${attempt.attemptNumber}: ${formatKobo(attempt.amountKobo)}`,
            },
            { label: "Amount requested", value: formatKobo(requested) },
            { label: "Financial reason", value: reason },
            {
              label: "Approval",
              value:
                "A separate authorised operator must approve; this does not return money.",
            },
          ],
        });
      }}
    >
      <fieldset className={styles.fields} disabled={disabled}>
        <legend>Request affected refund review</legend>
        <Feedback message={formError} scrollToMessage />
        <p>
          Affected gross not yet committed in this case: {formatKobo(amount)}. The server
          rechecks saved tax, prior commitments, the captured amount and current
          authority. No handling fee is deducted.
        </p>
        <label>
          Actual original payment
          <select
            className="input"
            required
            value={paymentId}
            onChange={(event) => setPaymentId(event.currentTarget.value)}
          >
            <option value="">Choose a payment record</option>
            {order.paymentReferences.map((reference) => (
              <option key={reference.id} value={reference.id}>
                {reference.paymentNumber}
              </option>
            ))}
          </select>
        </label>
        {paymentId && (payment.loading || payment.refreshing) && (
          <p role="status">Checking verified captures...</p>
        )}
        <Feedback message={payment.error ?? payment.refreshError} />
        {paymentId && (payment.error || payment.refreshError) && (
          <button className="button secondary" type="button" onClick={payment.refresh}>
            Retry payment check
          </button>
        )}
        <fieldset className={styles.fields} disabled={!ready || !captures.length}>
          <legend>Verified capture and reason</legend>
          {ready && !captures.length && (
            <p>
              No eligible verified capture is available. Review the payment record; do not
              invent payment proof.
            </p>
          )}
          <label>
            Verified capture
            <select
              className="input"
              name="attempt"
              required
              defaultValue=""
              key={paymentId}
            >
              <option value="">Choose a verified capture</option>
              {captures.map((attempt) => (
                <option key={attempt.id} value={attempt.id}>
                  {attempt.provider}, attempt {attempt.attemptNumber}:{" "}
                  {formatKobo(attempt.amountKobo)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Internal financial reason
            <textarea
              className="input"
              name="reason"
              minLength={12}
              maxLength={1000}
              required
            />
          </label>
          <label className={styles.check}>
            <input type="checkbox" name="confirmed" required />I reviewed this actual
            capture and affected amount. A separate financial approver is required.
          </label>
          <button className="button" type="submit">
            Review affected refund
          </button>
        </fieldset>
        {paymentId && (
          <Link href={`/admin/payments?selected=${paymentId}`}>
            Open the original payment record
          </Link>
        )}
      </fieldset>
    </form>
  );
}
