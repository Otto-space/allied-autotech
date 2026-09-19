import { z } from "zod";
export const lagosDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a Lagos date and time.")
  .refine(
    (value) => z.iso.datetime({ offset: true }).safeParse(`${value}:00+01:00`).success,
    "Choose a valid date and time.",
  );
const optionalInteger = (maximum: number) =>
  z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .regex(/^\d+$/, "Enter a whole number.")
      .refine((value) => Number(value) <= maximum, `Enter a value from 0 to ${maximum}.`),
  ]);
const finding = z
  .object({
    name: z.string().trim().min(1, "Name the finding.").max(100),
    type: z.enum(["TEXT", "NUMBER", "YES", "NO", "NOT_RECORDED"]),
    value: z.string().max(1000),
  })
  .superRefine((value, context) => {
    if (
      value.type === "NUMBER" &&
      (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(value.value.trim()) ||
        !Number.isFinite(Number(value.value)))
    )
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Enter a finite number.",
      });
  });
export const conditionFormSchema = z
  .object({
    inspectionId: z.union([
      z.literal(""),
      z.string().uuid("Choose a completed inspection."),
    ]),
    inspectedAt: lagosDateTime,
    odometer: optionalInteger(10000000),
    score: optionalInteger(100),
    summary: z.string().trim().min(1, "Summarize the inspected condition.").max(5000),
    findings: z.array(finding),
  })
  .superRefine((values, context) => {
    const names = new Set<string>();
    values.findings.forEach((finding, index) => {
      if (names.has(finding.name))
        context.addIssue({
          code: "custom",
          path: ["findings", index, "name"],
          message: "Use a distinct finding name to avoid replacing another finding.",
        });
      names.add(finding.name);
    });
  });
export type ConditionValues = z.infer<typeof conditionFormSchema>;
export function conditionFindings(
  values: ConditionValues["findings"],
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    values.map((finding) => [
      finding.name,
      finding.type === "TEXT"
        ? finding.value
        : finding.type === "NUMBER"
          ? Number(finding.value)
          : finding.type === "YES"
            ? true
            : finding.type === "NO"
              ? false
              : null,
    ]),
  );
}
export function toLagosInput(value: string | null): string {
  return value ? new Date(Date.parse(value) + 3600000).toISOString().slice(0, 16) : "";
}
