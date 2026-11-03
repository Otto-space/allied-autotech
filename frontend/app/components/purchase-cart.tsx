"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Package } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api/client";
import {
  branchRef,
  productSchema,
  orderSchema,
  type Product,
} from "@/lib/api/commerce-schemas";
import { formatKobo } from "@/lib/format/money";
import { purchaseRequest } from "@/lib/purchase/client";
import {
  clearPurchaseCart,
  PURCHASE_CART_CHANGED,
  readPurchaseCart,
  writePurchaseCart,
  type PurchaseCart as Cart,
} from "@/lib/purchase/cart";
import type { RequestBody } from "@/lib/api/contracts";
import { PurchaseAccess } from "./purchase-access";
import { usePublicCapabilities } from "./public-capabilities";
import { Feedback } from "./feedback";
import { PublicMedia } from "./public-media";

const pendingStorage = "aat:purchase-order:pending-key:1";
const branchesSchema = z.object({
  items: z.array(branchRef),
  nextCursor: z.uuid().optional(),
});
type Body = RequestBody<"/purchase/orders", "post">;
function CartLine({
  line,
  product,
  update,
  remove,
  disabled,
}: {
  line: Cart[number];
  product?: Product;
  update: (quantity: number) => void;
  remove: () => void;
  disabled: boolean;
}) {
  const [quantity, setQuantity] = useState(String(line.quantity)),
    [error, setError] = useState<string>();
  const field = useRef<HTMLInputElement>(null);
  const photo = product?.images.find((v) => v.isPrimary) ?? product?.images[0];
  return (
    <article className="purchase-row">
      <div className="purchase-photo">
        <PublicMedia
          src={photo?.url}
          alt={photo?.altText ?? ""}
          sizes="80px"
          fallbackIcon={<Package aria-hidden="true" />}
        />
      </div>
      <div>
        <h3>
          <Link href={`/parts/${line.productId}`}>
            {product?.name ?? "Product details unavailable"}
          </Link>
        </h3>
        {product ? (
          <p>
            {formatKobo(product.priceKobo)} each · SKU: {product.sku}
          </p>
        ) : (
          <p>Refresh the cart or remove this product before continuing.</p>
        )}
        <form
          className="purchase-quantity"
          data-no-draft
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(quantity);
            if (!Number.isInteger(value) || value < 1 || value > 1000) {
              setError("Enter a whole quantity from 1 to 1,000.");
              field.current?.focus();
              return;
            }
            setError(undefined);
            update(value);
          }}
        >
          <label>
            Quantity
            <input
              ref={field}
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              value={quantity}
              disabled={disabled}
              onChange={(event) => setQuantity(event.target.value)}
              aria-invalid={!!error}
            />
          </label>
          <button
            className="button secondary"
            disabled={disabled || quantity === String(line.quantity)}
          >
            Update
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={disabled}
            onClick={remove}
          >
            Remove<span className="sr-only"> {product?.name ?? "product"}</span>
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
        <p>
          <strong>
            Line subtotal:{" "}
            {product
              ? formatKobo((BigInt(product.priceKobo) * BigInt(line.quantity)).toString())
              : "Unavailable"}
          </strong>
        </p>
      </div>
    </article>
  );
}

