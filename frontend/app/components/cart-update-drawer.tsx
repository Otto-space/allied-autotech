"use client";
import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { ArrowRight, ShoppingBag, X } from "lucide-react";
import type { CartUpdate } from "@/lib/api/cart-update";
import { formatKobo } from "@/lib/format/money";
import { PublicMedia } from "./public-media";
import "./cart-update-drawer.css";

export function CartUpdateDrawer({
  cart,
  productId,
  onClose,
}: {
  cart: CartUpdate;
  productId: string;
  onClose: () => void;
}) {
  const modal = useRef<HTMLDialogElement>(null),
    close = useRef<HTMLButtonElement>(null);
  const id = useId();
  const updated = cart.items.find((item) => item.product.id === productId)!;
  useEffect(() => {
    const dialog = modal.current;
    const overflow = document.body.style.overflow;
    const overscroll = document.body.style.overscrollBehavior;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    close.current?.focus({ preventScroll: true });
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      document.body.style.overscrollBehavior = overscroll;
    };
  }, []);
  return (
    <dialog
      ref={modal}
      className="cart-update-drawer"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={onClose}
      onClose={() => {
        // Ignore a queued Strict Mode cleanup event after the next setup reopens.
        if (!modal.current?.open) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], [tabindex="0"]',
          ),
        );
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <header className="cart-drawer-heading">
        <div>
          <ShoppingBag size={23} aria-hidden="true" />
          <h2 id={`${id}-title`}>Cart updated</h2>
        </div>
        <button
          ref={close}
          type="button"
          className="cart-drawer-close"
          aria-label="Close cart summary"
          onClick={onClose}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div
        className="cart-drawer-body"
        tabIndex={0}
        role="region"
        aria-label="Cart update details"
      >
        <p id={`${id}-description`}>Your cart quantity has been saved.</p>
        <p className="cart-drawer-update">
          <strong>{updated.product.name}</strong>
          <span>Quantity {updated.quantity}</span>
        </p>
        <h3>Items in your cart</h3>
        <ul className="cart-drawer-items">
          {cart.items.map((item) => (
            <li key={item.id}>
              <PublicMedia
                key={item.product.images[0]?.url ?? item.id}
                src={
                  (
                    item.product.images.find((image) => image.isPrimary) ??
                    item.product.images[0]
                  )?.url
                }
                alt=""
                sizes="76px"
              />
              <div>
                <h4>{item.product.name}</h4>
                <p>
                  Qty {item.quantity} · {formatKobo(item.unitPriceKobo)} each
                </p>
                <strong className="cart-drawer-line-total">
                  {formatKobo(item.lineSubtotalKobo)}
                </strong>
                {item.product.id === productId && (
                  <span className="cart-drawer-updated">Updated quantity</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <footer className="cart-drawer-footer">
        <div className="cart-drawer-subtotal">
          <span>Subtotal</span>
          <strong>{formatKobo(cart.subtotalKobo)}</strong>
        </div>
        <p>
          Workshop collection only. Any applicable adjustments are confirmed at checkout.
        </p>
        <Link className="button" href="/dashboard/cart" onClick={onClose}>
          Review cart
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <button type="button" className="button secondary" onClick={onClose}>
          Continue shopping
        </button>
        <p className="cart-drawer-note">
          Items are not reserved. Review your cart for current prices and availability.
        </p>
      </footer>
    </dialog>
  );
}
