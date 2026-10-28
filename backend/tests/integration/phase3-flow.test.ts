import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";

import { createApp } from "../../src/app.js";
import { decryptIdentityPayload } from "../../src/common/security/mfa-encryption.js";
import { hashPassword } from "../../src/common/security/passwords.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { prisma } from "../../src/config/database.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import type { IdentityEmailPayload } from "../../src/modules/identity/identity.types.js";
import { testOwner } from "../helpers/owner.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const origin = "http://localhost:3000";

async function createUser(role: UserRole) {
  if (role === "SUPER_ADMIN")
    return testOwner(await hashPassword(`synthetic owner ${randomUUID()}`));
  const id = randomUUID();
  const email = `${role.toLowerCase()}-${id}@example.test`;
  return prisma.user.create({
    data: {
      id,
      email,
      passwordHash: await hashPassword(`strong direct-user password ${id}`),
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Test",
                lastName: "Customer",
                phone: "+234 800 000 0000",
              },
            },
          }
        : {
            staffProfile: {
              create: { firstName: "Test", lastName: role, jobTitle: role },
            },
          }),
    },
    select: { id: true, email: true, role: true },
  });
}

async function createSession(userId: string, role: UserRole, assured = true) {
  const rawToken = generateOpaqueToken();
  const csrfToken = generateOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1_000);
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken("session", rawToken),
      csrfTokenHash: hashToken("csrf", csrfToken),
      expiresAt,
      idleExpiresAt: expiresAt,
      createdAt: now,
      lastRotatedAt: now,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role === "CUSTOMER" || !assured ? null : now,
    },
    select: { id: true },
  });
  return {
    id: session.id,
    cookie: `${sessionCookieName}=${rawToken}`,
    csrfToken,
  };
}

function tokenFromPayload(payload: IdentityEmailPayload): string {
  return decodeURIComponent(new URL(payload.link).hash.slice("#token=".length));
}

