import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/database.js";
import { appendAuditEvent } from "../audit/audit.service.js";
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
