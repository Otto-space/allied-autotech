"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api/client";
import {
  announcePurchaseAccess,
  purchaseAccessSchema,
  purchaseRequest,
  subscribePurchaseAccess,
} from "@/lib/purchase/client";
import { Feedback } from "./feedback";

export function PurchaseAccess({
  children,
}: {
  children: (email: string, buyerReference: string) => ReactNode;
}) {
  const [state, setState] = useState<
    "loading" | "anonymous" | "verified" | "account" | "error"
  >("loading");
  const [email, setEmail] = useState("");
  const [buyerReference, setBuyerReference] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let controller: AbortController | undefined;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setState("loading");
      void purchaseRequest("/purchase/access", { signal })
        .then((response) => {
          const access = purchaseAccessSchema.parse(response.data);
          if (!signal.aborted) {
            setEmail(access.email);
            setBuyerReference(access.buyerReference);
            setState("verified");
          }
        })
        .catch((error) => {
          if (!signal.aborted) {
            setEmail("");
            setState(
              error instanceof ApiError && error.status === 401
                ? "anonymous"
                : error instanceof ApiError && error.status === 409
                  ? "account"
                  : "error",
            );
          }
        });
    };
    const visible = () => {
      if (document.visibilityState === "visible") load();
    };
    const unsubscribe = subscribePurchaseAccess(load);
    load();
    window.addEventListener("focus", visible);
    window.addEventListener("pageshow", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller?.abort();
      unsubscribe();
      window.removeEventListener("focus", visible);
      window.removeEventListener("pageshow", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [retry]);
  if (email && (state === "verified" || state === "loading"))
    return (
      <>
        <div key={buyerReference} hidden={state !== "verified"}>
          {children(email, buyerReference)}
        </div>
        {state === "loading" && <p role="status">Checking private purchase access…</p>}
      </>
    );
  if (state === "anonymous") return <PurchaseLinkRequest />;
  if (state === "account")
    return (
      <section className="purchase-panel">
        <h2>Continue through your account</h2>
        <p>
          This browser is signed in. Account orders and private guest purchases are kept
          separate. To use guest access, sign out of the account first.
        </p>
        <Link className="button" href="/dashboard/cart">
          Open account cart
        </Link>
        <Link className="purchase-link" href="/dashboard">
          Go to dashboard
        </Link>
        <button className="button secondary" onClick={() => setRetry((v) => v + 1)}>
          Check purchase access again
        </button>
      </section>
    );
  if (state === "loading") return <p role="status">Checking private purchase access…</p>;
  return (
    <section className="purchase-panel">
      <Feedback message="We could not check purchase access. Your saved cart is unchanged." />
      <button className="button secondary" onClick={() => setRetry((v) => v + 1)}>
        Retry access check
      </button>
      <Link className="purchase-link" href="/contact#enquiry">
        Contact the team
      </Link>
    </section>
  );
}

export function PurchaseLinkRequest() {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const submit = useCallback(async (form: HTMLFormElement) => {
    if (pending.current) return;
    const email = String(new FormData(form).get("email") ?? "").trim();
    pending.current = true;
    setBusy(true);
    setMessage(undefined);
    setError(undefined);
    controller.current = new AbortController();
    try {
      await purchaseRequest("/purchase/access/request", {
        method: "POST",
        body: { email },
        signal: controller.current.signal,
      });
      setMessage(
        "If eligible, a private link will arrive shortly. Open it in this browser within 15 minutes. Verifying your email does not place an order or take payment.",
      );
    } catch (error) {
      if (!controller.current.signal.aborted)
        setError(
          error instanceof ApiError && error.status === 429
            ? "Please wait before requesting another link. Check your inbox and spam folder."
            : "We could not request purchase access. Please try again.",
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, []);
  return (
    <section className="purchase-panel">
      <p className="purchase-kicker">No account required</p>
      <h2>Continue with your email</h2>
      <p>
        Use a private link to review and recover your purchases. An account is optional.
      </p>
      <form
        data-no-draft
        onSubmit={(event) => {
          event.preventDefault();
          void submit(event.currentTarget);
        }}
        aria-busy={busy}
      >
        <label htmlFor="purchase-email">Email address</label>
        <input
          id="purchase-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={busy}
        />
        <button className="button" disabled={busy}>
          {busy ? "Requesting link…" : "Send private access link"}
        </button>
      </form>
      <Feedback message={error} />
      <Feedback message={message} tone="info" />
      <p className="purchase-secondary">
        <Link href="/login?next=%2Fcart">Sign in</Link> or{" "}
        <Link href="/register?next=%2Fcart">create an account</Link> if you prefer.
      </p>
    </section>
  );
}

export function EndPurchaseAccess() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  return (
    <div>
      <button
        className="button secondary"
        disabled={busy}
        onClick={() => {
          if (busy) return;
          setBusy(true);
          setError(undefined);
          void purchaseRequest("/purchase/access", {
            method: "DELETE",
            body: { allSessions: false },
          })
            .then(announcePurchaseAccess)
            .catch(() => setError("We could not end purchase access. Please try again."))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Ending access…" : "End purchase access"}
      </button>
      <Feedback message={error} />
    </div>
  );
}