describe.skipIf(!runDatabaseTests)("Phase 3 customer and organization flow", () => {
  afterAll(async () => prisma.$disconnect());

  it("enforces ownership, privileged provisioning, MFA, authority changes, and auditability", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const staffRevision = async (userId: string, cookie: string) => {
      const response = await request(app)
        .get(`/api/v1/admin/staff/${userId}`)
        .set("Cookie", cookie)
        .expect(200);
      const member = response.body.data as {
        updatedAt: string;
        role: string;
        status: string;
        staffProfile: { updatedAt: string; branchId: string | null } | null;
      };
      return [
        member.updatedAt,
        member.role,
        member.status,
        member.staffProfile?.updatedAt,
        member.staffProfile?.branchId,
      ].join(":");
    };
    const customerA = await createUser("CUSTOMER");
    const customerB = await createUser("CUSTOMER");
    const customerASession = await createSession(customerA.id, customerA.role);
    const customerBSession = await createSession(customerB.id, customerB.role);

    const profile = await request(app)
      .get("/api/v1/customers/profile")
      .set("Cookie", customerASession.cookie);
    expect(profile.status).toBe(200);
    expect(profile.body.data.user).toEqual({ id: customerA.id, email: customerA.email });
    expect(profile.body.data).not.toHaveProperty("passwordHash");

    const updatedProfile = await request(app)
      .patch("/api/v1/customers/profile")
      .set("Origin", origin)
      .set("Cookie", customerASession.cookie)
      .set("X-CSRF-Token", customerASession.csrfToken)
      .send({
        expectedVersion: profile.body.data.profileVersion,
        city: "Lagos",
        state: "Lagos",
        address: null,
      });
    expect(updatedProfile.status).toBe(200);
    expect(updatedProfile.body.data.city).toBe("Lagos");

    const vin = randomUUID().replaceAll("-", "").slice(0, 17).toUpperCase();
    const createdVehicle = await request(app)
      .post("/api/v1/customers/vehicles")
      .set("Origin", origin)
      .set("Cookie", customerASession.cookie)
      .set("X-CSRF-Token", customerASession.csrfToken)
      .send({
        make: "Toyota",
        model: "Camry",
        year: 2022,
        registrationNumber: "ABC-123XY",
        vin,
      });
    expect(createdVehicle.status).toBe(201);
    expect(createdVehicle.body.data).not.toHaveProperty("customerId");
    const vehicleId = createdVehicle.body.data.id as string;

    const ownVehicle = await request(app)
      .get(`/api/v1/customers/vehicles/${vehicleId}`)
      .set("Cookie", customerASession.cookie);
    expect(ownVehicle.status).toBe(200);

    const secondVehicle = await request(app)
      .post("/api/v1/customers/vehicles")
      .set("Origin", origin)
      .set("Cookie", customerASession.cookie)
      .set("X-CSRF-Token", customerASession.csrfToken)
      .send({ make: "Honda", model: "Accord", year: 2021 });
    expect(secondVehicle.status).toBe(201);
    const firstPage = await request(app)
      .get("/api/v1/customers/vehicles?limit=1")
      .set("Cookie", customerASession.cookie);
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.data.vehicles).toHaveLength(1);
    expect(firstPage.body.data.nextCursor).toEqual(expect.any(String));
    const secondPage = await request(app)
      .get(
        `/api/v1/customers/vehicles?limit=1&cursor=${String(firstPage.body.data.nextCursor)}`,
      )
      .set("Cookie", customerASession.cookie);
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data.vehicles).toHaveLength(1);

    const crossCustomerRead = await request(app)
      .get(`/api/v1/customers/vehicles/${vehicleId}`)
      .set("Cookie", customerBSession.cookie);
    expect(crossCustomerRead.status).toBe(404);

    const massAssignment = await request(app)
      .patch(`/api/v1/customers/vehicles/${vehicleId}`)
      .set("Origin", origin)
      .set("Cookie", customerASession.cookie)
      .set("X-CSRF-Token", customerASession.csrfToken)
      .send({ customerId: customerB.id, mileageKm: 100 });
    expect(massAssignment.status).toBe(422);

    const updatedVehicle = await request(app)
      .patch(`/api/v1/customers/vehicles/${vehicleId}`)
      .set("Origin", origin)
      .set("Cookie", customerASession.cookie)
      .set("X-CSRF-Token", customerASession.csrfToken)
      .send({ mileageKm: 10_000 });
    expect(updatedVehicle.status).toBe(200);
    expect(updatedVehicle.body.data.mileageKm).toBe(10_000);

    const inactiveBranch = await prisma.branch.create({
      data: {
        code: `I-${randomUUID().slice(0, 8)}`,
        name: "Inactive Test Branch",
        address: "1 Test Road",
        city: "Lagos",
        state: "Lagos",
        isActive: false,
      },
    });
    const publicInactive = await request(app).get(
      `/api/v1/public/branches/${inactiveBranch.id}`,
    );
    expect(publicInactive.status).toBe(404);

    const admin = await createUser("ADMIN");
    const superAdmin = await createUser("SUPER_ADMIN");
    const adminSession = await createSession(admin.id, admin.role);
    const superSession = await createSession(superAdmin.id, superAdmin.role);

    const branchResponse = await request(app)
      .post("/api/v1/admin/branches")
      .set("Origin", origin)
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({
        code: `B-${randomUUID().slice(0, 8)}`,
        name: "Phase Three Branch",
        address: "2 Test Road",
        city: "Abuja",
        state: "FCT",
      });
    expect(branchResponse.status).toBe(201);
    const branchId = branchResponse.body.data.id as string;

    const activePublicBranch = await request(app).get(
      `/api/v1/public/branches/${branchId}`,
    );
    expect(activePublicBranch.status).toBe(200);

    const adminBranch = await request(app)
      .get(`/api/v1/admin/branches/${branchId}`)
      .set("Cookie", adminSession.cookie);
    expect(adminBranch.status).toBe(200);
    const inactiveBranches = await request(app)
      .get("/api/v1/admin/branches?isActive=false&limit=1")
      .set("Cookie", adminSession.cookie);
    expect(inactiveBranches.status).toBe(200);
    expect(inactiveBranches.body.data.items).toHaveLength(1);
    expect(inactiveBranches.body.data.items[0].isActive).toBe(false);

    const renamedBranch = await request(app)
      .patch(`/api/v1/admin/branches/${branchId}`)
      .set("Origin", origin)
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({ name: "Renamed Phase Three Branch" });
    expect(renamedBranch.status).toBe(200);

    const forbiddenAdminInvite = await request(app)
      .post("/api/v1/admin/staff/invitations")
      .set("Origin", origin)
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({
        email: `new-admin-${randomUUID()}@example.test`,
        role: "ADMIN",
        currentPassword: `strong direct-user password ${admin.id}`,
      });
    expect(forbiddenAdminInvite.status).toBe(409);

    const adminListing = await request(app)
      .get("/api/v1/admin/staff?role=ADMIN&limit=1")
      .set("Cookie", adminSession.cookie);
    expect(adminListing.status).toBe(200);
    expect(adminListing.body.data.items).toHaveLength(1);
    const adminDetail = await request(app)
      .get(`/api/v1/admin/staff/${admin.id}`)
      .set("Cookie", adminSession.cookie);
    expect(adminDetail.status).toBe(200);
    expect(adminDetail.body.data).not.toHaveProperty("passwordHash");

    const candidate = await createUser("CUSTOMER");
    const promotion = await request(app)
      .post("/api/v1/admin/staff/promotions")
      .set("Origin", origin)
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({
        customerUserId: candidate.id,
        branchId,
        currentPassword: `strong direct-user password ${admin.id}`,
      });
    expect(promotion.status).toBe(200);
    const invited = await prisma.user.findUniqueOrThrow({
      where: { id: candidate.id },
      include: { staffProfile: true },
    });
    expect(invited.role).toBe("STAFF");
    expect(invited.staffProfile?.branchId).toBe(branchId);

    const pendingSession = await createSession(invited.id, "STAFF", false);
    const deniedBeforeMfa = await request(app)
      .get("/api/v1/staff/profile")
      .set("Cookie", pendingSession.cookie);
    expect(deniedBeforeMfa.status).toBe(403);

    const staffSession = await createSession(invited.id, "STAFF");
    const ownStaffProfile = await request(app)
      .get("/api/v1/staff/profile")
      .set("Cookie", staffSession.cookie);
    expect(ownStaffProfile.status).toBe(200);
    expect(ownStaffProfile.body.data).not.toHaveProperty("passwordHash");
    const staffCannotAdminister = await request(app)
      .get("/api/v1/admin/branches")
      .set("Cookie", staffSession.cookie);
    expect(staffCannotAdminister.status).toBe(403);

    const secondBranch = await prisma.branch.create({
      data: {
        code: `S-${randomUUID().slice(0, 8)}`,
        name: "Second Phase Three Branch",
        address: "3 Test Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const beforeAssignment = await prisma.staffProfile.findUniqueOrThrow({
      where: { userId: invited.id },
    });
    await request(app)
      .patch(`/api/v1/admin/staff/${invited.id}/branch`)
      .set("Origin", origin)
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({ branchId: secondBranch.id })
      .expect(422);
    await request(app)
      .patch(`/api/v1/admin/staff/${invited.id}/status`)
      .set("Origin", origin)
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({ status: "SUSPENDED" })
      .expect(422);
    expect(
      (await prisma.staffProfile.findUniqueOrThrow({ where: { userId: invited.id } }))
        .branchId,
    ).toBe(beforeAssignment.branchId);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: invited.id } })).status,
    ).toBe("ACTIVE");
    const raceTarget = await createUser("STAFF");
    const raceRevision = await staffRevision(raceTarget.id, adminSession.cookie);
    const competing = await Promise.all([
      request(app)
        .patch(`/api/v1/admin/staff/${raceTarget.id}/status`)
        .set("Origin", origin)
        .set("Cookie", adminSession.cookie)
        .set("X-CSRF-Token", adminSession.csrfToken)
        .send({ status: "SUSPENDED", expectedRevision: raceRevision }),
      request(app)
        .patch(`/api/v1/admin/staff/${raceTarget.id}/branch`)
        .set("Origin", origin)
        .set("Cookie", adminSession.cookie)
        .set("X-CSRF-Token", adminSession.csrfToken)
        .send({ branchId: secondBranch.id, expectedRevision: raceRevision }),
    ]);
    expect(competing.map((response) => response.status).sort()).toEqual([200, 409]);
    const assigned = await request(app)
      .patch(`/api/v1/admin/staff/${invited.id}/branch`)
      .set("Origin", origin)
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({
        branchId: secondBranch.id,
        expectedRevision: await staffRevision(invited.id, adminSession.cookie),
      });
    expect(assigned.status).toBe(200);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: staffSession.id } }))
        .revokedAt,
    ).toBeInstanceOf(Date);

    const deactivateOccupiedBranch = await request(app)
      .patch(`/api/v1/admin/branches/${secondBranch.id}`)
      .set("Origin", origin)
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({ isActive: false });
    expect(deactivateOccupiedBranch.status).toBe(409);

    const superCannotAssignAdmin = await request(app)
      .patch(`/api/v1/admin/staff/${admin.id}/branch`)
      .set("Origin", origin)
      .set("Cookie", superSession.cookie)
      .set("X-CSRF-Token", superSession.csrfToken)
      .send({ branchId, expectedRevision: "stale-revision" });
    expect(superCannotAssignAdmin.status).toBe(409);

    const selfAdministration = await request(app)
      .patch(`/api/v1/admin/staff/${superAdmin.id}/status`)
      .set("Origin", origin)
      .set("Cookie", superSession.cookie)
      .set("X-CSRF-Token", superSession.csrfToken)
      .send({ status: "SUSPENDED", expectedRevision: "stale-revision" });
    expect(selfAdministration.status).toBe(403);

    const beforeRoleChange = await createSession(invited.id, "STAFF");
    const changedRole = await request(app)
      .patch(`/api/v1/admin/staff/${invited.id}/role`)
      .set("Origin", origin)
      .set("Cookie", superSession.cookie)
      .set("X-CSRF-Token", superSession.csrfToken)
      .send({ role: "ADMIN" });
    expect(changedRole.status).toBe(422);
    const invitationResponse = await request(app)
      .post("/api/v1/admin/staff/invitations")
      .set("Origin", origin)
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({
        email: invited.email,
        role: "ADMIN",
        currentPassword: `strong direct-user password ${admin.id}`,
      });
    expect(invitationResponse.status).toBe(202);
    const invitation = await prisma.privilegedInvitation.findUniqueOrThrow({
      where: { id: invitationResponse.body.data.invitation.id },
    });
    const invitationOutbox = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: invitation.id },
    });
    expect(JSON.stringify(invitationOutbox.payload)).not.toContain("#token=");
    const invitationPayload = decryptIdentityPayload<IdentityEmailPayload>(
      (
        invitationOutbox.payload as {
          encrypted: Parameters<typeof decryptIdentityPayload>[0];
        }
      ).encrypted,
    );
    const invitationToken = tokenFromPayload(invitationPayload);
    expect(invitation.tokenHash).toBe(
      hashToken("privileged-invitation", invitationToken),
    );
    const accepted = await request(app)
      .post("/api/v1/auth/staff/invitations/accept")
      .set("Origin", origin)
      .set("Cookie", beforeRoleChange.cookie)
      .set("X-CSRF-Token", beforeRoleChange.csrfToken)
      .send({
        token: invitationToken,
        currentPassword: `strong direct-user password ${invited.id}`,
      });
    expect(accepted.status).toBe(200);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: beforeRoleChange.id } }))
        .revokedAt,
    ).toBeInstanceOf(Date);
    expect(
      (await prisma.staffProfile.findUniqueOrThrow({ where: { userId: invited.id } }))
        .branchId,
    ).toBeNull();

    await request(app)
      .patch(`/api/v1/admin/staff/${invited.id}/role`)
      .set("Origin", origin)
      .set("Cookie", superSession.cookie)
      .set("X-CSRF-Token", superSession.csrfToken)
      .send({ role: "STAFF", branchId: secondBranch.id })
      .expect(422);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: invited.id } })).role,
    ).toBe("ADMIN");

    const adminCannotSuspendAdmin = await request(app)
      .patch(`/api/v1/admin/staff/${invited.id}/status`)
      .set("Origin", origin)
      .set("Cookie", adminSession.cookie)
      .set("X-CSRF-Token", adminSession.csrfToken)
      .send({ status: "SUSPENDED", expectedRevision: "stale-revision" });
    expect(adminCannotSuspendAdmin.status).toBe(403);

    const invitedAdminSession = await createSession(invited.id, "ADMIN");
    const suspended = await request(app)
      .patch(`/api/v1/admin/staff/${invited.id}/status`)
      .set("Origin", origin)
      .set("Cookie", superSession.cookie)
      .set("X-CSRF-Token", superSession.csrfToken)
      .send({
        status: "SUSPENDED",
        expectedRevision: await staffRevision(invited.id, superSession.cookie),
      });
    expect(suspended.status).toBe(200);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: invitedAdminSession.id } }))
        .revokedAt,
    ).toBeInstanceOf(Date);
    const repeatedSuspension = await request(app)
      .patch(`/api/v1/admin/staff/${invited.id}/status`)
      .set("Origin", origin)
      .set("Cookie", superSession.cookie)
      .set("X-CSRF-Token", superSession.csrfToken)
      .send({
        status: "SUSPENDED",
        expectedRevision: await staffRevision(invited.id, superSession.cookie),
      });
    expect(repeatedSuspension.status).toBe(409);
    const reactivated = await request(app)
      .patch(`/api/v1/admin/staff/${invited.id}/status`)
      .set("Origin", origin)
      .set("Cookie", superSession.cookie)
      .set("X-CSRF-Token", superSession.csrfToken)
      .send({
        status: "ACTIVE",
        expectedRevision: await staffRevision(invited.id, superSession.cookie),
      });
    expect(reactivated.status).toBe(200);

    const auditActions = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: vehicleId },
          { entityId: invitation.id },
          { entityId: invited.id },
        ],
      },
      select: { action: true },
    });
    expect(auditActions.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        "CREATE",
        "UPDATE",
        "INVITATION_CREATED",
        "INVITATION_ACCEPTED",
        "ROLE_CHANGE",
        "ACCOUNT_SUSPENDED",
      ]),
    );

    const deleted = await request(app)
      .delete(`/api/v1/customers/vehicles/${vehicleId}`)
      .set("Origin", origin)
      .set("Cookie", customerASession.cookie)
      .set("X-CSRF-Token", customerASession.csrfToken);
    expect(deleted.status).toBe(200);
  }, 45_000);
});
