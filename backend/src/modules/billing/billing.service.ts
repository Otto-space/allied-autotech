import { randomUUID } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  invalidInvoiceTransition,
  invoiceConflict,
  invoiceForbidden,
  invoiceNotFound,
  invoiceStale,
} from "./billing.errors.js";
import { assertInvoiceCustomer, assertInvoiceOperator } from "./billing.policy.js";
import { BillingRepository } from "./billing.repository.js";
import type {
  CustomerInvoiceListQuery,
  InvoiceCreateInput,
  InvoiceTransitionInput,
  StaffInvoiceListQuery,
} from "./billing.schemas.js";
import { invoiceJsonSafe, invoicePage } from "./billing.types.js";

const number = () =>
  `INV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
export class BillingService {
  private readonly repository: BillingRepository;
  constructor(private readonly database: PrismaClient = prisma) {
    this.repository = new BillingRepository(database);
  }
  async customerList(actor: AuthenticatedActor, query: CustomerInvoiceListQuery) {
    assertInvoiceCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (profile === null) throw invoiceNotFound();
    return invoiceJsonSafe(
      invoicePage(await this.repository.listCustomer(profile.id, query), query.limit),
    );
  }
  async customerGet(actor: AuthenticatedActor, id: string) {
    assertInvoiceCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (profile === null) throw invoiceNotFound();
    const invoice = await this.repository.ownedInvoice(id, profile.id);
    if (invoice === null) throw invoiceNotFound();
    return invoiceJsonSafe(invoice);
  }
  async staffList(actor: AuthenticatedActor, query: StaffInvoiceListQuery) {
    assertInvoiceOperator(actor);
    const branchId = await this.allowedBranch(actor);
    return invoiceJsonSafe(
      invoicePage(await this.repository.listStaff(query, branchId), query.limit),
    );
  }
  async staffGet(actor: AuthenticatedActor, id: string, context: RequestSecurityContext) {
    assertInvoiceOperator(actor);
    const invoice = await this.repository.invoice(id);
    if (invoice === null) throw invoiceNotFound();
    await this.assertBranch(actor, this.branchId(invoice));
    await this.database.$transaction((transaction) =>
      appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "INVOICE",
        entityId: id,
        newValues: { privilegedRead: true },
        context,
      }),
    );
    return invoiceJsonSafe(invoice);
  }
  async create(
    actor: AuthenticatedActor,
    input: InvoiceCreateInput,
    context: RequestSecurityContext,
  ) {
    assertInvoiceOperator(actor);
    const dueAt = input.dueAt === undefined ? null : new Date(input.dueAt);
    if (dueAt !== null && dueAt <= new Date())
      throw invoiceConflict("Invoice due date must be in the future");
    return this.database.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`invoice-source:${input.sourceType}:${input.sourceId}`}, 0))`;
      let data: Prisma.InvoiceUncheckedCreateInput;
      let branchId: string | null;
      if (input.sourceType === "ORDER") {
        const source = await this.repository.orderSource(input.sourceId, transaction);
        if (source === null || source.status === "CANCELLED") throw invoiceNotFound();
        if (source.invoice !== null)
          throw invoiceConflict("An invoice already exists for this source");
        branchId = source.branchId;
        data = {
          invoiceNumber: number(),
          customerId: source.customerId,
          orderId: source.id,
          currency: source.currency,
          subtotalKobo: source.totalKobo,
          taxKobo: 0n,
          totalKobo: source.totalKobo,
          dueAt,
        };
      } else if (input.sourceType === "BOOKING") {
        const source = await this.repository.bookingSource(input.sourceId, transaction);
        const quote = source?.quotes[0];
        if (source === null || quote === undefined || source.status === "CANCELLED")
          throw invoiceNotFound();
        if (source.invoice !== null)
          throw invoiceConflict("An invoice already exists for this source");
        branchId = source.branchId;
        data = {
          invoiceNumber: number(),
          customerId: source.customerId,
          bookingId: source.id,
          currency: quote.currency,
          subtotalKobo: quote.subtotalKobo,
          taxKobo: quote.taxKobo,
          totalKobo: quote.totalKobo,
          dueAt,
        };
      } else {
        const source = await this.repository.vehicleSource(input.sourceId, transaction);
        const invoiceableStatuses = [
          "PAYMENT_PENDING",
          "RESERVED",
          "PARTIALLY_PAID",
          "PAID",
          "HANDOVER_PENDING",
          "COMPLETED",
        ] as const;
        if (
          source === null ||
          source.customerId === null ||
          source.agreedPriceKobo === null ||
          !invoiceableStatuses.includes(
            source.status as (typeof invoiceableStatuses)[number],
          )
        )
          throw invoiceNotFound();
        if (source.invoice !== null)
          throw invoiceConflict("An invoice already exists for this source");
        branchId = source.vehicleListing.branchId;
        data = {
          invoiceNumber: number(),
          customerId: source.customerId,
          vehicleTransactionId: source.id,
          currency: source.currency,
          subtotalKobo: source.agreedPriceKobo,
          taxKobo: 0n,
          totalKobo: source.agreedPriceKobo,
          dueAt,
        };
      }
      await this.assertBranch(actor, branchId, transaction);
      const invoice = await this.repository.create(data, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "INVOICE",
        entityId: invoice.id,
        newValues: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          totalKobo: invoice.totalKobo.toString(),
          status: invoice.status,
        },
        context,
      });
      return invoiceJsonSafe(invoice);
    });
  }
  async issue(
    actor: AuthenticatedActor,
    id: string,
    input: InvoiceTransitionInput,
    context: RequestSecurityContext,
  ) {
    return this.transition(actor, id, input, "ISSUED", context);
  }
  async void(
    actor: AuthenticatedActor,
    id: string,
    input: InvoiceTransitionInput,
    context: RequestSecurityContext,
  ) {
    return this.transition(actor, id, input, "VOID", context);
  }
  private async transition(
    actor: AuthenticatedActor,
    id: string,
    input: InvoiceTransitionInput,
    target: "ISSUED" | "VOID",
    context: RequestSecurityContext,
  ) {
    assertInvoiceOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const invoice = await this.repository.lockInvoice(id, transaction);
      if (invoice === null) throw invoiceNotFound();
      await this.assertBranch(actor, this.branchId(invoice), transaction);
      const from: Array<"DRAFT" | "ISSUED"> =
        target === "ISSUED" ? ["DRAFT"] : ["DRAFT", "ISSUED"];
      if (
        !from.includes(invoice.status as "DRAFT" | "ISSUED") ||
        (target === "VOID" &&
          invoice.payments.some((payment) => payment.status === "SUCCEEDED"))
      )
        throw invalidInvoiceTransition();
      const now = new Date();
      const result = await this.repository.transition(
        id,
        input.expectedVersion,
        from,
        target === "ISSUED"
          ? { status: target, issuedAt: now }
          : { status: target, voidedAt: now },
        transaction,
      );
      if (result.count !== 1) throw invoiceStale();
      const updated = await this.repository.invoice(id, transaction);
      if (updated === null) throw invoiceNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "INVOICE",
        entityId: id,
        oldValues: { status: invoice.status, version: invoice.version },
        newValues: { status: updated.status, version: updated.version },
        context,
      });
      return invoiceJsonSafe(updated);
    });
  }
  private branchId(
    invoice: NonNullable<Awaited<ReturnType<BillingRepository["invoice"]>>>,
  ) {
    return (
      invoice.order?.branch?.id ??
      invoice.booking?.branch?.id ??
      invoice.vehicleTransaction?.vehicleListing.branch.id ??
      null
    );
  }
  private async allowedBranch(
    actor: AuthenticatedActor,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    if (actor.role !== "STAFF") return null;
    const profile = await this.repository.staffBranch(actor.userId, client);
    if (profile?.branchId == null || profile.branch?.isActive !== true)
      throw invoiceForbidden();
    return profile.branchId;
  }
  private async assertBranch(
    actor: AuthenticatedActor,
    sourceBranchId: string | null,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    const branchId = await this.allowedBranch(actor, client);
    if (actor.role === "STAFF" && (branchId === null || sourceBranchId !== branchId))
      throw invoiceForbidden();
  }
}
export const billingService = new BillingService();
