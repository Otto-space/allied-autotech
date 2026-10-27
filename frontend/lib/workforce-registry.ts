import type { WorkforceAccess } from "./api/workforce-schemas";

export type WorkforcePredicate = {
  all?: readonly string[];
  any?: readonly string[];
  independentAll?: readonly string[];
  scope: "account" | "responsibility" | "delegation" | "independent";
};
export type WorkforceRecordScope = {
  branchId: string | null;
  assignedStaffId?: string | null;
};

/** Presentation consumes current server capabilities, never a position or role template.
 * Each API still checks current assignment/record scope inside its transaction.
 */
export function workforceAllows(
  access: WorkforceAccess,
  predicate: WorkforcePredicate,
  record?: WorkforceRecordScope,
): boolean {
  if (!access.managed) return false;
  if (
    predicate.independentAll?.length &&
    (!access.accessRevision || !access.capabilityScopes)
  )
    return false;
  if (
    predicate.independentAll?.some(
      (capability) =>
        !access.independentCapabilities?.some((grant) => grant === capability),
    )
  )
    return false;
  if (predicate.scope === "independent") {
    if (record) return false; // Domain records require their own stage/ownership check.
    const independent = access.independentCapabilities ?? [];
    return (
      (!predicate.all?.length ||
        predicate.all.every((c) => independent.some((v) => v === c))) &&
      (!predicate.any?.length ||
        predicate.any.some((c) => independent.some((v) => v === c)))
    );
  }
  if (predicate.scope === "delegation" && !access.canManageAssignments) return false;
  const can = (capability: string) => {
    if (!access.permissions.includes(capability)) return false;
    // Older servers expose only their effective permission projection. This
    // compatibility path cannot manufacture record authority; the API remains final.
    if (access.capabilityScopes === undefined) return true;
    return access.capabilityScopes.some(
      (grant) =>
        grant.capability === capability &&
        (!record || grant.branchId === record.branchId) &&
        (grant.scope === "BRANCH" ||
          (!!access.staffId && (!record || record.assignedStaffId === access.staffId))),
    );
  };
  return (
    (!predicate.all?.length || predicate.all.every(can)) &&
    (!predicate.any?.length || predicate.any.some(can))
  );
}

