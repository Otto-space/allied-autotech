import { describe, expect, it, vi } from "vitest";
import { catalogueSchema } from "@/lib/learning/contracts";

const { settings } = vi.hoisted(() => ({
  settings: {
    HELP_LEARN_ENABLED: true,
    HELP_LEARN_GUIDES_ENABLED: true,
    HELP_LEARN_PRACTICE_ENABLED: true,
    HELP_LEARN_AI_ENABLED: false,
    PUBLIC_LAUNCH_MODE: "browse_enquiries",
    BOOKING_REQUESTS_ENABLED: false,
    PRODUCT_PURCHASES_ENABLED: false,
  },
}));
// Catalogue projection is pure. Any accidental database/access lookup fails;
// no application environment, credentials or provider are loaded by this test.
vi.mock("../../../backend/src/config/env.js", () => ({ env: settings }));
vi.mock("../../../backend/src/config/database.js", () => ({ prisma: {} }));
vi.mock("../../../backend/src/modules/organization/team-access-security.js", () => ({
  lockAccessActor: () => {
    throw Error("No database access in catalogue projection");
  },
}));
vi.mock("../../../backend/src/modules/organization/workforce.policy.js", () => ({
  workforceSnapshot: () => {
    throw Error("No database access in catalogue projection");
  },
}));
vi.mock("../../../backend/src/modules/organization/workforce-care-scope.js", () => ({
  careBranchesFor: () => {
    throw Error("No database access in catalogue projection");
  },
}));
import {
  learningCatalogue,
  publicLearningAccess,
  type LearningAccess,
} from "../../../backend/src/modules/learning/learning.service";

const permissions = [
  "CUSTOMER_ENQUIRIES",
  "COMPLAINTS",
  "CARE_CASE_VIEW",
  "SALES_ENQUIRIES",
  "FINANCE_READ",
  "JOBS_UPDATE",
  "JOBS_READ",
  "JOBS_ASSIGN",
  "ORDERS_PREPARE",
  "BOOKINGS_READ",
];
const independent = [
  "REFUND_APPROVE",
  "REFUND_TRANSFER",
  "REFUND_CHECK",
  "DISPUTE_MANAGE",
  "PRIVACY_REVIEW",
  "FINANCE_POLICY_APPROVE",
  "BOOKING_CONFIRM",
];

describe("real backend catalogue and frontend contract", () => {
  it.each(["PUBLIC", "CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"] as const)(
    "accepts the complete projected %s catalogue without discarding articles",
    (role) => {
      const access: LearningAccess = {
        ...publicLearningAccess,
        role,
        verified: role !== "PUBLIC",
        managed: false,
        permissions,
        independentCapabilities: independent,
        position: "CEO_MD",
        canManage: role === "SUPER_ADMIN",
        key: "synthetic-contract-" + role,
      };
      const projected = learningCatalogue(access);
      const parsed = catalogueSchema.parse(projected);
      expect(parsed.articles.map((a) => a.id)).toEqual(
        projected.articles.map((a) => a.id),
      );
      expect(parsed.articles.some((a) => a.id === "vehicle-operations")).toBe(
        role === "ADMIN" || role === "SUPER_ADMIN",
      );
      if (role === "ADMIN" || role === "SUPER_ADMIN")
        expect(parsed.articles.find((a) => a.id === "vehicle-operations")?.href).toBe(
          "/admin/vehicles",
        );
    },
  );

  const cases = ["full", "browse_enquiries", "catalogue"].flatMap((mode) =>
    (["STAFF", "ADMIN", "SUPER_ADMIN"] as const).flatMap((role) =>
      [false, true].flatMap((managed) =>
        [false, true].map((verified) => ({ mode, role, managed, verified })),
      ),
    ),
  );
  it.each(cases)(
    "preserves every independent-grant combination for $mode/$role managed=$managed verified=$verified",
    ({ mode, role, managed, verified }) => {
      settings.PUBLIC_LAUNCH_MODE = mode;
      try {
        for (let mask = 0; mask < 2 ** independent.length; mask++) {
          const access: LearningAccess = {
            ...publicLearningAccess,
            role,
            managed,
            verified,
            permissions,
            independentCapabilities: independent.filter((_, bit) => mask & (1 << bit)),
            position: "CEO_MD",
            canManage: role === "SUPER_ADMIN",
            key: "synthetic-grants",
          };
          for (const version of ["1", "2"] as const) {
            const projected = learningCatalogue(access, "", version);
            const parsed = catalogueSchema.parse(projected);
            expect(parsed.articles).toHaveLength(projected.articles.length);
            if (!verified)
              expect(parsed.articles.some((a) => a.id === "vehicle-operations")).toBe(
                false,
              );
          }
        }
      } finally {
        settings.PUBLIC_LAUNCH_MODE = "browse_enquiries";
      }
    },
  );
});
