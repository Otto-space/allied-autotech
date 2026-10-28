import type { Page, Route } from "@playwright/test";
import type { CareChannel } from "@/lib/api/support-channel-schemas";

const uuid = (n: number) => `f1600000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stamp = "2026-10-28T12:00:00.000Z";
export async function supportChannelFixture(
  page: Page,
  options: {
    id: string;
    branchId: string;
    staff?: boolean;
    kind?: "ENQUIRY" | "COMPLAINT";
  },
) {
  const root = options.staff
    ? "/staff/workforce/support-chat/channels"
    : "/customers/support/live/channels";
  const sample: CareChannel = {
    id: uuid(1),
    target: { kind: options.kind ?? "ENQUIRY", id: options.id },
    branchId: options.branchId,
    state: "QUEUED",
    version: 1,
    updatedAt: stamp,
    queuedSince: stamp,
    claimedAt: null,
    endedAt: null,
    latestPublicMessageId: null,
    assignedToYou: false,
    canClaim: !!options.staff,
    canTransfer: false,
    canEnd: !options.staff,
    pollAfterMs: 5000,
  };
  const state = {
    channel: options.staff ? sample : (null as CareChannel | null),
    sample,
    caseVersion: 0,
    latest: null as string | null,
    mode: "normal",
    denied: false,
    recoveryMissing: false,
    reads: [] as string[],
    writes: [] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
      key?: string;
      csrf?: string;
    }[],
    receipts: new Map<string, CareChannel | null>(),
    presence: {
      enabled: true,
      version: 0,
      branchId: options.branchId,
      optedIn: false,
      expiresAt: null as string | null,
      capacity: 1,
      eligibleBranches: [{ branchId: options.branchId, kinds: ["ENQUIRY", "COMPLAINT"] }],
    },
    heartbeats: 0,
  };
  const ok = (route: Route, data: unknown) =>
    route.fulfill({
      json: {
        success: true,
        data,
        message: "Isolated channel fixture",
        meta: { requestId: "channel-fixture" },
      },
    });
  const fail = (route: Route, status: number, code: string) =>
    route.fulfill({ status, json: { success: false, error: { code } } });
  await page.route("**/api/v1/auth/csrf", (route) =>
    ok(route, { csrfToken: "isolated-channel-csrf-".repeat(3) }),
  );
  if (options.staff)
    await page.route("**/api/v1/public/branches", (route) =>
      ok(route, { items: [{ id: options.branchId, name: "Isolated handling branch" }] }),
    );
  await page.route("**/api/v1/**/support*/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace("/api/v1", "");
    if (
      !path.startsWith(root) &&
      !path.startsWith("/staff/workforce/support-chat/presence")
    )
      return route.fallback();
    if (state.denied) return fail(route, 403, "FORBIDDEN");
    if (request.method() === "GET") {
      state.reads.push(path);
      if (path.includes("/by-case/"))
        return ok(route, {
          channel: state.channel,
          caseVersion: state.caseVersion,
          latestPublicMessageId: state.latest,
        });
      if (path.includes("/operations/")) {
        const key = path.split("/").at(-1)!;
        if (state.recoveryMissing || !state.receipts.has(key))
          return fail(route, 404, "NOT_FOUND");
        const channel = state.receipts.get(key)!;
        return ok(route, {
          action: path.split("/").at(-2),
          state: channel ? "SAVED" : "CANCELLED",
          channel,
        });
      }
      if (path.endsWith("/assignees"))
        return ok(route, {
          items: [{ staffId: uuid(3), name: "Approved Care representative" }],
        });
      if (path.endsWith("/presence")) return ok(route, state.presence);
      if (path === root)
        return ok(route, {
          items: state.channel ? [state.channel] : [],
          pollAfterMs: 5000,
        });
      return fail(route, 404, "NOT_FOUND");
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    state.writes.push({
      method: request.method(),
      path,
      body,
      key: request.headers()["idempotency-key"],
      csrf: request.headers()["x-csrf-token"],
    });
    if (path.endsWith("/heartbeat")) {
      state.heartbeats++;
      return ok(route, state.presence);
    }
    if (path.endsWith("/presence")) {
      state.presence.version++;
      state.presence.optedIn = body.available === true;
      state.presence.capacity = Number(body.capacity);
      state.presence.expiresAt = new Date(Date.now() + 90000).toISOString();
      return ok(route, state.presence);
    }
    const key = request.headers()["idempotency-key"];
    if (request.method() === "DELETE") {
      const operationKey = path.split("/").at(-1)!;
      if (!state.receipts.has(operationKey)) state.receipts.set(operationKey, null);
      const channel = state.receipts.get(operationKey)!;
      return ok(route, {
        action: path.split("/").at(-2),
        state: channel ? "SAVED" : "CANCELLED",
        channel,
      });
    }
    if (state.mode === "conflict") return fail(route, 409, "WORKFORCE_CONFLICT");
    if (state.mode === "unsaved") return fail(route, 503, "DATABASE_UNAVAILABLE");
    const action = String(body.action ?? "request");
    state.caseVersion++;
    state.channel = {
      ...(state.channel ?? sample),
      version: (state.channel?.version ?? 0) + 1,
      state:
        action === "claim" || action === "transfer"
          ? "HUMAN_ACTIVE"
          : action === "end"
            ? "ENDED"
            : "QUEUED",
      assignedToYou: action === "claim",
      canClaim: false,
      canTransfer: !!options.staff && action !== "end",
      canEnd: action !== "end",
    };
    if (key) state.receipts.set(key, { ...state.channel });
    if (state.mode === "lost") return fail(route, 503, "DATABASE_UNAVAILABLE");
    return ok(route, {
      ...state.channel,
      ...(state.mode === "invalid"
        ? { target: { kind: sample.target.kind, id: uuid(999) } }
        : {}),
      replayed: false,
    });
  });
  return state;
}
