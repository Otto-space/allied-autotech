import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireAdministrator } from "../../common/middleware/authorize.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { CustomerDirectoryController } from "./customer-directory.controller.js";
import {
  directoryCollections,
  directoryListQuerySchema,
  directoryParamsSchema,
  directoryRelatedQuerySchema,
} from "./customer-directory.schemas.js";
import { customerEmptyQuerySchema } from "./customers.schemas.js";

export function createCustomerDirectoryRouter() {
  const router = Router();
  const controller = new CustomerDirectoryController();
  router.use(authenticate(), requireAdministrator, createSensitiveRateLimit(120, 60_000));
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    next();
  });
  router.get("/", validate({ query: directoryListQuerySchema }), controller.list);
  router.get(
    "/:customerId",
    validate({ params: directoryParamsSchema, query: customerEmptyQuerySchema }),
    controller.detail,
  );
  for (const collection of directoryCollections)
    router.get(
      `/:customerId/${collection}`,
      validate({ params: directoryParamsSchema, query: directoryRelatedQuerySchema }),
      controller.related(collection),
    );
  return router;
}
