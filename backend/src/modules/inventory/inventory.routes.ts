import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireAdministrator, requireStaff } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { InventoryController } from "./inventory.controller.js";
import {
  idempotencyHeadersSchema,
  inventoryCreateBodySchema,
  inventoryEmptyQuerySchema,
  inventoryHistoryQuerySchema,
  inventoryListQuerySchema,
  inventoryMovementBodySchema,
  inventoryParamsSchema,
  inventoryReleaseBodySchema,
  inventoryReservationBodySchema,
  inventoryReservationListQuerySchema,
  inventoryReservationParamsSchema,
  inventoryUpdateBodySchema,
} from "./inventory.schemas.js";

export function createStaffInventoryRouter(): Router {
  const router = Router();
  const controller = new InventoryController();
  router.use(authenticate(), requireStaff);
  router.get("/", validate({ query: inventoryListQuerySchema }), controller.list);
  router.get(
    "/:inventoryId",
    validate({ params: inventoryParamsSchema, query: inventoryEmptyQuerySchema }),
    controller.get,
  );
  router.patch(
    "/:inventoryId",
    requireCsrf,
    validate({
      params: inventoryParamsSchema,
      query: inventoryEmptyQuerySchema,
      body: inventoryUpdateBodySchema,
    }),
    controller.update,
  );
  router.post(
    "/:inventoryId/movements",
    requireCsrf,
    validate({
      params: inventoryParamsSchema,
      query: inventoryEmptyQuerySchema,
      headers: idempotencyHeadersSchema,
      body: inventoryMovementBodySchema,
    }),
    controller.movement,
  );
  router.get(
    "/:inventoryId/history",
    validate({ params: inventoryParamsSchema, query: inventoryHistoryQuerySchema }),
    controller.history,
  );
  router.get(
    "/:inventoryId/reservations",
    validate({
      params: inventoryParamsSchema,
      query: inventoryReservationListQuerySchema,
    }),
    controller.reservations,
  );
  router.post(
    "/:inventoryId/reservations",
    requireCsrf,
    validate({
      params: inventoryParamsSchema,
      query: inventoryEmptyQuerySchema,
      headers: idempotencyHeadersSchema,
      body: inventoryReservationBodySchema,
    }),
    controller.reserve,
  );
  router.post(
    "/:inventoryId/reservations/:reservationId/release",
    requireCsrf,
    validate({
      params: inventoryReservationParamsSchema,
      query: inventoryEmptyQuerySchema,
      headers: idempotencyHeadersSchema,
      body: inventoryReleaseBodySchema,
    }),
    controller.release,
  );
  return router;
}

export function createAdminInventoryRouter(): Router {
  const router = Router();
  const controller = new InventoryController();
  router.use(authenticate(), requireAdministrator);
  router.post(
    "/",
    requireCsrf,
    validate({ query: inventoryEmptyQuerySchema, body: inventoryCreateBodySchema }),
    controller.create,
  );
  return router;
}
