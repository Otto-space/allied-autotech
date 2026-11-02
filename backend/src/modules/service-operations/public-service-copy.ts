// These legacy import sentences describe source arithmetic, not customer terms.
// Keep the stored authoring/audit evidence and every commercial field unchanged.
// Match only the verified boilerplate: never remove arbitrary discount, warranty
// or pricing conditions from an administrator's subsequent description.
const importNotes = [
  "Authorised amount: NGN 4,000, already reflecting the 20% reduction from NGN 5,000.",
  "Authorised service amount: NGN 8,000, already reflecting the workbook’s 20% reduction from NGN 10,000.",
  "Authorised service amount: NGN 8,000, already reflecting the workbook's 20% reduction from NGN 10,000.",
];

export function publicServiceCopy(description: string | null): string | null {
  if (description === null) return null;
  let result = description;
  for (const note of importNotes) {
    if (!result.includes(note)) continue;
    result = result
      .replace(`${note} No additional discount is applied.`, "")
      .replace(note, "");
  }
  return result === description
    ? description
    : result.replace(/ {2,}/g, " ").trim() || null;
}
