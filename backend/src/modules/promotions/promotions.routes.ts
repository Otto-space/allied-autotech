import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireAdministrator,
  requireCustomer,
} from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { PromotionsController } from "./promotions.controller.js";
import {
  promotionCreateBodySchema,
  promotionCreationHeadersSchema,
  promotionReceiptParamsSchema,
  promotionEmptyQuerySchema,
  promotionListQuerySchema,
  promotionParamsSchema,
  promotionPreviewBodySchema,
  promotionUpdateBodySchema,
} from "./promotions.schemas.js";

export function createCustomerPromotionsRouter(): Router {
  const router = Router();
  const controller = new PromotionsController();
  router.use(authenticate(), requireCustomer);
  router.post(
    "/preview",
    requireCsrf,
    validate({ body: promotionPreviewBodySchema }),
    controller.preview,
  );
  return router;
}
export function createAdminPromotionsRouter(): Router {
  const router = Router();
  const controller = new PromotionsController();
  router.use(authenticate(), requireAdministrator, (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  router.get("/", validate({ query: promotionListQuerySchema }), controller.list);
  router.get(
    "/creation-receipts/:requestKey",
    validate({ params: promotionReceiptParamsSchema, query: promotionEmptyQuerySchema }),
    controller.creationReceipt,
  );
  router.get(
    "/:promotionId",
    validate({ params: promotionParamsSchema }),
    controller.get,
  );
  router.post(
    "/",
    requireCsrf,
    validate({
      body: promotionCreateBodySchema,
      headers: promotionCreationHeadersSchema,
    }),
    controller.create,
  );
  router.patch(
    "/:promotionId",
    requireCsrf,
    validate({ params: promotionParamsSchema, body: promotionUpdateBodySchema }),
    controller.update,
  );
  return router;
}