export function PurchaseCart() {
  const { checkoutEnabled } = usePublicCapabilities();
  const [rows, setRows] = useState<Cart>([]),
    [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<string>(),
    [retry, setRetry] = useState(0);
  const [corrupt, setCorrupt] = useState(false);
  useEffect(() => {
    let controller: AbortController | undefined;
    const load = () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setLoading(true);
      setError(undefined);
      setCorrupt(false);
      let lines: Cart;
      try {
        lines = readPurchaseCart();
        setRows(lines);
      } catch {
        setCorrupt(true);
        setLoading(false);
        setError(
          "The saved cart could not be read. Clear it and choose your products again. An existing order is not removed.",
        );
        return;
      }
      void (async () => {
        const found: Record<string, Product> = {};
        // Bound concurrency instead of issuing hundreds of discovery requests together.
        for (let start = 0; start < lines.length; start += 4) {
          const results = await Promise.allSettled(
            lines.slice(start, start + 4).map(async (line) => {
              const response = await apiRequest(
                `/public/catalog/products/${line.productId}`,
                { signal },
              );
              const product = productSchema.parse(response.data);
              if (product.id !== line.productId) throw Error("Product identity changed");
              return product;
            }),
          );
          if (signal.aborted) return;
          for (const result of results)
            if (result.status === "fulfilled") found[result.value.id] = result.value;
        }
        if (!signal.aborted) {
          setProducts(found);
          setLoading(false);
          if (Object.keys(found).length !== lines.length)
            setError(
              "Some product details could not be checked. Refresh or remove those products before continuing.",
            );
        }
      })();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "aat:purchase-cart:1" || event.key === null) load();
    };
    load();
    window.addEventListener(PURCHASE_CART_CHANGED, load);
    window.addEventListener("storage", storage);
    return () => {
      controller?.abort();
      window.removeEventListener(PURCHASE_CART_CHANGED, load);
      window.removeEventListener("storage", storage);
    };
  }, [retry]);
  const complete = !loading && !corrupt && rows.every((row) => products[row.productId]);
  const subtotal = rows
    .reduce(
      (sum, row) =>
        sum + BigInt(products[row.productId]?.priceKobo ?? 0) * BigInt(row.quantity),
      BigInt(0),
    )
    .toString();
  const change = (next: Cart) => {
    try {
      writePurchaseCart(next);
    } catch {
      setError(
        "We could not save this change in your browser. The cart has not been updated.",
      );
    }
  };
  return (
    <>
      <p className="purchase-kicker">Parts for collection</p>
      <h1>Your cart</h1>
      <p>Choose your products, then review a collection order. An account is optional.</p>
      <Feedback message={error} />
      {corrupt && (
        <button
          className="button secondary"
          onClick={() => {
            try {
              clearPurchaseCart();
            } catch {
              setError("Browser storage is unavailable. Contact the team for help.");
            }
          }}
        >
          Clear unreadable cart
        </button>
      )}
      {loading && <p role="status">Checking current product details…</p>}
      {!loading && !corrupt && rows.length === 0 ? (
        <section className="purchase-panel">
          <h2>Your cart is empty</h2>
          <p>Browse parts to choose what you need, or recover a previous purchase.</p>
          <div className="purchase-actions">
            <Link className="button" href="/parts">
              Browse parts
            </Link>
            <Link className="button secondary" href="/purchase">
              View purchases
            </Link>
          </div>
        </section>
      ) : (
        !corrupt && (
          <div className="purchase-grid">
            <section className="purchase-panel" aria-label="Cart products">
              {rows.map((line) => (
                <CartLine
                  key={`${line.productId}:${line.quantity}`}
                  line={line}
                  product={products[line.productId]}
                  disabled={loading}
                  update={(quantity) =>
                    change(
                      rows.map((row) =>
                        row.productId === line.productId ? { ...row, quantity } : row,
                      ),
                    )
                  }
                  remove={() =>
                    change(rows.filter((row) => row.productId !== line.productId))
                  }
                />
              ))}
              <dl className="purchase-summary">
                <div className="purchase-total">
                  <dt>Product subtotal</dt>
                  <dd>{complete ? formatKobo(subtotal) : "Checking…"}</dd>
                </div>
              </dl>
              <p className="purchase-secondary">
                The server checks current price, stock, discounts and tax when you save
                the order. Review the exact total before payment.
              </p>
              <button
                className="button secondary"
                disabled={loading}
                onClick={() => setRetry((v) => v + 1)}
              >
                Refresh product details
              </button>
            </section>
            <div>
              {!checkoutEnabled && (
                <section className="purchase-panel">
                  <h2>Checkout is unavailable</h2>
                  <p>
                    Your cart is saved in this browser. You can contact the team about
                    these products.
                  </p>
                  <Link className="button" href="/contact#enquiry">
                    Ask the team
                  </Link>
                </section>
              )}
              <PurchaseAccess>
                {(email, buyerReference) => (
                  <GuestOrderForm
                    email={email}
                    buyerReference={buyerReference}
                    rows={rows}
                    disabled={!complete || rows.length === 0 || !checkoutEnabled}
                    subtotal={subtotal}
                  />
                )}
              </PurchaseAccess>
            </div>
          </div>
        )
      )}
    </>
  );
}

