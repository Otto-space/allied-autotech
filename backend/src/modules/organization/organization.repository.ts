import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import type {
  AdminBranchListQuery,
  BranchCreateInput,
  BranchUpdateInput,
  PublicBranchListQuery,
  StaffListQuery,
} from "./organization.schemas.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export const safeBranchSelect = {
  id: true,
  code: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  city: true,
  state: true,
  country: true,
  timezone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BranchSelect;

export const safeStaffSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
  staffProfile: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      jobTitle: true,
      branchId: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: { id: true, code: true, name: true, isActive: true },
      },
    },
  },
} satisfies Prisma.UserSelect;

export class OrganizationRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  listPublicBranches(query: PublicBranchListQuery) {
    return this.database.branch.findMany({
      where: {
        isActive: true,
        ...(query.city === undefined
          ? {}
          : { city: { equals: query.city, mode: "insensitive" } }),
        ...(query.state === undefined
          ? {}
          : { state: { equals: query.state, mode: "insensitive" } }),
      },
      select: safeBranchSelect,
      orderBy: { id: "asc" },
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }

  branch(branchId: string, activeOnly: boolean, client: DatabaseClient = this.database) {
    return client.branch.findFirst({
      where: { id: branchId, ...(activeOnly ? { isActive: true } : {}) },
      select: safeBranchSelect,
    });
  }

  listBranches(query: AdminBranchListQuery, client: DatabaseClient = this.database) {
    return client.branch.findMany({
      where: query.isActive === undefined ? {} : { isActive: query.isActive },
      select: safeBranchSelect,
      orderBy: { id: "asc" },
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }

  createBranch(input: BranchCreateInput, client: DatabaseClient) {
    const data: Prisma.BranchCreateInput = {
      code: input.code,
      name: input.name,
      address: input.address,
      city: input.city,
      state: input.state,
      country: input.country,
      timezone: input.timezone,
      isActive: input.isActive,
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.email === undefined ? {} : { email: input.email }),
    };
    return client.branch.create({ data, select: safeBranchSelect });
  }

  updateBranch(branchId: string, input: BranchUpdateInput, client: DatabaseClient) {
    const data: Prisma.BranchUpdateInput = {
      ...(input.code === undefined ? {} : { code: input.code }),
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.email === undefined ? {} : { email: input.email }),
      ...(input.address === undefined ? {} : { address: input.address }),
      ...(input.city === undefined ? {} : { city: input.city }),
      ...(input.state === undefined ? {} : { state: input.state }),
      ...(input.country === undefined ? {} : { country: input.country }),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    };
    return client.branch.update({
      where: { id: branchId },
      data,
      select: safeBranchSelect,
    });
  }

  countActiveAssignedStaff(branchId: string, client: DatabaseClient) {
    return client.staffProfile.count({
      where: { branchId, user: { role: "STAFF", status: "ACTIVE" } },
    });
  }

  staff(userId: string, client: DatabaseClient = this.database) {
    return client.user.findFirst({
      where: { id: userId, role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] } },
      select: safeStaffSelect,
    });
  }

  listStaff(query: StaffListQuery, client: DatabaseClient = this.database) {
    return client.user.findMany({
      where: {
        role: query.role ?? { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.branchId === undefined
          ? {}
          : { staffProfile: { is: { branchId: query.branchId } } }),
      },
      select: safeStaffSelect,
      orderBy: { id: "asc" },
      take: query.limit + 1,
      ...(query.cursor === undefined ? {} : { cursor: { id: query.cursor }, skip: 1 }),
    });
  }
}
