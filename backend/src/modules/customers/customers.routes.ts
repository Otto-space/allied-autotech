import { Router } from "express";

import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCustomer } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { CustomersController } from "./customers.controller.js";
import {
  customerEmptyBodySchema,
  customerEmptyQuerySchema,
  customerProfileUpdateBodySchema,
  customerVehicleCreateBodySchema,
  customerVehicleListQuerySchema,
  customerVehicleParamsSchema,
  customerVehicleUpdateBodySchema,
} from "./customers.schemas.js";

export function createCustomersRouter(): Router {
  const router = Router();
  const controller = new CustomersController();
  router.use(authenticate(), requireCustomer);

  router.get(
    "/profile",
    validate({ query: customerEmptyQuerySchema }),
    controller.profile,
  );
  router.patch(
    "/profile",
    requireCsrf,
    validate({ body: customerProfileUpdateBodySchema, query: customerEmptyQuerySchema }),
    controller.updateProfile,
  );
  router.get(
    "/vehicles",
    validate({ query: customerVehicleListQuerySchema }),
    controller.listVehicles,
  );
  router.post(
    "/vehicles",
    requireCsrf,
    validate({ body: customerVehicleCreateBodySchema, query: customerEmptyQuerySchema }),
    controller.createVehicle,
  );
  router.get(
    "/vehicles/:vehicleId",
    validate({ params: customerVehicleParamsSchema, query: customerEmptyQuerySchema }),
    controller.vehicle,
  );
  router.patch(
    "/vehicles/:vehicleId",
    requireCsrf,
    validate({
      params: customerVehicleParamsSchema,
      query: customerEmptyQuerySchema,
      body: customerVehicleUpdateBodySchema,
    }),
    controller.updateVehicle,
  );
  router.delete(
    "/vehicles/:vehicleId",
    requireCsrf,
    validate({
      params: customerVehicleParamsSchema,
      query: customerEmptyQuerySchema,
      body: customerEmptyBodySchema,
    }),
    controller.deleteVehicle,
  );

  return router;
}
