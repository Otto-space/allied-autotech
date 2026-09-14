"use client";
import Link from "next/link";
import { useEffect } from "react";
export function PaymentComplete() {
  useEffect(() => {
    const paymentId = new URLSearchParams(window.location.search).get("paymentId");
    history.replaceState(null, "", window.location.pathname);
    if (
      paymentId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        paymentId,
      )
    )
      window.location.replace(`/dashboard/payments/${paymentId}`);
  }, []);
  return (
    <main id="main" className="section">
      <div className="container narrow">
        <h1>Let’s check your payment.</h1>
        <output className="lead">
          Returning from checkout does not confirm payment. Open your account to view the
          current status and check with your payment provider.
        </output>
        <Link className="button" href="/dashboard/payments">
          Check your payment status
        </Link>
        <p>
          If confirmation is pending, avoid another payment until the status is resolved.
        </p>
      </div>
    </main>
  );
}
