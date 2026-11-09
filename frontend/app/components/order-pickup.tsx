"use client";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  SESSION_CHANGED,
  type RequestOptions,
} from "@/lib/api/client";
import { purchaseRequest, subscribePurchaseAccess } from "@/lib/purchase/client";
import { WORKFORCE_ACCESS_CHANGED } from "@/lib/workforce-invalidation";
import {
  pickupSummarySchema,
  pickupIssueResultSchema,
  pickupReviewSchema,
  pickupReceiptSchema,
  selectedPickupLines,
  samePickupLines,
  type PickupSummary,
  type PickupReview,
} from "@/lib/order-pickup";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import styles from "./order-pickup.module.css";

type Order = {
  id: string;
  version: number;
  status: string;
  fulfillmentMethod: string;
  pickupCapabilityVersion?: 1;
  items: { id: string; productName: string }[];
};
export function OrderPickup(props: {
  order: Order;
  audience: "customer" | "guest" | "staff";
  disabled?: boolean;
  onSaved: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  if (
    props.order.pickupCapabilityVersion !== 1 ||
    props.order.fulfillmentMethod !== "COLLECTION" ||
    !["READY", "COMPLETED"].includes(props.order.status)
  )
    return null;
  return <PickupPanel key={`${props.audience}:${props.order.id}`} {...props} />;
}
function PickupPanel({
  order,
  audience,
  disabled = false,
  onSaved,
  onBusyChange,
}: Parameters<typeof OrderPickup>[0]) {
  const id = useId(),
    staff = audience === "staff";
  const path = `/${audience === "guest" ? "purchase" : staff ? "staff" : "customers"}/orders/${order.id}/pickup`;
  const [summary, setSummary] = useState<PickupSummary>(),
    [error, setError] = useState<string>(),
    [loading, setLoading] = useState(true),
    [changed, setChanged] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [secret, setSecret] = useState<z.infer<typeof pickupIssueResultSchema>>(),
    [review, setReview] = useState<PickupReview>(),
    [code, setCode] = useState("");
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [revision, setRevision] = useState(0),
    [notice, setNotice] = useState<string>();
  const alive = useRef(true),
    controller = useRef<AbortController | null>(null),
    errorRef = useRef<HTMLDivElement>(null),
    validationFocus = useRef(false);
  const request = (suffix: string, options: RequestOptions = {}) =>
    audience === "guest"
      ? purchaseRequest(path + suffix, options)
      : apiRequest(path + suffix, { ...options, csrf: options.method === "POST" });
  useEffect(() => {
    alive.current = true;
    const discard = () => {
      alive.current = false;
      controller.current?.abort();
      setSecret(undefined);
      setReview(undefined);
      setCode("");
      setSummary(undefined);
      setProposal(null);
      setChanged(true);
    };
    window.addEventListener(SESSION_CHANGED, discard);
    window.addEventListener(WORKFORCE_ACCESS_CHANGED, discard);
    const unsubscribe =
      audience === "guest" ? subscribePurchaseAccess(discard) : () => {};
    return () => {
      alive.current = false;
      controller.current?.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
      window.removeEventListener(WORKFORCE_ACCESS_CHANGED, discard);
      unsubscribe();
    };
  }, [audience]);
  useEffect(() => {
    const abort = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const result =
          audience === "guest"
            ? await purchaseRequest(path, { signal: abort.signal })
            : await apiRequest(path, { signal: abort.signal });
        const current = pickupSummarySchema.parse(result.data);
        if (current.orderId !== order.id) throw Error("Incorrect order");
        if (!abort.signal.aborted && alive.current) {
          setSummary(current);
          setError(undefined);
        }
      } catch {
        if (!abort.signal.aborted && alive.current) {
          setSummary(undefined);
          setError("Collection details could not be checked. Refresh before continuing.");
        }
      } finally {
        if (!abort.signal.aborted && alive.current) setLoading(false);
      }
    };
    void load();
    return () => abort.abort();
  }, [audience, path, order.id, revision]);
  useEffect(() => {
    if (error && validationFocus.current) {
      validationFocus.current = false;
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [error]);
  const name = (itemId: string) =>
    order.items.find((item) => item.id === itemId)?.productName ?? "Order item";
  const blocked = disabled || loading || changed || uncertain || !!proposal || !summary;
  function propose(
    action:
      | "issue"
      | "revoke"
      | "verify"
      | "handover"
      | "cancel-review"
      | "contact"
      | "extend-hold",
    form: FormData,
  ) {
    if (blocked || !summary) return;
    setError(undefined);
    setNotice(undefined);
    try {
      const lines = ["issue", "verify"].includes(action)
        ? selectedPickupLines(form, summary.remaining)
        : undefined;
      const body: Record<string, unknown> = {
        expectedVersion: review?.version ?? summary.version,
      };
      if (action === "issue")
        Object.assign(body, { idempotencyKey: crypto.randomUUID(), lines });
      if (action === "revoke")
        Object.assign(body, {
          authorisationId: summary.authorisation!.id,
          reason: z.string().trim().min(1).max(500).parse(form.get("reason")),
        });
      if (action === "verify")
        Object.assign(body, {
          pickupCode: z
            .string()
            .regex(/^[A-Za-z0-9_-]{43}$/)
            .parse(form.get("pickupCode")),
          lines,
        });
      if (action === "handover") {
        if (!review) throw Error("Review required");
        Object.assign(body, {
          claimId: review.claimId,
          authorisationId: review.authorisationId,
          financialReviewHash: review.financialReviewHash,
          pickupCode: code,
          lines: review.lines.map(({ orderItemId, quantity }) => ({
            orderItemId,
            quantity,
          })),
          idempotencyKey: crypto.randomUUID(),
          collectorName: z
            .string()
            .trim()
            .min(1)
            .max(120)
            .parse(form.get("collectorName")),
          verificationNote: z
            .string()
            .trim()
            .min(12)
            .max(1000)
            .parse(form.get("verificationNote")),
          physicalHandoverConfirmed:
            z.literal("on").parse(form.get("confirmed")) === "on",
        });
      }
      if (action === "cancel-review")
        Object.assign(body, {
          claimId: review?.claimId ?? summary.handoverReview!.id,
          reason: z.string().trim().min(12).max(1000).parse(form.get("reason")),
          goodsNotHandedOverConfirmed:
            z.literal("on").parse(form.get("confirmed")) === "on",
        });
      if (action === "contact")
        Object.assign(body, {
          idempotencyKey: crypto.randomUUID(),
          outcome: z.enum(["NOTIFIED", "NOTIFICATION_FAILED"]).parse(form.get("outcome")),
          method: z.enum(["PHONE_CALL", "IN_PERSON"]).parse(form.get("method")),
          reason: z.string().trim().min(12).max(1000).parse(form.get("reason")),
          actualContactResultConfirmed:
            z.literal("on").parse(form.get("confirmed")) === "on",
        });
      if (action === "extend-hold")
        Object.assign(body, {
          idempotencyKey: crypto.randomUUID(),
          collectByDate: z.iso.date().parse(form.get("collectByDate")),
          reason: z.string().trim().min(12).max(1000).parse(form.get("reason")),
        });
      const titles = {
        contact: "Record this actual contact result?",
        "extend-hold": "Extend the collection holding date?",
        issue: "Create a private pickup code?",
        revoke: "Revoke this pickup code?",
        verify: "Begin this pickup review?",
        handover: "Record goods physically handed over?",
        "cancel-review": "Resolve review without handing over?",
      };
      const descriptions = {
        contact:
          "Record only the contact that actually occurred. A failed attempt cannot start the holding clock. The first successful notification after readiness starts the five collection-day period; later messages do not silently reset it.",
        "extend-hold":
          "Save this later collection date with the reason. The original date and history remain recorded. This does not release stock, charge storage fees or move money. Inform the customer of the change separately.",
        issue:
          "The new code replaces any unused code and is shown once. Share it privately only with your chosen collector. Its security expiry is separate from the collection holding period.",
        revoke:
          "The unused code will stop working. Payment and remaining goods stay recorded.",
        verify:
          "This reserves the review for your current session. Check the actual eligible goods. Verification alone does not record handover. Another operator must not release the same goods.",
        handover:
          "Confirm only after the listed goods have actually been handed over to this collector. This consumes the code once; any remaining goods need a new code.",
        "cancel-review":
          "Confirm only if you have checked that no goods were handed over. The old code is revoked and the buyer must create a new one. If goods may already have left, preserve this review and contact an administrator.",
      };
      setProposal({
        title: titles[action],
        description: descriptions[action],
        retryAfterRejection: false,
        onConfirmed: () => {
          if (action !== "verify") onSaved();
        },
        facts: [
          ...(lines ?? review?.lines ?? []).map((line) => ({
            label: name(line.orderItemId),
            value: `Quantity ${line.quantity}`,
          })),
          ...(body.collectByDate
            ? [{ label: "New collect-by date", value: String(body.collectByDate) }]
            : []),
          ...(body.outcome
            ? [
                {
                  label: "Actual contact result",
                  value:
                    body.outcome === "NOTIFIED"
                      ? "Successfully notified"
                      : "Contact attempt failed",
                },
              ]
            : []),
          ...(body.collectorName
            ? [{ label: "Collector", value: String(body.collectorName) }]
            : []),
          ...(body.reason ? [{ label: "Reason", value: String(body.reason) }] : []),
        ],
        submit: async () => {
          const abort = new AbortController();
          controller.current = abort;
          onBusyChange?.(true);
          let sent = false;
          try {
            const fresh = pickupSummarySchema.parse(
              (await request("", { signal: abort.signal })).data,
            );
            if (fresh.orderId !== order.id || fresh.version !== body.expectedVersion)
              throw Error("The order changed. Refresh and review it again.");
            sent = true;
            const result = await request(action === "issue" ? "" : `/${action}`, {
              method: "POST",
              body,
              signal: abort.signal,
            });
            if (!alive.current) return;
            if (action === "issue") {
              const issued = pickupIssueResultSchema.parse(result.data);
              if (issued.orderId !== order.id) throw Error("Incorrect receipt");
              setSecret(issued);
            } else if (action === "verify") {
              const verified = pickupReviewSchema.parse(result.data);
              if (
                verified.orderId !== order.id ||
                !samePickupLines(verified.lines, lines!)
              )
                throw Error("Incorrect review");
              setReview(verified);
              setCode(String(body.pickupCode));
            } else if (action === "handover") {
              const saved = pickupReceiptSchema.parse(result.data);
              if (
                saved.orderId !== order.id ||
                saved.claimId !== review?.claimId ||
                !samePickupLines(saved.lines, review.lines)
              )
                throw Error("Incorrect handover receipt");
              setReview(undefined);
              setCode("");
              setNotice(
                saved.replayed
                  ? "Existing handover recovered. Do not hand over the goods again."
                  : "Physical handover recorded. Remaining quantities are shown below.",
              );
            } else {
              const saved = pickupSummarySchema.parse(result.data);
              if (saved.orderId !== order.id) throw Error("Incorrect collection receipt");
              setReview(undefined);
              setCode("");
              setSecret(undefined);
            }
          } catch (cause) {
            if (
              alive.current &&
              sent &&
              !(cause instanceof ApiError && cause.status >= 400 && cause.status < 500)
            )
              setUncertain(true);
            throw cause;
          } finally {
            if (alive.current) onBusyChange?.(false);
          }
        },
      });
    } catch {
      validationFocus.current = true;
      setError(
        "Check quantities and required fields. Select at least one item. Notes about verification or resolving a review need at least 12 characters.",
      );
    }
  }
  return (
    <section className={`card ${styles.section}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>
        {staff ? "Physical parts collection" : "Collect your parts"}
      </h2>
      <p>
        Payment, readiness and physical collection are separate. A public order number
        cannot authorise collection.
      </p>
      {loading && <p role="status">Checking collection details...</p>}
      {changed && (
        <Feedback message="Your access changed. Reopen the order to continue." />
      )}
      {error && (
        <div ref={errorRef} tabIndex={-1}>
          <Feedback message={error} />
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {uncertain && (
        <Feedback message="The result is uncertain. Do not repeat a handover. Reopen the order and review the saved history; ask an administrator if goods may already have left." />
      )}
      <button
        type="button"
        className="button secondary"
        disabled={loading || changed || !!proposal}
        onClick={() => {
          setSecret(undefined);
          setReview(undefined);
          setCode("");
          setUncertain(false);
          setRevision((v) => v + 1);
        }}
      >
        Refresh collection details
      </button>
      {summary && (
        <>
          {summary.holding && (
            <div className={styles.secret}>
              <h3>Collection holding period</h3>
              <p>
                Five collection days, Monday to Saturday, after readiness and successful
                notification. Public holidays count. The same rule applies to
                imported/custom parts.
              </p>
              {summary.holding.collectByDate ? (
                <>
                  <p>
                    <strong>
                      Collect by{" "}
                      {new Intl.DateTimeFormat("en-NG", {
                        dateStyle: "long",
                        timeZone: "Africa/Lagos",
                      }).format(new Date(summary.holding.collectByDate + "T12:00:00Z"))}
                    </strong>{" "}
                    during actual workshop collection hours.
                  </p>
                  {summary.holding.extendedAt && (
                    <p>
                      Extended from {summary.holding.originalCollectByDate}; the original
                      deadline remains recorded.
                    </p>
                  )}
                </>
              ) : (
                <p>
                  A collection deadline is not set until actual readiness and successful
                  customer notification are recorded.
                </p>
              )}
              {summary.holding.state === "OVERDUE" && (
                <p role="status">
                  Collection overdue. Contact the workshop to arrange collection or a
                  reasoned extension. This status does not cancel your order or release
                  paid goods.
                </p>
              )}
              {summary.holding.state === "COLLECTED" && (
                <p>Physical collection is complete.</p>
              )}
              {staff &&
                summary.holding.latestNotificationAttempt?.kind ===
                  "NOTIFICATION_FAILED" && (
                  <p role="status">
                    The latest contact attempt failed. Follow up with the customer. An
                    earlier successful notification, if present, retains its original
                    holding date.
                  </p>
                )}
            </div>
          )}
          {staff &&
            summary.status === "READY" &&
            summary.collectionHoldCapabilityVersion === 1 && (
              <>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    propose("contact", new FormData(event.currentTarget));
                  }}
                >
                  <fieldset className={styles.fields} disabled={blocked || !!review}>
                    <legend>Record actual collection contact</legend>
                    <label>
                      Contact method
                      <select className="input" name="method">
                        <option value="PHONE_CALL">Phone conversation / attempt</option>
                        <option value="IN_PERSON">In person</option>
                      </select>
                    </label>
                    <label>
                      Actual result
                      <select
                        className="input"
                        name="outcome"
                        defaultValue="NOTIFICATION_FAILED"
                      >
                        <option value="NOTIFICATION_FAILED">
                          Contact attempt failed
                        </option>
                        <option value="NOTIFIED">Customer successfully notified</option>
                      </select>
                    </label>
                    <label>
                      Internal contact note
                      <textarea
                        className="input"
                        name="reason"
                        minLength={12}
                        maxLength={1000}
                        required
                      />
                    </label>
                    <label className={styles.check}>
                      <input type="checkbox" name="confirmed" required />I confirm this is
                      the contact result that actually occurred.
                    </label>
                    <button className="button secondary" type="submit">
                      Review contact result
                    </button>
                  </fieldset>
                </form>
                {summary.holding?.collectByDate && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      propose("extend-hold", new FormData(event.currentTarget));
                    }}
                  >
                    <fieldset className={styles.fields} disabled={blocked || !!review}>
                      <legend>Extend collection holding</legend>
                      <label>
                        New collect-by date (Nigeria time)
                        <input
                          className="input"
                          type="date"
                          name="collectByDate"
                          min={summary.holding.collectByDate}
                          required
                        />
                      </label>
                      <label>
                        Internal extension reason
                        <textarea
                          className="input"
                          name="reason"
                          minLength={12}
                          maxLength={1000}
                          required
                        />
                      </label>
                      <button className="button secondary" type="submit">
                        Review holding extension
                      </button>
                    </fieldset>
                  </form>
                )}
              </>
            )}
          {summary.legacyCompleted ? (
            <p>
              This order was completed before detailed pickup history was available. No
              new handover is available.
            </p>
          ) : (
            <ul>
              {summary.remaining.map((line) => (
                <li key={line.orderItemId}>
                  {name(line.orderItemId)}: {line.quantity} remaining
                </li>
              ))}
            </ul>
          )}
          {summary.handoverReview && !review && (
            <p role="status">
              A pickup review is in progress. Staff must resolve that review before any
              new code or handover.
            </p>
          )}
          {summary.authorisation && (
            <p>
              Current code expires {formatBusinessDate(summary.authorisation.expiresAt)}.
              This security expiry does not cancel your order or shorten its holding
              period.
            </p>
          )}
          {secret && (
            <div className={styles.secret}>
              <h3>Private pickup code</h3>
              {secret.pickupCode ? (
                <>
                  <p>
                    Shown once. Keep it private and share only with the person you
                    authorise to collect these goods.
                  </p>
                  <code>{secret.pickupCode}</code>
                  <p>Expires {formatBusinessDate(secret.expiresAt)}.</p>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setSecret(undefined)}
                  >
                    Hide code
                  </button>
                </>
              ) : (
                <p>
                  This request was already saved. The code cannot be displayed again.
                  Create a replacement if needed.
                </p>
              )}
            </div>
          )}
          {summary.status === "READY" &&
            !summary.legacyCompleted &&
            summary.remaining.length > 0 &&
            !review && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  propose(staff ? "verify" : "issue", new FormData(event.currentTarget));
                }}
              >
                <fieldset
                  className={styles.fields}
                  disabled={blocked || (!staff && !!summary.handoverReview)}
                >
                  <legend>
                    {staff
                      ? "Verify code and select goods"
                      : "Choose goods for this code"}
                  </legend>
                  {summary.remaining.map((line) => (
                    <label key={line.orderItemId}>
                      {name(line.orderItemId)} (up to {line.quantity})
                      <input
                        className="input"
                        type="number"
                        name={line.orderItemId}
                        min="0"
                        max={line.quantity}
                        step="1"
                        defaultValue="0"
                        required
                      />
                    </label>
                  ))}
                  {staff && (
                    <label>
                      Private pickup code
                      <input
                        className="input"
                        name="pickupCode"
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        pattern={"[A-Za-z0-9_\\-]{43}"}
                        maxLength={43}
                        required
                      />
                    </label>
                  )}
                  <button className="button" type="submit">
                    {staff ? "Review pickup authorisation" : "Create pickup code"}
                  </button>
                </fieldset>
              </form>
            )}
          {!staff && summary.authorisation && !summary.handoverReview && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                propose("revoke", new FormData(event.currentTarget));
              }}
            >
              <fieldset className={styles.fields} disabled={blocked}>
                <legend>Revoke an unused code</legend>
                <label>
                  Reason
                  <input className="input" name="reason" maxLength={500} required />
                </label>
                <button className="button secondary" type="submit">
                  Review revocation
                </button>
              </fieldset>
            </form>
          )}
          {staff && review && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                propose("handover", new FormData(event.currentTarget));
              }}
            >
              <fieldset className={styles.fields} disabled={blocked}>
                <legend>Record physical handover</legend>
                <p>Your exclusive review covers only these quantities:</p>
                <ul>
                  {review.lines.map((line) => (
                    <li key={line.orderItemId}>
                      {line.productName}: {line.quantity}
                    </li>
                  ))}
                </ul>
                <label>
                  Collector name
                  <input
                    className="input"
                    name="collectorName"
                    maxLength={120}
                    autoComplete="off"
                    required
                  />
                </label>
                <label>
                  Verification note
                  <textarea
                    className="input"
                    name="verificationNote"
                    minLength={12}
                    maxLength={1000}
                    required
                  />
                </label>
                <label className={styles.check}>
                  <input type="checkbox" name="confirmed" required />
                  These exact goods have physically been handed over to this collector.
                </label>
                <button className="button" type="submit">
                  Review handover record
                </button>
              </fieldset>
            </form>
          )}
          {staff && (review || summary.handoverReview) && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                propose("cancel-review", new FormData(event.currentTarget));
              }}
            >
              <fieldset className={styles.fields} disabled={blocked}>
                <legend>Resolve without handover</legend>
                <p>
                  The current reviewer or an authorised administrator must check the
                  physical goods before resolving this review.
                </p>
                <label>
                  Reason
                  <textarea
                    className="input"
                    name="reason"
                    minLength={12}
                    maxLength={1000}
                    required
                  />
                </label>
                <label className={styles.check}>
                  <input type="checkbox" name="confirmed" required />I checked that no
                  goods were handed over under this review.
                </label>
                <button className="button secondary" type="submit">
                  Review resolution
                </button>
              </fieldset>
            </form>
          )}
          <h3>Collection history</h3>
          {summary.handovers.length ? (
            <ul>
              {summary.handovers.map((row) => (
                <li key={row.id}>
                  {formatBusinessDate(row.createdAt)}: {row.collectorName}
                  <ul>
                    {row.lines.map((line) => (
                      <li key={line.orderItemId}>
                        {name(line.orderItemId)}: {line.quantity}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p>No detailed physical handover is recorded.</p>
          )}
          {summary.hasMoreHistory && (
            <p>
              Showing the latest 25 handovers. Contact the workshop for earlier history.
            </p>
          )}
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Confirm"
          disabledReason={
            changed
              ? "Your access changed."
              : uncertain
                ? "Reopen the order and review its saved state before continuing."
                : undefined
          }
          onClose={() => setProposal(null)}
          onSuccess={() => {
            setProposal(null);
            setRevision((v) => v + 1);
          }}
        />
      )}
    </section>
  );
}
