export function enquiryLabel(type: string, intent?: "LISTING" | "REQUIREMENTS" | null) {
  if (type === "VEHICLE")
    return intent === "REQUIREMENTS" ? "Vehicle requirements" : "Vehicle listing";
  return type
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}
