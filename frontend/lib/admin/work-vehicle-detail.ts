import { z } from "zod";
import { workStockVehicleSchema } from "./work-vehicle-stock";
import { staffListingSchema } from "../api/staff-vehicle-schemas";
import {
  vehicleDocumentSchema,
  conditionSummarySchema,
} from "../api/vehicle-document-schemas";
import { draftIdentity, draftKey, forgetDraft } from "../forms/drafts";
export const stockChangeKinds = [
  "record",
  "listing",
  "publication",
  "listing-create",
  "photo",
  "document",
  "document-create",
  "condition",
] as const;
export type StockChange = {
  kind: (typeof stockChangeKinds)[number];
  id?: string;
  expectedVersion?: number;
  expected?: Record<string, unknown>;
};
const date = z.iso.datetime({ offset: true }),
  nullableDate = date.nullable();
const documentSchema = vehicleDocumentSchema.extend({
  version: z.number().int().nonnegative(),
  createdAt: date,
  issuedAt: nullableDate,
  expiresAt: nullableDate,
  verifiedAt: nullableDate,
});
const reportSchema = conditionSummarySchema.extend({
  inspectedAt: date,
  odometerKm: z.number().int().nonnegative().nullable(),
  conditionScore: z.number().int().min(0).max(100).nullable(),
});
const listingSchema = staffListingSchema.extend({
  title: z.string().min(1).max(180),
  priceKobo: z.string().regex(/^[1-9][0-9]{0,15}$/),
  version: z.number().int().nonnegative(),
  publishedAt: nullableDate,
  reservedAt: nullableDate,
  soldAt: nullableDate,
  archivedAt: nullableDate,
});
const detailSchema = workStockVehicleSchema.safeExtend({
  createdAt: date.optional(),
  updatedAt: date.optional(),
  listings: z.array(listingSchema),
  documents: z.array(documentSchema),
  conditionReports: z.array(reportSchema).max(1),
});
export type StockDetail = z.infer<typeof detailSchema>;
export function parseStockDetail(
  value: unknown,
  id: string,
  role: string,
  branchId?: string | null,
): StockDetail {
  const row = detailSchema.parse(value);
  if (row.id !== id) throw Error("Unexpected stock record");
  if (role === "STAFF") {
    if (
      !branchId ||
      row.branchId !== branchId ||
      !row.branch.isActive ||
      typeof value !== "object" ||
      value === null ||
      Object.hasOwn(value, "acquisitionCostKobo") ||
      Object.hasOwn(value, "acquisitionCurrency")
    )
      throw Error("Unexpected Staff stock scope");
  } else if (
    !["ADMIN", "SUPER_ADMIN"].includes(role) ||
    row.acquisitionCostKobo === undefined ||
    row.acquisitionCurrency !== "NGN"
  )
    throw Error("Missing administrator acquisition projection");
  if (new Set(row.documents.map((d) => d.id)).size !== row.documents.length)
    throw Error("Duplicate stock documents");
  return row;
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
const json = (value: unknown) => JSON.stringify(canonical(value));
export function stockChangeSnapshot(row: StockDetail, change: StockChange) {
  const base = { id: row.id, branchId: row.branchId, branch: row.branch };
  const { listings, images, documents, conditionReports, ...core } = row;
  void conditionReports;
  const relevant =
    change.kind === "record" || change.kind === "listing-create"
      ? core
      : change.kind === "listing"
        ? listings.find((l) => l.id === change.id)
        : change.kind === "publication"
          ? { core, listing: listings.find((l) => l.id === change.id), images }
          : change.kind === "photo"
            ? {
                version: row.version,
                images,
                live: listings
                  .filter((l) => ["AVAILABLE", "RESERVED"].includes(l.status))
                  .map((l) => ({ id: l.id, status: l.status }))
                  .sort((a, b) => a.id.localeCompare(b.id)),
              }
            : change.kind === "document"
              ? documents.find((d) => d.id === change.id)
              : null;
  return json({ base, relevant });
}
export function stockAtLeast(row: StockDetail, seen: StockDetail) {
  return (
    row.version >= seen.version &&
    seen.listings.every((v) =>
      row.listings.some((n) => n.id === v.id && n.version >= v.version),
    ) &&
    seen.documents.every((v) =>
      row.documents.some((n) => n.id === v.id && n.version >= v.version),
    ) &&
    (!seen.conditionReports[0] ||
      (!!row.conditionReports[0] &&
        Date.parse(row.conditionReports[0].inspectedAt) >=
          Date.parse(seen.conditionReports[0].inspectedAt)))
  );
}
export function mergeStockObservation(
  previous: StockDetail | undefined,
  next: StockDetail,
): StockDetail {
  if (!previous) return next;
  if (previous.id !== next.id) throw Error("Stock identity changed");
  const merge = <T extends { id: string; version: number }>(old: T[], fresh: T[]) => {
    const rows = new Map(old.map((v) => [v.id, v]));
    for (const row of fresh)
      if (!rows.has(row.id) || row.version >= rows.get(row.id)!.version)
        rows.set(row.id, row);
    return [...rows.values()];
  };
  const core = next.version >= previous.version ? next : previous;
  const report = [...previous.conditionReports, ...next.conditionReports].sort(
    (a, b) => Date.parse(b.inspectedAt) - Date.parse(a.inspectedAt),
  );
  return {
    ...core,
    listings: merge(previous.listings, next.listings),
    documents: merge(previous.documents, next.documents),
    conditionReports: report.length ? [report[0]] : [],
  };
}
function matches(actual: Record<string, unknown>, expected: Record<string, unknown>) {
  return Object.entries(expected).every(
    ([key, value]) =>
      value === undefined ||
      (key.endsWith("At") && typeof value === "string" && typeof actual[key] === "string"
        ? Date.parse(actual[key] as string) === Date.parse(value)
        : json(actual[key]) === json(value)),
  );
}
export function validateStockChange(
  result: unknown,
  change: StockChange,
  before: StockDetail,
  role: string,
  branchId?: string | null,
) {
  const { data } = z
    .object({ success: z.literal(true), data: z.unknown() })
    .parse(result);
  if (change.kind === "record") {
    const saved = parseStockDetail(data, before.id, role, branchId);
    if (
      saved.version !== (change.expectedVersion ?? before.version) + 1 ||
      !matches(saved, change.expected ?? {})
    )
      throw Error("Unexpected saved vehicle");
    return { kind: "record" as const, saved };
  }
  if (change.kind === "photo") {
    const raw = z.record(z.string(), z.unknown()).parse(data);
    if (
      (raw.vehicleId !== undefined && raw.vehicleId !== before.id) ||
      (change.id && raw.imageId !== undefined && raw.imageId !== change.id) ||
      (change.id && raw.removedImageId !== undefined && raw.removedImageId !== change.id)
    )
      throw Error("Unexpected photo receipt scope");
    const receipt = z.object({ version: z.number().int().positive() }).parse(data);
    if (
      change.expectedVersion !== undefined &&
      receipt.version !== change.expectedVersion + 1
    )
      throw Error("Unexpected photo version");
    return { kind: "photo" as const, version: receipt.version };
  }
  const raw = z.record(z.string(), z.unknown()).parse(data);
  if (raw.vehicleId !== undefined && raw.vehicleId !== before.id)
    throw Error("Unexpected receipt stock scope");
  if (raw.branchId !== undefined && raw.branchId !== before.branchId)
    throw Error("Unexpected receipt branch scope");
  if (["listing", "publication", "listing-create"].includes(change.kind)) {
    const saved = listingSchema.parse(data),
      creating = change.kind === "listing-create";
    if (
      creating
        ? raw.vehicleId !== before.id ||
          before.listings.some((v) => v.id === saved.id) ||
          saved.version !== 0
        : saved.id !== change.id || saved.version !== (change.expectedVersion ?? -1) + 1
    )
      throw Error("Unexpected listing receipt");
    if (!matches(raw, change.expected ?? {}))
      throw Error("Listing differs from reviewed values");
    return { kind: "listing" as const, saved };
  }
  if (change.kind === "document" || change.kind === "document-create") {
    const saved = documentSchema.parse(data),
      creating = change.kind === "document-create";
    if (
      creating
        ? before.documents.some((v) => v.id === saved.id) ||
          saved.version !== 0 ||
          saved.verificationStatus !== "PENDING"
        : saved.id !== change.id || saved.version !== (change.expectedVersion ?? -1) + 1
    )
      throw Error("Unexpected document receipt");
    if (!matches(raw, change.expected ?? {}))
      throw Error("Document differs from reviewed values");
    return { kind: "document" as const, saved };
  }
  const saved = reportSchema.parse(data);
  if (
    before.conditionReports.some((v) => v.id === saved.id) ||
    !matches(raw, change.expected ?? {})
  )
    throw Error("Unexpected condition report receipt");
  return { kind: "condition" as const, saved };
}
export function formatStockInstant(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "Date unavailable";
  const precise = d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0;
  return (
    new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      ...(precise ? { second: "2-digit" as const } : {}),
      ...(d.getUTCMilliseconds() ? { fractionalSecondDigits: 3 as const } : {}),
    }).format(d) + " (Lagos time)"
  );
}
const prefix = "aat:stock-detail:v1:",
  pendingSchema = z
    .object({
      token: z.uuid(),
      kind: z.enum(stockChangeKinds),
      version: z.number().int().nonnegative(),
    })
    .strict();
