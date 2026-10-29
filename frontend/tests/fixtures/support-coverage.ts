import type { Page, Route } from "@playwright/test";
import { workSupportFixture, bookingId } from "./work-support";
import { supportChannelFixture } from "./support-channel";
import type { CareCoverage } from "@/lib/api/support-coverage-schemas";
export async function coverageFixture(page: Page, role = "SUPER_ADMIN") {
  const work = await workSupportFixture(page, role);
  const first = bookingId(101),
    second = bookingId(102);
  const channel = await supportChannelFixture(page, {
    id: work.support.records.enquiries[0].id,
    branchId: first,
    staff: true,
  });
  channel.presence.enabled = false;
  if (channel.channel)
    Object.assign(channel.channel, {
      canClaim: false,
      canTransfer: false,
      canEnd: false,
    });
  const records = new Map<string, CareCoverage>([
    [
      first,
      {
        branchId: first,
        enabled: false,
        version: 0,
        maxConcurrentPerAgent: 1,
        schedule: { timezone: "Africa/Lagos", windows: [] },
      },
    ],
    [
      second,
      {
        branchId: second,
        enabled: true,
        version: 3,
        maxConcurrentPerAgent: 2,
        schedule: {
          timezone: "Africa/Lagos",
          windows: [{ day: 6, startMinute: 1337, endMinute: 1440 }],
        },
      },
    ],
  ]);
  const state = {
    first,
    second,
    records,
    mode: "normal" as "normal" | "lost" | "unsaved" | "mismatch",
    denied: false,
    reads: [] as string[],
    writes: [] as {
      method: string;
      key: string;
      body: Record<string, unknown>;
      csrf?: string;
    }[],
    receipts: new Map<
      string,
      { branchId: string; state: "SAVED" | "CANCELLED"; savedVersion?: number }
    >(),
  };
  const ok = (route: Route, data: unknown) =>
    route.fulfill({
      json: {
        success: true,
        data,
        message: "Isolated support coverage",
        meta: { requestId: "coverage-fixture" },
      },
    });
  const fail = (route: Route, status: number, code = "CONFLICT") =>
    route.fulfill({
      status,
      json: { success: false, error: { code }, message: "Isolated coverage response" },
    });
  await page.route("**/api/v1/public/branches**", (route) =>
    ok(route, {
      items: [
        { id: first, name: "Isolated first branch" },
        { id: second, name: "Isolated second branch" },
      ],
    }),
  );
  await page.route(
    "**/api/v1/admin/workforce/support-chat/coverage/**",
    async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const segments = url.pathname.split("/"),
        index = segments.indexOf("coverage"),
        branchId = segments[index + 1],
        operationKey = segments[index + 3];
      const record = records.get(branchId);
      if (state.denied) return fail(route, 403, "FORBIDDEN");
      if (!record) return fail(route, 404, "NOT_FOUND");
      if (request.method() === "GET") {
        state.reads.push(url.pathname);
        if (!operationKey)
          return ok(
            route,
            state.mode === "mismatch" ? { ...record, branchId: bookingId(999) } : record,
          );
        const receipt = state.receipts.get(operationKey);
        return ok(route, {
          state: receipt?.state ?? "UNKNOWN",
          ...(receipt?.state === "SAVED" ? { savedVersion: receipt.savedVersion } : {}),
          coverage: record,
        });
      }
      const body = request.method() === "PUT" ? request.postDataJSON() : {};
      const key = operationKey ?? request.headers()["idempotency-key"];
      state.writes.push({
        method: request.method(),
        key,
        body,
        csrf: request.headers()["x-csrf-token"],
      });
      if (request.method() === "DELETE") {
        const prior = state.receipts.get(key);
        if (!prior) state.receipts.set(key, { branchId, state: "CANCELLED" });
        const receipt = state.receipts.get(key)!;
        return ok(route, {
          state: receipt.state,
          ...(receipt.state === "SAVED" ? { savedVersion: receipt.savedVersion } : {}),
          coverage: record,
        });
      }
      if (state.receipts.get(key)?.state === "CANCELLED")
        return fail(route, 409, "IDEMPOTENCY_CONFLICT");
      if (state.mode === "unsaved") return fail(route, 503, "DATABASE_UNAVAILABLE");
      if (body.expectedVersion !== record.version) return fail(route, 409);
      const saved = {
        branchId,
        enabled: body.enabled,
        schedule: body.schedule,
        version: record.version + 1,
        maxConcurrentPerAgent: body.maxConcurrentPerAgent,
      } as CareCoverage;
      records.set(branchId, saved);
      state.receipts.set(key, { branchId, state: "SAVED", savedVersion: saved.version });
      if (state.mode === "lost") return fail(route, 503, "DATABASE_UNAVAILABLE");
      return ok(route, saved);
    },
  );
  return state;
}
