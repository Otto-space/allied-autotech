"use client";
import { useState } from "react";
import { z } from "zod";
import type { RequestBody } from "@/lib/api/contracts";
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
const parseBranches = (value: unknown) =>
  z.object({ items: z.array(branchRef), nextCursor: z.string().optional() }).parse(value);
type CheckoutBody = RequestBody<"/customers/orders/checkout", "post">;
export function CartCheckout({
  subtotalKobo,
  disabled,
  busy,
  promotionCode,
  onPromotionChange,
  onSubmit,
}: {
  subtotalKobo: string;
  disabled: boolean;
  busy: boolean;
  promotionCode: string;
  onPromotionChange: (value: string) => void;
  onSubmit: (body: CheckoutBody) => void;
}) {
  const branches = useResource("/public/branches?limit=100", parseBranches);
  const options = useResource("/public/fulfillment-options", parseFulfillmentOptions);
  const [method, setMethod] = useState<"COLLECTION" | "DELIVERY">("COLLECTION");
  const [zoneId, setZoneId] = useState("");
  const [validation, setValidation] = useState<string>();
  const [delivery, setDelivery] = useState({ name: "", phone: "", address: "" });
  const zone = options.data?.delivery.zones.find((candidate) => candidate.id === zoneId);
  const deliveryUnavailable =
    method === "DELIVERY" &&
    (options.loading || !!options.error || !options.data?.delivery.enabled || !zone);
  const checkoutUnavailable = options.data?.checkoutEnabled === false;
  function submit(values: FormData) {
    if (
      disabled ||
      checkoutUnavailable ||
      deliveryUnavailable ||
      branches.loading ||
      branches.error
    )
      return;
    setValidation(undefined);
    const branchId = String(values.get("branchId") ?? "");
    if (!branches.data?.items.some((branch) => branch.id === branchId)) return;
    const body: CheckoutBody = {
      branchId,
      fulfillmentMethod: method,
      ...(promotionCode.trim() ? { promotionCode: promotionCode.trim() } : {}),
    };
    if (method === "DELIVERY") {
      if (!zone) return;
      const contact = deliveryContactSchema.safeParse({
        ...delivery,
        address: delivery.address.replace(/[\r\n\t]+/g, " ").trim(),
      });
      if (!contact.success) {
        const field = contact.error.issues[0]?.path[0];
        setValidation(
          "Review the recipient name, phone and delivery address. Use plain text within the stated limits.",
        );
        document.getElementById(`delivery-${String(field)}`)?.focus();
        return;
      }
      body.delivery = {
        ...contact.data,
        zoneId: zone.id,
        city: zone.city,
        state: zone.state,
        country: "Nigeria",
      };
    }
    onSubmit(body);
  }
  return (
    <section className="checkout-summary">
      <h2>Collection or delivery</h2>
      <dl className="totals">
        <dt>Products subtotal</dt>
        <dd>{formatKobo(subtotalKobo)}</dd>
      </dl>
      <p>
        Your order will show the final prices, delivery fee, tax and payment deadline
        before you pay.
      </p>
      <Feedback message={validation} />
      <Feedback message={branches.error} />
      {branches.error && (
        <button type="button" className="button secondary" onClick={branches.refresh}>
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
          <p>Delivery is not currently available. You can choose collection.</p>
        )}
      {checkoutUnavailable && (
        <Feedback message="Ordering is temporarily unavailable. Your cart remains saved. Please contact customer care for help." />
      )}
      <button
        type="button"
        className="button secondary"
        disabled={disabled || options.loading}
        onClick={options.refresh}
      >
        Refresh delivery options
      </button>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(new FormData(event.currentTarget));
        }}
      >
        <fieldset disabled={disabled}>
          <legend>How would you like to receive your order?</legend>
          <label className="check-label">
            <input
              type="radio"
              name="fulfillmentMethod"
              value="COLLECTION"
              checked={method === "COLLECTION"}
              onChange={() => setMethod("COLLECTION")}
            />{" "}
            Collection
          </label>
          <label className="check-label">
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
            />{" "}
            Delivery
          </label>
          <p>
            {method === "COLLECTION"
              ? `Collect from ${business.address}.`
              : "Choose the approved area containing your delivery address. The fee is checked again when you create the order."}
          </p>
          <div className="field">
            <label htmlFor="collection-branch">
              {method === "COLLECTION" ? "Collection branch" : "Stock branch"}
            </label>
            <select id="collection-branch" name="branchId" required>
              <option value="">Choose a branch</option>
              {branches.data?.items.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          {method === "DELIVERY" && (
            <>
              <div className="field">
                <label htmlFor="delivery-zone">Delivery area</label>
                <select
                  id="delivery-zone"
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
                <p>
                  Delivery to {zone.city}, {zone.state}:{" "}
                  <strong>{formatKobo(zone.feeKobo)}</strong> before any applicable tax.
                  The order confirms the final fee.
                </p>
              )}
              {zoneId && !zone && !options.loading && (
                <Feedback message="The selected delivery area is unavailable. Refresh the options or choose collection before continuing." />
              )}
              <div className="field">
                <label htmlFor="delivery-name">Recipient name</label>
                <input
                  id="delivery-name"
                  autoComplete="shipping name"
                  maxLength={160}
                  required
                  value={delivery.name}
                  onChange={(event) =>
                    setDelivery({ ...delivery, name: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="delivery-phone">Recipient phone</label>
                <input
                  id="delivery-phone"
                  type="tel"
                  autoComplete="shipping tel"
                  maxLength={32}
                  required
                  value={delivery.phone}
                  onChange={(event) =>
                    setDelivery({ ...delivery, phone: event.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="delivery-address">Street address and directions</label>
                <textarea
                  id="delivery-address"
                  autoComplete="shipping street-address"
                  maxLength={500}
                  required
                  value={delivery.address}
                  onChange={(event) =>
                    setDelivery({ ...delivery, address: event.target.value })
                  }
                />
              </div>
            </>
          )}
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
          {!disabled && (
            <PromotionPreview
              key={`${promotionCode}:${subtotalKobo}`}
              code={promotionCode}
              subtotalKobo={subtotalKobo}
            />
          )}
          <button
            className="button"
            disabled={
              checkoutUnavailable ||
              deliveryUnavailable ||
              branches.loading ||
              !!branches.error ||
              !branches.data?.items.length
            }
          >
            {busy ? "Submitting…" : "Create order & review total"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
