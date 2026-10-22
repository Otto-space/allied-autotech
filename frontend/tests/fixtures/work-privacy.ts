import type { Page } from "@playwright/test";
import { workSupportFixture, bookingId } from "./work-support";
import type { RetentionHold } from "@/lib/api/privacy-schemas";
export { bookingId };
export const privacyRow = (n = 0) => ({
  id: bookingId(96000 + n),
  userId: bookingId(97000 + n),
  kind: n % 2 ? "ANONYMIZATION" : "DELETION",
  reason: "Please review removal of personal information after the completed service.",
  status: n % 3 ? "UNDER_REVIEW" : "REQUESTED",
  createdAt: `2026-10-18T08:00:${String(59 - n).padStart(2, "0")}.123Z`,
  reviewedAt: n % 3 ? "2026-10-18T09:00:37.123Z" : null,
  reviewNote:
    n % 3 ? "We are reviewing the request and any required record protections." : null,
});
export async function workPrivacyFixture(page: Page, role = "ADMIN") {
  const base = await workSupportFixture(page, role),
    privacy = {
      records: [0, 1, 2].map(privacyRow),
      holds: [] as RetentionHold[],
      granted: true,
      profileMode: "normal",
      mode: "normal",
      holdsMode: "normal",
      writeMode: "normal",
      reads: [] as URL[],
      holdReads: [] as URL[],
      writes: [] as { path: string; body: Record<string, unknown> }[],
      profileReads: 0,
      heldProfile: undefined as (() => void) | undefined,
      heldWrite: undefined as (() => void) | undefined,
    };
  const ok = (data: unknown) => ({
      json: {
        success: true,
        data,
        message: "Synthetic privacy",
        meta: { requestId: "work-privacy" },
      },
    }),
    fail = (status: number) => ({
      status,
      json: {
        success: false,
        error: {
          code:
            status === 409
              ? "CONFLICT"
              : status === 403
                ? "FORBIDDEN"
                : "DATABASE_UNAVAILABLE",
        },
      },
    });
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill(ok({ csrfToken: "privacy-review-csrf-".repeat(3) })),
  );
  await page.route("**/api/v1/staff/profile", async (route) => {
    privacy.profileReads++;
    if (privacy.profileMode === "hold")
      await new Promise<void>((r) => {
        privacy.heldProfile = r;
      });
    if (["error", "denied"].includes(privacy.profileMode))
      return route.fulfill(fail(privacy.profileMode === "denied" ? 403 : 503));
    return route.fulfill({
      json: {
        success: true,
        data: {
          id: bookingId(privacy.profileMode === "mismatch" ? 399 : 302),
          email: "workshop@example.test",
          role,
          status: privacy.profileMode === "inactive" ? "SUSPENDED" : "ACTIVE",
          capabilities: privacy.granted ? ["PRIVACY_REVIEW"] : [],
          staffProfile: {
            id: bookingId(601),
            firstName: "Ada",
            lastName: "Okoro",
            branchId: bookingId(101),
          },
        },
        message: "Synthetic privacy permission",
        meta: { requestId: "work-privacy" },
      },
    });
  });
  const handle: Parameters<Page["route"]>[1] = async (route) => {
    const req = route.request(),
      u = new URL(req.url()),
      holds = u.pathname.includes("retention-holds"),
      mode = holds ? privacy.holdsMode : privacy.mode;
    if (req.method() === "GET") {
      (holds ? privacy.holdReads : privacy.reads).push(u);
      if (["error", "denied", "missing"].includes(mode))
        return route.fulfill(
          fail(mode === "error" ? 503 : mode === "missing" ? 404 : 403),
        );
      if (holds) {
        const rows = privacy.holds.filter(
          (h) => h.userId === u.searchParams.get("userId"),
        );
        return route.fulfill(
          ok(
            mode === "malformed"
              ? [{ id: "bad" }]
              : mode === "foreign"
                ? [{ ...rows[0], userId: bookingId(999) }]
                : rows,
          ),
        );
      }
      let rows = privacy.records.filter((r) =>
        ["kind", "status", "userId"].every(
          (k) =>
            !u.searchParams.has(k) || r[k as keyof typeof r] === u.searchParams.get(k),
        ),
      );
      if (mode === "empty") rows = [];
      const start = u.searchParams.has("cursor")
          ? rows.findIndex((r) => r.id === u.searchParams.get("cursor")) + 1
          : 0,
        items = rows.slice(start, start + 25);
      return route.fulfill(
        ok(
          mode === "malformed"
            ? { items: [{ id: "bad" }] }
            : {
                items: mode === "duplicate" ? [items[0], items[0]] : items,
                nextCursor: rows.length > start + 25 ? items.at(-1)?.id : null,
              },
        ),
      );
    }
    const body = req.postDataJSON();
    privacy.writes.push({ path: u.pathname, body });
    if (privacy.writeMode === "hold")
      await new Promise<void>((r) => {
        privacy.heldWrite = r;
      });
    if (["reject", "throttle"].includes(privacy.writeMode))
      return route.fulfill(fail(privacy.writeMode === "reject" ? 409 : 429));
    const stamp = `2026-10-18T10:00:${String(37 + privacy.writes.length).padStart(2, "0")}.123Z`;
    let data: unknown;
    if (!holds) {
      const row = privacy.records.find((r) => r.id === u.pathname.split("/").at(-2))!;
      if (
        body.status === "APPROVED_PENDING_POLICY" &&
        privacy.holds.some((h) => h.userId === row.userId && !h.releasedAt)
      )
        return route.fulfill(fail(409));
      Object.assign(row, {
        status: body.status,
        reviewedAt: stamp,
        reviewNote: body.note,
      });
      data = { ...row };
    } else if (u.pathname.endsWith("/release")) {
      const row = privacy.holds.find((h) => h.id === u.pathname.split("/").at(-2))!;
      if (row.releasedAt) return route.fulfill(fail(409));
      row.releasedAt = stamp;
      data = {
        id: row.id,
        userId: row.userId,
        releasedAt: stamp,
        releaseReason: body.reason,
      };
    } else {
      const row: RetentionHold = {
        id: bookingId(98000 + privacy.writes.length),
        userId: body.userId,
        recordType: body.recordType,
        recordId: body.recordId ?? null,
        reason: body.reason,
        createdAt: stamp,
        releasedAt: null,
      };
      privacy.holds.unshift(row);
      data = { ...row };
    }
    if (privacy.writeMode === "lost") return route.abort("failed");
    if (privacy.writeMode === "malformed") data = { id: bookingId(1) };
    if (privacy.writeMode === "wrong-account")
      data = { ...(data as object), userId: bookingId(999) };
    return route.fulfill(ok(data));
  };
  await page.route("**/api/v1/staff/privacy-requests**", handle);
  await page.route("**/api/v1/staff/retention-holds**", handle);
  return { ...base, privacy };
}
