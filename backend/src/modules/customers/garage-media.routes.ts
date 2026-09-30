import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCustomer } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { createSensitiveRateLimit } from "../../common/middleware/rate-limits.js";
import { validate } from "../../common/middleware/validate.js";
import { GarageMediaController } from "./garage-media.controller.js";
import { GarageMediaService } from "./garage-media.service.js";
import {
  garageImageConfirmSchema,
  garageImageParamsSchema,
  garageImageUpdateSchema,
} from "./garage-media.schemas.js";
import { mediaUploadSchema, mediaVersionSchema } from "../media/media.schemas.js";
import {
  customerVehicleParamsSchema,
  customerEmptyQuerySchema,
} from "./customers.schemas.js";
export function createGarageMediaRouter(service = new GarageMediaService()) {
  const router = Router();
  const controller = new GarageMediaController(service);
  router.use(authenticate(), requireCustomer);
  router.post(
    "/vehicles/:vehicleId/assets/upload",
    requireCsrf,
    createSensitiveRateLimit(20, 60000),
    validate({
      params: customerVehicleParamsSchema,
      query: customerEmptyQuerySchema,
      body: mediaUploadSchema,
    }),
    controller.prepare,
  );
  router.post(
    "/vehicles/:vehicleId/images",
    requireCsrf,
    createSensitiveRateLimit(20, 60000),
    validate({
      params: customerVehicleParamsSchema,
      query: customerEmptyQuerySchema,
      body: garageImageConfirmSchema,
    }),
    controller.confirm,
  );
  router.patch(
    "/vehicles/:vehicleId/images/:imageId",
    requireCsrf,
    validate({
      params: garageImageParamsSchema,
      query: customerEmptyQuerySchema,
      body: garageImageUpdateSchema,
    }),
    controller.update,
  );
  router.delete(
    "/vehicles/:vehicleId/images/:imageId",
    requireCsrf,
    validate({
      params: garageImageParamsSchema,
      query: customerEmptyQuerySchema,
      body: mediaVersionSchema,
    }),
    controller.remove,
  );
  return router;
}
