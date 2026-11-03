import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { buildInvoiceSnapshot } from "../billing/document-snapshot.js";
import { requestFreeCancellationRefund } from "../payments/refund-workflow.js";
import { requestAftercare } from "./order-aftercare.service.js";
import { aftercareReceipt } from "./order-aftercare-receipt.js";
import { customerAftercareView } from "./order-aftercare.schemas.js";
import {
  assertFinanceGate,
  currentPolicy,
  policySnapshot,
} from "../policies/policies.service.js";
import { draftTotals } from "../policies/policy-money.js";
import { randomUUID } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { hashToken } from "../../common/security/session-tokens.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { productPurchasesEnabled } from "../../common/contracts/public-release.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  promotionsService,
  type PromotionsService,
} from "../promotions/promotions.service.js";
import {
  checkoutIdempotencyConflict,
  checkoutStockUnavailable,
  invalidOrderTransition,
  orderConflict,
  orderForbidden,
  orderNotFound,
  orderStale,
} from "./orders.errors.js";
import { assertCustomer, assertOrderOperator } from "./orders.policy.js";
import { OrdersRepository, orderSelect } from "./orders.repository.js";
import type {
  CheckoutInput,
  CustomerOrderCancelInput,
  CustomerOrderListQuery,
  ExpireOrdersInput,
  OrderTransitionInput,
  StaffOrderListQuery,
  GuestCheckoutInput,
} from "./orders.schemas.js";
import {
  guestCheckoutBodySchema,
  customerOrderCancelBodySchema,
  orderIdempotencyHeadersSchema,
} from "./orders.schemas.js";
import { PurchaseGuestAccessService } from "./purchase-guest-access.service.js";
import {
  purchaseQuoteAcceptSchema,
  purchaseQuoteParamsSchema,
} from "./purchase.schemas.js";
import { jsonSafe, orderFingerprint, page } from "./orders.types.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import { assertReviewedPurchaseFulfilment } from "./purchase-review-fulfilment.js";
import { lockPurchaseReviewOrder } from "./purchase-review.repository.js";
import {
  assertReviewCanChange,
  recordPurchaseRequirements,
  decidePurchaseReview,
  tryAutomaticPurchaseReview,
  tryAutomaticNewPurchase,
} from "./purchase-review.service.js";
import {
  purchaseReviewRequestSchema,
  purchaseReviewDecisionSchema,
} from "./purchase-review.schemas.js";

