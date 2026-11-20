"use client";
import styles from "./parts-quotations.module.css";
import { useCallback, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { usePublicCapabilities } from "@/app/components/public-capabilities";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import type { SupportSource } from "@/lib/api/support-sources";
import { useAccountSession } from "./dashboard-shell";
import { SupportSourcePicker } from "./support-source-picker";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { partsQuotationSchema as quoteSchema } from "@/lib/api/parts-quotation-schemas";
type Quote = z.infer<typeof quoteSchema>;
export function PartsQuotations({ enquiryId }: { enquiryId: string }) {
  const session = useAccountSession();
  if (!session || !["CUSTOMER", "ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return null;
  return (
    <QuotationPanel
      key={`${session.user.id}:${session.user.role}:${enquiryId}`}
      enquiryId={enquiryId}
      userId={session.user.id}
      staff={session.user.role !== "CUSTOMER"}
    />
  );
}
function QuotationPanel({
  enquiryId,
  userId,
  staff,
}: {
  enquiryId: string;
  userId: string;
  staff: boolean;
}) {
  const { checkoutEnabled, catalogueOnly } = usePublicCapabilities();
  const root = `/${staff ? "admin" : "customers"}/parts-quotes`;
  const parse = useCallback(
    (value: unknown) => {
      const result = z.object({ items: z.array(quoteSchema) }).parse(value);
      if (result.items.some((q) => q.enquiryId !== enquiryId))
        throw Error("Mismatched quotation context");
      return result;
    },
    [enquiryId],
  );
  const records = useResource(`${root}/enquiries/${enquiryId}`, parse);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const [product, setProduct] = useState<SupportSource>();
  const [pickerBlocked, setPickerBlocked] = useState(true);
  const reset = useCallback(() => {
    setProposal(null);
    setProduct(undefined);
    setMessage(undefined);
  }, []);
  const operation = useAccountMutation(reset);
  const fresh =
    !!records.data &&
    !records.loading &&
    !records.refreshing &&
    !records.error &&
    !records.refreshError;
  const disabled = !fresh || operation.busy || operation.sessionChanged;
  const transactionClosed = !checkoutEnabled || catalogueOnly();
  const latest = records.data?.items[0];
  async function send(path: string, body: unknown, key: string) {
    const controller = operation.begin();
    if (!controller) throw Error("Another change is pending");
    try {
      const session = z
        .object({ user: z.object({ id: z.uuid(), role: z.string() }) })
        .parse((await apiRequest("/auth/session", { signal: controller.signal })).data);
      if (
        session.user.id !== userId ||
        (staff
          ? !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)
          : session.user.role !== "CUSTOMER")
      )
        throw new ApiError(409, {
          error: {
            code: "CONFLICT",
            message: "Your account changed. Refresh before continuing.",
          },
        });
      const result = await apiRequest(path, {
        method: "POST",
        body,
        csrf: true,
        idempotencyKey: key,
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      return result;
    } finally {
      operation.finish(controller);
    }
  }
  function decision(quote: Quote, accept: boolean, now: number) {
    if (accept && quote.supplyRemedyChoiceId && !quote.alternativeAgreementVersion) {
      setMessage(
        "This alternative needs current reviewed terms. Ask Care for a revised quotation before accepting.",
      );
      return;
    }
    if (new Date(quote.expiresAt).getTime() <= now) {
      setMessage(
        "This quotation has expired. Ask Customer Care for an updated quotation.",
      );
      records.refresh();
      return;
    }
    const key = crypto.randomUUID();
    setProposal({
      title: accept ? "Accept this quotation?" : "Decline this quotation?",
      presentation: "quotation",
      description: accept
        ? quote.supplyRemedyChoiceId
          ? "Accept this actual alternative and its quoted price as a separate unpaid order. The original affected amount must follow the independent refund and resolution workflow before a new payment. No store credit or transfer of the original payment is authorised. Compatibility and availability must be checked before payment."
          : "Creates an unpaid collection order. Suitability and availability are checked before payment becomes available. Wait for a separate collection confirmation before travelling."
        : "This revision will be declined. You can ask Customer Care for an updated quotation.",
      facts: [
        { label: "Product", value: quote.productName },
        { label: "Quantity", value: String(quote.quantity) },
        { label: "Total including VAT", value: formatKobo(quote.totalKobo) },
        { label: "Terms", value: quote.notes },
        { label: "Revision", value: String(quote.revision) },
      ],
      retrySafely: true,
      submit: async () => {
        const response = await send(
          `${root}/${quote.id}/${accept ? "accept" : "decline"}`,
          {
            revision: quote.revision,
            ...(accept && quote.alternativeAgreementVersion
              ? { alternativeAgreementVersion: quote.alternativeAgreementVersion }
              : {}),
          },
          key,
        );
        if (accept) z.object({ order: z.object({ id: z.uuid() }) }).parse(response.data);
        else {
          const saved = quoteSchema.parse(response.data);
          if (saved.id !== quote.id || saved.status !== "REJECTED")
            throw Error("Quotation outcome requires review");
        }
        setMessage(
          accept
            ? "Quotation accepted. Open the linked order to follow its review and payment status."
            : "Quotation declined. Your original request remains available.",
        );
      },
    });
  }
  if (operation.sessionChanged)
    return (
      <p role="alert">
        Your account changed. Refresh this page before reviewing quotations.
      </p>
    );
  return (
    <section className={`ct-panel ${styles.panel}`} aria-labelledby="parts-quote-title">
      <h2 id="parts-quote-title">Parts quotations</h2>
      <p>
        Assessment and quotations stay linked to this request. Collection only; the
        workshop checks suitability and availability before payment becomes available.
        Readiness for collection is confirmed separately.
      </p>
      <Feedback message={records.error || records.refreshError} />
      <Feedback message={message} tone="success" />
      {operation.sessionChanged && (
        <p role="alert">Your account changed. Refresh this page before continuing.</p>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={operation.busy || records.loading}
        onClick={records.refresh}
      >
        Refresh quotations
      </button>
      {records.loading && <p role="status">Loading quotations...</p>}
      {fresh && !records.data?.items.length && (
        <p>
          No quotation has been issued yet. Continue your request in the conversation
          below.
        </p>
      )}
      {records.data?.items.map((quote) => (
        <article key={quote.id} className={styles.quote}>
          <h3>
            {quote.productName} <small>Revision {quote.revision}</small>
          </h3>
          <p>
            Status: {quote.status.toLowerCase()}. Valid until{" "}
            {formatBusinessDate(quote.expiresAt)}.
          </p>
          {quote.supplyRemedyChoiceId && (
            <p>
              This is an alternative for affected original goods. Acceptance creates a
              separate unpaid order. The original refund and resolution must be verified
              before another payment; no store credit or transfer of the original payment
              is authorised.
            </p>
          )}
          <dl className={styles.totals}>
            <div>
              <dt>Quantity</dt>
              <dd>{quote.quantity}</dd>
            </div>
            <div>
              <dt>Unit price</dt>
              <dd>{formatKobo(quote.unitPriceKobo)}</dd>
            </div>
            <div>
              <dt>VAT</dt>
              <dd>{formatKobo(quote.taxKobo)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatKobo(quote.totalKobo)}</dd>
            </div>
          </dl>
          <p className="support-text">{quote.notes}</p>
          {quote.orderId && (
            <Link
              className="button"
              href={`/${staff ? "admin" : "dashboard"}/orders/${quote.orderId}`}
            >
              Open linked order
            </Link>
          )}
          {!staff && quote.status === "ISSUED" && (
            <>
              {transactionClosed ? (
                <p>
                  Online quotation acceptance is currently unavailable. Contact Customer
                  Care through this request.
                </p>
              ) : (
                <div className="actions">
                  <button
                    className="button"
                    disabled={disabled}
                    onClick={() => decision(quote, true, Date.now())}
                  >
                    Review and accept
                  </button>
                  <button
                    className="button secondary"
                    disabled={disabled}
                    onClick={() => decision(quote, false, Date.now())}
                  >
                    Decline quotation
                  </button>
                </div>
              )}
            </>
          )}
        </article>
      ))}
      {staff && latest?.status !== "ACCEPTED" && (
        <>
          <p>
            Check the recipient email and collection branch before issuing. Customers
            without an account review the offer through Guest purchases; check email
            delivery separately.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (disabled || pickerBlocked || !product) return;
              const form = new FormData(event.currentTarget),
                amount = String(form.get("price"));
              if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
                setMessage(
                  "Enter a positive naira price with at most two decimal places.",
                );
                return;
              }
              const [whole, fraction = ""] = amount.split(".");
              const unitPriceKobo = (
                BigInt(whole!) * BigInt(100) +
                BigInt(fraction.padEnd(2, "0"))
              ).toString();
              const quantity = Number(form.get("quantity"));
              const notes = String(form.get("notes"));
              const body = {
                expectedRevision: latest?.revision ?? 0,
                productId: product.id,
                quantity,
                unitPriceKobo,
                notes,
              };
              const key = crypto.randomUUID();
              setProposal({
                title: latest ? "Issue revised quotation?" : "Issue quotation?",
                presentation: "quotation",
                description:
                  "This creates a fixed commercial revision and replaces any earlier unaccepted revision. It does not create stock, confirm fitment or record a payment. The customer must accept before an order is created.",
                facts: [
                  { label: "Product", value: product.label },
                  { label: "Quantity", value: String(quantity) },
                  { label: "Unit price before VAT", value: formatKobo(unitPriceKobo) },
                  { label: "Terms", value: notes },
                  { label: "Valid for", value: "7 days from issue" },
                ],
                retrySafely: true,
                submit: async () => {
                  const saved = quoteSchema.parse(
                    (await send(`${root}/enquiries/${enquiryId}`, body, key)).data,
                  );
                  if (
                    saved.enquiryId !== enquiryId ||
                    saved.revision !== body.expectedRevision + 1
                  )
                    throw Error("Quotation outcome requires review");
                  setMessage(
                    "Quotation issued and visible in the customer's original request.",
                  );
                },
              });
            }}
          >
            <h3>{latest ? "Prepare a revised quotation" : "Prepare a quotation"}</h3>
            <p>
              Select the actual product identified during assessment. If it is not
              registered, <Link href="/admin/products">manage products</Link> first; do
              not invent inventory.
            </p>
            <SupportSourcePicker
              type="PRODUCT"
              value={product}
              onChange={setProduct}
              onAvailabilityChange={setPickerBlocked}
            />
            <div className="field">
              <label htmlFor="parts-quote-quantity">Quantity</label>
              <input
                id="parts-quote-quantity"
                name="quantity"
                type="number"
                min="1"
                max="100"
                step="1"
                required
                defaultValue="1"
              />
            </div>
            <div className="field">
              <label htmlFor="parts-quote-price">Unit price in naira, before VAT</label>
              <input
                id="parts-quote-price"
                name="price"
                inputMode="decimal"
                pattern="[0-9]+([.][0-9]{1,2})?"
                required
              />
            </div>
            <div className="field">
              <p>
                Valid for 7 days from issue. The saved quotation shows its exact expiry.
              </p>
            </div>
            <div className="field">
              <label htmlFor="parts-quote-notes">
                Assessment, lead time and cancellation/refund terms
              </label>
              <textarea
                id="parts-quote-notes"
                name="notes"
                minLength={10}
                maxLength={2000}
                required
              />
            </div>
            <button className="button" disabled={disabled || pickerBlocked || !product}>
              Review quotation
            </button>
          </form>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          disabledReason={
            !staff && transactionClosed
              ? "Online quotation decisions are currently unavailable. Close this review and contact Customer Care."
              : undefined
          }
          confirmLabel="Confirm quotation decision"
          onClose={() => setProposal(null)}
          onSuccess={records.refresh}
        />
      )}
    </section>
  );
}
