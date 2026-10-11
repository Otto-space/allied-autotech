import { parseCart } from "./commerce-schemas";
export type CartUpdate = ReturnType<typeof parseCart>;

/** Validate the server's replacement-quantity receipt before showing a confirmation. */
export function parseCartUpdate(
  value: unknown,
  productId: string,
  quantity: number,
): CartUpdate {
  const cart = parseCart(value);
  const products = new Set<string>(),
    rows = new Set<string>();
  let subtotal = BigInt(0);
  for (const item of cart.items) {
    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 1000 ||
      products.has(item.product.id) ||
      rows.has(item.id)
    )
      throw new Error("Unconfirmed cart contents");
    products.add(item.product.id);
    rows.add(item.id);
    const amount = BigInt(item.unitPriceKobo) * BigInt(item.quantity);
    if (amount !== BigInt(item.lineSubtotalKobo))
      throw new Error("Unconfirmed cart line");
    subtotal += amount;
  }
  if (
    subtotal !== BigInt(cart.subtotalKobo) ||
    !cart.items.some(
      (item) => item.product.id === productId && item.quantity === quantity,
    )
  )
    throw new Error("Unconfirmed cart update");
  return cart;
}
