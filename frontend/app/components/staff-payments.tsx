"use client";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { parseStaffPayments } from "@/lib/api/staff-payment-schemas";
import { paymentSchema } from "@/lib/api/payment-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { PrivateDocumentAccess } from "./private-document-access";
import { ManualPaymentReview } from "./manual-payment-review";
import { RefundRequestForm } from "./refund-request-form";
import { MutationReview, type MutationProposal } from "./mutation-review";
const filterSchema = z.object({
  status: z.enum(["", ...paymentSchema.shape.status.options]),
  provider: z.enum(["", "PAYSTACK", "MONNIFY", "MANUAL"]),
  customerId: z.union([
    z.literal(""),
    z.string().uuid("Enter a valid customer profile reference."),
  ]),
});
const emptyFilters: z.infer<typeof filterSchema> = {
  status: "",
  provider: "",
  customerId: "",
};
export function StaffPayments() {
  const session = useAccountSession();
  const admin = session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
  const [filters, setFilters] = useState(emptyFilters);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [recovery, setRecovery] = useState<MutationProposal | null>(null);
  const [uncertainReviews, setUncertainReviews] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string>();
  const pagination = useCursorPage();
  const filterForm = useForm({
    resolver: zodResolver(filterSchema),
    defaultValues: emptyFilters,
  });
  const query = new URLSearchParams({ limit: "25" });
  for (const [name, value] of Object.entries(filters)) if (value) query.set(name, value);
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const payments = useResource(`/staff/payments?${query}`, parseStaffPayments);
  const disabled = payments.loading || !!payments.error || !!proposal || !!recovery;
  function review(next: MutationProposal) {
    if (disabled) return;
    setMessage(undefined);
    const retained = {
      ...next,
      onUncertain: () => {
        next.onUncertain?.();
        if (next.retrySafely) setRecovery(retained);
      },
    };
    setProposal(retained);
  }
  return (
    <>
      <h1>Payment records</h1>
      <p className="lead">
        Review payment attempts and manual evidence, and request refunds against verified
        captured funds. Amounts and statuses come from the payment records.
      </p>
      {admin && (
        <Link className="text-link" href="/admin/refunds">
          Review refund requests
        </Link>
      )}
      <form
        noValidate
        onSubmit={filterForm.handleSubmit((values) => {
          if (!proposal && !recovery) {
            setFilters(values);
            pagination.reset();
          }
        })}
      >
        <fieldset
          className="handover-fields catalogue-filters"
          disabled={!!proposal || !!recovery}
        >
          <div className="field">
            <label htmlFor="staff-payment-status">Payment status</label>
            <select id="staff-payment-status" {...filterForm.register("status")}>
              <option value="">All statuses</option>
              {paymentSchema.shape.status.options.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="staff-payment-provider">Payment provider filter</label>
            <select id="staff-payment-provider" {...filterForm.register("provider")}>
              <option value="">All providers</option>
              {["PAYSTACK", "MONNIFY", "MANUAL"].map((provider) => (
                <option key={provider}>{provider}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="staff-payment-customer">
              Customer profile reference (optional)
            </label>
            <input
              id="staff-payment-customer"
              {...filterForm.register("customerId")}
              autoComplete="off"
              maxLength={36}
              aria-invalid={!!filterForm.formState.errors.customerId}
              aria-describedby={
                filterForm.formState.errors.customerId
                  ? "staff-payment-customer-error"
                  : undefined
              }
            />
            {filterForm.formState.errors.customerId && (
              <p id="staff-payment-customer-error" role="alert" className="field-error">
                {filterForm.formState.errors.customerId.message}
              </p>
            )}
          </div>
          <div className="actions">
            <button className="button secondary">Apply payment filters</button>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                filterForm.reset(emptyFilters);
                setFilters(emptyFilters);
                pagination.reset();
              }}
            >
              Clear payment filters
            </button>
          </div>
        </fieldset>
      </form>
      <p className="field-hint">
        A provider filter matches payments with at least one attempt from that provider.
        All attempts on matching payments remain visible.
      </p>
      <Feedback message={payments.error} />
      <Feedback message={message} tone="info" />
      <button
        className="button secondary"
        onClick={payments.refresh}
        disabled={payments.loading || !!proposal}
      >
        Refresh payment records
      </button>
      {recovery && (
        <div className="notice" role="status">
          <p>
            A refund request is unconfirmed. Its original amount, reason and reference are
            retained. Review or retry that same request before making another change.
          </p>
          <button
            className="button secondary"
            disabled={payments.loading || !!proposal}
            onClick={() => setProposal(recovery)}
          >
            Review same refund request
          </button>
        </div>
      )}
      {payments.loading && <p role="status">Checking payment records…</p>}
      {!payments.loading && !payments.error && !payments.data?.items.length && (
        <div className="empty">
          <h2>
            {Object.values(filters).some(Boolean)
              ? "No payments match these filters"
              : "No payment records on this page"}
          </h2>
        </div>
      )}
      {payments.data?.items.map((payment) => (
        <section
          key={payment.id}
          className="detail-section"
          aria-labelledby={`payment-heading-${payment.id}`}
        >
          <h2 id={`payment-heading-${payment.id}`}>{payment.paymentNumber}</h2>
          <p className="status">{payment.status.replaceAll("_", " ")}</p>
          <p className="price">{formatKobo(payment.amountKobo)}</p>
          <p>{payment.purpose.replaceAll("_", " ")}</p>
          <p>Created {formatBusinessDate(payment.createdAt)}</p>
          {payment.expiresAt && (
            <p>Payment deadline: {formatBusinessDate(payment.expiresAt)}</p>
          )}
          <div className="actions">
            {payment.orderId && (
              <Link className="text-link" href={`/admin/orders/${payment.orderId}`}>
                View order
              </Link>
            )}
            {payment.invoiceId && (
              <Link className="text-link" href={`/admin/invoices/${payment.invoiceId}`}>
                View invoice
              </Link>
            )}
            {payment.bookingId && (
              <Link className="text-link" href={`/admin/bookings/${payment.bookingId}`}>
                View booking
              </Link>
            )}
            {payment.vehicleTransactionId && (
              <Link
                className="text-link"
                href={`/admin/vehicle-sales/${payment.vehicleTransactionId}`}
              >
                View vehicle purchase
              </Link>
            )}
          </div>
          {!payment.attempts.length && <p>No payment attempts have been recorded.</p>}
          {payment.attempts.map((attempt) => (
            <section
              className="detail-section"
              key={attempt.id}
              aria-labelledby={`attempt-heading-${attempt.id}`}
            >
              <h3 id={`attempt-heading-${attempt.id}`}>
                Attempt {attempt.attemptNumber} · {attempt.provider}
              </h3>
              <p>
                {attempt.status.replaceAll("_", " ")} ·{" "}
                {attempt.verificationStatus.replaceAll("_", " ")}
              </p>
              <p>
                {formatKobo(attempt.amountKobo)} ·{" "}
                {attempt.method?.replaceAll("_", " ") ?? "Method not recorded"}
              </p>
              <p>Started {formatBusinessDate(attempt.initiatedAt)}</p>
              {attempt.paidAt && <p>Paid {formatBusinessDate(attempt.paidAt)}</p>}
              {attempt.manualReview && (
                <>
                  <dl className="totals">
                    <dt>Manual review</dt>
                    <dd>{attempt.manualReview.status}</dd>
                    <dt>Payer</dt>
                    <dd>{attempt.manualReview.payerName ?? "Not recorded"}</dd>
                    <dt>Bank reference</dt>
                    <dd>{attempt.manualReview.bankReference ?? "Not recorded"}</dd>
                    <dt>Reported transfer time</dt>
                    <dd>
                      {attempt.manualReview.transferredAt
                        ? formatBusinessDate(attempt.manualReview.transferredAt)
                        : "Not recorded"}
                    </dd>
                  </dl>
                  {attempt.manualReview.evidenceSha256 ? (
                    <PrivateDocumentAccess
                      path={`/staff/payments/manual-attempts/${attempt.id}/evidence-access`}
                      label="payment evidence"
                      disabled={disabled}
                    />
                  ) : (
                    <p>No evidence attachment is recorded.</p>
                  )}
                  {admin ? (
                    <ManualPaymentReview
                      attempt={attempt}
                      paymentNumber={payment.paymentNumber}
                      disabled={disabled}
                      uncertain={!!uncertainReviews[attempt.id]}
                      onUncertain={() =>
                        setUncertainReviews((current) => ({
                          ...current,
                          [attempt.id]: true,
                        }))
                      }
                      onReview={review}
                    />
                  ) : (
                    attempt.manualReview.status === "PENDING" && (
                      <p className="notice">
                        An administrator must decide this manual payment review.
                      </p>
                    )
                  )}
                </>
              )}
              {attempt.status === "SUCCESSFUL" &&
                attempt.verificationStatus === "VERIFIED" && (
                  <details>
                    <summary>Request a refund for this attempt</summary>
                    <RefundRequestForm
                      attempt={attempt}
                      paymentNumber={payment.paymentNumber}
                      disabled={disabled}
                      onReview={review}
                    />
                  </details>
                )}
            </section>
          ))}
        </section>
      ))}
      <CursorPagination
        pagination={pagination}
        nextCursor={payments.data?.nextCursor}
        disabled={disabled}
        label="Staff payments"
      />
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            payments.refresh();
          }}
          onSuccess={() => {
            setRecovery(null);
            setMessage(
              "Request recorded. Check the refreshed payment and any refund request status before taking further action.",
            );
          }}
        />
      )}
    </>
  );
}
