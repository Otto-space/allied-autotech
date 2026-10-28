"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Info, MapPin, RefreshCw } from "lucide-react";
import { z } from "zod";
import type { RequestBody } from "@/lib/api/contracts";
import { SESSION_CHANGED } from "@/lib/api/client";
import { branchRef } from "@/lib/api/commerce-schemas";
import { parseFulfillmentOptions } from "@/lib/api/fulfillment-schemas";
import { useResource } from "@/lib/api/use-resource";
import { business } from "@/lib/business";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { PromotionPreview } from "./promotion-preview";
import { CursorPagination, useCursorPage } from "./cursor-pagination";

const parseBranches = (value: unknown) =>
  z.object({ items: z.array(branchRef), nextCursor: z.string().optional() }).parse(value);
type CheckoutBody = RequestBody<"/customers/orders/checkout", "post">;
type Review = {
  body: CheckoutBody;
  branchName: string;
  subtotal: string;
  cartSignature: string;
};

export function CollectionCheckout({
  subtotalKobo,
  cartSignature,
  disabled,
  busy,
  promotionCode,
  onPromotionChange,
  onSubmit,
  onReviewChange,
}: {
  subtotalKobo: string;
  cartSignature: string;
  disabled: boolean;
  busy: boolean;
  promotionCode: string;
  onPromotionChange: (value: string) => void;
  onSubmit: (body: CheckoutBody) => void;
  onReviewChange: (reviewing: boolean) => void;
}) {
  const pagination = useCursorPage();
  const branches = useResource(
    `/public/branches?limit=100${pagination.cursor ? `&cursor=${encodeURIComponent(pagination.cursor)}` : ""}`,
    parseBranches,
  );
  const options = useResource("/public/fulfillment-options", parseFulfillmentOptions);
  const [branch, setBranch] = useState<{ id: string; name: string }>();
  const [validation, setValidation] = useState<string>();
  const [review, setReview] = useState<Review>();
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const branchInput = useRef<HTMLSelectElement>(null);
  const checkoutUnavailable = options.data?.checkoutEnabled === false;
  const unavailable =
    disabled ||
    busy ||
    checkoutUnavailable ||
    branches.loading ||
    !!branches.error ||
    options.loading ||
    !!options.error;
  const reviewChanged =
    !!review &&
    (review.cartSignature !== cartSignature ||
      review.body.promotionCode !== (promotionCode.trim() || undefined));
  useEffect(() => {
    const clear = () => {
      form.current?.reset();
      setBranch(undefined);
      setReview(undefined);
      setValidation(undefined);
      onReviewChange(false);
    };
    window.addEventListener(SESSION_CHANGED, clear);
    return () => window.removeEventListener(SESSION_CHANGED, clear);
  }, [onReviewChange]);
  useEffect(() => () => onReviewChange(false), [onReviewChange]);
  useEffect(() => {
    if (!review) return;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [review]);
  function submit() {
    if (unavailable) return;
    if (review) {
      if (!reviewChanged) onSubmit(review.body);
      return;
    }
    if (!branch) {
      setValidation("Choose the branch handling your collection.");
      branchInput.current?.focus();
      return;
    }
    setValidation(undefined);
    setReview({
      body: {
        branchId: branch.id,
        fulfillmentMethod: "COLLECTION",
        ...(promotionCode.trim() ? { promotionCode: promotionCode.trim() } : {}),
      },
      branchName: branch.name,
      subtotal: subtotalKobo,
      cartSignature,
    });
    onReviewChange(true);
  }
  return (
    <section
      className="checkout-summary cart-checkout"
      aria-labelledby="cart-checkout-title"
    >
      <p className="cart-eyebrow">02 / {review ? "Review" : "Collection"}</p>
      <h2 id="cart-checkout-title" ref={heading} tabIndex={-1}>
        {review ? "Review your checkout" : "Collect your parts"}
      </h2>
      <p className="cart-muted">
        {review
          ? "Check your items and collection branch before creating the order."
          : "Orders are collection only. Delivery is unavailable."}
      </p>
      <Feedback message={validation} />
      <Feedback message={branches.error} />
      {!branches.loading &&
        !branches.error &&
        !branches.data?.items.length &&
        !branch && (
          <p className="cart-guidance" role="status">
            No branch is available for checkout. Your cart remains saved. Refresh branch
            choices or contact customer care.
          </p>
        )}
      {(branches.error || (!branches.loading && !branches.data?.items.length)) && (
        <button
          type="button"
          className="button secondary"
          disabled={disabled}
          onClick={branches.refresh}
        >
          Refresh branch choices
        </button>
      )}
      {options.loading && <p role="status">Checking ordering availability...</p>}
      {options.error && (
        <Feedback message="Ordering availability could not be checked. Refresh availability before continuing." />
      )}
      {checkoutUnavailable && (
        <Feedback message="Ordering is temporarily unavailable. Your cart remains saved. Please contact customer care for help." />
      )}
      <form
        id="cart-checkout-form"
        ref={form}
        data-draft-key="cart-checkout:collection:1"
        hidden={!!review}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <fieldset disabled={disabled || busy || !!review}>
          <legend className="sr-only">Collection details</legend>
          <p className="cart-fulfillment-note">
            <MapPin size={17} aria-hidden="true" /> Choose the branch handling your order.
            Confirm its collection instructions before visiting.
          </p>
          <div className="field">
            <label htmlFor="collection-branch">Collection branch</label>
            <select
              id="collection-branch"
              name="branchId"
              ref={branchInput}
              value={branch?.id ?? ""}
              required
              aria-invalid={!!validation && !branch}
              aria-describedby={validation ? "cart-collection-error" : undefined}
              onChange={(event) => {
                const row = branches.data?.items.find(
                  (item) => item.id === event.target.value,
                );
                setBranch(row ? { id: row.id, name: row.name } : undefined);
                setValidation(undefined);
              }}
            >
              <option value="">Choose a branch</option>
              {branch && !branches.data?.items.some((item) => item.id === branch.id) && (
                <option value={branch.id}>{branch.name}</option>
              )}
              {branches.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {validation && (
              <p id="cart-collection-error" className="cart-field-error">
                {validation}
              </p>
            )}
            {(branches.data?.nextCursor || pagination.page > 1) && (
              <CursorPagination
                pagination={pagination}
                nextCursor={branches.data?.nextCursor}
                disabled={disabled || branches.loading || !!branches.error}
                label="Branch choices"
              />
            )}
          </div>
          <div className="field">
            <label htmlFor="checkout-promotion">Promotion code (optional)</label>
            <input
              id="checkout-promotion"
              name="promotionCode"
              value={promotionCode}
              maxLength={80}
              onChange={(event) => onPromotionChange(event.target.value)}
            />
            {promotionCode.trim() && (
              <PromotionPreview
                key={`${promotionCode}:${subtotalKobo}`}
                code={promotionCode}
                subtotalKobo={subtotalKobo}
              />
            )}
          </div>
          <p className="cart-guidance">
            <Info size={17} aria-hidden="true" />
            <span>
              No payment is taken here. Your order will show the final prices, any
              discount, tax and payment deadline before you pay.
            </span>
          </p>
          <button
            className="button cart-primary"
            disabled={unavailable || (!branches.data?.items.length && !branch)}
          >
            Review checkout <ArrowRight size={17} aria-hidden="true" />
          </button>
        </fieldset>
      </form>
      {review && (
        <div className="cart-checkout-review">
          <dl className="cart-review-facts">
            <div>
              <dt>Fulfilment</dt>
              <dd>Collection only</dd>
            </div>
            <div>
              <dt>Collection branch</dt>
              <dd>{review.branchName}</dd>
            </div>
            <div>
              <dt>Company address</dt>
              <dd>{business.address}</dd>
            </div>
            {review.body.promotionCode && (
              <div>
                <dt>Promotion code</dt>
                <dd>{review.body.promotionCode}</dd>
              </div>
            )}
          </dl>
          <dl className="cart-amounts">
            <div>
              <dt>Products subtotal</dt>
              <dd>{formatKobo(review.subtotal)}</dd>
            </div>
          </dl>
          <p className="cart-guidance">
            <Info size={17} aria-hidden="true" />
            <span>
              Prices, stock, tax and any discount are checked when your order is created.
              No payment is taken here.
            </span>
          </p>
          {reviewChanged && (
            <Feedback message="Your cart or promotion changed. Edit details to review the latest information before creating your order." />
          )}
          <div className="cart-review-actions">
            <button
              type="button"
              className="button cart-primary"
              disabled={unavailable || reviewChanged}
              onClick={submit}
            >
              {busy ? "Submitting..." : "Create order & review total"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={disabled || busy}
              onClick={() => {
                setReview(undefined);
                onReviewChange(false);
                requestAnimationFrame(() => branchInput.current?.focus());
              }}
            >
              Edit details
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="cart-text-button"
        disabled={disabled || options.loading}
        onClick={options.refresh}
      >
        <RefreshCw size={15} aria-hidden="true" />
        Refresh ordering availability
      </button>
    </section>
  );
}
