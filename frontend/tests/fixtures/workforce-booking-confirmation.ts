import type { Page } from "@playwright/test";
import { workforceNotificationsFixture } from "./workforce-notifications";
import { bookingFixtureId as id } from "./workforce-bookings";
import {
  workforceAccessRevision,
  workforceCapabilityScopes,
} from "../../../backend/src/modules/organization/workforce-access-revision";
export { id };
export async function workforceBookingConfirmationFixture(
  page: Page,
  role: "STAFF" | "ADMIN" = "STAFF",
) {
  const base = await workforceNotificationsFixture(page, "CUSTOMER_SERVICE", role);
  base.access.independentCapabilities = ["BOOKING_CONFIRM"];
  const state = {
    base,
    actionMode: "normal" as "normal" | "lost" | "malformed" | "policy",
    readMode: "normal" as "normal" | "error",
    writes: [] as {
      body: { expectedVersion: number; resourceReviewNote: string };
      csrf?: string;
    }[],
    booking: {
      id: id(1001),
      branchId: base.access.assignments[0].branchId,
      branch: { id: base.access.assignments[0].branchId, name: "Synthetic workshop" },
      service: {
        name: "Synthetic diagnostic inspection",
        durationMinutes: 60 as number | null,
      },
      customer: { firstName: "Synthetic", lastName: "Customer", phone: "+2348000000000" },
      vehicle: {
        make: "Toyota",
        model: "Camry",
        year: 2020,
        registrationNumber: "SYNTHETIC",
      },
      assignedStaff: { id: id(1010), firstName: "Synthetic", lastName: "Technician" } as {
        id: string;
        firstName: string;
        lastName: string;
      } | null,
      status: "REQUESTED",
      version: 0,
      scheduledAt: "2040-01-02T09:00:00.000Z",
      confirmedAt: null as string | null,
      alternativeStartsAt: null as string | null,
      alternativeReason: null as string | null,
      alternativeVersion: null as number | null,
    },
  };
  const snapshot = () => {
    const assignments = base.access.assignments.map((a) => ({
      ...a,
      templateVersion: a.templateVersion ?? 1,
      startsAt: new Date(a.startsAt),
      expiresAt: a.expiresAt ? new Date(a.expiresAt) : null,
      revokedAt: a.revokedAt ? new Date(a.revokedAt) : null,
    }));
    return {
      ...base.access,
      serverTime: new Date().toISOString(),
      nextChangeAt: null,
      capabilityScopes: workforceCapabilityScopes(assignments).filter((g) =>
        base.access.permissions.includes(g.capability),
      ),
      accessRevision: workforceAccessRevision({ ...base.access, assignments, role }),
    };
  };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Isolated booking confirmation fixture",
      meta: { requestId: "booking-confirmation-fixture" },
    },
  });
  await page.route("**/api/v1/staff/workforce/access", (route) =>
    route.fulfill(ok(snapshot())),
  );
  await page.route("**/api/v1/staff/workforce/overview", (route) =>
    route.fulfill(
      ok({
        access: snapshot(),
        generatedAt: new Date().toISOString(),
        counts: Object.fromEntries(
          [
            ...(base.access.permissions.includes("BOOKINGS_READ") ? ["bookings"] : []),
            ...(base.access.permissions.includes("CUSTOMER_ENQUIRIES")
              ? ["enquiries"]
              : []),
            ...(base.access.permissions.includes("COMPLAINTS") ? ["complaints"] : []),
            ...(base.access.permissions.includes("ORDERS_READ") ? ["orders"] : []),
          ].map((key) => [key, 0]),
        ),
        branches: [...new Set(base.access.assignments.map((a) => a.branchId))].map(
          (branchId) => ({ id: branchId, name: "Synthetic workshop" }),
        ),
      }),
    ),
  );
  await page.route("**/api/v1/staff/workforce/bookings/**", async (route) => {
    const request = route.request(),
      pathname = new URL(request.url()).pathname;
    if (request.method() === "GET") {
      if (state.readMode === "error")
        return route.fulfill({
          status: 503,
          json: { success: false, error: { code: "SERVICE_UNAVAILABLE" } },
        });
      return route.fulfill(
        ok({
          ...state.booking,
          access: snapshot(),
          generatedAt: new Date().toISOString(),
        }),
      );
    }
    if (request.method() === "POST" && pathname.endsWith("/alternative")) {
      const body = request.postDataJSON();
      state.writes.push({ body, csrf: request.headers()["x-csrf-token"] });
      if (body.expectedVersion !== state.booking.version)
        return route.fulfill({
          status: 409,
          json: { success: false, error: { code: "CONFLICT" } },
        });
      state.booking.version += 1;
      state.booking.alternativeVersion = state.booking.version;
      state.booking.alternativeStartsAt = body.preferredAt;
      state.booking.alternativeReason = body.reason;
      if (state.actionMode === "lost") return route.abort("failed");
      return route.fulfill(
        ok({ ...state.booking, performedByUserId: base.access.userId }),
      );
    }
    if (
      request.method() !== "POST" ||
      pathname !== `/api/v1/staff/workforce/bookings/${state.booking.id}/confirmation`
    )
      throw Error("Unexpected synthetic booking mutation");
    const body = request.postDataJSON();
    state.writes.push({ body, csrf: request.headers()["x-csrf-token"] });
    if (state.actionMode === "policy")
      return route.fulfill({
        status: 409,
        json: {
          success: false,
          message: "Synthetic policy unavailable",
          error: {
            code: "BOOKING_CAPACITY_POLICY_REQUIRED",
          },
        },
      });
    if (
      !base.access.independentCapabilities?.includes("BOOKING_CONFIRM") ||
      state.booking.status !== "REQUESTED" ||
      body.expectedVersion !== state.booking.version
    )
      return route.fulfill({
        status: 409,
        json: { success: false, error: { code: "CONFLICT" } },
      });
    state.booking.status = "CONFIRMED";
    state.booking.version++;
    state.booking.confirmedAt = new Date().toISOString();
    if (state.actionMode === "lost") return route.abort("failed");
    return route.fulfill(
      ok({
        id: state.booking.id,
        branchId: state.booking.branchId,
        assignedStaffId: state.booking.assignedStaff!.id,
        status: state.booking.status,
        version: state.booking.version,
        scheduledAt: state.booking.scheduledAt,
        confirmedAt: state.booking.confirmedAt,
        capacityPolicyVersionId: id(1020),
        resourceReviewNote: body.resourceReviewNote,
        performedByUserId:
          state.actionMode === "malformed" ? id(9999) : base.access.userId,
      }),
    );
  });
  return state;
}
