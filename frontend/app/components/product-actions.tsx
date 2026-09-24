"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { AccountChangeNotice } from "./account-change-notice";
import { Feedback } from "./feedback";
export function ProductActions({
  productId,
  available,
}: {
  productId: string;
  available: boolean;
}) {
  const form = useForm<{ quantity: number }>({
    defaultValues: { quantity: 1 },
    mode: "onSubmit",
  });
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [login, setLogin] = useState(false);
  const { reset } = form;
  const discard = useCallback(() => {
    setError(undefined);
    setMessage(undefined);
    setLogin(false);
    reset({ quantity: 1 });
  }, [reset]);
  const operation = useAccountMutation(discard);
  const { busy } = operation;
  async function mutate(action: "cart" | "favourite", quantity = 1) {
    const controller = operation.begin();
    if (!controller) return;
    setError(undefined);
    setMessage(undefined);
    setLogin(false);
    try {
      if (action === "cart") {
        const body: RequestBody<"/customers/cart/items/{productId}", "put"> = {
          quantity,
        };
        await apiRequest(`/customers/cart/items/${productId}`, {
          method: "PUT",
          csrf: true,
          signal: controller.signal,
          body,
        });
        if (controller.signal.aborted) return;
        setMessage("Your cart quantity has been saved. Review your cart to continue.");
      } else {
        await apiRequest(`/customers/favourites/${productId}`, {
          method: "PUT",
          csrf: true,
          signal: controller.signal,
          body: {},
        });
        if (controller.signal.aborted) return;
        setMessage("Product saved to your favourites.");
      }
    } catch (value) {
      if (controller.signal.aborted) return;
      setError(
        value instanceof ApiError
          ? value.message
          : "We could not confirm the update. Please check your account.",
      );
      setLogin(value instanceof ApiError && value.status === 401);
    } finally {
      operation.finish(controller);
    }
  }
  return (
    <>
      <AccountChangeNotice visible={operation.sessionChanged} />
      <Feedback message={error} toast="Please review the message on this page." />
      <Feedback message={message} tone="success" toast="Your selection has been saved." />
      {login && (
        <Link
          className="button"
          href={`/login?next=${encodeURIComponent(`/parts/${productId}`)}`}
        >
          Sign in to continue
        </Link>
      )}
      <form onSubmit={form.handleSubmit((values) => mutate("cart", values.quantity))}>
        <div className="field quantity-field">
          <label htmlFor="product-quantity">Quantity</label>
          <input
            id="product-quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            aria-invalid={!!form.formState.errors.quantity}
            aria-describedby="quantity-hint quantity-error"
            {...form.register("quantity", {
              valueAsNumber: true,
              required: "Enter a quantity.",
              min: { value: 1, message: "Choose at least one." },
              max: { value: 1000, message: "Choose up to 1,000." },
              validate: (value) => Number.isInteger(value) || "Enter a whole number.",
            })}
          />
          <span id="quantity-hint" className="field-hint">
            This saves the total quantity of this product in your cart.
          </span>
          <span id="quantity-error" className="field-error">
            {form.formState.errors.quantity?.message}
          </span>
        </div>
        <div className="actions">
          <button className="button" disabled={busy || !available}>
            {busy ? "Saving…" : "Save quantity to cart"}
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => void mutate("favourite")}
          >
            Save to favourites
          </button>
        </div>
      </form>
      <p>
        <Link className="text-link" href="/dashboard/cart">
          View cart →
        </Link>
      </p>
    </>
  );
}
