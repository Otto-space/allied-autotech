import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import { AppError } from "../../common/errors/app-error.js";
import { savedVehicleQualifierKeys } from "./customers.schemas.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { customerResourceNotFound } from "./customers.errors.js";
import { assertCustomerActor } from "./customers.policy.js";
import type {
  CustomerProfileUpdateInput,
  CustomerVehicleCreateInput,
  CustomerVehicleListQuery,
  CustomerVehicleUpdateInput,
} from "./customers.schemas.js";
import { CustomersRepository } from "./customers.repository.js";
import type { CustomerVehiclePage } from "./customers.types.js";

export class CustomersService {
  private readonly repository: CustomersRepository;

  constructor(private readonly database: PrismaClient = prisma) {
    this.repository = new CustomersRepository(database);
  }

  async profile(actor: AuthenticatedActor) {
    assertCustomerActor(actor);
    const profile = await this.repository.profile(actor.userId);
    if (profile === null) throw customerResourceNotFound();
    return profile;
  }

  async updateProfile(
    actor: AuthenticatedActor,
    input: CustomerProfileUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    return this.database.$transaction(async (transaction) => {
      const existing = await this.repository.profile(actor.userId, transaction);
      if (existing === null) throw customerResourceNotFound();
      const profile = await this.repository.updateProfile(
        actor.userId,
        input,
        transaction,
      );
      if (profile === null) throw customerResourceNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "CUSTOMER_PROFILE",
        entityId: existing.id,
        newValues: {
          changedFields: Object.keys(input)
            .filter((key) => key !== "expectedVersion")
            .sort()
            .join(","),
          profileVersion: profile.profileVersion,
        },
        context,
      });
      return profile;
    });
  }

  async listVehicles(
    actor: AuthenticatedActor,
    query: CustomerVehicleListQuery,
  ): Promise<CustomerVehiclePage> {
    assertCustomerActor(actor);
    if (query.cursor !== undefined) {
      const cursor = await this.repository.vehicle(actor.userId, query.cursor);
      if (cursor === null || (query.defaultOnly && !cursor.isDefault))
        throw customerResourceNotFound();
    }
    const rows = await this.repository.listVehicles(
      actor.userId,
      query.cursor,
      query.limit,
      query.defaultOnly,
    );
    if (rows === null) throw customerResourceNotFound();
    const hasMore = rows.length > query.limit;
    const vehicles = hasMore ? rows.slice(0, query.limit) : rows;
    const last = vehicles.at(-1);
    return {
      vehicles,
      ...(hasMore && last !== undefined ? { nextCursor: last.id } : {}),
    };
  }

  async vehicle(actor: AuthenticatedActor, vehicleId: string) {
    assertCustomerActor(actor);
    const vehicle = await this.repository.vehicle(actor.userId, vehicleId);
    if (vehicle === null) throw customerResourceNotFound();
    return vehicle;
  }

  private async vehicleConfiguration<
    T extends CustomerVehicleCreateInput | CustomerVehicleUpdateInput,
  >(
    input: T,
    tx: Prisma.TransactionClient,
    existing?: {
      vehicleModelId: string | null;
      year: number;
      make: string;
      model: string;
    },
  ): Promise<T> {
    const next = { ...input };
    const modelId =
      input.vehicleModelId === undefined
        ? existing?.vehicleModelId
        : input.vehicleModelId;
    if (
      (input.vehicleModelId !== undefined &&
        input.vehicleModelId !== existing?.vehicleModelId) ||
      (existing && input.year !== undefined && input.year !== existing.year)
    )
      for (const key of savedVehicleQualifierKeys)
        if (next[key] === undefined) next[key] = null;
    for (const key of savedVehicleQualifierKeys) {
      const value = next[key];
      if (typeof value === "string") {
        const normalized = value.normalize("NFKC").trim();
        if (normalized.length > 100)
          throw new AppError({
            code: "VALIDATION_FAILED",
            statusCode: 422,
            message: "Vehicle specification is too long after normalization",
          });
        next[key] = normalized;
      }
    }
    const sameName = (a: string, b: string) =>
      a.normalize("NFKC").trim().toLowerCase() ===
      b.normalize("NFKC").trim().toLowerCase();
    const selectionChanged =
      !existing ||
      (input.vehicleModelId !== undefined &&
        input.vehicleModelId !== existing.vehicleModelId) ||
      (input.year !== undefined && input.year !== existing.year) ||
      (input.make !== undefined && !sameName(input.make, existing.make)) ||
      (input.model !== undefined && !sameName(input.model, existing.model));
    if (modelId && selectionChanged) {
      const model = await tx.vehicleModel.findFirst({
        where: { id: modelId, isActive: true, make: { isActive: true } },
        include: { make: true },
      });
      const year = input.year ?? existing?.year;
      if (
        !model ||
        year === undefined ||
        year < model.yearFrom ||
        year > model.yearTo ||
        (input.make !== undefined && !sameName(input.make, model.make.name)) ||
        (input.model !== undefined && !sameName(input.model, model.name))
      )
        throw new AppError({
          code: "VALIDATION_FAILED",
          statusCode: 422,
          message:
            "Choose a matching catalogue make, model and supported year, or explicitly unlink the catalogue configuration",
        });
      next.make = model.make.name;
      next.model = model.name;
    }
    if (modelId && !selectionChanged && existing) {
      next.make = existing.make;
      next.model = existing.model;
    }
    return next;
  }

  private async switchDefault(
    transaction: Prisma.TransactionClient,
    customerId: string,
    vehicleId: string | null,
    actor: AuthenticatedActor,
    context: RequestSecurityContext,
  ) {
    const previous = await this.repository.clearOtherDefaults(
      customerId,
      vehicleId,
      transaction,
    );
    for (const row of previous)
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "CUSTOMER_VEHICLE",
        entityId: row.id,
        newValues: { changedFields: "isDefault", isDefault: false },
        context,
      });
  }

  async createVehicle(
    actor: AuthenticatedActor,
    input: CustomerVehicleCreateInput,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    return this.database.$transaction(async (transaction) => {
      const customerId = await this.repository.lockGarage(actor.userId, transaction);
      if (!customerId) throw customerResourceNotFound();
      const prepared = await this.vehicleConfiguration(input, transaction);
      if (input.isDefault)
        await this.switchDefault(transaction, customerId, null, actor, context);
      const vehicle = await this.repository.createVehicle(
        actor.userId,
        prepared,
        transaction,
      );
      if (vehicle === null) throw customerResourceNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "CUSTOMER_VEHICLE",
        entityId: vehicle.id,
        newValues: {
          ownerUserId: actor.userId,
          isDefault: vehicle.isDefault,
          catalogueLinked: vehicle.vehicleModelId !== null,
        },
        context,
      });
      return vehicle;
    });
  }

  async updateVehicle(
    actor: AuthenticatedActor,
    vehicleId: string,
    input: CustomerVehicleUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    return this.database.$transaction(async (transaction) => {
      const customerId = await this.repository.lockGarage(actor.userId, transaction);
      if (!customerId) throw customerResourceNotFound();
      const existing = await this.repository.vehicle(
        actor.userId,
        vehicleId,
        transaction,
      );
      if (!existing) throw customerResourceNotFound();
      const prepared = await this.vehicleConfiguration(input, transaction, existing);
      if (input.isDefault)
        await this.switchDefault(transaction, customerId, vehicleId, actor, context);
      const vehicle = await this.repository.updateVehicle(
        actor.userId,
        vehicleId,
        prepared,
        transaction,
      );
      if (vehicle === null) throw customerResourceNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "CUSTOMER_VEHICLE",
        entityId: vehicle.id,
        newValues: {
          changedFields: Object.keys(prepared)
            .filter((key) => key !== "expectedUpdatedAt")
            .sort()
            .join(","),
          isDefault: vehicle.isDefault,
        },
        context,
      });
      return vehicle;
    });
  }

  async deleteVehicle(
    actor: AuthenticatedActor,
    vehicleId: string,
    context: RequestSecurityContext,
  ): Promise<void> {
    assertCustomerActor(actor);
    await this.database.$transaction(async (transaction) => {
      if (!(await this.repository.lockGarage(actor.userId, transaction)))
        throw customerResourceNotFound();
      const vehicle = await this.repository.deleteVehicle(
        actor.userId,
        vehicleId,
        transaction,
      );
      if (vehicle === null) throw customerResourceNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "DELETE",
        entityType: "CUSTOMER_VEHICLE",
        entityId: vehicle.id,
        oldValues: { ownerUserId: actor.userId },
        context,
      });
    });
  }
}

export const customersService = new CustomersService();
