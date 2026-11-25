declare const koboBrand: unique symbol;
export type KoboString = string & { readonly [koboBrand]: true };
export function asKoboString(value: string): KoboString {
  if (typeof value !== "string" || value.length === 0 || /[^0-9]/.test(value))
    throw new Error("Money must be a decimal digit string of integer kobo.");
  return value as KoboString;
}
export function parseKobo(value: string): bigint {
  return BigInt(asKoboString(value));
}
/** Display only. Never compute payable totals, VAT or discounts in this client. */
export function formatNaira(value: KoboString): string {
  const digits = parseKobo(value).toString().padStart(3, "0");
  return `₦${digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${digits.slice(-2)}`;
}