export type StockDetailPending = z.infer<typeof pendingSchema> | "unknown";
export const stockDetailPendingKey = (owner: string, role: string, id: string) =>
  `${prefix}${owner}:${role}:${id}`;
export function readStockDetailPending(key: string): StockDetailPending | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return;
    if (raw.length > 200) return "unknown";
    return pendingSchema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markStockDetailPending(
  owner: string,
  role: string,
  id: string,
  kind: StockChange["kind"],
  version: number,
) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Stock account changed");
  const key = stockDetailPendingKey(owner, role, id);
  if (readStockDetailPending(key) !== undefined)
    throw Error("An earlier change needs reconciliation");
  const value = pendingSchema.parse({ token: crypto.randomUUID(), kind, version }),
    raw = JSON.stringify(value);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw)
    throw Error("Stock recovery storage unavailable");
  return value;
}
export function clearStockDetailPending(
  owner: string,
  role: string,
  id: string,
  token?: string,
) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Stock account changed");
  const key = stockDetailPendingKey(owner, role, id),
    current = readStockDetailPending(key);
  if (token && (typeof current !== "object" || current.token !== token))
    throw Error("Stock recovery changed");
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null)
    throw Error("Stock recovery storage unavailable");
}
export function forgetStockDetailDrafts(owner: string, role: string, id: string) {
  const identity = `${owner}:${role}`,
    path = `/admin/vehicles/${id}`;
  if (draftIdentity() !== identity) throw Error("Stock account changed");
  for (const key of Object.keys(sessionStorage)) {
    if (!key.startsWith("aat:form-draft:v1:")) continue;
    try {
      const parts = JSON.parse(key.slice("aat:form-draft:v1:".length));
      if (
        Array.isArray(parts) &&
        parts[0] === identity &&
        parts[1] === path &&
        typeof parts[2] === "string"
      )
        forgetDraft(draftKey(identity, path, parts[2]));
    } catch {
      /* Ignore unrelated or malformed draft keys. */
    }
  }
}
export function forgetStockFormDraft(element: HTMLElement | null) {
  const form = element instanceof HTMLFormElement ? element : element?.closest("form"),
    owner = form?.closest("[data-stock-owner]")?.getAttribute("data-stock-owner"),
    name = form?.getAttribute("data-draft-key");
  if (!owner || owner !== draftIdentity() || !name) return;
  forgetDraft(draftKey(owner, window.location.pathname, name));
}
export function redactStockDetailChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {
    /* Keep the lock when storage is unavailable. */
  }
}
