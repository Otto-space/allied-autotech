import { randomUUID } from "node:crypto";
import { prisma } from "../../src/config/database.js";
import { hashPassword } from "../../src/common/security/passwords.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import {
  workforceTemplates,
  type Template,
} from "../../src/modules/organization/workforce.policy.js";
import { testOwner } from "../helpers/owner.js";

export const fixturePassword = "Synthetic workforce proof passphrase 2026!";
export async function workforceFixture() {
  if (
    process.env.RUN_DATABASE_TESTS !== "true" ||
    !/_(?:test|ci)$/.test(process.env.DB_NAME ?? "")
  )
    throw Error("Workforce fixtures require a disposable _test/_ci database");
  const hash = await hashPassword(fixturePassword);
  const owner = await testOwner(hash);
  async function branch() {
    return prisma.branch.create({
      data: {
        code: `WF-${randomUUID().slice(0, 8)}`,
        name: "Synthetic workforce branch",
        address: "Synthetic test address",
        city: "Test",
        state: "Test",
      },
    });
  }
  const home = await branch(),
    other = await branch();
  async function session(userId: string, role: string, assured = true) {
    const token = generateOpaqueToken(),
      csrf = generateOpaqueToken(),
      expiresAt = new Date(Date.now() + 3_600_000);
    const record = await prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken("session", token),
        csrfTokenHash: hashToken("csrf", csrf),
        createdAt: new Date(Date.now() - 1000),
        expiresAt,
        idleExpiresAt: expiresAt,
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role !== "CUSTOMER" && assured ? new Date() : null,
      },
    });
    return {
      record,
      headers: {
        Cookie: `${sessionCookieName}=${token}`,
        Origin: "http://localhost:3000",
        "X-CSRF-Token": csrf,
      },
    };
  }
  async function account(
    template: Template | null,
    role: "STAFF" | "ADMIN" | "CUSTOMER" = "STAFF",
    branchId = home.id,
  ) {
    const user = await prisma.user.create({
      data: {
        email: `workforce-${randomUUID()}@example.test`,
        role,
        passwordHash: hash,
        emailVerifiedAt: new Date(),
        ...(role === "CUSTOMER"
          ? {
              profile: {
                create: {
                  firstName: "Synthetic",
                  lastName: "Customer",
                  phone: "+2348000000000",
                },
              },
            }
          : {
              staffProfile: {
                create: {
                  firstName: "Synthetic",
                  lastName: template ?? "Admin",
                  branchId,
                },
              },
            }),
      },
      include: { staffProfile: true, profile: true },
    });
    if (template) {
      await prisma.workforceAccess.create({
        data: { userId: user.id, position: template, updatedByUserId: owner.id },
      });
      await assignment(user.id, template, false, branchId);
    }
    return { user, ...(await session(user.id, role)) };
  }
  async function assignment(
    userId: string,
    template: Template,
    temporary = false,
    branchId = home.id,
    expiresAt: Date | null = null,
  ) {
    return prisma.workforceAssignment.create({
      data: {
        userId,
        template,
        branchId,
        scope: workforceTemplates[template].scope,
        temporary,
        startsAt: new Date(Date.now() - 10_000),
        expiresAt,
        reason: temporary
          ? "Position vacant; synthetic temporary coverage"
          : "Synthetic reviewed primary assignment",
        assignedByUserId: owner.id,
      },
    });
  }
  const operations = await account("OPERATIONS", "ADMIN");
  const salesCover = await assignment(operations.user.id, "SALES_SUPERVISOR", true);
  const careCover = await assignment(operations.user.id, "CUSTOMER_SERVICE", true);
  const mechanical1 = await account("MECHANICAL_TECHNICIAN"),
    mechanical2 = await account("MECHANICAL_TECHNICIAN"),
    electrical = await account("ELECTRICAL_TECHNICIAN");
  const lead = await account("WORKSHOP_LEAD"),
    accountant = await account("ACCOUNTANT"),
    cashier = await account("SALES_CASHIER"),
    sales = await account("SALES_SUPERVISOR"),
    care = await account("CUSTOMER_SERVICE");
  const scopedAdmin = await account("OPERATIONS", "ADMIN");
  await prisma.workforceAccess.update({
    where: { userId: scopedAdmin.user.id },
    data: {
      delegatedTemplates: ["CUSTOMER_SERVICE", "ADMIN_INVITE"],
      delegatedBranchIds: [home.id],
    },
  });
  const customer = await account(null, "CUSTOMER"),
    stranger = await account(null, "CUSTOMER");
  const service = await prisma.service.create({
    data: {
      name: "Synthetic workforce diagnostic",
      slug: `wf-${randomUUID()}`,
      pricingType: "QUOTE_REQUIRED",
      durationMinutes: 60,
    },
  });
  async function job(staffId: string, branchId = home.id) {
    return prisma.booking.create({
      data: {
        customerId: customer.user.profile!.id,
        branchId,
        assignedStaffId: staffId,
        serviceId: service.id,
        scheduledAt: new Date(),
        status: "CONFIRMED",
        confirmedAt: new Date(),
        customerNotes: "Synthetic reported symptoms",
        staffNotes: "Restricted administrative note",
        workOrder: {
          create: {
            workOrderNumber: `WF-${randomUUID()}`,
            status: "APPROVED",
            openedAt: new Date(),
          },
        },
      },
      include: { workOrder: true },
    });
  }
  const job1 = await job(mechanical1.user.staffProfile!.id),
    job2 = await job(mechanical2.user.staffProfile!.id),
    foreignJob = await job(electrical.user.staffProfile!.id, other.id);
  const product = await prisma.product.create({
    data: {
      name: "Synthetic workforce part",
      slug: `wf-${randomUUID()}`,
      sku: `WF-${randomUUID()}`,
      priceKobo: 10000n,
      category: { create: { name: "Synthetic category", slug: `wf-${randomUUID()}` } },
    },
  });
  const enquiry = await prisma.enquiry.create({
    data: {
      customerId: customer.user.profile!.id,
      branchId: home.id,
      type: "PRODUCT",
      productId: product.id,
      subject: "Synthetic product enquiry",
      message: "Synthetic question",
      name: "Synthetic customer",
      email: customer.user.email,
      assignedStaffId: cashier.user.staffProfile!.id,
    },
  });
  const generalEnquiry = await prisma.enquiry.create({
    data: {
      customerId: customer.user.profile!.id,
      branchId: home.id,
      type: "GENERAL",
      subject: "Synthetic customer care enquiry",
      message: "Synthetic question",
      name: "Synthetic customer",
      email: customer.user.email,
    },
  });
  return {
    owner,
    home,
    other,
    operations,
    mechanical1,
    mechanical2,
    electrical,
    lead,
    accountant,
    cashier,
    sales,
    care,
    scopedAdmin,
    customer,
    stranger,
    salesCover,
    careCover,
    job1,
    job2,
    foreignJob,
    enquiry,
    generalEnquiry,
    account,
    assignment,
    session,
  };
}
