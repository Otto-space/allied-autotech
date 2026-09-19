import { z } from "zod";
export const paymentNote = z
  .string()
  .trim()
  .min(1, "Enter a review note or reason.")
  .max(1000)
  .refine(
    (value) => [...value].every((character) => (character.codePointAt(0) ?? 0) > 31),
    "Use a single line without control characters.",
  );
