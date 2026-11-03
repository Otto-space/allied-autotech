"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { branchRef, orderSchema } from "@/lib/api/commerce-schemas";
import { partsQuotationSchema } from "@/lib/api/parts-quotation-schemas";
import { purchaseRequest, subscribePurchaseAccess } from "@/lib/purchase/client";
import { usePurchaseResource } from "@/lib/purchase/resource";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { usePublicCapabilities } from "./public-capabilities";
import { StatusBadge } from "./status-progress";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { CursorPagination, useCursorPage } from "./cursor-pagination";

const quote = partsQuotationSchema.extend({
  expiresAt: z.iso.datetime({ offset: true }),
});
const itemSchema = z.object({ quotation: quote, collectionBranch: branchRef.nullable() });
const parse = (value: unknown) =>
  z.object({ items: z.array(itemSchema), nextCursor: z.uuid().optional() }).parse(value);
type Item = z.infer<typeof itemSchema>;
type Contact = RequestBody<"/purchase/parts-quotes/{quoteId}/accept", "post">["contact"];
const emptyContact: Contact = { name: "", phone: "" };

export function PurchaseQuotations() {
  const router = useRouter(),
    pagination = useCursorPage(),
    { checkoutEnabled } = usePublicCapabilities();
  const resource = usePurchaseResource(
    `/purchase/parts-quotes?limit=10${pagination.cursor ? `&cursor=${encodeURIComponent(pagination.cursor)}` : ""}`,
    parse,
  );
  const [drafts, setDrafts] = useState<Record<string, Contact>>({});
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [reviewExpiresAt, setReviewExpiresAt] = useState<number>();
  const [now, setNow] = useState(() => Date.now());
  const available = useRef(checkoutEnabled);
  useEffect(
    () =>
      subscribePurchaseAccess(() => {
        setProposal(null);
        setDrafts({});
      }),
    [],
  );
  useEffect(() => {
    available.current = checkoutEnabled;
  }, [checkoutEnabled]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  function review(item: Item, accepting: boolean, contact: Contact) {
    const saved = item.quotation;
    setReviewExpiresAt(Date.parse(saved.expiresAt));
    const body = accepting
      ? { revision: saved.revision, contact: { ...contact } }
      : { revision: saved.revision };
    const key = `purchase-quote-accept:${saved.id}:${saved.revision}`;
    let orderId: string | undefined;
    const checkOrder = (value: unknown) => {
      const order = orderSchema.parse(value);
      if (
        order.totalKobo !== saved.totalKobo ||
        order.partsQuote?.id !== saved.id ||
        order.items.length !== 1 ||
        order.items[0]?.quantity !== saved.quantity ||
        order.items[0]?.unitPriceKobo !== saved.unitPriceKobo
      )
        throw Error("Quotation receipt could not be matched");
      orderId = order.id;
    };
    setProposal({
      presentation: "quotation",
      title: accepting ? "Review quotation acceptance" : "Review quotation decline",
      description: accepting
        ? "Accepting saves an unpaid collection order at this quoted total. Payment, final suitability and availability checks, and collection readiness are separate."
        : "Declining closes this offer. Contact the team if you need a different quotation.",
      facts: [
        { label: "Product", value: saved.productName },
        { label: "Revision", value: String(saved.revision) },
        { label: "Quantity", value: String(saved.quantity) },
        { label: "Total including tax", value: formatKobo(saved.totalKobo) },
        { label: "Valid until", value: formatBusinessDate(saved.expiresAt) },
        ...(accepting
          ? [
              {
                label: "Collection branch",
                value: item.collectionBranch?.name ?? "Unavailable",
              },
              { label: "Your name", value: contact.name },
              { label: "Phone", value: contact.phone },
            ]
          : []),
      ],
      retrySafely: true,
      retryAfterRejection: false,
      submit: async () => {
        if (accepting) {
          const result = await purchaseRequest("/purchase/orders/original-request", {
            headers: { "Idempotency-Key": key },
          });
          const receipt = z
            .object({ found: z.boolean(), order: orderSchema.nullable() })
            .parse(result.data);
          if (receipt.found && receipt.order) {
            checkOrder(receipt.order);
            return;
          }
        }
        if (!available.current || Date.parse(saved.expiresAt) <= Date.now())
          throw new ApiError(409, { error: { code: "CONFLICT" } });
        const result = await purchaseRequest(
          `/purchase/parts-quotes/${saved.id}/${accepting ? "accept" : "decline"}`,
          {
            method: "POST",
            body,
            ...(accepting ? { idempotencyKey: key } : {}),
          },
        );
        if (accepting)
          checkOrder(z.object({ order: orderSchema }).parse(result.data).order);
        else if (quote.parse(result.data).id !== saved.id)
          throw Error("Quotation decision could not be matched");
      },
      onConfirmed: () => {
        if (orderId) router.push(`/purchase/orders/${orderId}`);
      },
    });
  }
  return (
    <section className="purchase-panel" aria-labelledby="guest-quotations-heading">
      <h2 id="guest-quotations-heading">Your quotations</h2>
      <p>
        Offers sent to this email for enquiries made without an account. Account
        quotations remain with your account request.
      </p>
      <button
        className="button secondary"
        disabled={resource.loading || !!proposal}
        onClick={resource.refresh}
      >
        Refresh quotations
      </button>
      {resource.loading && <p role="status">Checking your quotations…</p>}
      {resource.failed && (
        <Feedback message="Quotations could not be loaded. Your order history is still available separately." />
      )}
      {resource.data?.items.length === 0 && (
        <p>No quotation is available for this email yet.</p>
      )}
      {resource.data?.items.map((item) => (
        <GuestQuotation
          key={item.quotation.id}
          item={item}
          now={now}
          enabled={checkoutEnabled && !resource.loading}
          contact={drafts[item.quotation.id] ?? emptyContact}
          onContact={(contact) =>
            setDrafts((previous) => ({ ...previous, [item.quotation.id]: contact }))
          }
          onReview={(accepting, contact) => review(item, accepting, contact)}
        />
      ))}
      {resource.data && (
        <CursorPagination
          pagination={pagination}
          nextCursor={resource.data.nextCursor}
          disabled={resource.loading || !!proposal}
          label="Quotations"
        />
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          disabledReason={
            !checkoutEnabled
              ? "Online quotation actions are unavailable while availability is being checked. You can close this review and contact the team."
              : reviewExpiresAt !== undefined && now >= reviewExpiresAt
                ? "This quotation has expired. Close the review and request an updated offer."
                : undefined
          }
          confirmLabel="Confirm decision"
          onClose={() => setProposal(null)}
          onSuccess={resource.refresh}
        />
      )}
    </section>
  );
}

function GuestQuotation({
  item,
  now,
  enabled,
  contact,
  onContact,
  onReview,
}: {
  item: Item;
  now: number;
  enabled: boolean;
  contact: Contact;
  onContact: (contact: Contact) => void;
  onReview: (accepting: boolean, contact: Contact) => void;
}) {
  const saved = item.quotation,
    prefix = useId(),
    name = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const expired = Date.parse(saved.expiresAt) <= now;
  const canDecide = saved.status === "ISSUED" && !expired;
  return (
    <article className="purchase-quote">
      <h3>{saved.productName}</h3>
      <p>
        Quotation revision {saved.revision}{" "}
        <StatusBadge
          status={expired && saved.status === "ISSUED" ? "EXPIRED" : saved.status}
        >
          {saved.status === "REJECTED"
            ? "Declined"
            : saved.status === "VOID"
              ? "Withdrawn"
              : undefined}
        </StatusBadge>
      </p>
      {saved.sku && <p>SKU: {saved.sku}</p>}
      <dl className="purchase-summary">
        <div>
          <dt>Quantity</dt>
          <dd>{saved.quantity}</dd>
        </div>
        <div>
          <dt>Unit price</dt>
          <dd>{formatKobo(saved.unitPriceKobo)}</dd>
        </div>
        <div>
          <dt>Tax</dt>
          <dd>{formatKobo(saved.taxKobo)}</dd>
        </div>
        <div className="purchase-total">
          <dt>Quoted total</dt>
          <dd>{formatKobo(saved.totalKobo)}</dd>
        </div>
      </dl>
      <p>
        Valid until {formatBusinessDate(saved.expiresAt)}. This is not a credit period.
      </p>
      <p className="purchase-quote-notes">{saved.notes}</p>
      {item.collectionBranch && <p>Collection: {item.collectionBranch.name}</p>}
      {saved.orderId ? (
        <Link className="button" href={`/purchase/orders/${saved.orderId}`}>
          View linked order
        </Link>
      ) : (
        canDecide &&
        (!enabled ? (
          <p>
            Online quotation decisions are currently unavailable. Contact the team about
            this offer.
          </p>
        ) : (
          <>
            <form
              data-no-draft
              onSubmit={(event) => {
                event.preventDefault();
                if (!item.collectionBranch) return;
                if (!contact.name.trim()) {
                  setError("Enter your name for collection.");
                  name.current?.focus();
                  return;
                }
                setError(undefined);
                onReview(true, {
                  name: contact.name.trim(),
                  phone: contact.phone.trim(),
                });
              }}
            >
              <label htmlFor={`${prefix}-name`}>Name for collection</label>
              <input
                ref={name}
                id={`${prefix}-name`}
                autoComplete="name"
                required
                maxLength={400}
                value={contact.name}
                onChange={(event) => onContact({ ...contact, name: event.target.value })}
              />
              <label htmlFor={`${prefix}-phone`}>Collection phone</label>
              <input
                id={`${prefix}-phone`}
                type="tel"
                autoComplete="tel"
                required
                maxLength={32}
                pattern="\+?[0-9 ()-]{7,32}"
                value={contact.phone}
                onChange={(event) => onContact({ ...contact, phone: event.target.value })}
              />
              <button className="button" disabled={!item.collectionBranch}>
                Review and accept quotation
              </button>
            </form>
            {!item.collectionBranch && (
              <Feedback message="Collection details changed or are unavailable. Ask the team for a revised quotation before accepting." />
            )}
            <button className="button secondary" onClick={() => onReview(false, contact)}>
              Review decline
            </button>
            <Feedback message={error} />
          </>
        ))
      )}
      <Link className="purchase-link" href="/contact#enquiry">
        Ask about this quotation
      </Link>
    </article>
  );
}
