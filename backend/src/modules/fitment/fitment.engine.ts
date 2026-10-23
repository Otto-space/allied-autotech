import type { Prisma } from "../../generated/prisma/client.js";
import {
  qualifierKeys,
  type FitmentSelection,
  type QualifierKey,
} from "./fitment.schemas.js";

export type PublishedRule = {
  id: string;
  reviewStatus: string;
  scope: string;
  effect: string;
  vehicleModelId: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  safetyCritical: boolean;
  allVariantsConfirmed: boolean;
  requiredQualifiers: string[];
  sourceReference: string | null;
  reviewedAt: Date | string | null;
} & Record<QualifierKey, string | null>;
export const normalizeFitmentValue = (value: string) =>
  value.normalize("NFKC").trim().toLowerCase();
const literal = (value: string) => value.replace(/[\\%_]/g, "\\$&");

function published(rule: PublishedRule) {
  return (
    rule.reviewStatus === "APPROVED" &&
    !!rule.sourceReference &&
    !!rule.reviewedAt &&
    rule.allVariantsConfirmed
  );
}
function baseMatch(rule: PublishedRule, selection: FitmentSelection) {
  if (!published(rule)) return false;
  if (rule.scope === "UNIVERSAL")
    return !rule.safetyCritical && rule.effect === "INCLUDE";
  return (
    rule.vehicleModelId === selection.vehicleModelId &&
    rule.yearFrom !== null &&
    rule.yearTo !== null &&
    selection.year >= rule.yearFrom &&
    selection.year <= rule.yearTo
  );
}
function qualifierMatch(rule: PublishedRule, selection: FitmentSelection) {
  const required = new Set(rule.requiredQualifiers);
  for (const key of qualifierKeys) if (rule[key] !== null) required.add(key);
  if (rule.safetyCritical) {
    required.add("position");
    required.add("brakeSystem");
  }
  const missing = qualifierKeys.filter((key) => required.has(key) && !selection[key]);
  const conflict = qualifierKeys.some(
    (key) =>
      rule[key] !== null &&
      !!selection[key] &&
      normalizeFitmentValue(rule[key]!) !== normalizeFitmentValue(selection[key]!),
  );
  // A malformed approved critical rule must never produce a verified claim.
  const valid = !rule.safetyCritical || (!!rule.position && !!rule.brakeSystem);
  return { missing, conflict, valid };
}

export function decideFitment(rules: PublishedRule[], selection: FitmentSelection) {
  const candidates = rules
    .filter((rule) => baseMatch(rule, selection))
    .map((rule) => ({ rule, ...qualifierMatch(rule, selection) }));
  const exclusions = candidates.filter(
    (entry) => entry.rule.effect === "EXCLUDE" && !entry.conflict,
  );
  const denied = exclusions.find((entry) => entry.valid && entry.missing.length === 0);
  if (denied)
    return {
      status: "NOT_COMPATIBLE" as const,
      scope: "MODEL" as const,
      message:
        "An approved exclusion identifies this configuration as incompatible. Request another part.",
      missingQualifiers: [],
      matchedRuleIds: [denied.rule.id],
    };
  const inclusions = candidates.filter(
    (entry) => entry.rule.effect === "INCLUDE" && !entry.conflict,
  );
  const exact = inclusions.find((entry) => entry.valid && entry.missing.length === 0);
  if (exact && exclusions.length === 0)
    return {
      status: "VERIFIED_FIT" as const,
      scope:
        exact.rule.scope === "UNIVERSAL" ? ("UNIVERSAL" as const) : ("MODEL" as const),
      message:
        exact.rule.scope === "UNIVERSAL"
          ? "Approved universal accessory; no vehicle-specific fitment is claimed."
          : "Approved fitment evidence matches the selected configuration. Confirm the supplied vehicle details before collection.",
      missingQualifiers: [],
      matchedRuleIds: [exact.rule.id],
    };
  const possible = [...inclusions, ...exclusions];
  if (possible.length)
    return {
      status: "NEEDS_VERIFICATION" as const,
      scope: "MODEL" as const,
      message:
        "Make, model and year identify a candidate. Confirm the missing technical details with our team before ordering.",
      missingQualifiers: [...new Set(possible.flatMap((entry) => entry.missing))],
      matchedRuleIds: possible.map((entry) => entry.rule.id),
    };
  return {
    status: "UNKNOWN" as const,
    message:
      "No approved fitment evidence confirms this configuration. Ask our team to verify the right part.",
    missingQualifiers: [],
    matchedRuleIds: [],
  };
}

/** PostgreSQL eligibility must precede count and pagination; the decision above
 * supplies presentation only and never removes rows from an already paged list.
 */
export function fitmentRuleWhere(
  selection: FitmentSelection,
  exact = false,
): Prisma.ProductCompatibilityWhereInput {
  return {
    reviewStatus: "APPROVED",
    allVariantsConfirmed: true,
    sourceReference: { not: null },
    reviewedAt: { not: null },
    AND: [
      {
        OR: [
          { scope: "UNIVERSAL", safetyCritical: false, effect: "INCLUDE" },
          {
            scope: "MODEL",
            vehicleModel: { isActive: true, make: { isActive: true } },
            vehicleModelId: selection.vehicleModelId,
            yearFrom: { lte: selection.year },
            yearTo: { gte: selection.year },
          },
        ],
      },
      ...qualifierKeys.flatMap((key): Prisma.ProductCompatibilityWhereInput[] =>
        selection[key]
          ? [
              {
                OR: [
                  { [key]: null },
                  {
                    [key]: {
                      equals: literal(normalizeFitmentValue(selection[key]!)),
                      mode: "insensitive",
                    },
                  },
                ],
              },
            ]
          : exact
            ? [{ [key]: null }]
            : [],
      ),
      ...(exact
        ? [
            {
              NOT: {
                requiredQualifiers: {
                  hasSome: qualifierKeys.filter((key) => !selection[key]),
                },
              },
            },
            {
              OR: [
                { safetyCritical: false },
                {
                  safetyCritical: true,
                  position: { not: null },
                  brakeSystem: { not: null },
                },
              ],
            },
          ]
        : []),
    ],
  };
}
export function fitmentProductWhere(
  selection: FitmentSelection,
  verifiedOnly: boolean,
): Prisma.ProductWhereInput {
  return verifiedOnly
    ? {
        AND: [
          {
            compatibilities: {
              some: { ...fitmentRuleWhere(selection, true), effect: "INCLUDE" },
            },
          },
          {
            compatibilities: {
              none: { ...fitmentRuleWhere(selection), effect: "EXCLUDE" },
            },
          },
        ],
      }
    : {
        compatibilities: { some: { ...fitmentRuleWhere(selection), effect: "INCLUDE" } },
      };
}

export function selectionFromQuery(
  query: {
    vehicleModelId?: string | undefined;
    vehicleMakeId?: string | undefined;
    year?: number | undefined;
  } & Partial<Record<QualifierKey, string | undefined>>,
): FitmentSelection | undefined {
  if (!query.vehicleModelId || query.year === undefined) return undefined;
  return {
    vehicleModelId: query.vehicleModelId,
    year: query.year,
    ...(query.vehicleMakeId ? { vehicleMakeId: query.vehicleMakeId } : {}),
    ...Object.fromEntries(
      qualifierKeys
        .filter((key) => query[key] !== undefined)
        .map((key) => [key, query[key]]),
    ),
  };
}
