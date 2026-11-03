import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { workforceSnapshot, branchesFor } from "../organization/workforce.policy.js";
import { paymentConflict } from "../payments/payments.errors.js";
import type { WorkshopResources } from "../service-operations/workshop-resources.js";

/** A policy cannot create employees, services or permissions by naming them. */
export async function validateWorkshopResourceReferences(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  branchId: string,
  settings: WorkshopResources,
) {
  if (
    !(await tx.branch.findFirst({
      where: { id: branchId, isActive: true },
      select: { id: true },
    }))
  )
    throw paymentConflict("Select an active workshop branch before reviewing resources");
  const services = settings.services.map((row) => row.serviceId).sort();
  for (const id of services)
    await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id"=${id}::uuid FOR SHARE`;
  if (
    (await tx.service.count({ where: { id: { in: services }, isActive: true } })) !==
    services.length
  )
    throw paymentConflict(
      "Select actual active services before approving workshop resources",
    );
  for (const staffId of settings.technicians.map((row) => row.staffId).sort()) {
    const staff = await tx.staffProfile.findUnique({
      where: { id: staffId },
      select: {
        branchId: true,
        user: { select: { id: true, role: true, status: true, emailVerifiedAt: true } },
      },
    });
    if (
      !staff ||
      staff.user.status !== "ACTIVE" ||
      !staff.user.emailVerifiedAt ||
      staff.user.role === "CUSTOMER"
    )
      throw paymentConflict("Select verified active workshop technicians");
    const access = await workforceSnapshot(tx, {
      ...actor,
      userId: staff.user.id,
      role: staff.user.role,
    });
    // Keep the existing legacy role/branch work boundary. A managed account
    // must satisfy its actual current duty; listing it never restores a revoked duty.
    if (
      access.managed
        ? !branchesFor(access, "JOBS_UPDATE").includes(branchId)
        : staff.branchId !== branchId
    )
      throw paymentConflict(
        "Every selected technician needs current work access in this branch; the resource plan does not grant it",
      );
  }
}
