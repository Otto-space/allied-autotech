"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  announcePurchaseAccess,
  purchaseAccessSchema,
  purchaseRequest,
} from "@/lib/purchase/client";
import { PurchaseLinkRequest } from "./purchase-access";
import { Feedback } from "./feedback";

export function PurchaseVerify() {
  const proof = useRef<string | null>(null);
  const read = useRef(false);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<string>();
  const controller = useRef<AbortController>(null),
    pending = useRef(false);
  useEffect(() => {
    let active = true;
    if (!read.current) {
      read.current = true;
      const value = new URLSearchParams(location.hash.slice(1)).get("token");
      history.replaceState(null, "", location.pathname);
      if (
        z
          .string()
          .regex(/^[A-Za-z0-9_-]{43}$/)
          .safeParse(value).success
      ) {
        proof.current = value;
      }
    }
    queueMicrotask(() => {
      if (!active) return;
      if (proof.current) setReady(true);
      else setError("This access link is missing or invalid. Request a new link below.");
    });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, []);
  async function verify() {
    if (!proof.current || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    controller.current = new AbortController();
    try {
      const result = await purchaseRequest("/purchase/access/verify", {
        method: "POST",
        body: { token: proof.current },
        signal: controller.current.signal,
      });
      purchaseAccessSchema.parse(result.data);
      proof.current = null;
      setReady(false);
      setDone(true);
      announcePurchaseAccess();
    } catch {
      if (!controller.current.signal.aborted)
        setError(
          "This link could not be verified. Open it in the browser that requested it, or request a new link. No order or payment has been created by this step.",
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <p className="purchase-kicker">Private purchase access</p>
      <h1>{done ? "Your email is verified" : "Verify your email"}</h1>
      {done ? (
        <section className="purchase-panel">
          <p>
            You can continue with your saved cart or review your existing purchases. No
            account was created.
          </p>
          <div className="purchase-actions">
            <Link className="button" href="/cart">
              Review cart
            </Link>
            <Link className="button secondary" href="/purchase">
              View purchases
            </Link>
          </div>
        </section>
      ) : (
        <section className="purchase-panel">
          <p>
            Continue in the browser where you requested this link. Verification gives
            private access to your purchases; it does not place an order or take payment.
          </p>
          <button
            className="button"
            disabled={!ready || busy}
            onClick={() => void verify()}
          >
            {busy ? "Verifying…" : "Verify purchase access"}
          </button>
          <Feedback message={error} />
        </section>
      )}
      {error && <PurchaseLinkRequest />}
    </>
  );
}