function GuestOrderForm({
  email,
  buyerReference,
  rows,
  disabled,
  subtotal,
}: {
  email: string;
  buyerReference: string;
  rows: Cart;
  disabled: boolean;
  subtotal: string;
}) {
  const router = useRouter(),
    { checkoutEnabled } = usePublicCapabilities();
  const pendingStorageKey = `${pendingStorage}:${buyerReference}`;
  const [branches, setBranches] = useState<z.infer<typeof branchRef>[]>([]),
    [cursor, setCursor] = useState<string>(),
    [branchError, setBranchError] = useState(false),
    [branchBusy, setBranchBusy] = useState(true);
  const [review, setReview] = useState<Body>(),
    [error, setError] = useState<string>(),
    [pendingKey, setPendingKey] = useState<string>(),
    [busy, setBusy] = useState(false),
    [storageReady, setStorageReady] = useState(false);
  const [savedPacket, setSavedPacket] = useState<{ key: string; body: Body } | null>(
    null,
  );
  const lock = useRef(false),
    controller = useRef<AbortController>(null);
  const form = useRef<HTMLFormElement>(null),
    reviewHeading = useRef<HTMLHeadingElement>(null);
  const cartSignature = JSON.stringify(rows);
  const [reviewedCart, setReviewedCart] = useState("");
  const [details, setDetails] = useState<Body>();
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const key = sessionStorage.getItem(pendingStorageKey);
        if (key) {
          if (!z.uuid().safeParse(key).success) throw Error("Unknown receipt");
          setPendingKey(key);
        }
        setStorageReady(true);
      } catch {
        setError(
          "Private receipt recovery is unavailable in this browser. Check browser storage or contact the team before creating an order.",
        );
      }
    });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [pendingStorageKey]);
  useEffect(() => {
    const abort = new AbortController();
    void apiRequest("/public/branches?limit=100", { signal: abort.signal })
      .then((response) => {
        const page = branchesSchema.parse(response.data);
        setBranches(page.items);
        setCursor(page.nextCursor);
        setBranchError(false);
      })
      .catch(() => {
        if (!abort.signal.aborted) setBranchError(true);
      })
      .finally(() => {
        if (!abort.signal.aborted) setBranchBusy(false);
      });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (review) reviewHeading.current?.focus();
  }, [review]);
  async function finish(order: z.infer<typeof orderSchema>) {
    sessionStorage.removeItem(pendingStorageKey);
    setPendingKey(undefined);
    setSavedPacket(null);
    // Preserve additions or quantity edits made in another tab after submission.
    try {
      writePurchaseCart(
        readPurchaseCart().filter(
          (row) =>
            !order.items.some(
              (item) =>
                item.productId === row.productId && item.quantity === row.quantity,
            ),
        ),
      );
    } catch {
      /* The saved order remains recoverable from purchase history. */
    }
    router.push(`/purchase/orders/${order.id}`);
  }
  async function save(packet: { key: string; body: Body }, repeat = false) {
    if (lock.current || !checkoutEnabled) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    controller.current = new AbortController();
    try {
      sessionStorage.setItem(pendingStorageKey, packet.key);
      setPendingKey(packet.key);
      setSavedPacket(packet);
      const result = await purchaseRequest("/purchase/orders", {
        method: "POST",
        body: packet.body,
        idempotencyKey: packet.key,
        signal: controller.current.signal,
      });
      const saved = z.object({ order: orderSchema }).parse(result.data).order;
      if (
        saved.branch.id !== packet.body.branchId ||
        saved.items.length !== packet.body.items.length ||
        !packet.body.items.every((row) =>
          saved.items.some(
            (item) => item.productId === row.productId && item.quantity === row.quantity,
          ),
        )
      )
        throw Error("Order receipt changed");
      await finish(saved);
    } catch (failure) {
      if (controller.current.signal.aborted) return;
      if (
        !repeat &&
        failure instanceof ApiError &&
        failure.status >= 400 &&
        failure.status < 500
      ) {
        sessionStorage.removeItem(pendingStorageKey);
        setPendingKey(undefined);
        setSavedPacket(null);
        setReview(undefined);
        setError(
          "The order was not saved. Refresh the cart and check your details before trying again.",
        );
      } else
        setError(
          "The order result is uncertain. Check the original request before starting another order. Do not pay twice.",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function recover() {
    if (!pendingKey || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    controller.current = new AbortController();
    try {
      const result = await purchaseRequest("/purchase/orders/original-request", {
        headers: { "Idempotency-Key": pendingKey },
        signal: controller.current.signal,
      });
      const receipt = z
        .object({ found: z.boolean(), order: orderSchema.nullable() })
        .parse(result.data);
      if (receipt.found && receipt.order) await finish(receipt.order);
      else
        setError(
          "No completed receipt is visible yet. The original request may still be processing. Check again, retry the saved request if offered, or contact the team.",
        );
    } catch {
      if (!controller.current.signal.aborted)
        setError(
          "The original request could not be checked. Keep this tab and contact the team if needed.",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const changed = cartSignature !== reviewedCart;
  return (
    <section className="purchase-panel">
      <p className="purchase-kicker">Private purchase access</p>
      <h2>Collection details</h2>
      <p className="purchase-reference">Verified email: {email}</p>
      {pendingKey ? (
        <>
          <h3>Check the original order request</h3>
          <p>A saved request needs a confirmed result before you create another order.</p>
          <div className="purchase-actions">
            <button className="button" disabled={busy} onClick={() => void recover()}>
              {busy ? "Checking…" : "Check original request"}
            </button>
            {savedPacket && (
              <button
                className="button secondary"
                disabled={busy || !checkoutEnabled}
                onClick={() => savedPacket && void save(savedPacket, true)}
              >
                Retry saved request
              </button>
            )}
          </div>
        </>
      ) : (
        <form
          ref={form}
          data-no-draft
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled || busy || !checkoutEnabled || !storageReady) return;
            if (review) {
              if (!changed) void save({ key: crypto.randomUUID(), body: review });
              return;
            }
            const data = new FormData(event.currentTarget);
            const parsed = z
              .object({
                name: z.string().trim().min(1).max(400),
                phone: z
                  .string()
                  .trim()
                  .regex(/^\+?[0-9 ()-]{7,32}$/),
                branchId: z.uuid(),
              })
              .safeParse({
                name: data.get("name"),
                phone: data.get("phone"),
                branchId: data.get("branchId"),
              });
            if (!parsed.success) {
              setError("Enter your name, contact phone and collection branch.");
              form.current
                ?.querySelector<HTMLElement>("input:invalid, select:invalid")
                ?.focus();
              return;
            }
            setError(undefined);
            setReviewedCart(cartSignature);
            const promotionCode = String(data.get("promotionCode") ?? "").trim();
            const body: Body = {
              branchId: parsed.data.branchId,
              fulfillmentMethod: "COLLECTION",
              contact: { name: parsed.data.name, phone: parsed.data.phone },
              items: rows,
              ...(promotionCode ? { promotionCode } : {}),
            };
            setDetails(body);
            setReview(body);
          }}
        >
          {review ? (
            <>
              <h3 ref={reviewHeading} tabIndex={-1}>
                Review before saving
              </h3>
              <p>
                {review.contact.name}
                <br />
                {review.contact.phone}
                <br />
                {branches.find((branch) => branch.id === review.branchId)?.name}
              </p>
              <p>Product subtotal: {formatKobo(subtotal)}</p>
              <p>
                Saving creates an unpaid order for your review. The exact total, including
                applicable tax and discounts, is shown before payment.
              </p>
              {changed && (
                <Feedback message="Your cart changed. Edit these details and review the updated cart before saving." />
              )}
              <button
                className="button secondary"
                type="button"
                onClick={() => setReview(undefined)}
              >
                Edit collection details
              </button>
            </>
          ) : (
            <>
              <label htmlFor="purchase-name">Your name</label>
              <input
                id="purchase-name"
                name="name"
                defaultValue={details?.contact.name}
                autoComplete="name"
                required
                maxLength={400}
                disabled={busy}
              />
              <label htmlFor="purchase-phone">Contact phone</label>
              <input
                id="purchase-phone"
                name="phone"
                defaultValue={details?.contact.phone}
                type="tel"
                autoComplete="tel"
                required
                maxLength={32}
                pattern="\+?[0-9 ()-]{7,32}"
                disabled={busy}
              />
              <label htmlFor="purchase-branch">Collection branch</label>
              <select
                id="purchase-branch"
                name="branchId"
                required
                disabled={busy || branchBusy || branchError}
                defaultValue={details?.branchId ?? ""}
              >
                <option value="">
                  {branchBusy ? "Loading branches…" : "Choose collection branch"}
                </option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              {branchError && (
                <Feedback message="Collection branches could not be loaded. Refresh the page to try again." />
              )}
              {cursor && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={branchBusy}
                  onClick={() => {
                    setBranchBusy(true);
                    void apiRequest(
                      `/public/branches?limit=100&cursor=${encodeURIComponent(cursor)}`,
                    )
                      .then((result) => {
                        const page = branchesSchema.parse(result.data);
                        setBranches((previous) => [
                          ...new Map(
                            [...previous, ...page.items].map((item) => [item.id, item]),
                          ).values(),
                        ]);
                        setCursor(page.nextCursor);
                      })
                      .catch(() =>
                        setError("More branches could not be loaded. Please try again."),
                      )
                      .finally(() => setBranchBusy(false));
                  }}
                >
                  Load more branches
                </button>
              )}
              <label htmlFor="purchase-promotion">Promotion code (optional)</label>
              <input
                id="purchase-promotion"
                name="promotionCode"
                defaultValue={details?.promotionCode}
                maxLength={80}
                autoComplete="off"
                disabled={busy}
              />
            </>
          )}
          <p className="purchase-note">
            After payment, the team checks suitability and final availability. Wait for
            confirmation that your order is ready before travelling to collect it.
          </p>
          <button
            className="button"
            disabled={
              disabled ||
              busy ||
              !checkoutEnabled ||
              !storageReady ||
              branchBusy ||
              branchError ||
              (!!review && changed)
            }
          >
            {busy
              ? "Saving order…"
              : review
                ? "Save unpaid order for review"
                : "Review collection details"}
          </button>
        </form>
      )}
      <Feedback message={error} />
      <Link className="purchase-link" href="/purchase">
        View previous purchases
      </Link>
    </section>
  );
}