// Actual route destinations, page predicates, group/order, availability, applicable
// scope and reviewed learning references live together. No per-job sidebar trees.
export const workforceDestinations = [
  {
    id: "overview",
    href: "/admin",
    aliases: ["/admin/workforce"],
    group: "overview",
    order: 0,
    label: "Overview",
    feature: "managed-workforce",
    predicate: { scope: "account" },
    articleIds: ["work-access"],
  },
  {
    id: "jobs",
    href: "/admin/workforce/jobs",
    detail: true,
    group: "workshop",
    order: 10,
    label: "My jobs",
    feature: "managed-workforce",
    predicate: { any: ["JOBS_READ"], scope: "responsibility" },
    articleIds: ["assigned-findings", "job-assignment"],
  },
  {
    id: "bookings",
    href: "/admin/workforce/bookings",
    detail: true,
    group: "workshop",
    order: 20,
    label: "Bookings",
    feature: "managed-workforce",
    predicate: { any: ["BOOKINGS_READ"], scope: "responsibility" },
    articleIds: ["work-access", "booking-confirmation"],
  },
  {
    id: "enquiries",
    href: "/admin/workforce/enquiries",
    group: "support",
    order: 30,
    label: "Enquiries",
    feature: "managed-workforce",
    predicate: {
      any: ["CUSTOMER_ENQUIRIES", "SALES_ENQUIRIES", "CARE_CASE_VIEW"],
      scope: "responsibility",
    },
    articleIds: ["care-triage", "sales-enquiries"],
  },
  {
    id: "complaints",
    href: "/admin/workforce/complaints",
    group: "support",
    order: 40,
    label: "Complaints",
    feature: "managed-workforce",
    predicate: { any: ["COMPLAINTS", "CARE_CASE_VIEW"], scope: "responsibility" },
    articleIds: ["care-triage"],
  },
  {
    id: "privacy",
    href: "/admin/privacy",
    group: "support",
    order: 41,
    label: "Privacy review",
    feature: "managed-workforce",
    predicate: { any: ["PRIVACY_REVIEW"], scope: "independent" },
    articleIds: ["privacy-work"],
  },
  {
    id: "fitment",
    href: "/admin/fitment",
    group: "catalogue",
    order: 50,
    label: "Fitment evidence & review",
    feature: "managed-workforce",
    predicate: { any: ["FITMENT_AUTHOR", "FITMENT_REVIEW"], scope: "responsibility" },
    articleIds: ["parts-fitment"],
  },
  {
    id: "orders",
    href: "/admin/workforce/orders",
    group: "orders",
    order: 60,
    label: "Order progress",
    feature: "managed-workforce",
    predicate: { any: ["ORDERS_READ"], scope: "responsibility" },
    articleIds: ["work-access"],
  },
  {
    id: "finance",
    href: "/admin/workforce/finance",
    group: "finance",
    order: 70,
    label: "Payment records",
    feature: "managed-workforce",
    predicate: { any: ["FINANCE_READ"], scope: "responsibility" },
    articleIds: ["finance-meaning"],
  },
  {
    id: "refunds",
    href: "/admin/refunds",
    group: "finance",
    order: 71,
    label: "Refund requests",
    feature: "managed-workforce",
    predicate: {
      any: ["REFUND_APPROVE", "REFUND_TRANSFER", "REFUND_CHECK"],
      scope: "independent",
    },
    articleIds: ["refund-work"],
  },
  {
    id: "disputes",
    href: "/admin/payment-disputes/work",
    group: "finance",
    order: 72,
    label: "Dispute work queue",
    feature: "managed-workforce",
    predicate: { any: ["DISPUTE_MANAGE"], scope: "independent" },
    articleIds: ["dispute-work"],
  },
  {
    id: "financialPolicy",
    href: "/admin/finance-policy",
    group: "finance",
    order: 73,
    label: "Financial policy",
    feature: "managed-workforce",
    predicate: { any: ["FINANCE_POLICY_APPROVE"], scope: "independent" },
    articleIds: ["financial-policy-work"],
  },
  {
    id: "financialAftercare",
    href: "/admin/workforce/aftercare",
    detail: true,
    group: "finance",
    order: 74,
    label: "Financial aftercare",
    feature: "managed-workforce",
    predicate: {
      all: ["FINANCE_READ"],
      independentAll: ["FINANCE_POLICY_APPROVE"],
      scope: "responsibility",
    },
    articleIds: ["financial-aftercare"],
  },
  {
    id: "access",
    href: "/admin/workforce/access",
    detail: true,
    group: "team",
    order: 80,
    label: "Responsibility assignments",
    feature: "managed-workforce",
    predicate: { scope: "delegation" },
    articleIds: ["access-review"],
  },
  {
    id: "security",
    href: "/admin/security",
    group: "settings",
    order: 90,
    label: "My account security",
    feature: "managed-workforce",
    predicate: { scope: "account" },
    articleIds: ["security-basics"],
  },
  {
    id: "notifications",
    href: "/admin/notifications",
    group: "settings",
    order: 100,
    label: "Notifications",
    feature: "managed-workforce",
    predicate: { scope: "account" },
    articleIds: ["work-access"],
  },
] as const satisfies readonly {
  id: string;
  href: string;
  aliases?: readonly string[];
  detail?: boolean;
  group: string;
  order: number;
  label: string;
  feature: "managed-workforce";
  predicate: WorkforcePredicate;
  articleIds: readonly string[];
}[];
export type WorkforceDestination = (typeof workforceDestinations)[number];
export type WorkforceDestinationId = WorkforceDestination["id"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function workforceDestination(path: string): WorkforceDestination | undefined {
  // The caller supplies a pathname. Never accept arbitrary URLs or encoded traversal.
  if (!path.startsWith("/") || /[?#%\\]/.test(path)) return;
  return workforceDestinations.find(
    (entry) =>
      path === entry.href ||
      ("aliases" in entry && entry.aliases.some((alias) => alias === path)) ||
      ("detail" in entry &&
        entry.detail &&
        path.startsWith(entry.href + "/") &&
        uuid.test(path.slice(entry.href.length + 1))),
  );
}
export function workforceDestinationAllowed(
  access: WorkforceAccess,
  id: WorkforceDestinationId,
) {
  const entry = workforceDestinations.find((item) => item.id === id)!;
  return workforceAllows(access, entry.predicate);
}
export function permittedWorkforceDestinations(access: WorkforceAccess) {
  return workforceDestinations
    .filter((entry) => workforceAllows(access, entry.predicate))
    .sort((a, b) => a.order - b.order);
}

export const workforceActionPredicates = {
  financialAftercare: {
    all: ["FINANCE_READ"],
    independentAll: ["FINANCE_POLICY_APPROVE"],
    scope: "responsibility",
  },
  bookingConfirm: {
    all: ["BOOKINGS_READ"],
    independentAll: ["BOOKING_CONFIRM"],
    scope: "responsibility",
  },
  jobWork: { all: ["JOBS_READ", "JOBS_UPDATE"], scope: "responsibility" },
  jobAssign: { all: ["JOBS_READ", "JOBS_ASSIGN"], scope: "responsibility" },
  jobQuality: { all: ["JOBS_READ", "QUALITY_APPROVE"], scope: "responsibility" },
  enquiryAssign: {
    all: ["SALES_ENQUIRIES", "ENQUIRIES_ASSIGN"],
    scope: "responsibility",
  },
} as const satisfies Record<string, WorkforcePredicate>;

/** Stable across timestamps and database ordering; covers scope changes even when
 * an old server does not yet return the opaque revision. Never used to authorize.
 */
export function workforceAccessKey(access: WorkforceAccess): string {
  return JSON.stringify([
    access.accessRevision ?? null,
    access.userId,
    access.staffId,
    access.managed,
    access.version,
    access.canManageAssignments,
    access.canInviteAdmins,
    [...access.permissions].sort(),
    [...(access.independentCapabilities ?? [])].sort(),
    access.assignments
      .map((a) => [
        a.id,
        a.template,
        a.templateVersion ?? 1,
        a.branchId,
        a.scope,
        a.startsAt,
        a.expiresAt,
        a.revokedAt,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    access.capabilityScopes?.map((g) => [g.capability, g.branchId, g.scope]).sort(),
  ]);
}
