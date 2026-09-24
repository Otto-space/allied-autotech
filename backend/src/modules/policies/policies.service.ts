import type { PublishPolicyInput } from "./policies.schemas.js";
import { deliverySettingsSchema } from "./policies.schemas.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { paymentConflict, paymentForbidden } from "../payments/payments.errors.js";

type PolicyDatabase = Pick<
  Prisma.TransactionClient,
  "businessPolicyVersion" | "userCapability" | "user"
>;

export async function currentPolicy(
  database: PolicyDatabase,
  key: string,
  now = new Date(),
) {
  const policy = await database.businessPolicyVersion.findFirst({
    where: { key, effectiveAt: { lte: now } },
    orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
  });
  if (!policy) throw paymentConflict(`Policy configuration is missing: ${key}`);
  return policy;
}

export async function approvedPolicy(database: PolicyDatabase, key: string) {
  const policy = await currentPolicy(database, key);
  if (policy.approvalStatus !== "APPROVED")
    throw paymentConflict(`This operation requires approved ${key} policy`);
  return policy;
}

export function policySnapshot(
  policy: Awaited<ReturnType<typeof currentPolicy>>,
): Prisma.InputJsonObject {
  return {
    id: policy.id,
    key: policy.key,
    version: policy.version,
    approvalStatus: policy.approvalStatus,
    source: policy.source,
    effectiveAt: policy.effectiveAt.toISOString(),
    settings: policy.settings,
  };
}

export async function assertCapability(
  database: PolicyDatabase,
  actor: AuthenticatedActor,
  capability: string,
) {
  if (actor.role === "CUSTOMER" || actor.mfaVerifiedAt === null) throw paymentForbidden();
  const user = await database.user.findUnique({
    where: { id: actor.userId },
    select: { role: true, status: true, emailVerifiedAt: true },
  });
  if (
    !user ||
    user.role !== actor.role ||
    user.status !== "ACTIVE" ||
    !user.emailVerifiedAt
  )
    throw paymentForbidden();
  if (
    !(await database.userCapability.findFirst({
      where: { userId: actor.userId, capability, revokedAt: null },
    }))
  )
    throw paymentForbidden();
}

export async function assertFinanceGate(database: PolicyDatabase) {
  const policy = await currentPolicy(database, "finance");
  // Synthetic local and private staging transactions may exercise draft totals.
  if (env.DEPLOYMENT_ENV === "production" && policy.approvalStatus !== "APPROVED")
    throw paymentConflict(
      "Accounting approval is required before live checkout or invoices",
    );
  return policy;
}

export async function safeCapabilities(database: PolicyDatabase = prisma) {
  const [delivery, vehicle, finance] = await Promise.all([
    currentPolicy(database, "delivery"),
    currentPolicy(database, "vehicle"),
    currentPolicy(database, "finance"),
  ]);
  return {
    serverTime: new Date().toISOString(),
    collection: {
      enabled: true,
      address:
        "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria",
    },
    delivery: { enabled: delivery.approvalStatus === "APPROVED" },
    vehicleDeposits: { enabled: vehicle.approvalStatus === "APPROVED" },
    finance: {
      approvalStatus: finance.approvalStatus,
      draftVatBasisPoints: 750,
      pricesIncludeVat: false,
    },
    booking: {
      confirmation: "STAFF_REVIEW",
      cancellationFeeKobo: "0",
      reminderMinutes: 60,
    },
    marketing: { enabled: false },
    destructiveRetention: { enabled: false },
  };
}

export async function publicFulfillmentOptions(
  database: PolicyDatabase = prisma,
  now = new Date(),
) {
  const [delivery, finance] = await Promise.all(
    ["delivery", "finance"].map((key) =>
      database.businessPolicyVersion.findFirst({
        where: { key, effectiveAt: { lte: now } },
        orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
      }),
    ),
  );
  const checkoutEnabled =
    !!finance &&
    (env.DEPLOYMENT_ENV !== "production" || finance.approvalStatus === "APPROVED");
  const settings = deliverySettingsSchema.safeParse(delivery?.settings);
  const financeSettings = finance?.settings;
  const hasDeliveryTax =
    financeSettings !== null &&
    typeof financeSettings === "object" &&
    !Array.isArray(financeSettings) &&
    typeof financeSettings?.["deliveryTaxable"] === "boolean";
  return {
    serverTime: now.toISOString(),
    currency: "NGN" as const,
    checkoutEnabled,
    collection: {
      enabled: true as const,
      address:
        "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria",
    },
    delivery:
      delivery?.approvalStatus === "APPROVED" &&
      checkoutEnabled &&
      hasDeliveryTax &&
      settings.success
        ? { enabled: true, policyVersion: delivery.version, zones: settings.data.zones }
        : { enabled: false, policyVersion: null, zones: [] },
  };
}

