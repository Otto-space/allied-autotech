/** Public fictional teaching fixtures. Never stock, price or real fitment evidence. */
export type PracticePart = {
  id: string;
  name: string;
  status: "Compatible" | "Incompatible" | "Not confirmed";
  evidence: string;
};
const parts: PracticePart[] = [
  {
    id: "sample-a",
    name: "Practice brake pads A",
    status: "Compatible",
    evidence:
      "The fictional fitment record explicitly confirms this sample Toyota Corolla 2018 and its specification. This is invented evidence, not a real part recommendation.",
  },
  {
    id: "sample-b",
    name: "Practice brake pads B",
    status: "Incompatible",
    evidence:
      "The fictional record excludes the selected 2018 model year. A matching product name does not overcome that exclusion.",
  },
  {
    id: "sample-c",
    name: "Practice brake pads C",
    status: "Not confirmed",
    evidence:
      "The fictional record lacks the engine/trim details needed to confirm fitment. Ask for those details; do not treat the name or year match as compatibility.",
  },
];
export function searchPracticeParts(values: Record<string, string>): PracticePart[] {
  if (values.make !== "Toyota" || values.model !== "Corolla" || values.year !== "2018")
    return [];
  const query = (values.query ?? "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!query.length) return [];
  return parts
    .filter((part) =>
      query.every((word) =>
        (part.name + " fictional Toyota Corolla 2018").toLowerCase().includes(word),
      ),
    )
    .map((part) => ({ ...part }));
}
