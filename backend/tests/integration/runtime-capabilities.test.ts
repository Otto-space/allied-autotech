import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/config/database.js";
import { publicCapabilitiesSchema } from "../../src/modules/policies/policies.schemas.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "current runtime availability through anonymous HTTP",
  () => {
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterAll(() => prisma.$disconnect());
    it.each(["full", "browse_enquiries", "catalogue"] as const)(
      "reports %s and preserves direct write gates",
      async (mode) => {
        const original = env.PUBLIC_LAUNCH_MODE;
        try {
          env.PUBLIC_LAUNCH_MODE = mode;
          const app = createApp({
            checkReadiness: async () => undefined,
            rateLimit: 10000,
          });
          const before = [await prisma.order.count(), await prisma.booking.count()];
          const read = await request(app).get("/api/v1/public/capabilities");
          expect(read.status).toBe(200);
          expect(read.headers["cache-control"]).toBe("no-store");
          expect(read.headers["set-cookie"]).toBeUndefined();
          const value = publicCapabilitiesSchema.parse(read.body.data);
          expect(value.release).toEqual({
            mode,
            customerAccountsEnabled: mode !== "catalogue",
            enquiriesEnabled: mode !== "catalogue",
            bookingRequestsEnabled: mode === "full",
            inspectionRequestsEnabled: mode === "full",
          });
          if (mode !== "full") {
            expect(value.checkoutEnabled).toBe(false);
            expect(value.vehicleDeposits.enabled).toBe(false);
            for (const path of [
              "/customers/orders/checkout",
              "/customers/bookings",
              "/customers/vehicle-inspections",
            ])
              expect((await request(app).post(`/api/v1${path}`).send({})).status).toBe(
                403,
              );
          }
          expect([await prisma.order.count(), await prisma.booking.count()]).toEqual(
            before,
          );
          expect(value).not.toHaveProperty("settings");
          expect(value).not.toHaveProperty("approvalEvidence");
        } finally {
          env.PUBLIC_LAUNCH_MODE = original;
        }
      },
    );
  },
);
