"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError, newIdempotencyKey } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import { branchRef, parseCart, orderSchema } from "@/lib/api/commerce-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { PromotionPreview } from "./promotion-preview";
import { MutationReview, type MutationProposal } from "./mutation-review";
const parseBranches = (value: unknown) =>
  z.object({ items: z.array(branchRef), nextCursor: z.string().optional() }).parse(value);
type CheckoutBody = RequestBody<"/customers/orders/checkout", "post">;
export function CartPanel() {
  const cart = useResource("/customers/cart", parseCart);
  const branches = useResource("/public/branches?limit=100", parseBranches);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [orderId, setOrderId] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");
  const [cartUncertain, setCartUncertain] = useState(false);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const editsDisabled =
    busy || uncertain || cartUncertain || cart.loading || !!cart.error || !!orderId;
  const checkout = useRef<{ body: CheckoutBody; key: string } | null>(null);
  async function change(path: string, method: string, body: unknown) {
    if (editsDisabled || proposal || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await apiRequest(path, { method, body, csrf: true, signal: controller.signal });
      cart.refresh();
      setMessage("Your cart has been updated.");
    } catch (error_) {
      if (!(error_ instanceof ApiError && error_.status >= 400 && error_.status < 500))
        setCartUncertain(true);
      setError(
        error_ instanceof ApiError
          ? error_.message
          : "We could not confirm the cart update. Refresh your cart before making another change.",
      );
    } finally {
      pending.current = null;
      setBusy(false);
    }
  }
  async function submitCheckout(body?: CheckoutBody) {
    if (
      busy ||
      pending.current ||
      orderId ||
      cartUncertain ||
      proposal ||
      (body && (uncertain || cart.loading || cart.error))
    )
      return;
    if (body) checkout.current = { body, key: newIdempotencyKey() };
    const attempt = checkout.current;
    if (!attempt) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      const result = await apiRequest<unknown>("/customers/orders/checkout", {
        method: "POST",
        csrf: true,
        idempotencyKey: attempt.key,
        body: attempt.body,
        signal: controller.signal,
      });
      const parsed = z
        .object({ order: orderSchema, replayed: z.boolean() })
        .parse(result.data);
      setOrderId(parsed.order.id);
      setUncertain(false);
      cart.refresh();
    } catch (error_) {
      const knownRejection =
        error_ instanceof ApiError && error_.status >= 400 && error_.status < 500;
      setUncertain(!knownRejection);
      setError(
        error_ instanceof ApiError
          ? error_.message
          : "Checkout confirmation is unavailable. Check your orders before starting another checkout.",
      );
    } finally {
      pending.current = null;
      setBusy(false);
    }
  }
  return (
    <>
      <h1>Your cart</h1>
      <p className="muted">
        Review your parts. Prices and branch stock are checked again when your order is
        created.
      </p>
      <Feedback message={error ?? cart.error} />
      <Feedback message={message} tone="success" />
      <div className="actions">
        <button
          className="button secondary"
          disabled={busy || cart.loading}
          onClick={cart.refresh}
        >
          Refresh cart
        </button>
        {!!cart.data?.items.length && !orderId && (
          <button
            className="button secondary"
            disabled={editsDisabled}
            onClick={() => {
              if (!cart.data || editsDisabled || proposal) return;
              const reviewed = JSON.stringify(cart.data);
              setProposal({
                title: "Clear your cart?",
                description:
                  "This removes every part currently in your cart. Existing orders and payments are not cancelled. Review the contents before continuing.",
                facts: [
                  {
                    label: "Parts",
                    value: cart.data.items
                      .map((item) => `${item.product.name} × ${item.quantity}`)
                      .join("; "),
                  },
                  {
                    label: "Current subtotal",
                    value: formatKobo(cart.data.subtotalKobo),
                  },
                ],
                retryAfterRejection: false,
                onUncertain: () => setCartUncertain(true),
                submit: async () => {
                  const controller = new AbortController();
                  pending.current = controller;
                  setBusy(true);
                  setError(undefined);
                  setMessage(undefined);
                  try {
                    let current: ReturnType<typeof parseCart>;
                    try {
                      const response = await apiRequest("/customers/cart", {
                        signal: controller.signal,
                      });
                      current = parseCart(response.data);
                    } catch {
                      cart.refresh();
                      throw new ApiError(409, {
                        error: { code: "PRECONDITION_UNAVAILABLE" },
                      });
                    }
                    if (JSON.stringify(current) !== reviewed) {
                      cart.refresh();
                      throw new ApiError(409, { error: { code: "CONFLICT" } });
                    }
                    await apiRequest("/customers/cart", {
                      method: "DELETE",
                      body: {},
                      csrf: true,
                      signal: controller.signal,
                    });
                    setPromotionCode("");
                    setMessage(
                      "Your cart was cleared. Refresh to check its latest contents.",
                    );
                    cart.refresh();
                  } finally {
                    pending.current = null;
                    setBusy(false);
                  }
                },
              });
            }}
          >
            Clear cart
          </button>
        )}
      </div>
      {cartUncertain && (
        <p role="status" className="notice">
          A cart change has an unknown outcome. Refresh to inspect your cart. Further
          changes and checkout are paused in this view; the request will not be resent.
        </p>
      )}
      {cart.loading && (
        <p role="status">{cart.data ? "Updating cart…" : "Loading cart…"}</p>
      )}
      {orderId && (
        <div className="notice success">
          <h2>Order created</h2>
          <p>
            Your order is awaiting payment. Review its confirmed total and payment
            deadline before continuing.
          </p>
          <Link className="button" href={`/dashboard/orders/${orderId}`}>
            Review order & payment
          </Link>
        </div>
      )}
      {uncertain && (
        <div className="notice">
          <h2>Checkout confirmation is pending</h2>
          <p>
            Do not start another checkout yet. You can check the same submission again or
            look for your order.
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => void submitCheckout()}
          >
            Check this checkout again
          </button>
          <p>
            <Link className="text-link" href="/dashboard/orders">
              View your orders
            </Link>
          </p>
        </div>
      )}
      <div className="list">
        {!cart.error &&
          cart.data?.items.map((item) => (
            <article className="cart-row" key={item.id}>
              <div>
                <Link className="text-link" href={`/parts/${item.product.id}`}>
                  {item.product.name}
                </Link>
                <p className="muted">{formatKobo(item.unitPriceKobo)} each</p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const quantity = Number(
                    new FormData(event.currentTarget).get("quantity"),
                  );
                  if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 1000)
                    void change(`/customers/cart/items/${item.product.id}`, "PUT", {
                      quantity,
                    });
                }}
                key={`${item.id}-${item.quantity}`}
              >
                <div className="field quantity-field">
                  <label htmlFor={`qty-${item.id}`}>Quantity</label>
                  <input
                    id={`qty-${item.id}`}
                    name="quantity"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={1000}
                    defaultValue={item.quantity}
                    required
                    disabled={editsDisabled}
                  />
                </div>
                <button className="button secondary" disabled={editsDisabled}>
                  Update
                </button>
              </form>
              <strong>{formatKobo(item.lineSubtotalKobo)}</strong>
              <button
                className="text-link"
                disabled={editsDisabled}
                onClick={() =>
                  void change(`/customers/cart/items/${item.product.id}`, "DELETE", {})
                }
                aria-label={`Remove ${item.product.name}`}
              >
                Remove
              </button>
            </article>
          ))}
      </div>
      {!cart.loading && !cart.error && cart.data?.items.length === 0 && !orderId && (
        <div className="empty">
          <h2>Your cart is empty</h2>
          <Link className="button" href="/parts">
            Explore parts
          </Link>
        </div>
      )}
      {!!cart.data?.items.length && !cart.error && !orderId && (
        <section className="checkout-summary">
          <h2>Order for collection</h2>
          <dl className="totals">
            <dt>Current parts subtotal</dt>
            <dd>{formatKobo(cart.data.subtotalKobo)}</dd>
          </dl>
          <p className="muted">
            Collection is currently available. Your order will show the final total and
            payment deadline. Delivery is not available.
          </p>
          <Feedback message={branches.error} />
          {branches.error && (
            <button className="button secondary" onClick={branches.refresh}>
              Retry branches
            </button>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              const promotionCode = String(values.get("promotionCode") ?? "").trim();
              void submitCheckout({
                branchId: String(values.get("branchId")),
                fulfillmentMethod: "COLLECTION",
                ...(promotionCode ? { promotionCode } : {}),
              });
            }}
          >
            <div className="field">
              <label htmlFor="collection-branch">Collection branch</label>
              <select
                id="collection-branch"
                name="branchId"
                required
                disabled={editsDisabled}
              >
                <option value="">Choose a branch</option>
                {branches.data?.items.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="promotion-code">Promotion code (optional)</label>
              <input
                id="promotion-code"
                name="promotionCode"
                maxLength={80}
                disabled={editsDisabled}
                value={promotionCode}
                onChange={(event) => setPromotionCode(event.target.value)}
              />
            </div>
            {!editsDisabled && (
              <PromotionPreview
                key={`${promotionCode}:${JSON.stringify(cart.data)}`}
                code={promotionCode}
                subtotalKobo={cart.data.subtotalKobo}
              />
            )}
            <button
              className="button"
              disabled={editsDisabled || !branches.data?.items.length}
            >
              {busy ? "Submitting…" : "Create order & review total"}
            </button>
          </form>
        </section>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
          confirmLabel="Clear cart"
        />
      )}
    </>
  );
}
