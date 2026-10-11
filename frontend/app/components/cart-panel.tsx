"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Info,
  Package,
  RefreshCw,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError, newIdempotencyKey } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useResource } from "@/lib/api/use-resource";
import { parseCart, orderSchema } from "@/lib/api/commerce-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { CartCheckout } from "./cart-checkout";
import { notify } from "@/lib/notifications";
import { useScrollToMessage } from "@/lib/use-scroll-to-message";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { PublicMedia } from "./public-media";
import { CopyControl } from "./copy-control";
import "./cart-checkout.css";
type CheckoutBody = RequestBody<"/customers/orders/checkout", "post">;
type CartItem = ReturnType<typeof parseCart>["items"][number];
function cartSnapshot(value?: ReturnType<typeof parseCart>) {
  return JSON.stringify({
    subtotal: value?.subtotalKobo,
    items: value?.items.map((item) => [
      item.product.id,
      item.quantity,
      item.unitPriceKobo,
      item.lineSubtotalKobo,
    ]),
  });
}

function CartLine({
  item,
  disabled,
  onDirty,
  onChange,
}: {
  item: CartItem;
  disabled: boolean;
  onDirty: (dirty: boolean) => void;
  onChange: (quantity?: number) => void;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [error, setError] = useState<string>();
  const field = useRef<HTMLInputElement>(null);
  const dirty = quantity !== String(item.quantity);
  const photo =
    item.product.images.find((image) => image.isPrimary) ?? item.product.images[0];
  return (
    <article className="cart-row" aria-label={item.product.name}>
      <Link
        href={`/parts/${item.product.id}`}
        className="cart-product-image"
        tabIndex={-1}
        aria-hidden="true"
      >
        <PublicMedia
          src={photo?.url}
          alt=""
          sizes="96px"
          fallbackIcon={<Package size={25} strokeWidth={1.4} />}
        />
      </Link>
      <div className="cart-product-info">
        <Link className="cart-product-name" href={`/parts/${item.product.id}`}>
          {item.product.name}
        </Link>
        <p className="cart-sku">
          {item.product.brand ? `${item.product.brand} · ` : ""}SKU: {item.product.sku}
        </p>
        <p className="cart-unit-price">{formatKobo(item.unitPriceKobo)} each</p>
      </div>
      <div className="cart-line-total">
        <span>Line subtotal</span>
        <strong>{formatKobo(item.lineSubtotalKobo)}</strong>
      </div>
      <form
        className="cart-quantity-form"
        data-no-draft
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled) return;
          const value = Number(quantity);
          if (!Number.isInteger(value) || value < 1 || value > 1000) {
            setError("Enter a whole number from 1 to 1,000.");
            field.current?.focus();
            return;
          }
          setError(undefined);
          onChange(value);
        }}
      >
        <div className="field quantity-field">
          <label htmlFor={`qty-${item.id}`}>Quantity</label>
          <input
            ref={field}
            id={`qty-${item.id}`}
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={quantity}
            required
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `qty-${item.id}-error` : undefined}
            onChange={(event) => {
              setQuantity(event.target.value);
              onDirty(event.target.value !== String(item.quantity));
              setError(undefined);
            }}
          />
        </div>
        <button className="button secondary" disabled={disabled || !dirty}>
          Update
        </button>
        {error && (
          <p className="cart-field-error" id={`qty-${item.id}-error`}>
            {error}
          </p>
        )}
      </form>
      <button
        type="button"
        className="cart-remove"
        disabled={disabled}
        onClick={() => onChange()}
        aria-label={`Remove ${item.product.name}`}
      >
        <Trash2 size={15} aria-hidden="true" />
        Remove
      </button>
    </article>
  );
}

