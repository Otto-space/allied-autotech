"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Info, MapPin, RefreshCw, Truck } from "lucide-react";
import { z } from "zod";
import type { RequestBody } from "@/lib/api/contracts";
import { SESSION_CHANGED } from "@/lib/api/client";
import { branchRef } from "@/lib/api/commerce-schemas";
import {
  deliveryContactSchema,
  parseFulfillmentOptions,
} from "@/lib/api/fulfillment-schemas";
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
  zoneLabel?: string;
  fee?: string;
  subtotal: string;
  cartSignature: string;
  policyVersion: number | null;
};

export function CartCheckout({
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
  const [method, setMethod] = useState<"COLLECTION" | "DELIVERY">("COLLECTION");
  const [branch, setBranch] = useState<{ id: string; name: string }>();
  const [zoneId, setZoneId] = useState("");
  const [validation, setValidation] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [delivery, setDelivery] = useState({ name: "", phone: "", address: "" });
  const [review, setReview] = useState<Review>();
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const branchInput = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    // Remove the account's saved delivery draft before the shell unmounts us.
    const clear = () => form.current?.reset();
    window.addEventListener(SESSION_CHANGED, clear);
    return () => window.removeEventListener(SESSION_CHANGED, clear);
  }, []);
  const zone = options.data?.delivery.zones.find((candidate) => candidate.id === zoneId);
  const deliveryUnavailable =
    method === "DELIVERY" &&
    (options.loading || !!options.error || !options.data?.delivery.enabled || !zone);
  const checkoutUnavailable = options.data?.checkoutEnabled === false;
  const reviewChanged =
    !!review &&
    (review.cartSignature !== cartSignature ||
      (review.body.fulfillmentMethod === "DELIVERY" &&
        (review.policyVersion !== options.data?.delivery.policyVersion ||
          review.fee !== zone?.feeKobo)));
  const unavailable =
    disabled ||
    checkoutUnavailable ||
    deliveryUnavailable ||
    branches.loading ||
    !!branches.error;
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
  function edit() {
    if (disabled || busy) return;
    setReview(undefined);
    onReviewChange(false);
    requestAnimationFrame(() => branchInput.current?.focus());
  }
  function submit() {
    if (unavailable) return;
    if (review) {
      if (!reviewChanged) onSubmit(review.body);
      return;
    }
    setValidation(undefined);
    const errors: Record<string, string> = {};
    if (!branch) errors.branch = "Choose the branch handling your order.";
    const body: CheckoutBody = {
      branchId: branch?.id ?? "",
      fulfillmentMethod: method,
      ...(promotionCode.trim() ? { promotionCode: promotionCode.trim() } : {}),
    };
    if (method === "DELIVERY" && zone) {
      const contact = deliveryContactSchema.safeParse({
        ...delivery,
        address: delivery.address.replace(/[\r\n\t]+/g, " ").trim(),
      });
      if (!contact.success) {
        for (const issue of contact.error.issues) {
          const field = String(issue.path[0]);
          errors[field] ??=
            field === "name"
              ? "Enter the recipient name using up to 160 characters."
              : field === "phone"
                ? "Enter the recipient phone using up to 32 characters."
                : "Enter the street address using up to 500 characters.";
        }
      } else
        body.delivery = {
          ...contact.data,
          zoneId: zone.id,
          city: zone.city,
          state: zone.state,
          country: "Nigeria",
        };
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setValidation(
        "Review the highlighted details before continuing. Use plain text without control characters.",
      );
      const first = Object.keys(errors)[0];
      document
        .getElementById(first === "branch" ? "collection-branch" : `delivery-${first}`)
        ?.focus();
      return;
    }
    setReview({
      body,
      branchName: branch!.name,
      zoneLabel: zone?.label,
      fee: method === "DELIVERY" ? zone?.feeKobo : undefined,
      subtotal: subtotalKobo,
      cartSignature,
      policyVersion: options.data?.delivery.policyVersion ?? null,
    });
    onReviewChange(true);
  }
  function deliveryField(
    name: "name" | "phone" | "address",
    label: string,
    maxLength: number,
  ) {
    const props = {
      id: `delivery-${name}`,
      name: `delivery-${name}`,
      maxLength,
      required: true,
      autoComplete:
        name === "name"
          ? "shipping name"
          : name === "phone"
            ? "shipping tel"
            : "shipping street-address",
      value: delivery[name],
      "aria-invalid": !!fieldErrors[name],
      "aria-describedby": fieldErrors[name] ? `delivery-${name}-error` : undefined,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setDelivery((value) => ({ ...value, [name]: event.target.value }));
        setFieldErrors((value) => ({ ...value, [name]: "" }));
      },
    };
    return (
      <div className={`field ${name === "address" ? "cart-address-field" : ""}`}>
        <label htmlFor={props.id}>{label}</label>
        {name === "address" ? (
          <textarea {...props} rows={3} />
        ) : (
          <input {...props} type={name === "phone" ? "tel" : "text"} />
        )}
        {fieldErrors[name] && (
          <p className="cart-field-error" id={`delivery-${name}-error`}>
            {fieldErrors[name]}
          </p>
        )}
        {name === "address" && (
          <small>
            {delivery.address.length.toLocaleString("en-NG")} / 500 characters
          </small>
        )}
      </div>
    );
  }
  return (
    <section
      className="checkout-summary cart-checkout"
      aria-labelledby="cart-checkout-title"
    >
      <p className="cart-eyebrow">02 / {review ? "Review" : "Collection or delivery"}</p>
      <h2 id="cart-checkout-title" ref={heading} tabIndex={-1}>
        {review ? "Review your checkout" : "Collection or delivery"}
      </h2>
      <p className="cart-muted">
        {review
          ? "Check your items and details before creating the order."
          : "Choose how you would like to receive your parts."}
      </p>
      <Feedback message={validation} />
      <Feedback message={branches.error} />
      {!branches.loading &&
        !branches.error &&
        branches.data?.items.length === 0 &&
        !branch && (
          <p className="cart-guidance" role="status">
            No branch is available for checkout. Your cart is saved; refresh the branch
            choices or contact customer care.
          </p>
        )}
      {!branches.loading && !branches.error && branches.data?.items.length === 0 && (
        <button
          type="button"
          className="button secondary"
          disabled={disabled}
          onClick={branches.refresh}
        >
          Refresh branch choices
        </button>
      )}
      {branches.error && (
        <button
          type="button"
          className="button secondary"
          disabled={disabled}
          onClick={branches.refresh}
        >
          Retry branches
        </button>
      )}
      {options.loading && <p role="status">Checking delivery availability…</p>}
      {options.error && (
        <Feedback message="We could not load delivery options. You can retry or continue with collection." />
      )}
      {!options.loading &&
        !options.error &&
        options.data &&
        !options.data.delivery.enabled && (
          <p className="cart-muted">
            Delivery is not currently available. You can choose collection.
          </p>
        )}
      {checkoutUnavailable && (
        <Feedback message="Ordering is temporarily unavailable. Your cart remains saved. Please contact customer care for help." />
      )}
      <form
        id="cart-checkout-form"
        ref={form}
        data-draft-key="cart-checkout:1"
        hidden={!!review}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <fieldset disabled={disabled || !!review}>
          <legend className="sr-only">How would you like to receive your order?</legend>
          <div className="cart-fulfillment-options">
            <label className="cart-fulfillment-option">
              <input
                type="radio"
                name="fulfillmentMethod"
                value="COLLECTION"
                checked={method === "COLLECTION"}
                onChange={() => setMethod("COLLECTION")}
              />
              <MapPin size={21} aria-hidden="true" />
              <span>Collection</span>
            </label>
            <label className="cart-fulfillment-option">
              <input
                type="radio"
                name="fulfillmentMethod"
                value="DELIVERY"
                checked={method === "DELIVERY"}
                disabled={
                  method !== "DELIVERY" &&
                  (!options.data?.delivery.enabled || options.loading || !!options.error)
                }
                onChange={() => setMethod("DELIVERY")}
              />
              <Truck size={21} aria-hidden="true" />
              <span>Delivery</span>
            </label>
          </div>
          <p className="cart-fulfillment-note">
            {method === "COLLECTION"
              ? `Collect from ${business.address}.`
              : "Choose the approved area containing your delivery address. The fee is checked again when you create the order."}
          </p>
          <div className="field">
            <label htmlFor="collection-branch">
              {method === "COLLECTION" ? "Collection branch" : "Stock branch"}
            </label>
            <select
              id="collection-branch"
              name="branchId"
              ref={branchInput}
              value={branch?.id ?? ""}
              required
              aria-invalid={!!fieldErrors.branch}
              aria-describedby={fieldErrors.branch ? "cart-branch-error" : undefined}
              onChange={(event) => {
                const value = branches.data?.items.find(
                  (item) => item.id === event.target.value,
                );
                setBranch(value ? { id: value.id, name: value.name } : undefined);
                setFieldErrors((value) => ({ ...value, branch: "" }));
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
            {fieldErrors.branch && (
              <p className="cart-field-error" id="cart-branch-error">
                {fieldErrors.branch}
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
          {method === "DELIVERY" && (
            <>
              <div className="field">
                <label htmlFor="delivery-zone">Delivery area</label>
                <select
                  id="delivery-zone"
                  name="delivery-zone"
                  value={zoneId}
                  onChange={(event) => setZoneId(event.target.value)}
                  required
                  disabled={
                    options.loading || !!options.error || !options.data?.delivery.enabled
                  }
                >
                  <option value="">Choose your delivery area</option>
                  {zoneId && !zone && (
                    <option value={zoneId}>Selected area is no longer available</option>
                  )}
                  {options.data?.delivery.zones.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.label} · {area.city}, {area.state} ·{" "}
                      {formatKobo(area.feeKobo)}
                    </option>
                  ))}
                </select>
              </div>
              {zone && (
                <p className="cart-guidance">
                  <Info size={17} aria-hidden="true" />
                  <span>
                    Delivery to {zone.city}, {zone.state}:{" "}
                    <strong>{formatKobo(zone.feeKobo)}</strong> before any applicable tax.
                    The order confirms the final fee.
                  </span>
                </p>
              )}
              {zoneId && !zone && !options.loading && (
                <Feedback message="The selected delivery area is unavailable. Refresh the options or choose collection before continuing." />
              )}
              <div className="cart-contact-grid">
                {deliveryField("name", "Recipient name", 160)}
                {deliveryField("phone", "Recipient phone", 32)}
                {deliveryField("address", "Street address and directions", 500)}
              </div>
            </>
          )}
          <div className="cart-promotion">
            <div className="field">
              <label htmlFor="promotion-code">Promotion code (optional)</label>
              <input
                id="promotion-code"
                name="promotionCode"
                maxLength={80}
                value={promotionCode}
                onChange={(event) => onPromotionChange(event.target.value)}
              />
            </div>
            {!disabled && !review && (
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
              No payment is taken here. Your order will show the final prices, delivery
              fee, tax and payment deadline before you pay.
            </span>
          </p>
          <button
            className="button cart-primary"
            disabled={unavailable || (!branches.data?.items.length && !branch)}
          >
            {busy ? "Submitting…" : "Review checkout"}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </fieldset>
      </form>
      {review && (
        <div className="cart-checkout-review">
          <dl className="cart-review-facts">
            <div>
              <dt>Fulfilment</dt>
              <dd>
                {review.body.fulfillmentMethod === "DELIVERY" ? "Delivery" : "Collection"}
              </dd>
            </div>
            <div>
              <dt>
                {review.body.fulfillmentMethod === "DELIVERY"
                  ? "Stock branch"
                  : "Collection branch"}
              </dt>
              <dd>{review.branchName}</dd>
            </div>
            {review.body.delivery ? (
              <>
                <div>
                  <dt>Delivery area</dt>
                  <dd>
                    {review.zoneLabel} · {review.body.delivery.city},{" "}
                    {review.body.delivery.state}
                  </dd>
                </div>
                <div>
                  <dt>Recipient</dt>
                  <dd>
                    {review.body.delivery.name}
                    <br />
                    {review.body.delivery.phone}
                  </dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{review.body.delivery.address}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>Collection address</dt>
                <dd>{business.address}</dd>
              </div>
            )}
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
            {review.fee !== undefined && (
              <div>
                <dt>Delivery fee before tax</dt>
                <dd>{formatKobo(review.fee)}</dd>
              </div>
            )}
          </dl>
          <p className="cart-guidance">
            <Info size={17} aria-hidden="true" />
            <span>
              Prices, stock, tax and any discount are checked when your order is created.
              No payment is taken here.
            </span>
          </p>
          {reviewChanged && (
            <Feedback message="Your cart or delivery options changed. Edit details to review the latest information before creating your order." />
          )}
          <div className="cart-review-actions">
            <button
              type="submit"
              form="cart-checkout-form"
              className="button cart-primary"
              disabled={unavailable || reviewChanged}
            >
              {busy ? "Submitting…" : "Create order & review total"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={disabled || busy}
              onClick={edit}
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
        Refresh delivery options
      </button>
    </section>
  );
}
