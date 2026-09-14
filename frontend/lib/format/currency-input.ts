export function nairaToKobo(value: string): string {
  const match = /^(\d{1,16})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error("Enter an amount with up to two decimal places.");
  return (
    BigInt(match[1]) * BigInt(100) +
    BigInt((match[2] ?? "").padEnd(2, "0"))
  ).toString();
}
export function koboToInput(value: string): string {
  if (!/^\d+$/.test(value)) return "";
  const amount = BigInt(value);
  return `${amount / BigInt(100)}.${(amount % BigInt(100)).toString().padStart(2, "0")}`;
}