export async function grantCapability(
  actor: AuthenticatedActor,
  userId: string,
  capability: string,
  context: RequestSecurityContext,
) {
  if (actor.role !== "SUPER_ADMIN" || actor.mfaVerifiedAt === null)
    throw paymentForbidden();
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      user.role === "CUSTOMER" ||
      user.status !== "ACTIVE" ||
      !user.emailVerifiedAt
    )
      throw paymentConflict("Select a verified active privileged account");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`capability:${userId}:${capability}`}, 0))`;
    const prior = await tx.userCapability.findFirst({
      where: { userId, capability, revokedAt: null },
    });
    if (prior) return prior;
    const record = await tx.userCapability.create({
      data: { userId, capability, grantedByUserId: actor.userId },
    });
    await appendAuditEvent(tx, {
      actorUserId: actor.userId,
      action: "UPDATE",
      entityType: "USER",
      entityId: userId,
      newValues: { capability, capabilityGrantId: record.id },
      context,
    });
    return record;
  });
}

export async function publishPolicy(
  actor: AuthenticatedActor,
  input: PublishPolicyInput,
  context: RequestSecurityContext,
) {
  if (actor.mfaVerifiedAt === null || actor.role === "CUSTOMER") throw paymentForbidden();
  if (input.kind !== "FINANCE" && actor.role !== "SUPER_ADMIN") throw paymentForbidden();
  const key =
    input.kind === "BRANCH_CAPACITY"
      ? `booking-capacity:${input.branchId}`
      : input.kind.toLowerCase();
  return prisma.$transaction(async (tx) => {
    if (input.kind === "FINANCE")
      await assertCapability(tx, actor, "FINANCE_POLICY_APPROVE");
    const contactIds =
      input.kind === "DISPUTES"
        ? [input.settings.primaryUserId, input.settings.backupUserId]
        : input.kind === "COMPLAINTS"
          ? [input.settings.escalationUserId]
          : [];
    if (
      contactIds.length &&
      (await tx.user.count({
        where: {
          id: { in: contactIds },
          status: "ACTIVE",
          emailVerifiedAt: { not: null },
          role: {
            in:
              input.kind === "COMPLAINTS"
                ? ["ADMIN", "SUPER_ADMIN"]
                : ["STAFF", "ADMIN", "SUPER_ADMIN"],
          },
        },
      })) !== contactIds.length
    )
      throw paymentConflict(
        "Policy contacts must map to verified active authorized accounts",
      );
    if (
      input.kind === "DISPUTES" &&
      (await tx.userCapability.count({
        where: {
          userId: { in: contactIds },
          capability: "DISPUTE_MANAGE",
          revokedAt: null,
        },
      })) !== 2
    )
      throw paymentConflict("Both dispute contacts require dispute capability");
    if (
      input.kind === "BRANCH_CAPACITY" &&
      !(await tx.branch.findFirst({ where: { id: input.branchId, isActive: true } }))
    )
      throw paymentConflict("Select an active branch");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`policy:${key}`}, 0))`;
    const latest = await tx.businessPolicyVersion.findFirst({
      where: { key },
      orderBy: { version: "desc" },
    });
    if ((latest?.version ?? 0) !== input.expectedVersion)
      throw paymentConflict("Policy version changed; review the latest version");
    const effectiveAt = new Date(input.effectiveAt);
    if (effectiveAt.getTime() < Date.now() - 60_000)
      throw paymentConflict("Policy approvals cannot be backdated");
    const policy = await tx.businessPolicyVersion.create({
      data: {
        key,
        version: input.expectedVersion + 1,
        approvalStatus: "APPROVED",
        source: input.source,
        sourceQuestion: {
          FINANCE: "Q7-Q8",
          DELIVERY: "Q1",
          BRANCH_CAPACITY: "Q5",
          COMPLAINTS: "Q11",
          DISPUTES: "Q9",
          RETENTION: "Q13",
          BANK_REFUND_CLOCK: "Q6",
        }[input.kind],
        approvedByUserId: actor.userId,
        effectiveAt,
        settings: input.settings,
        approvalEvidence: input.approvalEvidence,
      },
    });
    await appendAuditEvent(tx, {
      actorUserId: actor.userId,
      action: "CREATE",
      entityType: "USER",
      entityId: actor.userId,
      newValues: { policyVersionId: policy.id, policyKey: key, version: policy.version },
      context,
    });
    return policy;
  });
}
