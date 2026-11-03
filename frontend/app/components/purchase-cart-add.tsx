"use client";
import Link from "next/link";
import type { PurchaseSelection } from "@/lib/purchase/suitability";
import { useRef, useState } from "react";
import { setPurchaseCartItem } from "@/lib/purchase/cart";
import { usePublicCapabilities } from "./public-capabilities";

export function PurchaseCartAdd({
  productId,
  available,
  vehicleSelection,
}: {
  productId: string;
  available: boolean;
  vehicleSelection?: PurchaseSelection | null;
}) {
  const { checkoutEnabled } = usePublicCapabilities();
  const [saved, setSaved] = useState(false),
    [error, setError] = useState<string>();
  const quantity = useRef<HTMLInputElement>(null);
  return (
    <form
      data-no-draft
      onSubmit={(event) => {
        event.preventDefault();
        if (!checkoutEnabled || !available) return;
        const value = Number(quantity.current?.value);
        if (!Number.isInteger(value) || value < 1 || value > 1000) {
          setError("Choose a whole quantity from 1 to 1,000.");
          quantity.current?.focus();
          return;
        }
        try {
          setPurchaseCartItem(productId, value, vehicleSelection ?? null);
          setSaved(true);
          setError(undefined);
        } catch {
          setError(
            "We could not save this cart in your browser. Check browser storage or contact the team.",
          );
        }
      }}
    >
      <label htmlFor="guest-product-quantity">Quantity</label>
      <div className="pd-cart-row">
        <input
          ref={quantity}
          id="guest-product-quantity"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          step={1}
          defaultValue={1}
          disabled={!available || !checkoutEnabled}
        />
        <button className="button" disabled={!available || !checkoutEnabled}>
          Add to cart
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {saved && (
        <p role="status">
          Saved in this browser. <Link href="/cart">Review cart</Link>
        </p>
      )}
      <p className="pd-hint">
        This replaces the quantity and chosen vehicle for this product in your cart.
        Price, suitability and stock are checked at checkout.
      </p>
    </form>
  );
}
