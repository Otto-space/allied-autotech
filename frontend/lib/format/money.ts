export function formatKobo(value: string | number | null | undefined): string {
  if (value === null || value === undefined || !/^\d+$/.test(String(value)))
    return "Request a quote";
  const kobo = BigInt(String(value));
  const hundred = BigInt(100);
  const naira = kobo / hundred;
  const remainder = (kobo % hundred).toString().padStart(2, "0");
  return `₦${naira.toLocaleString("en-NG")}.${remainder}`;
}
