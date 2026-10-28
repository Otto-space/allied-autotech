import { Router, type Request } from "express";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireStaff,
  requireSuperAdministrator,
} from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import {
  customerSupportChannelRouter,
  workforceSupportChannelRouter,
} from "./support-channel.routes.js";
import {
  supportCoverageUpdateSchema,
  supportLiveBranchSchema,
  supportLiveAvailabilityQuerySchema,
  supportPresenceHeartbeatSchema,
  supportPresenceUpdateSchema,
} from "./support-live.schemas.js";
import {
  customerSupportAvailability,
  getSupportCoverage,
  getSupportPresence,
  heartbeatSupportPresence,
  updateSupportCoverage,
  updateSupportPresence,
} from "./support-live.js";

const empty = z.strictObject({});
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const noStore = (
  _req: Request,
  res: import("express").Response,
  next: import("express").NextFunction,
) => {
  res.set("Cache-Control", "private, no-store");
  next();
};

/** Mounted after the existing authenticated customer boundary. */
export function customerSupportLiveRouter() {
  const router = Router();
  router.use(noStore);
  router.use("/channels", customerSupportChannelRouter());
  router.get(
    "/availability/:branchId",
    createSensitiveRateLimit(240, 60_000),
    validate({
      params: supportLiveBranchSchema,
      query: supportLiveAvailabilityQuerySchema,
    }),
    async (req, res) => {
      const { branchId } = supportLiveBranchSchema.parse(req.params);
      const { kind } = supportLiveAvailabilityQuerySchema.parse(req.query);
      res.json(
        successResponse(
          "Support availability checked; queued messages remain available",
          req.id,
          await customerSupportAvailability(req.actor!, branchId, kind),
        ),
      );
    },
  );
  return router;
}

/** Separate role guards plus transactional current-session and branch-duty checks. */
export function workforceSupportLiveRouter() {
  const router = Router();
  router.use(workforceSupportChannelRouter());
  const adminPath = "/admin/workforce/support-chat/coverage/:branchId";
  const staffPath = "/staff/workforce/support-chat/presence";
  router.get(
    adminPath,
    authenticate(),
    requireSuperAdministrator,
    noStore,
    validate({ params: supportLiveBranchSchema, query: empty }),
    async (req, res) => {
      res.json(
        successResponse(
          "Explicit support coverage",
          req.id,
          await getSupportCoverage(
            req.actor!,
            supportLiveBranchSchema.parse(req.params).branchId,
          ),
        ),
      );
    },
  );
  router.put(
    adminPath,
    authenticate(),
    requireSuperAdministrator,
    noStore,
    requireCsrf,
    createSensitiveRateLimit(30, 60_000),
    validate({
      params: supportLiveBranchSchema,
      query: empty,
      body: supportCoverageUpdateSchema,
    }),
    async (req, res) => {
      res.json(
        successResponse(
          "Support coverage saved",
          req.id,
          await updateSupportCoverage(
            req.actor!,
            supportLiveBranchSchema.parse(req.params).branchId,
            supportCoverageUpdateSchema.parse(req.body),
            context(req),
          ),
        ),
      );
    },
  );
  router.get(
    staffPath,
    authenticate(),
    requireStaff,
    noStore,
    validate({ query: empty }),
    async (req, res) => {
      res.json(
        successResponse(
          "Your support availability",
          req.id,
          await getSupportPresence(req.actor!),
        ),
      );
    },
  );
  router.put(
    staffPath,
    authenticate(),
    requireStaff,
    noStore,
    requireCsrf,
    createSensitiveRateLimit(60, 60_000),
    validate({ query: empty, body: supportPresenceUpdateSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Support availability updated",
          req.id,
          await updateSupportPresence(
            req.actor!,
            supportPresenceUpdateSchema.parse(req.body),
            context(req),
          ),
        ),
      );
    },
  );
  router.post(
    staffPath + "/heartbeat",
    authenticate(),
    requireStaff,
    noStore,
    requireCsrf,
    createSensitiveRateLimit(120, 60_000),
    validate({ query: empty, body: supportPresenceHeartbeatSchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Availability lease renewed",
          req.id,
          await heartbeatSupportPresence(
            req.actor!,
            supportPresenceHeartbeatSchema.parse(req.body).expectedVersion,
          ),
        ),
      );
    },
  );
  return router;
}
