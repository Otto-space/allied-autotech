import { Router, type Request, type Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { successResponse } from "../../common/http/api-response.js";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireAdministrator } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { serviceOperationsEmptyQuerySchema } from "./service-operations.schemas.js";
import { ServiceDiscoveryRepository } from "./service-discovery.repository.js";
import { ServiceCategoryService } from "./service-category.service.js";
import {
  ownerStructureApplySchema,
  adminServiceCategoryQuerySchema,
  serviceCategoryQuerySchema,
  serviceDiscoveryQuerySchema,
  serviceCategoryCreateSchema,
  serviceCategoryUpdateSchema,
  serviceCategoryParamsSchema,
  type ServiceDiscoveryQuery,
  type ServiceCategoryQuery,
  type ServiceCategoryCreate,
  type ServiceCategoryUpdate,
} from "./service-discovery.schemas.js";

const validated = <T>(res: Response, field: "query" | "params" | "body") =>
  res.locals.validated?.[field] as T;
const categoryId = (res: Response) =>
  validated<{ categoryId: string }>(res, "params").categoryId;
const context = (req: Request) => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
export function createServiceDiscoveryRouter() {
  const router = Router(),
    repository = new ServiceDiscoveryRepository(),
    service = new ServiceCategoryService();
  router.get(
    "/public/services/discovery",
    validate({ query: serviceDiscoveryQuerySchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Services retrieved",
          req.id,
          await repository.services(validated<ServiceDiscoveryQuery>(res, "query")),
        ),
      );
    },
  );
  router.get(
    "/public/services/categories",
    validate({ query: serviceCategoryQuerySchema }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service categories retrieved",
          req.id,
          await repository.categories(
            validated<ServiceCategoryQuery>(res, "query"),
            true,
          ),
        ),
      );
    },
  );
  router.get(
    "/public/services/categories/:categoryId",
    validate({
      params: serviceCategoryParamsSchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    async (req, res) => {
      res.json(
        successResponse(
          "Service category retrieved",
          req.id,
          await repository.publicCategory(categoryId(res)),
        ),
      );
    },
  );
  const admin = Router();
  admin.use(authenticate(), requireAdministrator);
  admin.get(
    "/owner-structure",
    validate({ query: serviceOperationsEmptyQuerySchema }),
    async (req, res) => {
      res
        .set("Cache-Control", "private, no-store")
        .json(
          successResponse(
            "Owner service structure review",
            req.id,
            await service.previewOwnerStructure(req.actor as AuthenticatedActor),
          ),
        );
    },
  );
  admin.post(
    "/owner-structure",
    requireCsrf,
    createSensitiveRateLimit(20),
    validate({
      query: serviceOperationsEmptyQuerySchema,
      body: ownerStructureApplySchema,
    }),
    async (req, res) => {
      res
        .set("Cache-Control", "private, no-store")
        .json(
          successResponse(
            "Owner service structure applied",
            req.id,
            await service.applyOwnerStructure(
              req.actor as AuthenticatedActor,
              validated<{ expectedRevision: string }>(res, "body").expectedRevision,
              context(req),
            ),
          ),
        );
    },
  );
  admin.get(
    "/",
    validate({ query: adminServiceCategoryQuerySchema }),
    async (req, res) => {
      res
        .set("Cache-Control", "private, no-store")
        .json(
          successResponse(
            "Service categories retrieved",
            req.id,
            await repository.categories(
              validated<ServiceCategoryQuery>(res, "query"),
              false,
            ),
          ),
        );
    },
  );
  admin.get(
    "/:categoryId",
    validate({
      params: serviceCategoryParamsSchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    async (req, res) => {
      res
        .set("Cache-Control", "private, no-store")
        .json(
          successResponse(
            "Service category retrieved",
            req.id,
            await repository.adminCategory(categoryId(res)),
          ),
        );
    },
  );
  admin.post(
    "/",
    requireCsrf,
    createSensitiveRateLimit(20),
    validate({
      body: serviceCategoryCreateSchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    async (req, res) => {
      res
        .status(201)
        .set("Cache-Control", "private, no-store")
        .json(
          successResponse(
            "Service category created",
            req.id,
            await service.create(
              req.actor as AuthenticatedActor,
              validated<ServiceCategoryCreate>(res, "body"),
              context(req),
            ),
          ),
        );
    },
  );
  admin.patch(
    "/:categoryId",
    requireCsrf,
    validate({
      params: serviceCategoryParamsSchema,
      body: serviceCategoryUpdateSchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    async (req, res) => {
      res
        .set("Cache-Control", "private, no-store")
        .json(
          successResponse(
            "Service category updated",
            req.id,
            await service.update(
              req.actor as AuthenticatedActor,
              categoryId(res),
              validated<ServiceCategoryUpdate>(res, "body"),
              context(req),
            ),
          ),
        );
    },
  );
  router.use("/admin/service-categories", admin);
  return router;
}
