import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireAdministrator,
  requireCustomer,
  requireStaff,
} from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { VehicleSalesController } from "./vehicle-sales.controller.js";
import {
  customerInspectionListQuerySchema,
  customerTransactionListQuerySchema,
  expireReservationsBodySchema,
  handoverCreateBodySchema,
  handoverParamsSchema,
  handoverTransitionBodySchema,
  idempotencyHeadersSchema,
  inspectionCreateBodySchema,
  inspectionParamsSchema,
  inspectionTransitionBodySchema,
  negotiationBodySchema,
  reservationBodySchema,
  staffInspectionListQuerySchema,
  staffTransactionListQuerySchema,
  transactionCreateBodySchema,
  transactionParamsSchema,
  transactionTransitionBodySchema,
  vehicleSalesEmptySchema,
} from "./vehicle-sales.schemas.js";
export function createCustomerVehicleSalesRouter(): Router {
  const router = Router();
  const controller = new VehicleSalesController();
  router.use(authenticate(), requireCustomer);
  router.get(
    "/vehicle-inspections",
    validate({ query: customerInspectionListQuerySchema }),
    controller.customerInspections,
  );
  router.post(
    "/vehicle-inspections",
    requireCsrf,
    validate({ query: vehicleSalesEmptySchema, body: inspectionCreateBodySchema }),
    controller.requestInspection,
  );
  router.get(
    "/vehicle-transactions",
    validate({ query: customerTransactionListQuerySchema }),
    controller.customerTransactions,
  );
  router.post(
    "/vehicle-transactions",
    requireCsrf,
    validate({ query: vehicleSalesEmptySchema, body: transactionCreateBodySchema }),
    controller.createTransaction,
  );
  router.get(
    "/vehicle-transactions/:transactionId",
    validate({ params: transactionParamsSchema, query: vehicleSalesEmptySchema }),
    controller.customerTransaction,
  );
  router.post(
    "/vehicle-transactions/:transactionId/reserve",
    requireCsrf,
    validate({
      params: transactionParamsSchema,
      headers: idempotencyHeadersSchema,
      query: vehicleSalesEmptySchema,
      body: reservationBodySchema,
    }),
    controller.reserve,
  );
  return router;
}
export function createStaffVehicleSalesRouter(): Router {
  const router = Router();
  const controller = new VehicleSalesController();
  router.use(authenticate(), requireStaff);
  router.get(
    "/vehicle-inspections",
    validate({ query: staffInspectionListQuerySchema }),
    controller.staffInspections,
  );
  router.post(
    "/vehicle-inspections/:inspectionId/status",
    requireCsrf,
    validate({
      params: inspectionParamsSchema,
      query: vehicleSalesEmptySchema,
      body: inspectionTransitionBodySchema,
    }),
    controller.transitionInspection,
  );
  router.get(
    "/vehicle-transactions",
    validate({ query: staffTransactionListQuerySchema }),
    controller.staffTransactions,
  );
  router.get(
    "/vehicle-transactions/:transactionId",
    validate({ params: transactionParamsSchema, query: vehicleSalesEmptySchema }),
    controller.staffTransaction,
  );
  router.post(
    "/vehicle-transactions/:transactionId/negotiate",
    requireCsrf,
    validate({
      params: transactionParamsSchema,
      query: vehicleSalesEmptySchema,
      body: negotiationBodySchema,
    }),
    controller.negotiate,
  );
  router.post(
    "/vehicle-transactions/:transactionId/status",
    requireCsrf,
    validate({
      params: transactionParamsSchema,
      query: vehicleSalesEmptySchema,
      body: transactionTransitionBodySchema,
    }),
    controller.transition,
  );
  router.post(
    "/vehicle-transactions/:transactionId/handovers",
    requireCsrf,
    validate({
      params: transactionParamsSchema,
      query: vehicleSalesEmptySchema,
      body: handoverCreateBodySchema,
    }),
    controller.createHandover,
  );
  router.post(
    "/vehicle-transactions/:transactionId/handovers/:handoverId/status",
    requireCsrf,
    validate({
      params: handoverParamsSchema,
      query: vehicleSalesEmptySchema,
      body: handoverTransitionBodySchema,
    }),
    controller.transitionHandover,
  );
  router.post(
    "/vehicle-transactions/:transactionId/handovers/:handoverId/access",
    requireCsrf,
    validate({
      params: handoverParamsSchema,
      query: vehicleSalesEmptySchema,
      body: vehicleSalesEmptySchema,
    }),
    controller.handoverAccess,
  );
  return router;
}
export function createAdminVehicleSalesRouter(): Router {
  const router = Router();
  const controller = new VehicleSalesController();
  router.use(authenticate(), requireAdministrator);
  router.post(
    "/vehicle-transactions/expire",
    requireCsrf,
    validate({ query: vehicleSalesEmptySchema, body: expireReservationsBodySchema }),
    controller.expire,
  );
  return router;
}
