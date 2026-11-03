"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import {
  aftercareSchema,
  aftercareRequestSchema,
  parseAftercareList,
  parseAftercareOrder,
  matchesAftercareOrder,
  type AftercareOrder,
} from "@/lib/api/aftercare-schemas";
import { purchaseRequest, subscribePurchaseAccess } from "@/lib/purchase/client";
import { usePurchaseResource } from "@/lib/purchase/resource";
import { PurchaseAccess } from "./purchase-access";
import { AftercareRequestRecord } from "./aftercare-request-record";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
import "../dashboard/orders/[orderId]/aftercare/aftercare.css";

const markerSchema = z
  .object({
    key: z.string().regex(/^aftercare-v1\.\d{13}\.[0-9a-f-]{36}$/),
    operation: z.enum(["cancel", "aftercare"]),
  })
  .strict();
type Marker = z.infer<typeof markerSchema>;
type Action = Marker & {
  body: Record<string, unknown>;
  facts: { label: string; value: string }[];
};
const recoverySchema = z.object({
  found: z.boolean(),
  record: z.unknown().nullable(),
  canStartNew: z.boolean(),
  recoveryUntil: z.iso.datetime({ offset: true }),
});
function readMarker(name: string): Marker | "unknown" | undefined {
  try {
    const value = sessionStorage.getItem(name);
    return value ? markerSchema.parse(JSON.parse(value)) : undefined;
  } catch {
    return "unknown";
  }
}
export function PurchaseAftercarePage({ orderId }: { orderId: string }) {
  return (
    <>
      <p className="purchase-kicker">Private purchase access</p>
      <h1>Changes and aftercare</h1>
      <PurchaseAccess>
        {(_, buyerReference) => (
          <Aftercare orderId={orderId} buyerReference={buyerReference} />
        )}
      </PurchaseAccess>
    </>
  );
}
function Aftercare({
  orderId,
  buyerReference,
}: {
  orderId: string;
  buyerReference: string;
}) {
  const order = usePurchaseResource(`/purchase/orders/${orderId}`, parseAftercareOrder);
  const history = usePurchaseResource(
    `/purchase/orders/${orderId}/aftercare`,
    parseAftercareList,
  );
  const markerName = `aat:purchase-aftercare:1:${buyerReference}:${orderId}`;
  const [pending, setPending] = useState(() => readMarker(markerName));
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [kind, setKind] = useState("RETURN"),
    [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string>(),
    [busy, setBusy] = useState(false),
    [canStartNew, setCanStartNew] = useState(false);
  const [retained, setRetained] = useState<Action>();
  const active = useRef(true),
    controller = useRef<AbortController | null>(null);
  const current = order.data?.id === orderId ? order.data : undefined;
  const validHistory =
    !!current &&
    !!history.data &&
    history.data.every((record) => matchesAftercareOrder(record, current));
  const unavailable =
    order.loading ||
    history.loading ||
    order.failed ||
    history.failed ||
    !current ||
    !validHistory;
  const blocked = useRef(unavailable);
  useEffect(() => {
    blocked.current = unavailable;
  }, [unavailable]);
  useEffect(() => {
    active.current = true;
    const clear = () => {
      active.current = false;
      controller.current?.abort();
      setProposal(null);
      setReason("");
      setQuantities({});
      setRetained(undefined);
    };
    const unsubscribe = subscribePurchaseAccess(clear);
    return () => {
      clear();
      unsubscribe();
    };
  }, []);
  function refresh() {
    order.refresh();
    history.refresh();
  }
  function complete(text: string) {
    if (!active.current) return;
    sessionStorage.removeItem(markerName);
    setPending(undefined);
    setRetained(undefined);
    setCanStartNew(false);
    setMessage(text);
    refresh();
  }
  async function checkOriginal(
    saved: Marker,
    signal: AbortSignal,
    source: AftercareOrder,
  ) {
    const receipt = recoverySchema.parse(
      (
        await purchaseRequest(
          `/purchase/orders/${orderId}/aftercare/original-request?operation=${saved.operation}`,
          { headers: { "Idempotency-Key": saved.key }, signal },
        )
      ).data,
    );
    if (receipt.found) {
      if (saved.operation === "cancel") {
        const record = z
          .object({ id: z.uuid(), status: z.literal("CANCELLED") })
          .parse(receipt.record);
        if (record.id !== orderId) throw Error("Unmatched cancellation receipt");
      } else if (!matchesAftercareOrder(aftercareSchema.parse(receipt.record), source))
        throw Error("Unmatched order request receipt");
      complete(
        saved.operation === "cancel"
          ? "The original cancellation is recorded. Any refund has its own review and payment status."
          : "The original order request is recorded. Review its current status below.",
      );
    } else {
      if (receipt.record !== null) throw Error("Invalid original receipt");
      setCanStartNew(receipt.canStartNew);
      setMessage(
        receipt.canStartNew
          ? "The original recovery window has ended and no original receipt is available. Review the refreshed order and request history before clearing the pending action."
          : "No original receipt is visible yet. This does not prove failure. New requests remain locked; check again or review the identical original retry when available.",
      );
    }
    return receipt.found;
  }
  async function recover() {
    if (!pending || pending === "unknown" || busy || !current || unavailable) return;
    setBusy(true);
    controller.current = new AbortController();
    try {
      await checkOriginal(pending, controller.current.signal, current);
    } catch {
      if (active.current)
        setMessage(
          "The original action could not be checked. Keep the pending action and try again; nothing was resent.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  }
  function propose(action: Action, retry = false) {
    if (unavailable || busy || proposal || (!retry && pending)) return;
    setMessage(undefined);
    setProposal({
      title:
        action.operation === "cancel"
          ? "Review order cancellation"
          : "Review order request",
      description:
        action.operation === "cancel"
          ? "Cancellation before confirmation is free and releases this order's stock holds. If you paid, staff must request a refund for separate approval; cancellation does not confirm money returned."
          : "Staff will review these products, quantities and your explanation. This does not cancel the order, approve a return or confirm a refund. An existing request of the same type keeps its original details.",
      facts: action.facts,
      retryAfterRejection: false,
      submit: async () => {
        if (blocked.current || !active.current || !current)
          throw Error("Refresh order details before continuing");
        const previousPending = !!pending;
        sessionStorage.setItem(
          markerName,
          JSON.stringify({ key: action.key, operation: action.operation }),
        );
        setRetained(action);
        setPending(action);
        controller.current = new AbortController();
        try {
          if (retry && (await checkOriginal(action, controller.current.signal, current)))
            return;
          const response = await purchaseRequest(
            `/purchase/orders/${orderId}/${action.operation}`,
            {
              method: "POST",
              body: action.body,
              idempotencyKey: action.key,
              signal: controller.current.signal,
            },
          );
          z.object({ replayed: z.boolean() }).parse(response.data);
          if (action.operation === "cancel") {
            const result = z
              .object({
                order: z.object({ id: z.uuid(), status: z.literal("CANCELLED") }),
              })
              .parse(response.data);
            if (result.order.id !== orderId) throw Error("Unmatched cancellation");
          } else {
            const result = aftercareSchema.parse(response.data);
            if (
              !matchesAftercareOrder(result, current) ||
              result.kind !== action.body.kind
            )
              throw Error("Unmatched order request");
          }
          setReason("");
          setQuantities({});
          complete(
            action.operation === "cancel"
              ? "Cancellation recorded. Check the order and payment details for the current outcome."
              : "Order request recorded. Review the saved request below; an earlier request keeps its original details.",
          );
        } catch (error) {
          if (
            !previousPending &&
            error instanceof ApiError &&
            [400, 403, 404, 409, 422].includes(error.status) &&
            !["IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_EXPIRED"].includes(error.code)
          ) {
            sessionStorage.removeItem(markerName);
            if (active.current) {
              setPending(undefined);
              setRetained(undefined);
              refresh();
            }
          }
          throw error;
        }
      },
    });
  }
  function review() {
    if (!current) return;
    const actionKey = `aftercare-v1.${Date.now()}.${crypto.randomUUID()}`;
    if (kind === "cancel") {
      if (reason.trim().length < 10 || reason.trim().length > 500) {
        setMessage("Explain the cancellation in 10–500 characters.");
        document.getElementById("purchase-aftercare-reason")?.focus();
        return;
      }
      propose({
        key: actionKey,
        operation: "cancel",
        body: { expectedVersion: current.version, reason: reason.trim() },
        facts: [
          { label: "Order", value: current.orderNumber },
          { label: "Action", value: "Cancel before confirmation" },
          { label: "Reason", value: reason.trim() },
        ],
      });
      return;
    }
    const parsed = aftercareRequestSchema.safeParse({
      kind,
      reason,
      items: current.items
        .map((item) => ({
          orderItemId: item.id,
          quantity: quantities[item.id] ?? item.quantity,
        }))
        .filter((item) => item.quantity > 0),
    });
    if (
      !parsed.success ||
      parsed.data.items.some(
        (item) =>
          item.quantity >
          current.items.find((original) => original.id === item.orderItemId)!.quantity,
      )
    ) {
      setMessage(
        "Choose products with valid quantities and explain the request in 10–2,000 characters.",
      );
      return;
    }
    propose({
      key: actionKey,
      operation: "aftercare",
      body: parsed.data,
      facts: [
        { label: "Order", value: current.orderNumber },
        {
          label: "Request",
          value: parsed.data.kind === "RETURN" ? "Return review" : "Cancellation review",
        },
        ...parsed.data.items.map((item, index) => ({
          label: `Product ${index + 1}`,
          value: `${current.items.find((original) => original.id === item.orderItemId)!.productName}, quantity ${item.quantity}`,
        })),
        { label: "Reason", value: parsed.data.reason },
      ],
    });
  }
  return (
    <div className="customer-aftercare">
      <Link className="purchase-link" href={`/purchase/orders/${orderId}`}>
        View order details
      </Link>
      <Feedback message={message} tone="info" />
      {unavailable && (
        <section className="purchase-panel">
          <p>
            {order.loading || history.loading
              ? "Checking the current order and request history…"
              : "Order details or request history could not be confirmed. Your draft stays here."}
          </p>
          <button
            className="button secondary"
            disabled={order.loading || history.loading}
            onClick={refresh}
          >
            Refresh order and requests
          </button>
        </section>
      )}
      {pending && (
        <section className="purchase-panel">
          <h2>Check the previous action</h2>
          {pending === "unknown" && (
            <p>
              The pending-action details could not be read. Contact the team and review
              saved order requests before starting another action.
            </p>
          )}
          <p>Check the original result before starting another action.</p>
          <div className="purchase-actions">
            <button
              className="button secondary"
              disabled={unavailable || busy || pending === "unknown"}
              onClick={() => void recover()}
            >
              Check original action
            </button>
            {retained && (
              <button
                className="button secondary"
                disabled={unavailable || busy}
                onClick={() => retained && propose(retained, true)}
              >
                Review identical retry
              </button>
            )}
            {canStartNew && (
              <button
                className="button secondary"
                disabled={unavailable || busy}
                onClick={() =>
                  complete(
                    "Pending marker cleared after its server-confirmed recovery window. Review the current order before a new request.",
                  )
                }
              >
                Clear expired pending action
              </button>
            )}
          </div>
        </section>
      )}
      {current && (
        <>
          <section className="purchase-panel">
            <h2>{current.orderNumber}</h2>
            <p>
              A return or cancellation review does not confirm a refund. Staff review the
              saved policy, timing and item evidence.
            </p>
            <form
              data-no-draft
              onSubmit={(event) => {
                event.preventDefault();
                review();
              }}
            >
              <fieldset disabled={unavailable || busy || !!pending || !!proposal}>
                <label htmlFor="purchase-aftercare-kind">Request type</label>
                <select
                  id="purchase-aftercare-kind"
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                >
                  <option value="RETURN">Return review</option>
                  <option value="CANCELLATION">Cancellation review</option>
                  {current.status === "PENDING" && !current.confirmedAt && (
                    <option value="cancel">Cancel before confirmation</option>
                  )}
                </select>
                {kind !== "cancel" && (
                  <>
                    <p>Enter zero to leave a product out.</p>
                    {current.items.map((item) => (
                      <div className="field" key={item.id}>
                        <label htmlFor={`purchase-aftercare-${item.id}`}>
                          {item.productName} — ordered quantity {item.quantity}
                        </label>
                        <input
                          id={`purchase-aftercare-${item.id}`}
                          type="number"
                          min={0}
                          max={item.quantity}
                          step={1}
                          value={quantities[item.id] ?? item.quantity}
                          onChange={(event) =>
                            setQuantities((values) => ({
                              ...values,
                              [item.id]: Number(event.target.value),
                            }))
                          }
                        />
                      </div>
                    ))}
                  </>
                )}
                <label htmlFor="purchase-aftercare-reason">Reason for your request</label>
                <textarea
                  id="purchase-aftercare-reason"
                  required
                  minLength={10}
                  maxLength={kind === "cancel" ? 500 : 2000}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
                <button className="button">
                  Review {kind === "cancel" ? "cancellation" : "order request"}
                </button>
              </fieldset>
            </form>
          </section>
          {validHistory && (
            <section className="purchase-panel">
              <h2>Saved requests</h2>
              {history.data!.length ? (
                history.data!.map((item) => (
                  <AftercareRequestRecord key={item.id} item={item} order={current} />
                ))
              ) : (
                <p>No return or cancellation review requests are recorded.</p>
              )}
            </section>
          )}
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Confirm reviewed action"
          disabledReason={
            unavailable
              ? "Refresh the order and request history before confirming."
              : undefined
          }
          onClose={() => setProposal(null)}
          onSuccess={() => setProposal(null)}
        />
      )}
    </div>
  );
}
