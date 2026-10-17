import { z } from "zod";
import { draftIdentity } from "../forms/drafts";
import { parseWorkVehicleStock } from "./work-vehicle-stock";
import type { RequestBody } from "../api/contracts";
const prefix = "aat:stock-create:v1:";
const pendingSchema = z
  .object({
    kind: z.literal("pending"),
    token: z.uuid(),
    stockNumber: z.string().min(1).max(40),
    branchId: z.uuid(),
  })
  .strict();
const confirmedSchema = z
  .object({ kind: z.literal("confirmed"), token: z.uuid(), vehicleId: z.uuid() })
  .strict();
const stateSchema = z.discriminatedUnion("kind", [pendingSchema, confirmedSchema]);
export type StockCreationState = z.infer<typeof stateSchema> | "unknown";
export type StockCreationPending = z.infer<typeof pendingSchema>;
export const stockCreationStorageKey = (owner: string, role: string) =>
  `${prefix}${owner}:${role}`;
export const stockCreationDraft = (branchId?: string) =>
  `work-vehicle-create:2:${branchId ?? "all"}`;
function assertOwner(owner: string, role: string) {
  if (
    draftIdentity() !== `${owner}:${role}` ||
    !["STAFF", "ADMIN", "SUPER_ADMIN"].includes(role)
  )
    throw Error("Vehicle account changed");
}
export function readStockCreation(
  owner: string,
  role: string,
): StockCreationState | undefined {
  try {
    const raw = sessionStorage.getItem(stockCreationStorageKey(owner, role));
    if (raw === null) return;
    if (raw.length > 400) return "unknown";
    return stateSchema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markStockCreation(
  owner: string,
  role: string,
  stockNumber: string,
  branchId: string,
) {
  assertOwner(owner, role);
  if (readStockCreation(owner, role) !== undefined)
    throw Error("An earlier creation needs reconciliation");
  const state = pendingSchema.parse({
      kind: "pending",
      token: crypto.randomUUID(),
      stockNumber,
      branchId,
    }),
    raw = JSON.stringify(state),
    key = stockCreationStorageKey(owner, role);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw)
    throw Error("Vehicle recovery storage unavailable");
  return state;
}
export function confirmStockCreation(
  owner: string,
  role: string,
  pending: StockCreationPending,
  vehicleId: string,
) {
  assertOwner(owner, role);
  const current = readStockCreation(owner, role);
  if (
    typeof current !== "object" ||
    current.token !== pending.token ||
    current.kind !== "pending"
  )
    throw Error("Vehicle recovery changed");
  const state = confirmedSchema.parse({
      kind: "confirmed",
      token: pending.token,
      vehicleId,
    }),
    raw = JSON.stringify(state),
    key = stockCreationStorageKey(owner, role);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw)
    throw Error("Vehicle recovery storage unavailable");
  return state;
}
export function clearStockCreation(owner: string, role: string, token?: string) {
  assertOwner(owner, role);
  if (token) {
    const current = readStockCreation(owner, role);
    if (typeof current !== "object" || current.token !== token)
      throw Error("Vehicle recovery changed");
  }
  const key = stockCreationStorageKey(owner, role);
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null)
    throw Error("Vehicle recovery storage unavailable");
}
export function redactStockCreations() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {
    /* Retain an unresolved lock if storage is unavailable. */
  }
}
export function parseCreatedStock(
  value: unknown,
  body: RequestBody<"/staff/vehicles", "post">,
  role: string,
) {
  const row = parseWorkVehicleStock({ items: [value] }, role, body.branchId).items[0];
  if (
    !row ||
    row.version !== 0 ||
    !row.branch.isActive ||
    row.listings.length ||
    row.images.length ||
    row.documents.length ||
    row.conditionReports.length
  )
    throw Error("Unexpected created stock record");
  for (const [key, expected] of Object.entries(body)) {
    const actual = (row as unknown as Record<string, unknown>)[key];
    if (
      key === "acquiredAt" &&
      typeof expected === "string" &&
      typeof actual === "string"
    ) {
      if (Date.parse(actual) !== Date.parse(expected))
        throw Error("Unexpected acquisition date");
    } else if (actual !== expected)
      throw Error("Created stock differs from reviewed request");
  }
  return row;
}
