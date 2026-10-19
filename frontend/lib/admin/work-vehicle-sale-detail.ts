import { z } from "zod";
import { workVehicleSaleSchema } from "./work-vehicle-sales";
import { transactionStatuses } from "../api/vehicle-schemas";
import { draftIdentity, draftKey, forgetDraft } from "../forms/drafts";
const date = z.iso.datetime({ offset: true });
export const saleDetailSchema = workVehicleSaleSchema.extend({
  statusHistory: z.array(
    z.object({
      id: z.uuid(),
      fromStatus: z.enum(transactionStatuses).nullable(),
      toStatus: z.enum(transactionStatuses),
      reason: z.string().nullable(),
      createdAt: date,
    }),
  ),
  handover: workVehicleSaleSchema.shape.handover
    .unwrap()
    .extend({ createdAt: date.optional(), hasSignedDocument: z.boolean() })
    .nullable(),
});
export type SaleDetail = z.infer<typeof saleDetailSchema>;
export const saleChangeKinds = [
  "negotiation",
  "progress",
  "handover-create",
  "handover-status",
] as const;
export type SaleChange = {
  kind: (typeof saleChangeKinds)[number];
  expectedVersion?: number;
  handoverId?: string;
  body: Record<string, unknown>;
};
export function parseSaleDetail(
  value: unknown,
  id: string,
  role: string,
  branchId?: string | null,
) {
  const row = saleDetailSchema.parse(value);
  if (
    row.id !== id ||
    (role === "STAFF" && (!branchId || row.vehicleListing.branchId !== branchId))
  )
    throw Error("Unexpected purchase scope");
  if (new Set(row.statusHistory.map((h) => h.id)).size !== row.statusHistory.length)
    throw Error("Duplicate purchase history");
  return row;
}
export function saleAtLeast(row: SaleDetail, previous: SaleDetail) {
  return (
    row.id === previous.id &&
    row.version >= previous.version &&
    (!previous.handover ||
      (row.handover?.id === previous.handover.id &&
        row.handover.version >= previous.handover.version))
  );
}
export function mergeSaleObservation(previous: SaleDetail | undefined, next: SaleDetail) {
  if (!previous || previous.id !== next.id) return next;
  const core = next.version >= previous.version ? next : previous;
  const handover = !previous.handover
    ? next.handover
    : !next.handover
      ? previous.handover
      : next.handover.id === previous.handover.id &&
          next.handover.version >= previous.handover.version
        ? next.handover
        : previous.handover;
  const history = new Map(
    [...previous.statusHistory, ...next.statusHistory].map((h) => [h.id, h]),
  );
  return {
    ...core,
    handover,
    statusHistory: [...history.values()].sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id),
    ),
  };
}
export function saleChangeSnapshot(row: SaleDetail, change: SaleChange) {
  const identity = [
    row.id,
    row.version,
    row.status,
    row.customerId,
    row.customerName,
    row.vehicleListing.id,
    row.vehicleListing.title,
    row.vehicleListing.branchId,
    row.vehicleListing.status,
    row.vehicleListing.vehicle.id,
    row.agreedPriceKobo,
    row.reservationRequiredKobo,
    row.paidAt,
    row.reservationExpiresAt,
    row.termsVersion,
    row.termsAcceptedAt,
    row.paidHoldStartsAt,
    row.paidHoldExpiresAt,
  ];
  return JSON.stringify([
    ...identity,
    ...(change.kind.startsWith("handover") ? [row.handover] : []),
  ]);
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function validateSaleChange(
  result: unknown,
  change: SaleChange,
  before: SaleDetail,
  role: string,
  branchId?: string | null,
) {
  const response = z
      .object({ success: z.literal(true), data: z.unknown() })
      .parse(result),
    saved = parseSaleDetail(response.data, before.id, role, branchId),
    body = change.body;
  if (
    saved.vehicleListing.id !== before.vehicleListing.id ||
    saved.vehicleListing.branchId !== before.vehicleListing.branchId ||
    saved.customerId !== before.customerId ||
    saved.customerName !== before.customerName
  )
    throw Error("Unexpected purchase identity");
  if (change.kind === "negotiation" || change.kind === "progress") {
    if (
      saved.version !== (change.expectedVersion ?? -1) + 1 ||
      saved.status !== (change.kind === "negotiation" ? "NEGOTIATING" : body.status)
    )
      throw Error("Unexpected purchase version/status");
    if (
      change.kind === "negotiation" &&
      (saved.agreedPriceKobo !== body.agreedPriceKobo ||
        saved.reservationRequiredKobo !== (body.reservationRequiredKobo ?? null))
    )
      throw Error("Unexpected negotiated values");
    if (
      change.kind === "progress" &&
      body.status === "CANCELLED" &&
      saved.cancellationReason !== body.reason
    )
      throw Error("Unexpected cancellation reason");
    const reason = change.kind === "negotiation" ? body.notes : body.reason;
    if (
      !saved.statusHistory.some(
        (h) =>
          !before.statusHistory.some((old) => old.id === h.id) &&
          h.fromStatus === before.status &&
          h.toStatus === saved.status &&
          h.reason === (reason ?? null),
      )
    )
      throw Error("Purchase history could not be confirmed");
  } else if (change.kind === "handover-create") {
    const handover = saved.handover;
    if (
      before.handover ||
      saved.version !== before.version + 1 ||
      saved.status !== "HANDOVER_PENDING" ||
      !handover ||
      handover.version !== 0 ||
      handover.status !== "PENDING"
    )
      throw Error("Unexpected handover creation");
    for (const key of [
      "recipientName",
      "recipientPhone",
      "odometerKm",
      "keysDelivered",
    ] as const)
      if (!equal(handover[key], body[key])) throw Error("Unexpected handover facts");
    if (handover.hasSignedDocument !== Boolean(body.assetToken))
      throw Error("Unexpected signed document receipt");
  } else {
    if (
      !before.handover ||
      !saved.handover ||
      saved.handover?.id !== change.handoverId ||
      saved.handover.version !== (change.expectedVersion ?? -1) + 1 ||
      saved.handover.status !== body.status
    )
      throw Error("Unexpected handover version/status");
    const completing = body.status === "COMPLETED";
    if (
      saved.version !== before.version + (completing ? 1 : 0) ||
      saved.status !== (completing ? "COMPLETED" : before.status) ||
      (completing && saved.vehicleListing.status !== "SOLD")
    )
      throw Error("Unexpected purchase completion");
  }
  return saved;
}
const prefix = "aat:sale-detail:v1:",
  pendingSchema = z
    .object({
      token: z.uuid(),
      kind: z.enum(saleChangeKinds),
      version: z.number().int().nonnegative(),
    })
    .strict();
export type SalePending = z.infer<typeof pendingSchema> | "unknown";
export const salePendingKey = (owner: string, role: string, id: string) =>
  `${prefix}${owner}:${role}:${id}`;
export function readSalePending(
  owner: string,
  role: string,
  id: string,
): SalePending | undefined {
  try {
    const raw = sessionStorage.getItem(salePendingKey(owner, role, id));
    if (raw === null) return;
    if (raw.length > 200) return "unknown";
    return pendingSchema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markSalePending(
  owner: string,
  role: string,
  id: string,
  kind: SaleChange["kind"],
  version: number,
) {
  if (
    draftIdentity() !== `${owner}:${role}` ||
    readSalePending(owner, role, id) !== undefined
  )
    throw Error("Purchase recovery unavailable");
  const marker = pendingSchema.parse({ token: crypto.randomUUID(), kind, version }),
    raw = JSON.stringify(marker),
    key = salePendingKey(owner, role, id);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw) throw Error("Purchase recovery unavailable");
  return marker;
}
export function clearSalePending(
  owner: string,
  role: string,
  id: string,
  token?: string,
) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Purchase account changed");
  const stored = readSalePending(owner, role, id);
  if (token && (typeof stored !== "object" || stored.token !== token))
    throw Error("Purchase recovery changed");
  const key = salePendingKey(owner, role, id);
  sessionStorage.removeItem(key);
  if (sessionStorage.getItem(key) !== null) throw Error("Purchase recovery unavailable");
}
export function redactSaleChanges() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {}
}
export function forgetSaleDrafts(owner: string, role: string, id: string) {
  if (draftIdentity() !== `${owner}:${role}`) throw Error("Purchase account changed");
  for (const key of Object.keys(sessionStorage)) {
    if (!key.startsWith("aat:form-draft:v1:")) continue;
    try {
      const parts = JSON.parse(key.slice("aat:form-draft:v1:".length));
      if (parts[0] === `${owner}:${role}` && parts[1] === `/admin/vehicle-sales/${id}`)
        forgetDraft(key);
    } catch {}
  }
}
export function forgetSaleFormDraft(element: HTMLElement) {
  const form = element.closest("form"),
    root = form?.closest("[data-sale-owner]"),
    owner = root?.getAttribute("data-sale-owner"),
    path = root?.getAttribute("data-sale-path");
  if (owner && path && owner === draftIdentity() && form?.dataset.draftKey)
    forgetDraft(draftKey(owner, path, form.dataset.draftKey));
}
