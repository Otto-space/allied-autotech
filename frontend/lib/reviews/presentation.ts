export function reviewerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    [words[0], words.length > 1 ? words.at(-1) : undefined]
      .filter(Boolean)
      .map((word) => Array.from(word!)[0])
      .join("")
      .toLocaleUpperCase("en-NG") || "C"
  );
}

const reviewDateFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
});

export function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return reviewDateFormatter.format(date);
}
