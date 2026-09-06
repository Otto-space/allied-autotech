import { Router } from "express";

import { authenticate } from "../../common/middleware/authenticate.js";
import {
  requireAdministrator,
  requireCustomer,
  requireStaff,
} from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { ServiceOperationsController } from "./service-operations.controller.js";
import {
  adminServiceListQuerySchema,
  bookingAssignmentBodySchema,
  bookingCancelBodySchema,
  bookingCreateBodySchema,
  bookingParamsSchema,
  bookingRescheduleBodySchema,
  bookingTransitionBodySchema,
  customerBookingListQuerySchema,
  publicServiceListQuerySchema,
  quoteCreateBodySchema,
  quoteParamsSchema,
  quoteReplaceBodySchema,
  quoteTransitionBodySchema,
  serviceCreateBodySchema,
  serviceOperationsEmptyQuerySchema,
  serviceParamsSchema,
  serviceUpdateBodySchema,
  staffBookingListQuerySchema,
  workOrderCreateBodySchema,
  workOrderParamsSchema,
  workOrderTransitionBodySchema,
  workOrderUpdateBodySchema,
} from "./service-operations.schemas.js";

export function createPublicServicesRouter(): Router {
  const router = Router();
  const controller = new ServiceOperationsController();
  router.get(
    "/",
    validate({ query: publicServiceListQuerySchema }),
    controller.publicServices,
  );
  router.get(
    "/:serviceId",
    validate({ params: serviceParamsSchema, query: serviceOperationsEmptyQuerySchema }),
    controller.publicService,
  );
  return router;
}

export function createCustomerServiceOperationsRouter(): Router {
  const router = Router();
  const controller = new ServiceOperationsController();
  router.use(authenticate(), requireCustomer);
  router.get(
    "/bookings",
    validate({ query: customerBookingListQuerySchema }),
    controller.customerBookings,
  );
  router.post(
    "/bookings",
    requireCsrf,
    validate({ body: bookingCreateBodySchema, query: serviceOperationsEmptyQuerySchema }),
    controller.createBooking,
  );
  router.get(
    "/bookings/:bookingId",
    validate({ params: bookingParamsSchema, query: serviceOperationsEmptyQuerySchema }),
    controller.customerBooking,
  );
  router.patch(
    "/bookings/:bookingId/schedule",
    requireCsrf,
    validate({
      params: bookingParamsSchema,
      body: bookingRescheduleBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.rescheduleBooking,
  );
  router.post(
    "/bookings/:bookingId/cancel",
    requireCsrf,
    validate({
      params: bookingParamsSchema,
      body: bookingCancelBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.cancelBooking,
  );
  router.post(
    "/bookings/:bookingId/quotes/:quoteId/accept",
    requireCsrf,
    validate({
      params: quoteParamsSchema,
      body: quoteTransitionBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.acceptQuote,
  );
  router.post(
    "/bookings/:bookingId/quotes/:quoteId/reject",
    requireCsrf,
    validate({
      params: quoteParamsSchema,
      body: quoteTransitionBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.rejectQuote,
  );
  return router;
}

export function createStaffServiceOperationsRouter(): Router {
  const router = Router();
  const controller = new ServiceOperationsController();
  router.use(authenticate(), requireStaff);
  router.get(
    "/bookings",
    validate({ query: staffBookingListQuerySchema }),
    controller.staffBookings,
  );
  router.get(
    "/bookings/:bookingId",
    validate({ params: bookingParamsSchema, query: serviceOperationsEmptyQuerySchema }),
    controller.staffBooking,
  );
  router.patch(
    "/bookings/:bookingId/assignment",
    requireCsrf,
    validate({
      params: bookingParamsSchema,
      body: bookingAssignmentBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.assignBooking,
  );
  router.post(
    "/bookings/:bookingId/status",
    requireCsrf,
    validate({
      params: bookingParamsSchema,
      body: bookingTransitionBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.transitionBooking,
  );
  router.post(
    "/bookings/:bookingId/quotes",
    requireCsrf,
    validate({
      params: bookingParamsSchema,
      body: quoteCreateBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.createQuote,
  );
  router.put(
    "/bookings/:bookingId/quotes/:quoteId",
    requireCsrf,
    validate({
      params: quoteParamsSchema,
      body: quoteReplaceBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.replaceQuote,
  );
  router.post(
    "/bookings/:bookingId/quotes/:quoteId/issue",
    requireCsrf,
    validate({
      params: quoteParamsSchema,
      body: quoteTransitionBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.issueQuote,
  );
  router.post(
    "/bookings/:bookingId/quotes/:quoteId/void",
    requireCsrf,
    validate({
      params: quoteParamsSchema,
      body: quoteTransitionBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.voidQuote,
  );
  router.post(
    "/bookings/:bookingId/quotes/:quoteId/expire",
    requireCsrf,
    validate({
      params: quoteParamsSchema,
      body: quoteTransitionBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.expireQuote,
  );
  router.post(
    "/bookings/:bookingId/work-orders",
    requireCsrf,
    validate({
      params: bookingParamsSchema,
      body: workOrderCreateBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.createWorkOrder,
  );
  router.put(
    "/bookings/:bookingId/work-orders/:workOrderId",
    requireCsrf,
    validate({
      params: workOrderParamsSchema,
      body: workOrderUpdateBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.updateWorkOrder,
  );
  router.post(
    "/bookings/:bookingId/work-orders/:workOrderId/status",
    requireCsrf,
    validate({
      params: workOrderParamsSchema,
      body: workOrderTransitionBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.transitionWorkOrder,
  );
  return router;
}

export function createAdminServicesRouter(): Router {
  const router = Router();
  const controller = new ServiceOperationsController();
  router.use(authenticate(), requireAdministrator);
  router.get(
    "/",
    validate({ query: adminServiceListQuerySchema }),
    controller.adminServices,
  );
  router.post(
    "/",
    requireCsrf,
    validate({ body: serviceCreateBodySchema, query: serviceOperationsEmptyQuerySchema }),
    controller.createService,
  );
  router.patch(
    "/:serviceId",
    requireCsrf,
    validate({
      params: serviceParamsSchema,
      body: serviceUpdateBodySchema,
      query: serviceOperationsEmptyQuerySchema,
    }),
    controller.updateService,
  );
  return router;
}
