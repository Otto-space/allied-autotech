import { randomUUID } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import {
  issueVehicleAssetTicket,
  readVehicleAssetTicket,
  type VehicleAssetKind,
} from "../../common/security/asset-tickets.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { ObjectStoragePort } from "../../providers/storage/object-storage.port.js";
import { objectStorage } from "../../providers/storage/s3-object-storage.adapter.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  invalidAssetTicket,
  vehicleConflict,
  vehicleForbidden,
  vehicleNotFound,
  vehicleStale,
} from "./vehicles.errors.js";
import { assertVehicleCustomer, assertVehicleOperator } from "./vehicles.policy.js";
import { VehiclesRepository } from "./vehicles.repository.js";
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
import { vehicleJsonSafe, vehiclePage } from "./vehicles.types.js";

const listingTransitions = {
  DRAFT: ["AVAILABLE", "INACTIVE"],
  AVAILABLE: ["INACTIVE", "ARCHIVED"],
  INACTIVE: ["AVAILABLE", "ARCHIVED"],
  RESERVED: [],
  SOLD: ["ARCHIVED"],
  ARCHIVED: [],
} as const;

export class VehiclesService {
  private readonly repository: VehiclesRepository;
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly storage: ObjectStoragePort = objectStorage,
  ) {
    this.repository = new VehiclesRepository(database);
  }
  async publicListings(query: PublicVehicleListQuery) {
    return vehicleJsonSafe(
      vehiclePage(await this.repository.listPublic(query), query.limit),
    );
  }
  async publicListing(id: string) {
    const listing = await this.repository.publicListing(id);
    if (listing === null) throw vehicleNotFound();
    return vehicleJsonSafe(listing);
  }
  async publicImage(id: string) {
    const image = await this.repository.publicImage(id);
    if (image?.publicId == null) throw vehicleNotFound();
    return this.storage.createView(image.publicId);
  }
  async staffVehicles(actor: AuthenticatedActor, query: StaffVehicleListQuery) {
    assertVehicleOperator(actor);
    const branchId = await this.allowedBranch(actor);
    if (
      actor.role === "STAFF" &&
      query.branchId !== undefined &&
      query.branchId !== branchId
    )
      throw vehicleForbidden();
    return vehicleJsonSafe(
      vehiclePage(
        await this.repository.listStaff(
          query,
          branchId,
          actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
        ),
        query.limit,
      ),
    );
  }
  async staffVehicle(
    actor: AuthenticatedActor,
    id: string,
    context: RequestSecurityContext,
  ) {
    assertVehicleOperator(actor);
    const vehicle = await this.repository.vehicle(
      id,
      this.database,
      actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
    );
    if (vehicle === null) throw vehicleNotFound();
    await this.assertBranch(actor, vehicle.branchId);
    await this.audit(actor.userId, "VEHICLE", id, context, { privilegedRead: true });
    return vehicleJsonSafe(vehicle);
  }
  async createVehicle(
    actor: AuthenticatedActor,
    input: VehicleCreateInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleOperator(actor);
    if (actor.role === "STAFF" && Object.hasOwn(input, "acquisitionCostKobo"))
      throw vehicleForbidden();
    await this.assertBranch(actor, input.branchId);
    return this.database.$transaction(async (transaction) => {
      if ((await this.repository.activeBranch(input.branchId, transaction)) === null)
        throw vehicleNotFound();
      const vehicle = await this.repository.createVehicle(
        input,
        transaction,
        actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "VEHICLE",
        entityId: vehicle.id,
        newValues: { branchId: input.branchId, stockNumber: input.stockNumber },
        context,
      });
      return vehicleJsonSafe(vehicle);
    });
  }
  async updateVehicle(
    actor: AuthenticatedActor,
    id: string,
    input: VehicleUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleOperator(actor);
    if (actor.role === "STAFF" && Object.hasOwn(input, "acquisitionCostKobo"))
      throw vehicleForbidden();
    return this.database.$transaction(async (transaction) => {
      const existing = await this.repository.vehicle(id, transaction);
      if (existing === null) throw vehicleNotFound();
      await this.assertBranch(actor, existing.branchId, transaction);
      const updated = await this.repository.updateVehicle(
        id,
        input,
        transaction,
        actor.role === "ADMIN" || actor.role === "SUPER_ADMIN",
      );
      if (updated === null) throw vehicleStale();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "VEHICLE",
        entityId: id,
        oldValues: { version: existing.version },
        newValues: {
          version: updated.version,
          fields: Object.keys(input)
            .filter((key) => key !== "expectedVersion")
            .sort()
            .join(","),
        },
        context,
      });
      return vehicleJsonSafe(updated);
    });
  }
  async createListing(
    actor: AuthenticatedActor,
    input: ListingCreateInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const vehicle = await this.repository.vehicle(input.vehicleId, transaction);
      if (vehicle === null) throw vehicleNotFound();
      await this.assertBranch(actor, vehicle.branchId, transaction);
      const listing = await this.repository.createListing(vehicle, input, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "VEHICLE_LISTING",
        entityId: listing.id,
        newValues: {
          vehicleId: vehicle.id,
          branchId: vehicle.branchId,
          priceKobo: input.priceKobo,
        },
        context,
      });
      return vehicleJsonSafe(await this.repository.listing(listing.id, transaction));
    });
  }
  async updateListing(
    actor: AuthenticatedActor,
    id: string,
    input: ListingUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleOperator(actor);
    const { expectedVersion, ...fields } = input;
    const data = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ) as Prisma.VehicleListingUncheckedUpdateManyInput;
    return this.mutateListing(actor, id, expectedVersion, data, context);
  }
  async transitionListing(
    actor: AuthenticatedActor,
    id: string,
    input: ListingStatusInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const listing = await this.repository.lockListing(id, transaction);
      if (listing === null) throw vehicleNotFound();
      await this.assertBranch(actor, listing.branchId, transaction);
      if (
        !(listingTransitions[listing.status] as readonly string[]).includes(input.status)
      )
        throw vehicleConflict("Invalid listing lifecycle transition");
      const now = new Date();
      const updated = await this.repository.updateListing(
        id,
        input.expectedVersion,
        {
          status: input.status,
          ...(input.status === "AVAILABLE"
            ? { publishedAt: listing.publishedAt ?? now, archivedAt: null }
            : {}),
          ...(input.status === "ARCHIVED" ? { archivedAt: now } : {}),
        },
        transaction,
      );
      if (updated === null) throw vehicleStale();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "VEHICLE_LISTING",
        entityId: id,
        oldValues: { status: listing.status, version: listing.version },
        newValues: { status: input.status, version: updated.version },
        context,
      });
      return vehicleJsonSafe(updated);
    });
  }
  async changePrice(
    actor: AuthenticatedActor,
    id: string,
    input: ListingPriceInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const listing = await this.repository.lockListing(id, transaction);
      if (listing === null) throw vehicleNotFound();
      await this.assertBranch(actor, listing.branchId, transaction);
      if (["RESERVED", "SOLD", "ARCHIVED"].includes(listing.status))
        throw vehicleConflict("Committed listing prices cannot change");
      const staff = await this.repository.staff(actor.userId, transaction);
      if (staff === null) throw vehicleForbidden();
      const next = BigInt(input.priceKobo);
      if (next === listing.priceKobo) throw vehicleConflict("Price is unchanged");
      await this.repository.addPriceHistory(
        id,
        staff.id,
        listing.priceKobo,
        next,
        input.reason,
        transaction,
      );
      const updated = await this.repository.updateListing(
        id,
        input.expectedVersion,
        { priceKobo: next },
        transaction,
      );
      if (updated === null) throw vehicleStale();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "VEHICLE_LISTING",
        entityId: id,
        oldValues: { priceKobo: listing.priceKobo.toString() },
        newValues: { priceKobo: input.priceKobo, reason: input.reason },
        context,
      });
      return vehicleJsonSafe(updated);
    });
  }
  async createUpload(
    actor: AuthenticatedActor,
    vehicleId: string,
    input: AssetUploadInput,
  ) {
    assertVehicleOperator(actor);
    const vehicle = await this.repository.vehicle(vehicleId);
    if (vehicle === null) throw vehicleNotFound();
    await this.assertBranch(actor, vehicle.branchId);
    const issued = issueVehicleAssetTicket({
      actorUserId: actor.userId,
      vehicleId,
      ...input,
    });
    const upload = await this.storage.createUpload({
      key: issued.payload.objectKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
    });
    return { upload, assetToken: issued.ticket };
  }
  async addImage(
    actor: AuthenticatedActor,
    vehicleId: string,
    input: ImageCreateInput,
    context: RequestSecurityContext,
  ) {
    const imageId = randomUUID();
    return this.addAsset(
      actor,
      vehicleId,
      input.assetToken,
      "IMAGE",
      context,
      async (asset, transaction) =>
        this.repository.addImage(
          vehicleId,
          {
            id: imageId,
            url: `/api/v1/public/vehicles/images/${imageId}`,
            objectKey: asset.objectKey,
            checksum: asset.checksumSha256,
            ...(input.altText === undefined ? {} : { altText: input.altText }),
            sortOrder: input.sortOrder,
            isPrimary: input.isPrimary,
          },
          transaction,
        ),
    );
  }
  async addDocument(
    actor: AuthenticatedActor,
    vehicleId: string,
    input: DocumentCreateInput,
    context: RequestSecurityContext,
  ) {
    return this.addAsset(
      actor,
      vehicleId,
      input.assetToken,
      "DOCUMENT",
      context,
      (asset, transaction) =>
        this.repository.addDocument(
          vehicleId,
          {
            ...input,
            objectKey: asset.objectKey,
            checksum: asset.checksumSha256,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
          },
          transaction,
        ),
    );
  }
  async addConditionReport(
    actor: AuthenticatedActor,
    vehicleId: string,
    input: ConditionReportInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleOperator(actor);
    const ticket =
      input.assetToken === undefined
        ? null
        : this.consumeTicket(
            input.assetToken,
            actor.userId,
            vehicleId,
            "CONDITION_REPORT",
          );
    if (ticket !== null && !(await this.storage.verifyObject(this.objectRequest(ticket))))
      throw invalidAssetTicket();
    return this.database.$transaction(async (transaction) => {
      const vehicle = await this.repository.vehicle(vehicleId, transaction);
      if (vehicle === null) throw vehicleNotFound();
      await this.assertBranch(actor, vehicle.branchId, transaction);
      if (input.inspectionId !== undefined && input.inspectionId !== null) {
        const inspection = await transaction.inspectionRequest.findFirst({
          where: {
            id: input.inspectionId,
            status: "COMPLETED",
            vehicleListing: { vehicleId },
          },
          select: { id: true },
        });
        if (inspection === null) throw vehicleNotFound();
      }
      const asset =
        ticket === null
          ? null
          : { objectKey: ticket.objectKey, checksum: ticket.checksumSha256 };
      const report = await this.repository.addConditionReport(
        vehicleId,
        input,
        asset,
        transaction,
      );
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "INSPECTION",
        entityId: report.id,
        newValues: {
          vehicleId,
          inspectionId: input.inspectionId ?? null,
          hasPrivateReport: asset !== null,
        },
        context,
      });
      return vehicleJsonSafe(report);
    });
  }
  async reviewDocument(
    actor: AuthenticatedActor,
    vehicleId: string,
    documentId: string,
    input: DocumentReviewInput,
    context: RequestSecurityContext,
  ) {
    assertVehicleOperator(actor);
    return this.database.$transaction(async (transaction) => {
      const vehicle = await this.repository.vehicle(vehicleId, transaction);
      const document = await this.repository.document(vehicleId, documentId, transaction);
      const staff = await this.repository.staff(actor.userId, transaction);
      if (vehicle === null || document === null || staff === null)
        throw vehicleNotFound();
      await this.assertBranch(actor, vehicle.branchId, transaction);
      const now = new Date();
      const result = await transaction.vehicleDocument.updateMany({
        where: { id: documentId, vehicleId, version: input.expectedVersion },
        data: {
          verificationStatus: input.status,
          reviewedByStaffId: staff.id,
          verifiedAt: input.status === "VERIFIED" ? now : null,
          rejectionReason:
            input.status === "REJECTED" ? (input.rejectionReason ?? null) : null,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw vehicleStale();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "VEHICLE",
        entityId: vehicleId,
        newValues: { documentId, verificationStatus: input.status },
        context,
      });
      const updated = await this.repository.document(vehicleId, documentId, transaction);
      if (updated === null) throw vehicleNotFound();
      const { objectKey: _privateKey, ...safe } = updated;
      return vehicleJsonSafe(safe);
    });
  }
  async documentAccess(
    actor: AuthenticatedActor,
    vehicleId: string,
    documentId: string,
    context: RequestSecurityContext,
  ) {
    assertVehicleOperator(actor);
    const vehicle = await this.repository.vehicle(vehicleId);
    const document = await this.repository.document(vehicleId, documentId);
    if (vehicle === null || document === null) throw vehicleNotFound();
    await this.assertBranch(actor, vehicle.branchId);
    await this.audit(actor.userId, "VEHICLE", vehicleId, context, {
      privateDocumentId: documentId,
    });
    return {
      url: await this.storage.createDownload(
        document.objectKey,
        `vehicle-document-${document.id}`,
      ),
      expiresInSeconds: env.ASSET_DOWNLOAD_TTL_SECONDS,
    };
  }
  async saved(actor: AuthenticatedActor) {
    assertVehicleCustomer(actor);
    const customer = await this.repository.customer(actor.userId);
    if (customer === null) throw vehicleNotFound();
    return vehicleJsonSafe(await this.repository.listSaved(customer.id));
  }
  async save(actor: AuthenticatedActor, listingId: string) {
    assertVehicleCustomer(actor);
    return this.database.$transaction(async (transaction) => {
      const customer = await this.repository.customer(actor.userId, transaction);
      const listing = await transaction.vehicleListing.findFirst({
        where: { id: listingId, status: "AVAILABLE", branch: { isActive: true } },
        select: { id: true },
      });
      if (customer === null || listing === null) throw vehicleNotFound();
      return this.repository.save(customer.id, listingId, transaction);
    });
  }
  async unsave(actor: AuthenticatedActor, listingId: string) {
    assertVehicleCustomer(actor);
    const customer = await this.repository.customer(actor.userId);
    if (customer === null) throw vehicleNotFound();
    await this.database.$transaction((transaction) =>
      this.repository.unsave(customer.id, listingId, transaction),
    );
  }
  private consumeTicket(
    ticket: string,
    actorUserId: string,
    vehicleId: string,
    kind: VehicleAssetKind,
  ) {
    try {
      const asset = readVehicleAssetTicket(ticket);
      if (
        asset.actorUserId !== actorUserId ||
        asset.vehicleId !== vehicleId ||
        asset.kind !== kind ||
        asset.expiresAt < Date.now()
      )
        throw new Error("Asset ticket mismatch");
      return asset;
    } catch {
      throw invalidAssetTicket();
    }
  }
  private async addAsset<T>(
    actor: AuthenticatedActor,
    vehicleId: string,
    ticket: string,
    kind: VehicleAssetKind,
    context: RequestSecurityContext,
    create: (
      asset: ReturnType<VehiclesService["consumeTicket"]>,
      transaction: Prisma.TransactionClient,
    ) => Promise<T>,
  ) {
    assertVehicleOperator(actor);
    const asset = this.consumeTicket(ticket, actor.userId, vehicleId, kind);
    if (!(await this.storage.verifyObject(this.objectRequest(asset))))
      throw invalidAssetTicket();
    return this.database.$transaction(async (transaction) => {
      const vehicle = await this.repository.vehicle(vehicleId, transaction);
      if (vehicle === null) throw vehicleNotFound();
      await this.assertBranch(actor, vehicle.branchId, transaction);
      const result = await create(asset, transaction);
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "VEHICLE",
        entityId: vehicleId,
        newValues: { assetKind: kind, checksumSha256: asset.checksumSha256 },
        context,
      });
      return vehicleJsonSafe(result);
    });
  }
  private objectRequest(asset: ReturnType<VehiclesService["consumeTicket"]>) {
    return {
      key: asset.objectKey,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      checksumSha256: asset.checksumSha256,
    };
  }
  private async mutateListing(
    actor: AuthenticatedActor,
    id: string,
    expectedVersion: number,
    data: Prisma.VehicleListingUncheckedUpdateManyInput,
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction(async (transaction) => {
      const listing = await this.repository.lockListing(id, transaction);
      if (listing === null) throw vehicleNotFound();
      await this.assertBranch(actor, listing.branchId, transaction);
      if (listing.status === "SOLD" || listing.status === "ARCHIVED")
        throw vehicleConflict("Final listings cannot be edited");
      const updated = await this.repository.updateListing(
        id,
        expectedVersion,
        data,
        transaction,
      );
      if (updated === null) throw vehicleStale();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "VEHICLE_LISTING",
        entityId: id,
        oldValues: { version: listing.version },
        newValues: {
          version: updated.version,
          fields: Object.keys(data).sort().join(","),
        },
        context,
      });
      return vehicleJsonSafe(updated);
    });
  }
  private async allowedBranch(
    actor: AuthenticatedActor,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    if (actor.role !== "STAFF") return null;
    const staff = await this.repository.staff(actor.userId, client);
    if (staff?.branchId == null || staff.branch?.isActive !== true)
      throw vehicleForbidden();
    return staff.branchId;
  }
  private async assertBranch(
    actor: AuthenticatedActor,
    branchId: string,
    client: PrismaClient | Prisma.TransactionClient = this.database,
  ) {
    const allowed = await this.allowedBranch(actor, client);
    if (actor.role === "STAFF" && allowed !== branchId) throw vehicleForbidden();
  }
  private async audit(
    actorUserId: string,
    entityType: "VEHICLE",
    entityId: string,
    context: RequestSecurityContext,
    newValues: Readonly<Record<string, string | number | boolean | null>>,
  ) {
    await this.database.$transaction((transaction) =>
      appendAuditEvent(transaction, {
        actorUserId,
        action: "READ",
        entityType,
        entityId,
        newValues,
        context,
      }),
    );
  }
}

export const vehiclesService = new VehiclesService();
