import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireCustomer, requireStaff } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { validate } from "../../common/middleware/validate.js";
import { VehiclesController } from "./vehicles.controller.js";
import {
  assetUploadBodySchema,
  conditionReportBodySchema,
  documentCreateBodySchema,
  documentParamsSchema,
  documentReviewBodySchema,
  imageCreateBodySchema,
  imageParamsSchema,
  listingCreateBodySchema,
  listingParamsSchema,
  listingPriceBodySchema,
  listingStatusBodySchema,
  listingUpdateBodySchema,
  publicVehicleListQuerySchema,
  staffVehicleListQuerySchema,
  vehicleCreateBodySchema,
  vehicleEmptySchema,
  vehicleParamsSchema,
  vehicleUpdateBodySchema,
} from "./vehicles.schemas.js";

export function createPublicVehiclesRouter(): Router {
  const router = Router();
  const controller = new VehiclesController();
  router.get(
    "/",
    validate({ query: publicVehicleListQuerySchema }),
    controller.publicList,
  );
  router.get(
    "/images/:imageId",
    validate({ params: imageParamsSchema, query: vehicleEmptySchema }),
    controller.publicImage,
  );
  router.get(
    "/:listingId",
    validate({ params: listingParamsSchema, query: vehicleEmptySchema }),
    controller.publicGet,
  );
  return router;
}
export function createCustomerVehiclesDiscoveryRouter(): Router {
  const router = Router();
  const controller = new VehiclesController();
  router.use(authenticate(), requireCustomer);
  router.get(
    "/saved-vehicles",
    validate({ query: vehicleEmptySchema }),
    controller.saved,
  );
  router.put(
    "/saved-vehicles/:listingId",
    requireCsrf,
    validate({
      params: listingParamsSchema,
      query: vehicleEmptySchema,
      body: vehicleEmptySchema,
    }),
    controller.save,
  );
  router.delete(
    "/saved-vehicles/:listingId",
    requireCsrf,
    validate({
      params: listingParamsSchema,
      query: vehicleEmptySchema,
      body: vehicleEmptySchema,
    }),
    controller.unsave,
  );
  return router;
}
export function createStaffVehiclesRouter(): Router {
  const router = Router();
  const controller = new VehiclesController();
  router.use(authenticate(), requireStaff);
  router.get("/", validate({ query: staffVehicleListQuerySchema }), controller.staffList);
  router.post(
    "/",
    requireCsrf,
    validate({ query: vehicleEmptySchema, body: vehicleCreateBodySchema }),
    controller.createVehicle,
  );
  router.post(
    "/listings",
    requireCsrf,
    validate({ query: vehicleEmptySchema, body: listingCreateBodySchema }),
    controller.createListing,
  );
  router.patch(
    "/listings/:listingId",
    requireCsrf,
    validate({
      params: listingParamsSchema,
      query: vehicleEmptySchema,
      body: listingUpdateBodySchema,
    }),
    controller.updateListing,
  );
  router.post(
    "/listings/:listingId/status",
    requireCsrf,
    validate({
      params: listingParamsSchema,
      query: vehicleEmptySchema,
      body: listingStatusBodySchema,
    }),
    controller.transitionListing,
  );
  router.post(
    "/listings/:listingId/price",
    requireCsrf,
    validate({
      params: listingParamsSchema,
      query: vehicleEmptySchema,
      body: listingPriceBodySchema,
    }),
    controller.changePrice,
  );
  router.get(
    "/:vehicleId",
    validate({ params: vehicleParamsSchema, query: vehicleEmptySchema }),
    controller.staffGet,
  );
  router.patch(
    "/:vehicleId",
    requireCsrf,
    validate({
      params: vehicleParamsSchema,
      query: vehicleEmptySchema,
      body: vehicleUpdateBodySchema,
    }),
    controller.updateVehicle,
  );
  router.post(
    "/:vehicleId/assets/upload",
    requireCsrf,
    validate({
      params: vehicleParamsSchema,
      query: vehicleEmptySchema,
      body: assetUploadBodySchema,
    }),
    controller.createUpload,
  );
  router.post(
    "/:vehicleId/images",
    requireCsrf,
    validate({
      params: vehicleParamsSchema,
      query: vehicleEmptySchema,
      body: imageCreateBodySchema,
    }),
    controller.addImage,
  );
  router.post(
    "/:vehicleId/documents",
    requireCsrf,
    validate({
      params: vehicleParamsSchema,
      query: vehicleEmptySchema,
      body: documentCreateBodySchema,
    }),
    controller.addDocument,
  );
  router.post(
    "/:vehicleId/condition-reports",
    requireCsrf,
    validate({
      params: vehicleParamsSchema,
      query: vehicleEmptySchema,
      body: conditionReportBodySchema,
    }),
    controller.addConditionReport,
  );
  router.post(
    "/:vehicleId/documents/:documentId/review",
    requireCsrf,
    validate({
      params: documentParamsSchema,
      query: vehicleEmptySchema,
      body: documentReviewBodySchema,
    }),
    controller.reviewDocument,
  );
  router.post(
    "/:vehicleId/documents/:documentId/access",
    requireCsrf,
    validate({
      params: documentParamsSchema,
      query: vehicleEmptySchema,
      body: vehicleEmptySchema,
    }),
    controller.documentAccess,
  );
  return router;
}
