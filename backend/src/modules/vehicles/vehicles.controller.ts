import type { Request, Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { successResponse } from "../../common/http/api-response.js";
import type {
  AssetUploadInput,
  ConditionReportInput,
  DocumentCreateInput,
  DocumentReviewInput,
  ImageCreateInput,
  ListingCreateInput,
  ListingPriceInput,
  ListingStatusInput,
  ListingUpdateInput,
  PublicVehicleListQuery,
  StaffVehicleListQuery,
  VehicleCreateInput,
  VehicleUpdateInput,
} from "./vehicles.schemas.js";
import { vehiclesService, type VehiclesService } from "./vehicles.service.js";

const validated = <T>(res: Response, location: "body" | "params" | "query") =>
  res.locals.validated?.[location] as T;
const actor = (req: Request) => req.actor as AuthenticatedActor;
const context = (req: Request): RequestSecurityContext => ({
  requestId: String(req.id),
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null,
});
const ids = (res: Response) =>
  validated<{
    vehicleId?: string;
    listingId?: string;
    imageId?: string;
    documentId?: string;
  }>(res, "params");

export class VehiclesController {
  constructor(private readonly service: VehiclesService = vehiclesService) {}
  publicList = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle listings retrieved",
          req.id,
          await this.service.publicListings(
            validated<PublicVehicleListQuery>(res, "query"),
          ),
        ),
      );
  publicGet = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle listing retrieved",
          req.id,
          await this.service.publicListing(ids(res).listingId!),
        ),
      );
  publicImage = async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.redirect(302, await this.service.publicImage(ids(res).imageId!));
  };
  staffList = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicles retrieved",
          req.id,
          await this.service.staffVehicles(
            actor(req),
            validated<StaffVehicleListQuery>(res, "query"),
          ),
        ),
      );
  staffGet = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle retrieved",
          req.id,
          await this.service.staffVehicle(actor(req), ids(res).vehicleId!, context(req)),
        ),
      );
  createVehicle = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Vehicle created",
          req.id,
          await this.service.createVehicle(
            actor(req),
            validated<VehicleCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  updateVehicle = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle updated",
          req.id,
          await this.service.updateVehicle(
            actor(req),
            ids(res).vehicleId!,
            validated<VehicleUpdateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  createListing = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Vehicle listing created",
          req.id,
          await this.service.createListing(
            actor(req),
            validated<ListingCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  updateListing = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle listing updated",
          req.id,
          await this.service.updateListing(
            actor(req),
            ids(res).listingId!,
            validated<ListingUpdateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  transitionListing = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle listing status updated",
          req.id,
          await this.service.transitionListing(
            actor(req),
            ids(res).listingId!,
            validated<ListingStatusInput>(res, "body"),
            context(req),
          ),
        ),
      );
  changePrice = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle listing price updated",
          req.id,
          await this.service.changePrice(
            actor(req),
            ids(res).listingId!,
            validated<ListingPriceInput>(res, "body"),
            context(req),
          ),
        ),
      );
  createUpload = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Secure upload authorized",
          req.id,
          await this.service.createUpload(
            actor(req),
            ids(res).vehicleId!,
            validated<AssetUploadInput>(res, "body"),
          ),
        ),
      );
  addImage = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Vehicle image recorded",
          req.id,
          await this.service.addImage(
            actor(req),
            ids(res).vehicleId!,
            validated<ImageCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  addDocument = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Vehicle document recorded",
          req.id,
          await this.service.addDocument(
            actor(req),
            ids(res).vehicleId!,
            validated<DocumentCreateInput>(res, "body"),
            context(req),
          ),
        ),
      );
  addConditionReport = async (req: Request, res: Response) =>
    res
      .status(201)
      .json(
        successResponse(
          "Condition report recorded",
          req.id,
          await this.service.addConditionReport(
            actor(req),
            ids(res).vehicleId!,
            validated<ConditionReportInput>(res, "body"),
            context(req),
          ),
        ),
      );
  reviewDocument = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle document reviewed",
          req.id,
          await this.service.reviewDocument(
            actor(req),
            ids(res).vehicleId!,
            ids(res).documentId!,
            validated<DocumentReviewInput>(res, "body"),
            context(req),
          ),
        ),
      );
  documentAccess = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Private document access authorized",
          req.id,
          await this.service.documentAccess(
            actor(req),
            ids(res).vehicleId!,
            ids(res).documentId!,
            context(req),
          ),
        ),
      );
  saved = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Saved vehicles retrieved",
          req.id,
          await this.service.saved(actor(req)),
        ),
      );
  save = async (req: Request, res: Response) =>
    res
      .status(200)
      .json(
        successResponse(
          "Vehicle saved",
          req.id,
          await this.service.save(actor(req), ids(res).listingId!),
        ),
      );
  unsave = async (req: Request, res: Response) => {
    await this.service.unsave(actor(req), ids(res).listingId!);
    res.status(200).json(successResponse("Saved vehicle removed", req.id));
  };
}
