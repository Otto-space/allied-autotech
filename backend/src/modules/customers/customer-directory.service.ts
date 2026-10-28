import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/database.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import { enforceWorkforceBoundary } from "../organization/workforce.policy.js";
import { customerAccountStatusSchema } from "./customer-directory.schemas.js";
import { assertPaymentOperator } from "../payments/payments.policy.js";
import { assertServiceAdministrator } from "../service-operations/service-operations.policy.js";
import { assertOrderOperator } from "../orders/orders.policy.js";
import { assertSupportOperator } from "../support/support.policy.js";
import { customerResourceNotFound } from "./customers.errors.js";
import { CustomerDirectoryRepository } from "./customer-directory.repository.js";
import type {
  DirectoryCollection,
  DirectoryQuery,
  RelatedQuery,
} from "./customer-directory.schemas.js";

export function assertDirectoryAdministrator(actor: AuthenticatedActor) {
  if (
    (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") ||
    actor.mfaVerifiedAt === null
  )
    throw new AppError({
      code: "FORBIDDEN",
      statusCode: 403,
      message: "Administrator access is required",
    });
}
export class CustomerDirectoryService {
  constructor(
    private readonly db = prisma,
    private readonly repository = new CustomerDirectoryRepository(db),
  ) {}
  async changeAccountStatus(
    actor: AuthenticatedActor,
    id: string,
    body: unknown,
    context: RequestSecurityContext,
  ) {
    assertDirectoryAdministrator(actor);
    const input = customerAccountStatusSchema.parse(body);
    return this.db.$transaction(async (tx) => {
      await lockAccessActor(tx, actor);
      await enforceWorkforceBoundary(
        tx,
        actor,
        `/api/v1/admin/customers/${id}/account-status`,
      );
      // Lock the current identity, not a stale directory projection. This serializes
      // against promotions, password/MFA operations and session issuance.
      await tx.$queryRaw`SELECT u."id" FROM "User" u JOIN "CustomerProfile" p ON p."userId" = u."id" WHERE p."id" = ${id}::uuid FOR NO KEY UPDATE OF u`;
      const profile = await tx.customerProfile.findUnique({
        where: { id },
        select: { user: { select: { id: true, role: true, status: true } } },
      });
      if (
        !profile ||
        profile.user.role !== "CUSTOMER" ||
        profile.user.id === actor.userId
      )
        throw customerResourceNotFound();
      if (profile.user.status !== input.expectedStatus)
        throw new AppError({
          code:
            profile.user.status === input.status
              ? input.status === "SUSPENDED"
                ? "ACCOUNT_ALREADY_SUSPENDED"
                : "ACCOUNT_ALREADY_ACTIVE"
              : "CONFLICT",
          statusCode: 409,
          message:
            profile.user.status === input.status
              ? `Account is already ${input.status === "SUSPENDED" ? "suspended" : "active"}. Refresh and review the customer again.`
              : "Account status changed. Refresh and review the customer again.",
        });
      const now = new Date(),
        userId = profile.user.id;
      await tx.user.update({ where: { id: userId }, data: { status: input.status } });
      let revokedSessions = 0;
      if (input.status === "SUSPENDED") {
        revokedSessions = (
          await tx.session.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: now },
          })
        ).count;
        await tx.passwordResetToken.updateMany({
          where: { userId, usedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.emailVerificationToken.updateMany({
          where: { userId, usedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "CUSTOMER_PROFILE",
        entityId: id,
        oldValues: { status: profile.user.status },
        newValues: {
          status: input.status,
          targetUserId: userId,
          reason: input.reason,
          changedAt: now.toISOString(),
          revokedSessions,
        },
        context,
      });
      return { customerId: id, status: input.status, revokedSessions };
    });
  }
  async list(
    actor: AuthenticatedActor,
    query: DirectoryQuery,
    context: RequestSecurityContext,
  ) {
    assertDirectoryAdministrator(actor);
    const result = await this.repository.list(query);
    await this.audit(actor, null, "directory", result.items.length, context);
    return result;
  }
  async detail(actor: AuthenticatedActor, id: string, context: RequestSecurityContext) {
    assertDirectoryAdministrator(actor);
    const result = await this.repository.detail(id);
    if (!result) throw customerResourceNotFound();
    await this.audit(actor, id, "summary", 1, context);
    return result;
  }
  async related(
    actor: AuthenticatedActor,
    id: string,
    collection: DirectoryCollection,
    query: RelatedQuery,
    context: RequestSecurityContext,
  ) {
    assertDirectoryAdministrator(actor);
    if (collection === "payments") assertPaymentOperator(actor);
    if (collection === "orders") assertOrderOperator(actor);
    if (collection === "bookings" || collection === "quotations")
      assertServiceAdministrator(actor);
    if (collection === "enquiries" || collection === "complaints")
      assertSupportOperator(actor);
    if (!(await this.repository.detail(id))) throw customerResourceNotFound();
    const result = await this.repository.related(id, collection, query);
    await this.audit(actor, id, collection, result.items.length, context);
    return result;
  }
  private audit(
    actor: AuthenticatedActor,
    id: string | null,
    collection: string,
    count: number,
    context: RequestSecurityContext,
  ) {
    return this.db.$transaction((tx) =>
      appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "CUSTOMER_PROFILE",
        entityId: id,
        newValues: { collection, resultCount: count },
        context,
      }),
    );
  }
}
