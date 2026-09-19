import { Router, type Request, type Response } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCustomer, requireStaff } from "../../common/middleware/authorize.js";
import { validate } from "../../common/middleware/validate.js";
import { successResponse } from "../../common/http/api-response.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { OverviewService } from "./overview.service.js";
import { overviewQuerySchema, type OverviewQuery } from "./overview.schemas.js";

export function createOverviewRouter(audience: "customer" | "staff"): Router {
  const router = Router();
  const service = new OverviewService();
  router.get(
    "/",
    authenticate(),
    audience === "customer" ? requireCustomer : requireStaff,
    validate({ query: overviewQuerySchema }),
    async (req: Request, res: Response) => {
      const data = await service.read(
        req.actor as AuthenticatedActor,
        res.locals.validated?.["query"] as OverviewQuery,
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).json(successResponse("Overview retrieved", req.id, data));
    },
  );
  return router;
}
