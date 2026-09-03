import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
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
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "CUSTOMER_PROFILE",
        entityId: existing.id,
        newValues: { changedFields: Object.keys(input).sort().join(",") },
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
      if (cursor === null) throw customerResourceNotFound();
    }
    const rows = await this.repository.listVehicles(
      actor.userId,
      query.cursor,
      query.limit,
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

  async createVehicle(
    actor: AuthenticatedActor,
    input: CustomerVehicleCreateInput,
    context: RequestSecurityContext,
  ) {
    assertCustomerActor(actor);
    return this.database.$transaction(async (transaction) => {
      const vehicle = await this.repository.createVehicle(
        actor.userId,
        input,
        transaction,
      );
      if (vehicle === null) throw customerResourceNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "CUSTOMER_VEHICLE",
        entityId: vehicle.id,
        newValues: { ownerUserId: actor.userId },
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
      const vehicle = await this.repository.updateVehicle(
        actor.userId,
        vehicleId,
        input,
        transaction,
      );
      if (vehicle === null) throw customerResourceNotFound();
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "CUSTOMER_VEHICLE",
        entityId: vehicle.id,
        newValues: { changedFields: Object.keys(input).sort().join(",") },
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
