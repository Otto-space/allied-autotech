"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowRight, Check, Heart, ShoppingBag } from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseCart, productSchema } from "@/lib/api/commerce-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { AccountChangeNotice } from "./account-change-notice";

const identity = z.object({
  user: z.object({ role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) }),
});
const favouriteReceipt = z.object({ product: productSchema });
type Action = "cart" | "favourite";
type Result = {
  title: string;
  message: string;
  success?: boolean;
  login?: boolean;
  action: Action;
};

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
  const [result, setResult] = useState<Result>();
  const [active, setActive] = useState<Action>();
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const { reset, getFieldState, setFocus } = form;
  const discard = useCallback(() => {
    setResult(undefined);
    setActive(undefined);
    setSaved(false);
    reset({ quantity: 1 });
  }, [reset]);
  const operation = useAccountMutation(discard);
  const { busy } = operation;
  const loginHref = `/login?next=${encodeURIComponent(`/parts/${productId}`)}`;
  useEffect(() => {
    if (result && getFieldState("quantity").error) {
      setFocus("quantity");
      return;
    }
    const target = operation.sessionChanged
      ? notice.current
      : result
        ? heading.current
        : null;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [result, operation.sessionChanged, getFieldState, setFocus]);
  async function mutate(action: Action, quantity = 1) {
    if (action === "cart" && !available) return;
    const controller = operation.begin();
    if (!controller) return;
    setResult(undefined);
    setActive(action);
    form.clearErrors();
    let mutationStarted = false;
    try {
      const session = identity.parse(
        (
          await apiRequest("/auth/session", {
            signal: controller.signal,
            optionalSession: true,
          })
        ).data,
      );
      if (session.user.role !== "CUSTOMER") {
        setResult({
          action,
          title: "Customer account required",
          message:
            "Cart and favourites are available to customer accounts. Contact our team for help.",
        });
        return;
      }
      mutationStarted = true;
      if (action === "cart") {
        const body: RequestBody<"/customers/cart/items/{productId}", "put"> = {
          quantity,
        };
        const cart = parseCart(
          (
            await apiRequest(`/customers/cart/items/${productId}`, {
              method: "PUT",
              csrf: true,
              signal: controller.signal,
              body,
            })
          ).data,
        );
        if (
          !cart.items.some(
            (item) => item.product.id === productId && item.quantity === quantity,
          )
        )
          throw new Error("Unconfirmed cart item");
      } else {
        const receipt = favouriteReceipt.parse(
          (
            await apiRequest(`/customers/favourites/${productId}`, {
              method: "PUT",
              csrf: true,
              signal: controller.signal,
              body: {},
            })
          ).data,
        );
        if (receipt.product.id !== productId) throw new Error("Unconfirmed favourite");
      }
      if (controller.signal.aborted) return;
      if (action === "favourite") setSaved(true);
      setResult({
        action,
        success: true,
        title: action === "cart" ? "Cart updated" : "Product saved",
        message:
          action === "cart"
            ? "Your cart quantity has been saved. Review your cart to continue."
            : "Product saved to your favourites.",
      });
    } catch (value) {
      if (controller.signal.aborted) return;
      const api = value instanceof ApiError ? value : undefined;
      const login = api?.status === 401;
      const uncertain =
        mutationStarted && (!api || api.status === 0 || api.status >= 500);
      const quantityError = api?.fields?.["body.quantity"]?.[0];
      if (quantityError?.[0])
        form.setError("quantity", { message: quantityError[0] }, { shouldFocus: true });
      setResult({
        action,
        login,
        title: login
          ? "Sign in to continue"
          : uncertain
            ? "Update not confirmed"
            : "Please review your selection",
        message: login
          ? "Sign in to your customer account, then try again."
          : uncertain
            ? "We could not confirm the update. Check your account before trying again."
            : api?.status === 409
              ? "The requested quantity is not currently available. Choose a smaller quantity or contact our team."
              : (api?.message ?? "We couldn’t check your account. Please try again."),
      });
    } finally {
      operation.finish(controller);
      if (!controller.signal.aborted) setActive(undefined);
    }
  }
  return (
    <div className="pd-actions">
      {operation.sessionChanged && (
        <div ref={notice} tabIndex={-1}>
          <AccountChangeNotice visible />
        </div>
      )}
      {result && (
        <div
          className={`pd-feedback${result.success ? " pd-success" : ""}`}
          role={result.success ? "status" : "alert"}
        >
          <h2 ref={heading} tabIndex={-1}>
            {result.title}
          </h2>
          <p>{result.message}</p>
          {result.login ? (
            <Link href={loginHref}>
              Sign in to continue <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <Link
              href={result.action === "cart" ? "/dashboard/cart" : "/dashboard/saved"}
            >
              {result.action === "cart" ? "Review cart" : "View favourites"}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
      <form
        noValidate
        data-draft-key={JSON.stringify(["product-actions:1", productId])}
        onSubmit={form.handleSubmit((values) => mutate("cart", values.quantity))}
        aria-busy={busy}
      >
        <label htmlFor="product-quantity">Quantity</label>
        <div className="pd-cart-row">
          <input
            id="product-quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            step={1}
            disabled={busy || !available}
            aria-invalid={!!form.formState.errors.quantity}
            aria-describedby={`quantity-hint${form.formState.errors.quantity ? " quantity-error" : ""}`}
            {...form.register("quantity", {
              valueAsNumber: true,
              required: "Enter a quantity.",
              min: { value: 1, message: "Choose at least one." },
              max: { value: 1000, message: "Choose up to 1,000." },
              validate: (value) => Number.isInteger(value) || "Enter a whole number.",
            })}
          />
          <button className="button" disabled={busy || !available}>
            <ShoppingBag size={17} aria-hidden="true" />
            {active === "cart" ? "Saving…" : "Save quantity to cart"}
          </button>
        </div>
        {form.formState.errors.quantity && (
          <p id="quantity-error" className="pd-field-error" role="alert">
            {form.formState.errors.quantity.message}
          </p>
        )}
        <p id="quantity-hint" className="pd-hint">
          This saves the total quantity of this product in your cart.
        </p>
        <button
          type="button"
          className="button secondary pd-favourite"
          disabled={busy || saved}
          onClick={() => void mutate("favourite")}
        >
          {saved ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <Heart size={18} aria-hidden="true" />
          )}
          {active === "favourite"
            ? "Saving…"
            : saved
              ? "Saved to favourites"
              : "Save to favourites"}
        </button>
      </form>
      <Link className="pd-link" href="/dashboard/cart">
        View cart <ArrowRight size={17} aria-hidden="true" />
      </Link>
      <p className="pd-account-note">
        Customer account required. Availability is checked again at checkout. Adding a
        product to your cart does not reserve it.
      </p>
    </div>
  );
}