const transitions = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["READY", "CANCELLED"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
} as const;
const MAX_MONEY_KOBO = 9_000_000_000_000_000_000n;
const reference = (prefix: "ORD" | "INV") =>
  `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
function customerOrderView<T extends { invoice: null | { status: string } }>(order: T) {
  return { ...order, invoice: order.invoice?.status === "DRAFT" ? null : order.invoice };
}

type CheckoutBuyer =
  | { kind: "account"; actor: AuthenticatedActor }
  | {
      kind: "guest";
      sessionToken: string;
      csrfToken: string;
      contact: GuestCheckoutInput["contact"];
      items: GuestCheckoutInput["items"];
    };

export class OrdersService {
  private readonly repository: OrdersRepository;
  private readonly guestAccess: PurchaseGuestAccessService;
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly promotions: PromotionsService = promotionsService,
  ) {
    this.repository = new OrdersRepository(database);
    this.guestAccess = new PurchaseGuestAccessService(database);
  }

  async checkout(
    actor: AuthenticatedActor,
    input: CheckoutInput,
    rawKey: string,
    context: RequestSecurityContext,
    partsQuote?: { id: string; revision: number },
  ) {
    assertCustomer(actor);
    return this.checkoutBuyer(
      { kind: "account", actor },
      input,
      rawKey,
      context,
      partsQuote,
    );
  }

  async guestCheckout(
    credentials: { sessionToken: string; csrfToken: string },
    rawInput: unknown,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    orderIdempotencyHeadersSchema.parse({ "idempotency-key": rawKey });
    const { contact, items, ...input } = guestCheckoutBodySchema.parse(rawInput);
    return this.checkoutBuyer(
      {
        kind: "guest",
        ...credentials,
        contact,
        items: items.toSorted((a, b) => a.productId.localeCompare(b.productId)),
      },
      input,
      rawKey,
      context,
    );
  }

  async guestAcceptQuote(
    credentials: { sessionToken: string; csrfToken: string },
    id: string,
    rawInput: unknown,
    rawKey: string,
    context: RequestSecurityContext,
  ) {
    orderIdempotencyHeadersSchema.parse({ "idempotency-key": rawKey });
    purchaseQuoteParamsSchema.parse({ quoteId: id });
    const input = purchaseQuoteAcceptSchema.parse(rawInput);
    const access = await this.guestAccess.access(credentials.sessionToken, {
      kind: "write",
      csrfToken: credentials.csrfToken,
    });
    const quote = await this.database.partsQuote.findFirst({
      where: { id, guestEmail: access.email, enquiry: { customerId: null } },
      select: {
        productId: true,
        quantity: true,
        enquiry: { select: { branchId: true } },
      },
    });
    if (!quote?.enquiry.branchId) throw orderNotFound();
    // The shared engine rechecks this session and locks/revalidates the enquiry,
    // quote revision, branch and original receipt before creating an order.
    return this.checkoutBuyer(
      {
        kind: "guest",
        ...credentials,
        contact: input.contact,
        items: [{ productId: quote.productId, quantity: quote.quantity }],
      },
      { branchId: quote.enquiry.branchId, fulfillmentMethod: "COLLECTION" },
      rawKey,
      context,
      { id, revision: input.revision },
    );
  }

  async guestOrder(sessionToken: string, id: string) {
    if (env.PUBLIC_LAUNCH_MODE === "catalogue") throw orderForbidden();
    return this.database.$transaction(async (transaction) => {
      const access = await this.guestAccess.lockAccess(transaction, sessionToken, {
        kind: "read",
      });
      const order = await this.repository.guestOrder(id, access.guestId, transaction);
      if (!order) throw orderNotFound();
      const payment = await transaction.payment.findFirst({
        where: { orderId: order.id, customerId: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });
      return jsonSafe({ ...customerOrderView(order), paymentId: payment?.id ?? null });
    });
  }

  async guestOrders(sessionToken: string, query: CustomerOrderListQuery) {
    if (env.PUBLIC_LAUNCH_MODE === "catalogue") throw orderForbidden();
    return this.database.$transaction(async (tx) => {
      const access = await this.guestAccess.lockAccess(tx, sessionToken, {
        kind: "read",
      });
      if (
        query.cursor &&
        !(await this.repository.guestOrder(query.cursor, access.guestId, tx))
      )
        throw orderNotFound();
      const rows = await tx.order.findMany({
        where: {
          guestId: access.guestId,
          customerId: null,
          ...(query.status ? { status: query.status } : {}),
        },
        select: orderSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      return jsonSafe(page(rows.map(customerOrderView), query.limit));
    });
  }

  async guestOriginalCheckout(sessionToken: string, rawKey: string) {
    if (env.PUBLIC_LAUNCH_MODE === "catalogue") throw orderForbidden();
    orderIdempotencyHeadersSchema.parse({ "idempotency-key": rawKey });
    return this.database.$transaction(async (tx) => {
      const access = await this.guestAccess.lockAccess(tx, sessionToken, {
        kind: "read",
      });
      const receipt = await this.repository.idempotency(
        `guest-order-checkout:${access.guestId}`,
        hashToken("order-checkout-idempotency", `guest:${access.guestId}:${rawKey}`),
        tx,
      );
      const body = receipt?.responseBody;
      const orderId =
        body && typeof body === "object" && !Array.isArray(body)
          ? body["orderId"]
          : undefined;
      const order =
        receipt?.status === "COMPLETED" && typeof orderId === "string"
          ? await this.repository.guestOrder(orderId, access.guestId, tx)
          : null;
      // A missing receipt is a current observation, never proof a request failed.
      return jsonSafe({
        found: order !== null,
        order: order ? customerOrderView(order) : null,
      });
    });
  }

  private async checkoutBuyer(
    buyer: CheckoutBuyer,
    input: CheckoutInput,
    rawKey: string,
    context: RequestSecurityContext,
    partsQuote?: { id: string; revision: number },
  ) {
    if (!productPurchasesEnabled(env))
      throw orderConflict(
        "Online purchasing is not available. Contact the team about an enquiry.",
      );
    if (input.fulfillmentMethod !== "COLLECTION")
      throw orderConflict("Orders are collection only; delivery is unavailable");
    if (partsQuote && input.promotionCode !== undefined)
      throw orderConflict("A quoted total cannot be combined with another promotion");
    return withTransactionRetry(
      this.database,
      async (transaction) => {
        const guest =
          buyer.kind === "guest"
            ? await this.guestAccess.lockAccess(transaction, buyer.sessionToken, {
                kind: "write",
                csrfToken: buyer.csrfToken,
              })
            : null;
        let profile =
          buyer.kind === "account"
            ? await this.repository.customerProfile(buyer.actor.userId, transaction)
            : null;
        if (buyer.kind === "account" && !profile) throw orderNotFound();
        const actorUserId = buyer.kind === "account" ? buyer.actor.userId : null;
        const owner = {
          customerId: profile?.id ?? null,
          guestId: guest?.guestId ?? null,
        };
        const scope = guest
          ? `guest-order-checkout:${guest.guestId}`
          : `order-checkout:${actorUserId}`;
        const keyHash = hashToken(
          "order-checkout-idempotency",
          guest ? `guest:${guest.guestId}:${rawKey}` : rawKey,
        );
        const fingerprint = partsQuote ? { ...input, partsQuote } : input;
        const requestHash = orderFingerprint(
          buyer.kind === "guest"
            ? { ...fingerprint, contact: buyer.contact, items: buyer.items }
            : fingerprint,
        );
        const ownedOrder = (id: string) =>
          guest
            ? this.repository.guestOrder(id, guest.guestId, transaction)
            : this.repository.ownedOrder(id, profile!.id, transaction);
        const checkoutLockKey = `checkout:${keyHash}`;
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${checkoutLockKey}, 0))`;
        const existing = await this.repository.idempotency(scope, keyHash, transaction);
        if (existing !== null) {
          if (existing.requestHash !== requestHash) throw checkoutIdempotencyConflict();
          const orderId =
            existing.responseBody !== null &&
            typeof existing.responseBody === "object" &&
            !Array.isArray(existing.responseBody)
              ? (existing.responseBody as { orderId?: unknown }).orderId
              : undefined;
          if (existing.status !== "COMPLETED" || typeof orderId !== "string")
            throw orderConflict("Checkout is already in progress");
          const order = await ownedOrder(orderId);
          if (order === null) throw orderNotFound();
          return jsonSafe({ order: customerOrderView(order), replayed: true });
        }
        await this.repository.createIdempotency(
          actorUserId,
          scope,
          keyHash,
          requestHash,
          transaction,
        );
        let quote = partsQuote
          ? await transaction.partsQuote.findUnique({
              where: { id: partsQuote.id },
              include: { enquiry: true },
            })
          : null;
        if (partsQuote) {
          if (
            !quote ||
            (guest
              ? quote.enquiry.customerId !== null || quote.guestEmail !== guest.email
              : quote.enquiry.customerId !== profile!.id) ||
            quote.enquiry.branchId !== input.branchId
          )
            throw orderNotFound();
          await transaction.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id" = ${quote.enquiryId}::uuid FOR UPDATE`;
          await transaction.$queryRaw`SELECT "id" FROM "PartsQuote" WHERE "id" = ${quote.id}::uuid FOR UPDATE`;
          quote = await transaction.partsQuote.findUnique({
            where: { id: partsQuote.id },
            include: { enquiry: true },
          });
          if (
            !quote ||
            (guest
              ? quote.enquiry.customerId !== null || quote.guestEmail !== guest.email
              : quote.enquiry.customerId !== profile!.id) ||
            quote.enquiry.branchId !== input.branchId
          )
            throw orderNotFound();
          if (quote.revision !== partsQuote.revision) throw orderStale();
          if (quote.status === "ACCEPTED" && quote.orderId) {
            const saved = await ownedOrder(quote.orderId);
            if (!saved) throw orderNotFound();
            await this.repository.completeIdempotency(
              scope,
              keyHash,
              saved.id,
              transaction,
            );
            return jsonSafe({ order: customerOrderView(saved), replayed: true });
          }
          const quotedBranch =
            quote.policySnapshot &&
            typeof quote.policySnapshot === "object" &&
            !Array.isArray(quote.policySnapshot)
              ? quote.policySnapshot["branchId"]
              : undefined;
          if (quotedBranch !== input.branchId)
            throw orderConflict(
              "The collection branch changed. Request a revised quotation before accepting.",
            );
          if (quote.status !== "ISSUED" || quote.expiresAt <= new Date())
            throw orderConflict(
              "This quotation has expired, was declined or has been replaced. Request an updated quotation.",
            );
        } else if (buyer.kind === "account") {
          if (!profile?.cart) throw orderConflict("Cart is empty");
          await this.repository.lockCart(profile.cart.id, transaction);
          profile = await this.repository.customerProfile(
            buyer.actor.userId,
            transaction,
          );
          if (!profile?.cart || !profile.cart.items.length)
            throw orderConflict("Cart is empty");
        }
        if ((await this.repository.branch(input.branchId, transaction)) === null)
          throw orderNotFound();
        const sourceItems = quote
          ? [{ productId: quote.productId, quantity: quote.quantity }]
          : buyer.kind === "guest"
            ? buyer.items
            : profile!.cart!.items;
        const contact =
          guest && buyer.kind === "guest"
            ? { name: buyer.contact.name, email: guest.email, phone: buyer.contact.phone }
            : {
                name: `${profile!.firstName} ${profile!.lastName}`,
                email: profile!.user.email,
                phone: profile!.phone,
              };
        const productIds = [...new Set(sourceItems.map((item) => item.productId))].sort(
          (a, b) => a.localeCompare(b),
        );
        const inventories = quote
          ? []
          : await this.repository.lockInventories(
              input.branchId,
              productIds,
              transaction,
            );
        if (!quote && inventories.length !== productIds.length)
          throw checkoutStockUnavailable();
        const cartByProduct = new Map(
          sourceItems.map((item) => [item.productId, item.quantity]),
        );
        for (const inventory of inventories) {
          const quantity = cartByProduct.get(inventory.productId);
          if (
            quantity === undefined ||
            !inventory.product.isActive ||
            !inventory.product.category.isActive ||
            (inventory.product.category.parentId !== null &&
              inventory.product.category.parent?.isActive !== true) ||
            !inventory.branch.isActive ||
            inventory.product.currency !== "NGN" ||
            inventory.quantity - inventory.reserved < quantity
          )
            throw checkoutStockUnavailable();
        }
        if (quote) {
          const product = await transaction.product.findUnique({
            where: { id: quote.productId },
            include: { category: { include: { parent: true } } },
          });
          if (
            !product?.isActive ||
            product.currency !== "NGN" ||
            !product.category.isActive ||
            (product.category.parentId && !product.category.parent?.isActive)
          )
            throw orderConflict(
              "The quoted product is no longer available for ordering. Request a revised quotation.",
            );
        }
        const items = quote
          ? [
              {
                productId: quote.productId,
                productName: quote.productName,
                sku: quote.sku,
                unitPriceKobo: quote.unitPriceKobo,
                quantity: quote.quantity,
                subtotalKobo: quote.subtotalKobo,
              },
            ]
          : inventories.map((inventory) => {
              const quantity = cartByProduct.get(inventory.productId)!;
              return {
                productId: inventory.productId,
                productName: inventory.product.name,
                sku: inventory.product.sku,
                unitPriceKobo: inventory.product.priceKobo,
                quantity,
                subtotalKobo: inventory.product.priceKobo * BigInt(quantity),
              };
            });
        if (items.some((item) => item.subtotalKobo > MAX_MONEY_KOBO))
          throw orderConflict("Order amount exceeds the supported limit");
        const subtotalKobo = items.reduce((sum, item) => sum + item.subtotalKobo, 0n);
        if (subtotalKobo > MAX_MONEY_KOBO)
          throw orderConflict("Order amount exceeds the supported limit");
        const evaluation =
          input.promotionCode === undefined
            ? null
            : await this.promotions.lockAndEvaluate(
                guest ? { guestId: guest.guestId } : profile!.id,
                input.promotionCode,
                subtotalKobo,
                transaction,
              );
        const finance = await assertFinanceGate(transaction);
        const timing = await currentPolicy(transaction, "order-payment");
        const discountAmountKobo = evaluation?.discountAmountKobo ?? 0n;
        const deliveryFeeKobo = 0n;
        const taxableDeliveryKobo = 0n;
        const deliverySnapshot: Prisma.InputJsonObject = {
          method: "COLLECTION",
          address:
            "133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria",
        };
        const { taxKobo } = draftTotals(
          subtotalKobo + taxableDeliveryKobo,
          discountAmountKobo,
        );
        const totalKobo = subtotalKobo - discountAmountKobo + deliveryFeeKobo + taxKobo;
        if (quote && (totalKobo !== quote.totalKobo || taxKobo !== quote.taxKobo))
          throw orderConflict(
            "The quotation needs revision before checkout because its financial terms changed",
          );
        if (totalKobo > MAX_MONEY_KOBO)
          throw orderConflict("Order amount exceeds the supported limit");
        const orderId = randomUUID();
        await this.repository.createOrder(
          {
            id: orderId,
            ...owner,
            branchId: input.branchId,
            orderNumber: reference("ORD"),
            fulfillmentMethod: input.fulfillmentMethod,
            currency: "NGN",
            subtotalKobo,
            discountAmountKobo,
            deliveryFeeKobo,
            taxKobo,
            totalKobo,
            policySnapshot: {
              purchaseWorkflow: { version: 2, sequence: "FINAL_REVIEW_BEFORE_PAYMENT" },
              finance: policySnapshot(finance),
              payment: policySnapshot(timing),
              fulfillment: deliverySnapshot,
              ...(quote
                ? {
                    partsQuote: {
                      id: quote.id,
                      enquiryId: quote.enquiryId,
                      revision: quote.revision,
                      notes: quote.notes,
                      finance: quote.policySnapshot,
                    },
                  }
                : {}),
            },
            customerName: contact.name,
            customerEmail: contact.email,
            customerPhone: contact.phone,
            paymentDueAt: null,
            items: { createMany: { data: items } },
          },
          transaction,
        );
        if (evaluation !== null)
          await this.promotions.repository.createUsage(evaluation, orderId, transaction);
        await transaction.invoice.create({
          data: {
            invoiceNumber: reference("INV"),
            ...owner,
            orderId,
            currency: "NGN",
            subtotalKobo: totalKobo - taxKobo,
            taxKobo,
            policySnapshot: policySnapshot(finance),
            totalKobo,
            documentSnapshot: await buildInvoiceSnapshot(transaction, {
              ...owner,
              orderId,
              subtotalKobo: totalKobo - taxKobo,
              taxKobo,
              totalKobo,
              policySnapshot: policySnapshot(finance),
            }),
          },
          select: { id: true },
        });
        if (quote) {
          await transaction.partsQuote.update({
            where: { id: quote.id },
            data: { status: "ACCEPTED", orderId, decidedAt: new Date() },
          });
          await appendAuditEvent(transaction, {
            actorUserId,
            action: "STATUS_CHANGE",
            entityType: "ENQUIRY",
            entityId: quote.enquiryId,
            newValues: { status: "ACCEPTED", orderId, revision: quote.revision },
            context,
          });
        } else if (buyer.kind === "account")
          await transaction.cartItem.deleteMany({ where: { cartId: profile!.cart!.id } });
        await appendAuditEvent(transaction, {
          actorUserId,
          action: "CREATE",
          entityType: "ORDER",
          entityId: orderId,
          newValues: {
            status: "PENDING",
            branchId: input.branchId,
            itemCount: items.length,
            totalKobo: totalKobo.toString(),
            promotionId: evaluation?.promotion.id ?? null,
            ...(guest
              ? { guestId: guest.guestId, purchaseAccess: "EMAIL_VERIFIED_GUEST" }
              : {}),
          },
          context,
        });
        await tryAutomaticNewPurchase(transaction, orderId, actorUserId, context);
        await this.repository.completeIdempotency(scope, keyHash, orderId, transaction);
        const order = await ownedOrder(orderId);
        if (order === null) throw orderNotFound();
        return jsonSafe({ order: customerOrderView(order), replayed: false });
      },
      { isolationLevel: "Serializable" },
    );
  }

  async customerOrders(actor: AuthenticatedActor, query: CustomerOrderListQuery) {
    assertCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (profile === null) throw orderNotFound();
    const result = page(
      await this.repository.listCustomer(profile.id, query),
      query.limit,
    );
    return jsonSafe({ ...result, items: result.items.map(customerOrderView) });
  }
  async customerRequestPurchaseReview(
    actor: AuthenticatedActor,
    id: string,
    raw: unknown,
    context: RequestSecurityContext,
  ) {
    assertCustomer(actor);
    const input = purchaseReviewRequestSchema.parse(raw);
    if (!productPurchasesEnabled(env))
      throw orderConflict(
        "Online purchasing is not available. Contact the team about an enquiry.",
      );
    await withTransactionRetry(
      this.database,
      async (tx) => {
        const profile = await this.repository.customerProfile(actor.userId, tx);
        const order = await lockPurchaseReviewOrder(tx, id);
        if (!profile || order.customerId !== profile.id || order.guestId !== null)
          throw orderNotFound();
        await assertReviewCanChange(tx, order);
        await this.releaseOrRestock(actor.userId, id, "PENDING", tx);
        await recordPurchaseRequirements(tx, order, input, actor.userId, context);
        await tryAutomaticPurchaseReview(tx, id, context);
      },
      { isolationLevel: "Serializable" },
    );
    return this.customerOrder(actor, id);
  }
  async guestRequestPurchaseReview(
    credentials: { sessionToken: string; csrfToken: string },
    id: string,
    raw: unknown,
    context: RequestSecurityContext,
  ) {
    const input = purchaseReviewRequestSchema.parse(raw);
    if (!productPurchasesEnabled(env))
      throw orderConflict(
        "Online purchasing is not available. Contact the team about an enquiry.",
      );
    await withTransactionRetry(
      this.database,
      async (tx) => {
        const access = await this.guestAccess.lockAccess(tx, credentials.sessionToken, {
          kind: "write",
          csrfToken: credentials.csrfToken,
        });
        const order = await lockPurchaseReviewOrder(tx, id);
        if (order.guestId !== access.guestId || order.customerId !== null)
          throw orderNotFound();
        await assertReviewCanChange(tx, order);
        await this.releaseOrRestock(null, id, "PENDING", tx);
        await recordPurchaseRequirements(tx, order, input, null, context);
        await tryAutomaticPurchaseReview(tx, id, context);
      },
      { isolationLevel: "Serializable" },
    );
    return this.guestOrder(credentials.sessionToken, id);
  }
  async decidePurchaseReview(
    actor: AuthenticatedActor,
    id: string,
    raw: unknown,
    context: RequestSecurityContext,
  ) {
    assertOrderOperator(actor);
    if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") throw orderForbidden();
    const input = purchaseReviewDecisionSchema.parse(raw);
    await withTransactionRetry(
      this.database,
      async (tx) => {
        await lockAccessActor(tx, actor);
        const order = await lockPurchaseReviewOrder(tx, id);
        await this.assertBranch(actor, order.branchId, tx);
        await decidePurchaseReview(tx, order, input, actor.userId, context);
      },
      { isolationLevel: "Serializable" },
    );
    return this.staffOrder(actor, id, context);
  }
  async customerOrder(actor: AuthenticatedActor, id: string) {
    assertCustomer(actor);
    const profile = await this.repository.customerProfile(actor.userId);
    if (profile === null) throw orderNotFound();
    const order = await this.repository.ownedOrder(id, profile.id);
    if (order === null) throw orderNotFound();
    return jsonSafe(customerOrderView(order));
  }
  async staffOrders(actor: AuthenticatedActor, query: StaffOrderListQuery) {
    assertOrderOperator(actor);
    const branchId = await this.allowedBranch(actor);
    return jsonSafe(
      page(
        await this.repository.listStaff(
          query,
          branchId,
          actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
        ),
        query.limit,
      ),
    );
  }
  async staffOrder(
    actor: AuthenticatedActor,
    id: string,
    context: RequestSecurityContext,
  ) {
    assertOrderOperator(actor);
    const order = await this.repository.staffOrder(
      id,
      actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
    );
    if (order === null) throw orderNotFound();
    await this.assertBranch(actor, order.branch?.id ?? null);
    await this.database.$transaction((transaction) =>
      appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "ORDER",
        entityId: id,
        newValues: { privilegedRead: true },
        context,
      }),
    );
    return jsonSafe({
      ...order,
      allowedTransitions: await this.allowedTransitions(order),
      ...(actor.role === "ADMIN" || actor.role === "SUPER_ADMIN"
        ? {
            paymentReferences: await this.database.payment.findMany({
              where: { orderId: id },
              select: { id: true, paymentNumber: true, status: true },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 25,
            }),
          }
        : {}),
    });
  }
  async guestCancel(
    credentials: { sessionToken: string; csrfToken: string },
    id: string,
    rawInput: unknown,
    key: string,
    context: RequestSecurityContext,
  ) {
    if (env.PUBLIC_LAUNCH_MODE === "catalogue") throw orderForbidden();
    const input = customerOrderCancelBodySchema.parse(rawInput);
    const receipt = await withTransactionRetry(this.database, async (tx) => {
      const guest = await this.guestAccess.lockAccess(tx, credentials.sessionToken, {
        kind: "write",
        csrfToken: credentials.csrfToken,
      });
      const order = await this.repository.lockOrder(id, tx);
      if (!order || order.guestId !== guest.guestId || order.customerId !== null)
        throw orderNotFound();
      return aftercareReceipt(
        tx,
        null,
        `guest-cancel:${id}:${guest.guestId}`,
        key,
        input,
        async () => {
          if (order.status !== "CANCELLED") {
            if (order.status !== "PENDING" || order.confirmedAt !== null)
              throw orderConflict(
                "This order now needs a cancellation request for staff review. Refresh its details before continuing.",
              );
            if (order.version !== input.expectedVersion) throw orderStale();
            await this.cancelLocked(
              null,
              order,
              input.expectedVersion,
              input.reason,
              tx,
              context,
              guest.guestId,
            );
            if (order.paidAt)
              await tx.operationalAlert.upsert({
                where: { key: `guest-cancellation-refund:${id}` },
                update: {},
                create: {
                  key: `guest-cancellation-refund:${id}`,
                  category: "GUEST_ORDER_REFUND_REVIEW",
                  resourceId: id,
                  message:
                    "A cancelled guest order has a verified payment. Review its payments and request the full remaining pre-confirmation refund for separate approval. Cancellation does not confirm a refund.",
                },
              });
          }
          return { id };
        },
        (savedId) =>
          tx.order.findFirst({
            where: { id: savedId, guestId: guest.guestId, customerId: null },
            select: { id: true },
          }),
      );
    });
    return {
      order: await this.guestOrder(credentials.sessionToken, id),
      replayed: receipt.replayed,
    };
  }
  async customerCancel(
    actor: AuthenticatedActor,
    id: string,
    input: CustomerOrderCancelInput,
    context: RequestSecurityContext,
  ) {
    assertCustomer(actor);
    const cancellationRequest = await withTransactionRetry(
      this.database,
      async (transaction) => {
        const profile = await transaction.customerProfile.findUnique({
          where: { userId: actor.userId },
          select: { id: true },
        });
        const order = await this.repository.lockOrder(id, transaction);
        if (
          profile === null ||
          order === null ||
          (await transaction.order.count({ where: { id, customerId: profile.id } })) !== 1
        )
          throw orderNotFound();
        if (order.status === "CANCELLED") return null;
        if (order.status !== "PENDING")
          return requestAftercare(
            transaction,
            actor,
            id,
            "CANCELLATION",
            input.reason,
            context,
          );
        await this.cancelLocked(
          actor,
          order,
          input.expectedVersion,
          input.reason,
          transaction,
          context,
        );
        return null;
      },
    );
    const updated = await this.repository.order(id);
    if (updated === null) throw orderNotFound();
    if (updated.status === "CANCELLED" && updated.confirmedAt === null)
      await this.database.$transaction((tx) =>
        requestFreeCancellationRefund(tx, id, actor.userId),
      );
    return jsonSafe({
      ...updated,
      ...(cancellationRequest
        ? { cancellationRequest: customerAftercareView(cancellationRequest) }
        : {}),
    });
  }
  async transition(
    actor: AuthenticatedActor,
    id: string,
    input: OrderTransitionInput,
    context: RequestSecurityContext,
  ) {
    assertOrderOperator(actor);
    await withTransactionRetry(
      this.database,
      async (transaction) => {
        const order = await this.repository.lockOrder(id, transaction);
        if (order === null) throw orderNotFound();
        await this.assertBranch(actor, order.branchId, transaction);
        if (!(transitions[order.status] as readonly string[]).includes(input.status))
          throw invalidOrderTransition();
        if (input.status === "CANCELLED") {
          if (
            order.status !== "PENDING" &&
            !(await transaction.orderAftercareRequest.findFirst({
              where: { orderId: id, kind: "CANCELLATION", status: "APPROVED" },
            }))
          )
            throw orderConflict(
              "Cancellation after confirmation requires a reviewed request and fee basis",
            );
          if (input.reason === undefined)
            throw orderConflict("A cancellation reason is required");
          await this.cancelLocked(
            actor,
            order,
            input.expectedVersion,
            input.reason,
            transaction,
            context,
          );
          return;
        }
        if (order.paidAt === null)
          throw orderConflict(
            "Verified payment is required before confirming or fulfilling an order",
          );
        const purchaseReview = await assertReviewedPurchaseFulfilment(transaction, id);
        if (input.status === "CONFIRMED") {
          const quote = await transaction.partsQuote.findUnique({
            where: { orderId: order.id },
            include: { enquiry: { select: { customerId: true } } },
          });
          const activeHolds = await transaction.inventoryReservation.count({
            where: {
              referenceType: "ORDER",
              referenceId: order.id,
              status: "ACTIVE",
            },
          });
          if (quote && activeHolds === 0) {
            if (!input.reason || input.reason.trim().length < 10)
              throw orderConflict(
                purchaseReview.legacy
                  ? "Record the fulfilment assessment for this historical paid quotation. This is not a backdated pre-payment review."
                  : "Record the received part and current stock check before allocating this sourced order",
              );
            const buyerMatches = order.guestId
              ? quote.enquiry.customerId === null &&
                quote.guestEmail === order.customerEmail
              : quote.enquiry.customerId === order.customerId &&
                quote.guestEmail === null;
            if (!order.branchId || !buyerMatches)
              throw orderConflict(
                "The quoted order has no valid collection branch or matching buyer",
              );
            const inventory = (
              await this.repository.lockInventories(
                order.branchId,
                [quote.productId],
                transaction,
              )
            )[0];
            if (
              !inventory ||
              inventory.quantity - inventory.reserved < quote.quantity ||
              !inventory.product.isActive ||
              !inventory.branch.isActive
            )
              throw checkoutStockUnavailable();
            const nextReserved = inventory.reserved + quote.quantity;
            if (
              (
                await this.repository.updateInventory(
                  inventory.id,
                  inventory.version,
                  inventory.quantity,
                  nextReserved,
                  transaction,
                )
              ).count !== 1
            )
              throw orderStale();
            const key = hashToken(
              "order-reservation",
              `quoted:${order.id}:${inventory.id}`,
            );
            const fingerprint = orderFingerprint({
              orderId: order.id,
              quoteId: quote.id,
              quantity: quote.quantity,
            });
            await transaction.inventoryReservation.create({
              data: {
                inventoryId: inventory.id,
                customerId: order.customerId,
                quantity: quote.quantity,
                expiresAt: new Date(Date.now() + 3600000),
                idempotencyKey: key,
                requestHash: fingerprint,
                referenceType: "ORDER",
                referenceId: order.id,
              },
            });
            await transaction.inventoryTransaction.create({
              data: {
                inventoryId: inventory.id,
                performedById: actor.userId,
                type: "RESERVATION",
                quantityDelta: 0,
                reservedDelta: quote.quantity,
                quantityBefore: inventory.quantity,
                quantityAfter: inventory.quantity,
                reservedBefore: inventory.reserved,
                reservedAfter: nextReserved,
                idempotencyKey: hashToken("order-inventory", `${key}:reserve`),
                requestHash: fingerprint,
                referenceType: "ORDER",
                referenceId: order.id,
              },
            });
            await appendAuditEvent(transaction, {
              actorUserId: actor.userId,
              action: "UPDATE",
              entityType: "ORDER",
              entityId: order.id,
              newValues: {
                quoteId: quote.id,
                finalCompatibilityAndAvailabilityReview: input.reason.trim(),
              },
              context,
            });
          }
          await this.consumeReservations(actor.userId, order.id, transaction);
        }
        const now = new Date();
        const result = await this.repository.updateOrder(
          id,
          input.expectedVersion,
          [order.status],
          {
            status: input.status,
            ...(input.status === "CONFIRMED" ? { confirmedAt: now } : {}),
            ...(input.status === "PROCESSING" ? { processingAt: now } : {}),
            ...(input.status === "READY" ? { readyAt: now } : {}),
            ...(input.status === "COMPLETED" ? { completedAt: now } : {}),
          },
          transaction,
        );
        if (result.count !== 1) throw orderStale();
        await appendAuditEvent(transaction, {
          actorUserId: actor.userId,
          action: "STATUS_CHANGE",
          entityType: "ORDER",
          entityId: id,
          oldValues: { status: order.status, version: order.version },
          newValues: { status: input.status, version: input.expectedVersion + 1 },
          context,
        });
      },
      { isolationLevel: "Serializable" },
    );
    const updated = await this.repository.staffOrder(
      id,
      actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
    );
    if (updated === null) throw orderNotFound();
    return jsonSafe({
      ...updated,
      allowedTransitions: await this.allowedTransitions(updated),
    });
  }
  private async allowedTransitions(order: {
    id: string;
    status: keyof typeof transitions;
    paidAt: Date | null;
  }) {
    const cancellationAllowed =
      order.status === "PENDING" ||
      ((order.status === "CONFIRMED" || order.status === "PROCESSING") &&
        (await this.database.orderAftercareRequest.findFirst({
          where: { orderId: order.id, kind: "CANCELLATION", status: "APPROVED" },
          select: { id: true },
        })) !== null);
    return (transitions[order.status] as readonly string[]).filter((status) =>
      status === "CANCELLED" ? cancellationAllowed : order.paidAt !== null,
    );
  }
  async expireDue(
    actor: AuthenticatedActor,
    input: ExpireOrdersInput,
    context: RequestSecurityContext,
  ) {
    assertOrderOperator(actor);
    if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") throw orderForbidden();
    return this.expireEligibleOrders(input.limit, actor, context);
  }

  async expireDueSystem(limit: number) {
    return this.expireEligibleOrders(limit, null);
  }

  private async expireEligibleOrders(
    limit: number,
    actor: AuthenticatedActor | null,
    context?: RequestSecurityContext,
  ) {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const candidates = await this.repository.dueOrderIds(boundedLimit);
    let expired = 0;
    for (const candidate of candidates) {
      await withTransactionRetry(this.database, async (transaction) => {
        const order = await this.repository.lockOrder(candidate.id, transaction);
        if (
          order?.status !== "PENDING" ||
          order.paymentDueAt === null ||
          order.paymentDueAt > new Date()
        )
          return;
        if (order.paidAt !== null) return;
        await this.cancelLocked(
          actor,
          order,
          order.version,
          "PAYMENT_WINDOW_EXPIRED",
          transaction,
          context ?? {
            requestId: `worker:order-expiry:${order.id}`,
            ipAddress: null,
            userAgent: null,
          },
        );
        expired += 1;
      });
    }
    return { expired };
  }

  private async allowedBranch(
    actor: AuthenticatedActor,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    if (actor.role !== "STAFF") return null;
    const profile = await this.repository.staffBranch(actor.userId, client);
    if (profile?.branchId == null || profile.branch?.isActive !== true)
      throw orderForbidden();
    return profile.branchId;
  }
  private async assertBranch(
    actor: AuthenticatedActor,
    branchId: string | null,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    const allowed = await this.allowedBranch(actor, client);
    if (actor.role === "STAFF" && (allowed === null || branchId !== allowed))
      throw orderForbidden();
  }
  private async consumeReservations(
    userId: string,
    orderId: string,
    transaction: Prisma.TransactionClient,
  ) {
    const reservations = await this.repository.reservations(
      orderId,
      ["ACTIVE"],
      transaction,
    );
    if (reservations.length === 0) throw checkoutStockUnavailable();
    const inventories = await this.repository.lockInventoryIds(
      reservations.map(({ inventoryId }) => inventoryId),
      transaction,
    );
    const inventoryById = new Map(inventories.map((item) => [item.id, item]));
    const now = new Date();
    for (const reservation of reservations) {
      const inventory = inventoryById.get(reservation.inventoryId);
      if (
        inventory === undefined ||
        inventory.quantity < reservation.quantity ||
        inventory.reserved < reservation.quantity
      )
        throw checkoutStockUnavailable();
      const nextQuantity = inventory.quantity - reservation.quantity;
      const nextReserved = inventory.reserved - reservation.quantity;
      if (
        (
          await this.repository.updateInventory(
            inventory.id,
            inventory.version,
            nextQuantity,
            nextReserved,
            transaction,
          )
        ).count !== 1 ||
        (
          await this.repository.transitionReservation(
            reservation.id,
            "ACTIVE",
            "CONSUMED",
            now,
            transaction,
          )
        ).count !== 1
      )
        throw orderStale();
      await transaction.inventoryTransaction.create({
        data: {
          inventoryId: inventory.id,
          performedById: userId,
          type: "SALE",
          quantityDelta: -reservation.quantity,
          reservedDelta: -reservation.quantity,
          quantityBefore: inventory.quantity,
          quantityAfter: nextQuantity,
          reservedBefore: inventory.reserved,
          reservedAfter: nextReserved,
          idempotencyKey: hashToken(
            "order-inventory",
            `${orderId}:${reservation.id}:consume`,
          ),
          requestHash: orderFingerprint({
            orderId,
            reservationId: reservation.id,
            operation: "consume",
          }),
          referenceType: "ORDER",
          referenceId: orderId,
        },
      });
    }
  }
  private async releaseOrRestock(
    userId: string | null,
    orderId: string,
    orderStatus: string,
    transaction: Prisma.TransactionClient,
  ) {
    const statuses: Array<"ACTIVE" | "CONSUMED"> =
      orderStatus === "PENDING" ? ["ACTIVE"] : ["CONSUMED"];
    const reservations = await this.repository.reservations(
      orderId,
      statuses,
      transaction,
    );
    const inventories = await this.repository.lockInventoryBalances(
      reservations.map(({ inventoryId }) => inventoryId),
      transaction,
    );
    const inventoryById = new Map(inventories.map((item) => [item.id, item]));
    const now = new Date();
    for (const reservation of reservations) {
      const inventory = inventoryById.get(reservation.inventoryId);
      if (inventory === undefined) throw orderNotFound();
      if (reservation.status === "ACTIVE") {
        const nextReserved = inventory.reserved - reservation.quantity;
        if (
          nextReserved < 0 ||
          (
            await this.repository.updateInventory(
              inventory.id,
              inventory.version,
              inventory.quantity,
              nextReserved,
              transaction,
            )
          ).count !== 1 ||
          (
            await this.repository.transitionReservation(
              reservation.id,
              "ACTIVE",
              "RELEASED",
              now,
              transaction,
            )
          ).count !== 1
        )
          throw orderStale();
        await transaction.inventoryTransaction.create({
          data: {
            inventoryId: inventory.id,
            performedById: userId,
            type: "RESERVATION_RELEASE",
            quantityDelta: 0,
            reservedDelta: -reservation.quantity,
            quantityBefore: inventory.quantity,
            quantityAfter: inventory.quantity,
            reservedBefore: inventory.reserved,
            reservedAfter: nextReserved,
            idempotencyKey: hashToken(
              "order-inventory",
              `${orderId}:${reservation.id}:release`,
            ),
            requestHash: orderFingerprint({
              orderId,
              reservationId: reservation.id,
              operation: "release",
            }),
            referenceType: "ORDER",
            referenceId: orderId,
          },
        });
      } else {
        const nextQuantity = inventory.quantity + reservation.quantity;
        if (
          (
            await this.repository.updateInventory(
              inventory.id,
              inventory.version,
              nextQuantity,
              inventory.reserved,
              transaction,
            )
          ).count !== 1
        )
          throw orderStale();
        await transaction.inventoryTransaction.create({
          data: {
            inventoryId: inventory.id,
            performedById: userId,
            type: "RESTOCK",
            quantityDelta: reservation.quantity,
            reservedDelta: 0,
            quantityBefore: inventory.quantity,
            quantityAfter: nextQuantity,
            reservedBefore: inventory.reserved,
            reservedAfter: inventory.reserved,
            idempotencyKey: hashToken(
              "order-inventory",
              `${orderId}:${reservation.id}:restock`,
            ),
            requestHash: orderFingerprint({
              orderId,
              reservationId: reservation.id,
              operation: "restock",
            }),
            referenceType: "ORDER",
            referenceId: orderId,
          },
        });
      }
    }
  }
  private async cancelLocked(
    actor: AuthenticatedActor | null,
    order: NonNullable<Awaited<ReturnType<OrdersRepository["lockOrder"]>>>,
    expectedVersion: number,
    reason: string,
    transaction: Prisma.TransactionClient,
    context: RequestSecurityContext,
    guestId?: string,
  ) {
    if (!(["PENDING", "CONFIRMED", "PROCESSING"] as string[]).includes(order.status))
      throw invalidOrderTransition();
    if (order.status !== "PROCESSING")
      await this.releaseOrRestock(
        actor?.userId ?? null,
        order.id,
        order.status,
        transaction,
      );
    const now = new Date();
    const result = await this.repository.updateOrder(
      order.id,
      expectedVersion,
      [order.status],
      { status: "CANCELLED", cancellationReason: reason, cancelledAt: now },
      transaction,
    );
    if (result.count !== 1) throw orderStale();
    await transaction.invoice.updateMany({
      where: { orderId: order.id, status: { in: ["DRAFT", "ISSUED"] } },
      data: { status: "VOID", voidedAt: now, version: { increment: 1 } },
    });
    await appendAuditEvent(transaction, {
      actorUserId: actor?.userId ?? null,
      action: "STATUS_CHANGE",
      entityType: "ORDER",
      entityId: order.id,
      oldValues: { status: order.status, version: order.version },
      newValues: {
        status: "CANCELLED",
        version: expectedVersion + 1,
        reason,
        ...(guestId ? { guestId, purchaseAccess: "EMAIL_VERIFIED_GUEST" } : {}),
      },
      context,
    });
  }
}

export const ordersService = new OrdersService();
