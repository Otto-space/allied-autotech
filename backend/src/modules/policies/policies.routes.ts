import {
  capabilityListQuerySchema,
  publishPolicyBodySchema,
  type PublishPolicyInput,
} from "./policies.schemas.js";
import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireStaff,
  requireSuperAdministrator,
} from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import {
  grantCapability,
  safeCapabilities,
  publishPolicy,
  publicFulfillmentOptions,
} from "./policies.service.js";
import { prisma } from "../../config/database.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { financeEmptyQuery, readFinancePolicy } from "./finance-policy-workspace.js";
import { lockAccessActor } from "../organization/team-access-security.js";

export function createPoliciesRouter() {
  const router = Router();
  router.get("/public/fulfillment-options", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(
      successResponse(
        "Collection and available delivery zones",
        req.id,
        await publicFulfillmentOptions(),
      ),
    );
  });
  router.get("/public/capabilities", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(
      successResponse("Policy availability summary", req.id, await safeCapabilities()),
    );
  });
  for (const historyOnly of [true, false])
    router.get(
      historyOnly ? "/staff/finance-policy" : "/staff/finance-policy/current",
      authenticate(),
      requireStaff,
      validate({ query: financeEmptyQuery }),
      async (req, res) => {
        res.set("Cache-Control", "private, no-store");
        const result = await readFinancePolicy(
          req.actor!,
          {
            requestId: String(req.id),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
          },
          historyOnly,
        );
        res.json(
          successResponse(
            historyOnly ? "Financial policy history" : "Current financial policy",
            req.id,
            historyOnly ? result.history : result,
          ),
        );
      },
    );
  router.get(
    "/admin/policies",
    authenticate(),
    requireSuperAdministrator,
    async (req, res) => {
      const query = z
        .object({
          key: z.string().min(1).max(100),
          limit: z.coerce.number().int().min(1).max(100).default(25),
        })
        .strict()
        .parse(req.query);
      res.json(
        successResponse(
          "Policy history",
          req.id,
          await prisma.businessPolicyVersion.findMany({
            where: { key: query.key },
            orderBy: { version: "desc" },
            take: query.limit,
          }),
        ),
      );
    },
  );
  router.get(
    "/admin/capabilities",
    authenticate(),
    requireSuperAdministrator,
    async (req, res) => {
      const { userId, activeOnly } = capabilityListQuerySchema.parse(req.query);
      res.set("Cache-Control", "private, no-store");
      const grants = await prisma.$transaction(async (tx) => {
        await lockAccessActor(tx, req.actor!);
        const items = await tx.userCapability.findMany({
          where: { userId, ...(activeOnly === "true" ? { revokedAt: null } : {}) },
          select: {
            id: true,
            userId: true,
            capability: true,
            grantedByUserId: true,
            grantedAt: true,
            revokedAt: true,
          },
          orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
          ...(activeOnly === "true" ? {} : { take: 100 }),
        });
        await appendAuditEvent(tx, {
          actorUserId: req.actor!.userId,
          action: "READ",
          entityType: "USER",
          entityId: userId,
          newValues: {
            resource: "CAPABILITIES",
            activeOnly: activeOnly === "true",
            resultCount: items.length,
          },
          context: {
            requestId: String(req.id),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
          },
        });
        return items;
      });
      res.json(
        successResponse(
          activeOnly === "true"
            ? "Active account capabilities"
            : "Account capability history",
          req.id,
          grants,
        ),
      );
    },
  );
  router.post(
    "/admin/capabilities/:id/revoke",
    authenticate(),
    requireSuperAdministrator,
    requireCsrf,
    async (req, res) => {
      const id = z.uuid().parse(req.params["id"]);
      res.set("Cache-Control", "private, no-store");
      const { reason } = z
        .object({ reason: z.string().trim().min(10).max(1000) })
        .strict()
        .parse(req.body);
      const result = await prisma.$transaction(async (tx) => {
        await lockAccessActor(tx, req.actor!);
        const grant = await tx.userCapability.findUniqueOrThrow({ where: { id } });
        await tx.userCapability.updateMany({
          where: { id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await appendAuditEvent(tx, {
          actorUserId: req.actor!.userId,
          action: "UPDATE",
          entityType: "USER",
          entityId: grant.userId,
          newValues: { revokedCapabilityGrantId: id, reason },
          context: {
            requestId: String(req.id),
            ipAddress: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
          },
        });
        return { id, revoked: true };
      });
      res.json(successResponse("Capability revoked immediately", req.id, result));
    },
  );
  router.post(
    "/admin/capabilities",
    authenticate(),
    requireSuperAdministrator,
    requireCsrf,
    validate({
      body: z
        .object({
          userId: z.uuid(),
          capability: z.enum([
            "REFUND_APPROVE",
            "REFUND_TRANSFER",
            "REFUND_CHECK",
            "FINANCE_POLICY_APPROVE",
            "BOOKING_CONFIRM",
            "PRIVACY_REVIEW",
            "DISPUTE_MANAGE",
          ]),
        })
        .strict(),
    }),
    async (req, res) => {
      const input = res.locals.validated!["body"] as {
        userId: string;
        capability: string;
      };
      const result = await grantCapability(req.actor!, input.userId, input.capability, {
        requestId: String(req.id),
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });
      res.set("Cache-Control", "private, no-store");
      res.status(201).json(successResponse("Capability granted", req.id, result));
    },
  );
  router.post(
    "/admin/policies",
    authenticate(),
    requireStaff,
    requireCsrf,
    validate({ body: publishPolicyBodySchema }),
    async (req, res) => {
      const result = await publishPolicy(
        req.actor!,
        res.locals.validated!["body"] as PublishPolicyInput,
        {
          requestId: String(req.id),
          ipAddress: req.ip ?? null,
          userAgent: req.get("user-agent") ?? null,
        },
      );
      res
        .status(201)
        .json(successResponse("Approved policy version recorded", req.id, result));
    },
  );
  return router;
}