export function CartPanel() {
  const cart = useResource("/customers/cart", parseCart);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [result, setResult] = useState<{
    order: z.infer<typeof orderSchema>;
    replayed: boolean;
  }>();
  const order = result?.order;
  const confirmation = useScrollToMessage(order?.id);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const [uncertain, setUncertain] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");
  const [cartUncertain, setCartUncertain] = useState(false);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [dirtyProducts, setDirtyProducts] = useState<string[]>([]);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (order) resultHeading.current?.focus({ preventScroll: true });
  }, [order]);
  const editsDisabled =
    busy || uncertain || cartUncertain || cart.loading || !!cart.error || !!order;
  const hasEdits = !!cart.data?.items.some((item) =>
    dirtyProducts.includes(item.product.id),
  );
  const cartSignature = cartSnapshot(cart.data);
  const checkout = useRef<{ body: CheckoutBody; key: string } | null>(null);
  function cleanProduct(productId: string) {
    setDirtyProducts((value) => value.filter((id) => id !== productId));
  }
  async function change(productId: string, quantity?: number) {
    if (editsDisabled || reviewing || proposal || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await apiRequest(`/customers/cart/items/${productId}`, {
        method: quantity === undefined ? "DELETE" : "PUT",
        body: quantity === undefined ? {} : { quantity },
        csrf: true,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      cleanProduct(productId);
      cart.refresh();
      setMessage("Your cart has been updated.");
    } catch (error_) {
      if (controller.signal.aborted) return;
      if (!(error_ instanceof ApiError && error_.status >= 400 && error_.status < 500))
        setCartUncertain(true);
      setError(
        error_ instanceof ApiError
          ? error_.message
          : "We could not confirm the cart update. Refresh your cart before making another change.",
      );
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function submitCheckout(body?: CheckoutBody) {
    if (
      busy ||
      pending.current ||
      order ||
      cartUncertain ||
      proposal ||
      (body && (uncertain || cart.loading || cart.error || hasEdits))
    )
      return;
    if (body) checkout.current = { body, key: newIdempotencyKey() };
    const attempt = checkout.current;
    if (!attempt) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    let submitted = false;
    try {
      if (body) {
        const latest = parseCart(
          (await apiRequest("/customers/cart", { signal: controller.signal })).data,
        );
        if (controller.signal.aborted) return;
        if (cartSnapshot(latest) !== cartSignature) {
          cart.refresh();
          setError(
            "Your cart changed. Edit details and review the updated items before creating your order.",
          );
          return;
        }
      }
      // A replay must reach checkout even when the original write cleared the cart.
      submitted = true;
      const response = await apiRequest<unknown>("/customers/orders/checkout", {
        method: "POST",
        csrf: true,
        idempotencyKey: attempt.key,
        body: attempt.body,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const parsed = z
        .object({ order: orderSchema, replayed: z.boolean() })
        .parse(response.data);
      setResult(parsed);
      setUncertain(false);
      setDirtyProducts([]);
      notify(
        parsed.replayed
          ? "Your order was found. Review its current details."
          : "Order created. Review the total and payment deadline.",
        {
          tone: "success",
          action: { label: "View order", href: `/dashboard/orders/${parsed.order.id}` },
        },
      );
      cart.refresh();
    } catch (error_) {
      if (controller.signal.aborted) return;
      const knownRejection =
        error_ instanceof ApiError && error_.status >= 400 && error_.status < 500;
      setUncertain(submitted && !knownRejection);
      setError(
        !submitted
          ? "We could not check the latest cart. No checkout was sent. Check your connection and try again."
          : error_ instanceof ApiError
            ? error_.message
            : "Checkout confirmation is unavailable. Check your orders before starting another checkout.",
      );
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function reviewClear() {
    if (!cart.data || editsDisabled || reviewing || proposal) return;
    const reviewed = JSON.stringify(cart.data);
    setProposal({
      title: "Clear your cart?",
      description:
        "This removes every product currently in your cart. Existing orders and payments are not cancelled. Review the contents before continuing.",
      facts: [
        {
          label: "Products",
          value: cart.data.items
            .map((item) => `${item.product.name} × ${item.quantity}`)
            .join("; "),
        },
        { label: "Current subtotal", value: formatKobo(cart.data.subtotalKobo) },
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
            current = parseCart(
              (await apiRequest("/customers/cart", { signal: controller.signal })).data,
            );
          } catch {
            if (!controller.signal.aborted) cart.refresh();
            throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
          }
          if (controller.signal.aborted)
            throw new DOMException("Request cancelled", "AbortError");
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
          if (controller.signal.aborted) return;
          setPromotionCode("");
          setDirtyProducts([]);
          setMessage("Your cart was cleared. Refresh to check its latest contents.");
          cart.refresh();
        } finally {
          if (pending.current === controller) pending.current = null;
          if (!controller.signal.aborted) setBusy(false);
        }
      },
    });
  }
  return (
    <section className="cart-page">
      <header className="cart-page-header">
        <div>
          <h1>Your cart</h1>
          <p>
            Review your parts, then choose collection or delivery. Prices and branch stock
            are checked when your order is created.
          </p>
        </div>
        <Link className="cart-shopping-link" href="/parts">
          Continue shopping
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </header>
      <ol className="cart-progress" aria-label="Order journey">
        <li aria-current={!reviewing && !order ? "step" : undefined}>
          <span>01</span>Review items
        </li>
        <li aria-current={reviewing && !order ? "step" : undefined}>
          <span>02</span>Collection or delivery
        </li>
        <li aria-current={order ? "step" : undefined}>
          <span>03</span>Order &amp; payment
        </li>
      </ol>
      <Feedback message={error ?? cart.error} />
      <Feedback message={message} tone="success" toast="Cart change recorded." />
      {cartUncertain && (
        <p role="status" className="cart-guidance">
          <Info size={18} aria-hidden="true" />
          <span>
            A cart change has an unknown outcome. Refresh to inspect your cart. Further
            changes and checkout are paused in this view; the request will not be resent.
          </span>
        </p>
      )}
      {uncertain && (
        <section className="cart-pending" aria-labelledby="cart-pending-title">
          <h2 id="cart-pending-title">Checkout confirmation is pending</h2>
          <p>
            Do not start another checkout yet. You can check the same submission again or
            look for your order.
          </p>
          <div className="cart-review-actions">
            <button
              className="button"
              disabled={busy}
              onClick={() => void submitCheckout()}
            >
              {busy ? "Checking checkout…" : "Check this checkout again"}
            </button>
            <Link className="button secondary" href="/dashboard/orders">
              View your orders
            </Link>
          </div>
        </section>
      )}
      {order ? (
        <section
          className="cart-confirmation"
          ref={confirmation}
          aria-labelledby="cart-order-title"
        >
          <div className="cart-confirmation-intro">
            <span className="cart-confirmation-icon">
              <Check size={26} aria-hidden="true" />
            </span>
            <p className="cart-eyebrow">
              03 / Order {result.replayed ? "found" : "created"}
            </p>
            <h2 id="cart-order-title" ref={resultHeading} tabIndex={-1}>
              {result.replayed ? "Order found" : "Order created"}
            </h2>
            <p>
              Review the confirmed total and your order’s current details before
              continuing to payment.
            </p>
            <label htmlFor="cart-order-reference">Order reference</label>
            <input id="cart-order-reference" readOnly value={order.orderNumber} />
            <CopyControl
              value={order.orderNumber}
              label="Copy order reference"
              fieldId="cart-order-reference"
            />
            <Link className="button cart-primary" href={`/dashboard/orders/${order.id}`}>
              Review order &amp; payment
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <div>
            <dl className="cart-amounts">
              <div>
                <dt>Products</dt>
                <dd>{formatKobo(order.subtotalKobo)}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>{formatKobo(order.discountAmountKobo)}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>{formatKobo(order.deliveryFeeKobo)}</dd>
              </div>
              {order.taxKobo !== undefined && (
                <div>
                  <dt>Tax</dt>
                  <dd>{formatKobo(order.taxKobo)}</dd>
                </div>
              )}
              <div className="cart-final-total">
                <dt>Total</dt>
                <dd>{formatKobo(order.totalKobo)}</dd>
              </div>
            </dl>
            <div className="cart-confirmed-status">
              <strong>
                {order.status === "CANCELLED"
                  ? "Order cancelled"
                  : order.paidAt
                    ? "Payment recorded"
                    : "Awaiting payment"}
              </strong>
              {order.paymentDueAt && !order.paidAt && order.status !== "CANCELLED" && (
                <p>Payment deadline: {formatBusinessDate(order.paymentDueAt)}</p>
              )}
              <p>Check the order for its latest status and payment options.</p>
            </div>
          </div>
        </section>
      ) : (
        <div className="cart-layout" data-empty={!cart.data?.items.length}>
          <section className="cart-items" aria-labelledby="cart-items-title">
            <div className="cart-items-toolbar">
              <h2 id="cart-items-title">
                Your items
                {cart.data && !cart.error && (
                  <span>
                    {cart.data.items.length}{" "}
                    {cart.data.items.length === 1 ? "product" : "products"}
                  </span>
                )}
              </h2>
              <div className="cart-tools">
                <button
                  type="button"
                  className="cart-text-button"
                  disabled={busy || cart.loading || reviewing || !!proposal}
                  onClick={cart.refresh}
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  Refresh cart
                </button>
                {!!cart.data?.items.length && (
                  <button
                    type="button"
                    className="cart-text-button"
                    disabled={editsDisabled || reviewing}
                    onClick={reviewClear}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Clear cart
                  </button>
                )}
              </div>
            </div>
            {cart.loading && (
              <p role="status" className="cart-loading">
                {cart.data ? "Updating cart…" : "Loading cart…"}
              </p>
            )}
            {!cart.data && cart.loading && (
              <div className="cart-skeleton" aria-hidden="true">
                <div />
                <div />
              </div>
            )}
            <div className="cart-products">
              {!cart.error &&
                cart.data?.items.map((item) => (
                  <CartLine
                    key={`${item.id}:${item.quantity}`}
                    item={item}
                    disabled={editsDisabled || reviewing || !!proposal}
                    onDirty={(dirty) =>
                      setDirtyProducts((value) =>
                        dirty
                          ? value.includes(item.product.id)
                            ? value
                            : [...value, item.product.id]
                          : value.filter((id) => id !== item.product.id),
                      )
                    }
                    onChange={(quantity) => void change(item.product.id, quantity)}
                  />
                ))}
            </div>
            {hasEdits && (
              <p role="status" className="cart-unsaved">
                Update your edited quantities before reviewing checkout.
              </p>
            )}
            {!!cart.data?.items.length && !cart.error && (
              <div className="cart-subtotal">
                <div>
                  <span>Products subtotal</span>
                  <strong>{formatKobo(cart.data.subtotalKobo)}</strong>
                </div>
                <p>Final tax, delivery and any discount are confirmed with your order.</p>
              </div>
            )}
            {!cart.loading && !cart.error && cart.data?.items.length === 0 && (
              <div className="cart-empty">
                <ShoppingBag size={42} strokeWidth={1.3} aria-hidden="true" />
                <h2>Your cart is empty</h2>
                <p>
                  Explore parts and automotive products, then return here to review your
                  order.
                </p>
                <Link className="button" href="/parts">
                  Visit Shop
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link className="cart-shopping-link" href="/dashboard/saved">
                  View saved items
                </Link>
              </div>
            )}
          </section>
          {!!cart.data?.items.length && !cart.error && (
            <CartCheckout
              subtotalKobo={cart.data.subtotalKobo}
              cartSignature={cartSignature}
              disabled={editsDisabled || !!proposal || hasEdits}
              busy={busy}
              promotionCode={promotionCode}
              onPromotionChange={setPromotionCode}
              onReviewChange={setReviewing}
              onSubmit={(body) => void submitCheckout(body)}
            />
          )}
        </div>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
          confirmLabel="Clear cart"
        />
      )}
    </section>
  );
}
