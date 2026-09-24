import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCustomer, requireStaff } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import { prisma } from "../../config/database.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { paymentConflict, paymentNotFound } from "../payments/payments.errors.js";
import { assertCapability } from "./policies.service.js";

export const intake = z
  .object({
    kind: z.enum(["ANONYMIZATION", "DELETION"]),
    reason: z.string().trim().min(10).max(2000),
  })
  .strict();
export const review = z
  .object({
    status: z.enum(["UNDER_REVIEW", "ON_HOLD", "APPROVED_PENDING_POLICY", "REJECTED"]),
    note: z.string().trim().min(10).max(2000),
    expectedReviewedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .strict();
export const hold = z
  .object({
    userId: z.uuid(),
    recordType: z.enum(["ALL", "ACCOUNT", "PAYMENT", "INVOICE", "AUDIT", "SUPPORT"]),
    recordId: z.uuid().optional(),
    reason: z.string().trim().min(10).max(2000),
  })
  .strict();
export const privacyPageQuery = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const holdQuery = z.object({ userId: z.uuid() }).strict();
export const releaseHold = z
  .object({ reason: z.string().trim().min(20).max(2000) })
  .strict();
const customerPrivacySelect = {
  id: true,
  userId: true,
  kind: true,
  reason: true,
  status: true,
  createdAt: true,
  reviewedAt: true,
  reviewNote: true,
} as const;

export function createPrivacyRouter() {
  const router = Router();
  router.get(
    "/staff/privacy-requests",
    authenticate(),
    requireStaff,
    validate({ query: privacyPageQuery }),
    async (req, res) => {
      await assertCapability(prisma, req.actor!, "PRIVACY_REVIEW");
      const query = res.locals.validated!["query"] as z.infer<typeof privacyPageQuery>;
      const items = await prisma.privacyRequest.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      res.json(
        successResponse("Privacy review queue", req.id, {
          items: items.slice(0, query.limit),
          nextCursor: items.length > query.limit ? items[query.limit - 1]!.id : null,
        }),
      );
    },
  );
  router.get(
    "/staff/retention-holds",
    authenticate(),
    requireStaff,
    validate({ query: holdQuery }),
    async (req, res) => {
      await assertCapability(prisma, req.actor!, "PRIVACY_REVIEW");
      const { userId } = res.locals.validated!["query"] as z.infer<typeof holdQuery>;
      res.json(
        successResponse(
          "Retention holds",
          req.id,
          await prisma.retentionHold.findMany({
            where: { userId },
            take: 100,
            orderBy: { createdAt: "desc" },
          }),
        ),
      );
    },
  );
  router.post(
    "/staff/retention-holds/:id/release",
    authenticate(),
    requireStaff,
    requireCsrf,
    validate({ params: z.object({ id: z.uuid() }), body: releaseHold }),
    async (req, res) => {
      const { id } = res.locals.validated!["params"] as { id: string };
      const { reason } = res.locals.validated!["body"] as z.infer<typeof releaseHold>;
      await prisma.$transaction(async (tx) => {
        await assertCapability(tx, req.actor!, "PRIVACY_REVIEW");
        const record = await tx.retentionHold.findUnique({ where: { id } });
        if (!record) throw paymentNotFound();
        await tx.retentionHold.updateMany({
          where: { id, releasedAt: null },
          data: { releasedAt: new Date(), releasedByUserId: req.actor!.userId },
        });
        await appendAuditEvent(tx, {
          actorUserId: req.actor!.userId,
          action: "UPDATE",
          entityType: "USER",
          entityId: record.userId,
          newValues: { releasedHoldId: id, reason },
          context: {
            requestId: String(req.id),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
          },
        });
      });
      res.json(
        successResponse("Hold released; no destructive action scheduled", req.id, { id }),
      );
    },
  );
  router.get(
    "/customers/privacy-requests",
    authenticate(),
    requireCustomer,
    validate({ query: privacyPageQuery }),
    async (req, res) => {
      const query = res.locals.validated!["query"] as z.infer<typeof privacyPageQuery>;
      const items = await prisma.privacyRequest.findMany({
        where: { userId: req.actor!.userId },
        select: customerPrivacySelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      res.json(
        successResponse("Privacy requests", req.id, {
          items: items.slice(0, query.limit),
          nextCursor: items.length > query.limit ? items[query.limit - 1]!.id : null,
        }),
      );
    },
  );
  router.post(
    "/customers/privacy-requests",
    authenticate(),
    requireCustomer,
    requireCsrf,
    validate({ body: intake }),
    async (req, res) => {
      const input = res.locals.validated!["body"] as z.infer<typeof intake>;
      const result = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`privacy:${req.actor!.userId}`}, 0))`;
        const existing = await tx.privacyRequest.findFirst({
          select: customerPrivacySelect,
          where: {
            userId: req.actor!.userId,
            kind: input.kind,
            status: { not: "REJECTED" },
          },
        });
        if (existing) return existing;
        const record = await tx.privacyRequest.create({
          data: { userId: req.actor!.userId, ...input },
          select: customerPrivacySelect,
        });
        await appendAuditEvent(tx, {
          actorUserId: req.actor!.userId,
          action: "CREATE",
          entityType: "USER",
          entityId: req.actor!.userId,
          newValues: { privacyRequestId: record.id, kind: input.kind },
          context: {
            requestId: String(req.id),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
          },
        });
        return record;
      });
      res
        .status(201)
        .json(
          successResponse(
            "Privacy request received for review; no deletion scheduled",
            req.id,
            result,
          ),
        );
    },
  );
  router.post(
    "/staff/privacy-requests/:id/review",
    authenticate(),
    requireStaff,
    requireCsrf,
    validate({ params: z.object({ id: z.uuid() }), body: review }),
    async (req, res) => {
      const id = (res.locals.validated!["params"] as { id: string }).id;
      const input = res.locals.validated!["body"] as z.infer<typeof review>;
      const result = await prisma.$transaction(async (tx) => {
        await assertCapability(tx, req.actor!, "PRIVACY_REVIEW");
        await tx.$queryRaw`SELECT "id" FROM "PrivacyRequest" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const current = await tx.privacyRequest.findUnique({ where: { id } });
        if (!current) throw paymentNotFound();
        if (
          input.expectedReviewedAt !== undefined &&
          (current.reviewedAt?.getTime() ?? null) !==
            (input.expectedReviewedAt === null
              ? null
              : Date.parse(input.expectedReviewedAt))
        )
          throw paymentConflict(
            "Privacy review changed; refresh before submitting another decision",
          );
        const holds = await tx.retentionHold.count({
          where: { userId: current.userId, releasedAt: null },
        });
        const disputes = await tx.paymentDispute.count({
          where: {
            resolvedAt: null,
            paymentAttempt: { payment: { customer: { userId: current.userId } } },
          },
        });
        if ((holds > 0 || disputes > 0) && input.status === "APPROVED_PENDING_POLICY")
          throw paymentConflict(
            "Legal/retention holds or unresolved disputes require protection before approval",
          );
        const updated = await tx.privacyRequest.update({
          where: { id },
          data: {
            status: input.status,
            reviewedByUserId: req.actor!.userId,
            reviewedAt: new Date(
              Math.max(Date.now(), (current.reviewedAt?.getTime() ?? 0) + 1),
            ),
            reviewNote: input.note,
          },
        });
        await appendAuditEvent(tx, {
          actorUserId: req.actor!.userId,
          action: "UPDATE",
          entityType: "USER",
          entityId: current.userId,
          newValues: { privacyRequestId: id, status: input.status, note: input.note },
          context: {
            requestId: String(req.id),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
          },
        });
        return updated;
      });
      res.json(
        successResponse(
          "Privacy review recorded; destructive execution remains disabled",
          req.id,
          result,
        ),
      );
    },
  );
  router.post(
    "/staff/retention-holds",
    authenticate(),
    requireStaff,
    requireCsrf,
    validate({ body: hold }),
    async (req, res) => {
      const input = res.locals.validated!["body"] as z.infer<typeof hold>;
      const result = await prisma.$transaction(async (tx) => {
        await assertCapability(tx, req.actor!, "PRIVACY_REVIEW");
        const record = await tx.retentionHold.create({
          data: {
            ...input,
            recordId: input.recordId ?? null,
            createdByUserId: req.actor!.userId,
          },
        });
        await appendAuditEvent(tx, {
          actorUserId: req.actor!.userId,
          action: "CREATE",
          entityType: "USER",
          entityId: input.userId,
          newValues: { retentionHoldId: record.id, recordType: input.recordType },
          context: {
            requestId: String(req.id),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
          },
        });
        return record;
      });
      res.status(201).json(successResponse("Retention hold recorded", req.id, result));
    },
  );
  return router;
}
