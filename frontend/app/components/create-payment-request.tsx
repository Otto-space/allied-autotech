"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  apiRequest,
  ApiError,
  newIdempotencyKey,
  SESSION_CHANGED,
} from "@/lib/api/client";
import { paymentSchema } from "@/lib/api/payment-schemas";
import { parseInvoice } from "@/lib/api/invoice-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

type Invoice = ReturnType<typeof parseInvoice>;
export function CreatePaymentRequest({
  invoice,
  disabled = false,
}: {
  invoice: Invoice;
  disabled?: boolean;
}) {
  const accepted = invoice.servicePayment?.nextPayment;
  const amount = accepted?.amountKobo ?? invoice.totalKobo;
  const stageLabel =
    accepted?.stage === "MATERIALS" ? "Materials" : "Workmanship and fees";
  const attempt = useRef<{ key: string; sent: boolean } | null>(null);
  const pending = useRef<AbortController | null>(null),
    active = useRef(true);
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [existing, setExisting] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [payment, setPayment] = useState<z.infer<typeof paymentSchema>>();
  const paymentLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!payment) return;
    const frame = requestAnimationFrame(() => {
      const link = paymentLink.current;
      link?.focus({ preventScroll: true });
      link?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [payment]);
  useEffect(() => {
    active.current = true;
    function clear() {
      active.current = false;
      pending.current?.abort();
      attempt.current = null;
      setProposal(null);
      setPayment(undefined);
      setExisting(false);
      setUncertain(false);
    }
    window.addEventListener(SESSION_CHANGED, clear);
    return () => {
      clear();
      window.removeEventListener(SESSION_CHANGED, clear);
    };
  }, [invoice.id]);
  function review() {
    if (
      disabled ||
      existing ||
      payment ||
      !active.current ||
      (invoice.servicePayment && !accepted)
    )
      return;
    setProposal({
      title: accepted
        ? `Prepare ${accepted.stage === "MATERIALS" ? "materials" : "workmanship"} payment`
        : "Prepare invoice payment",
      description:
        "Create a payment request for this invoice. You will choose a payment method on the next page. This does not charge you or confirm a payment.",
      facts: [
        { label: "Invoice", value: invoice.invoiceNumber },
        ...(accepted ? [{ label: "Payment stage", value: stageLabel }] : []),
        { label: "Amount", value: formatKobo(amount) },
      ],
      retrySafely: true,
      retryAfterRejection: false,
      onUncertain: () => {
        if (active.current) setUncertain(true);
      },
      submit: async () => {
        const controller = new AbortController();
        pending.current = controller;
        try {
          attempt.current ??= { key: newIdempotencyKey(), sent: false };
          if (!attempt.current.sent) {
            const fresh = parseInvoice(
              (
                await apiRequest(`/customers/invoices/${invoice.id}`, {
                  signal: controller.signal,
                })
              ).data,
            );
            if (
              fresh.id !== invoice.id ||
              fresh.version !== invoice.version ||
              fresh.status !== "ISSUED" ||
              !fresh.booking ||
              fresh.booking.id !== invoice.booking?.id ||
              fresh.totalKobo !== invoice.totalKobo ||
              BigInt(fresh.totalKobo) <= BigInt(0) ||
              (fresh.dueAt &&
                (!Number.isFinite(Date.parse(fresh.dueAt)) ||
                  Date.parse(fresh.dueAt) <= Date.now()))
            )
              throw new ApiError(409, { error: { code: "STALE_VERSION" } });
            const next = fresh.servicePayment?.nextPayment;
            if (
              Boolean(fresh.servicePayment) !== Boolean(invoice.servicePayment) ||
              (accepted &&
                (!next ||
                  next.stage !== accepted.stage ||
                  next.invoiceVersion !== accepted.invoiceVersion ||
                  next.amountKobo !== accepted.amountKobo))
            )
              throw new ApiError(409, { error: { code: "STALE_VERSION" } });
            if (
              fresh.payments.some(
                (value) =>
                  !(
                    accepted
                      ? ["SUCCEEDED", "CANCELLED", "EXPIRED"]
                      : ["CANCELLED", "EXPIRED"]
                  ).includes(value.status),
              )
            )
              throw new ApiError(409, { error: { code: "PAYMENT_TARGET_PENDING" } });
          }
          controller.signal.throwIfAborted();
          attempt.current.sent = true;
          const response = await apiRequest("/customers/payments", {
            method: "POST",
            csrf: true,
            signal: controller.signal,
            idempotencyKey: attempt.current.key,
            body: {
              targetType: "INVOICE",
              targetId: invoice.id,
              purpose: "SERVICE_INVOICE",
              ...(accepted ? { acceptedServiceStage: accepted } : {}),
            },
          });
          const result = z
            .object({ payment: paymentSchema })
            .parse(response.data).payment;
          if (
            result.invoiceId !== invoice.id ||
            result.orderId !== null ||
            result.vehicleTransactionId !== null ||
            result.bookingId !== null ||
            result.purpose !== "SERVICE_INVOICE" ||
            result.amountKobo !== amount
          )
            throw new Error("Mismatched payment request");
          if (active.current && !controller.signal.aborted) {
            setPayment(result);
            setUncertain(false);
          }
        } catch (value) {
          if (
            active.current &&
            value instanceof ApiError &&
            value.status >= 400 &&
            value.status < 500
          ) {
            if (value.code === "PAYMENT_TARGET_PENDING") setExisting(true);
            attempt.current = null;
            setUncertain(false);
          }
          throw value;
        }
      },
    });
  }
  return (
    <div className="invoice-payment-create">
      {payment ? (
        <>
          <p role="status">Payment request ready: {payment.paymentNumber}</p>
          <Link
            ref={paymentLink}
            className="button"
            href={`/dashboard/payments/${payment.id}`}
          >
            Review payment &amp; checkout options
          </Link>
        </>
      ) : existing ? (
        <>
          <Feedback
            message="A payment request already exists for this item. Open your payments to continue."
            tone="info"
          />
          <Link className="button secondary" href="/dashboard/payments">
            View existing payments
          </Link>
        </>
      ) : (
        <>
          <p>
            {uncertain
              ? "The outcome is unconfirmed. Check the same request before starting another."
              : "Review the invoice, then prepare your payment."}
          </p>
          <button
            className="button"
            disabled={disabled || Boolean(invoice.servicePayment && !accepted)}
            onClick={review}
          >
            {uncertain
              ? "Check the same payment request"
              : accepted
                ? `Prepare ${accepted.stage === "MATERIALS" ? "materials" : "workmanship"} payment`
                : "Prepare invoice payment"}
          </button>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => undefined}
          confirmLabel="Create payment request"
        />
      )}
    </div>
  );
}
