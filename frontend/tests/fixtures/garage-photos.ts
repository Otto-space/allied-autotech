import type { Page } from "@playwright/test";
import path from "node:path";
import { garageId, garageRecord } from "./customer-garage";

export const photoVehicleId = garageId(1);
export const photoRoute = `/dashboard/vehicles/${photoVehicleId}`;
export const photoFile = path.resolve(
  "public/images/allied-autotech/showroom-editorial.webp",
);
export const photoRecord = (n: number) => ({
  id: garageId(10 + n),
  url: `/api/v1/customers/media/images/${garageId(10 + n)}`,
  altText: n === 1 ? "Front view" : "Side view",
  sortOrder: n - 1,
  isPrimary: n === 1,
  width: 900,
  height: 600,
});

export async function photoFixture(page: Page, role = "CUSTOMER") {
  const state = {
    mode: "normal",
    mutation: "normal",
    storage: "normal",
    version: 2,
    images: [photoRecord(1), photoRecord(2)],
    reads: 0,
    transfers: 0,
    writes: [] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
      csrf?: string;
    }[],
    release: undefined as (() => void) | undefined,
    releaseMutation: undefined as (() => void) | undefined,
    releaseStorage: undefined as (() => void) | undefined,
  };
  let token = 0;
  const receipts = new Map<string, unknown>();
  await page.route("https://media.example.test/**", async (route) => {
    state.transfers++;
    if (state.storage === "hold")
      await new Promise<void>((r) => {
        state.releaseStorage = r;
      });
    await route
      .fulfill({
        status: state.storage === "error" ? 503 : 200,
        body: "",
        headers: { "access-control-allow-origin": "*" },
      })
      .catch(() => {
        /* A cancelled upload may close the intercepted request. */
      });
  });
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const endpoint = new URL(req.url()).pathname.replace("/api/v1", "");
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          message: "Isolated photo QA",
          meta: { requestId: "photo-qa" },
          data,
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({
        status,
        json: { success: false, error: { code }, meta: { requestId: "photo-qa" } },
      });
    if (endpoint === "/auth/session")
      return ok({
        id: garageId(98),
        user: { id: garageId(99), email: "garage@example.test", role },
        mfaRequired: role !== "CUSTOMER",
        mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-10-08T08:00:00Z",
        expiresAt: "2027-01-01T00:00:00Z",
        idleExpiresAt: "2027-01-01T00:00:00Z",
      });
    if (endpoint === "/auth/csrf") return ok({ csrfToken: "photo-qa-csrf-".repeat(4) });
    if (endpoint.startsWith("/customers/media/images/"))
      return state.mode === "broken-image"
        ? fail(404, "NOT_FOUND")
        : route.fulfill({ path: photoFile });
    if (endpoint === `/customers/vehicles/${photoVehicleId}`) {
      state.reads++;
      if (state.mode === "hold")
        await new Promise<void>((r) => {
          state.release = r;
        });
      if (state.mode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      if (state.mode === "denied") return fail(404, "CUSTOMER_RESOURCE_NOT_FOUND");
      return ok(
        state.mode === "malformed"
          ? { images: [{}] }
          : { ...garageRecord(), mediaVersion: state.version, images: state.images },
      );
    }
    if (endpoint.startsWith(`/customers/vehicles/${photoVehicleId}/`)) {
      const body = req.postDataJSON();
      state.writes.push({
        method: req.method(),
        path: endpoint,
        body,
        csrf: req.headers()["x-csrf-token"],
      });
      if (endpoint.endsWith("/assets/upload"))
        return ok({
          assetToken: String(++token).padStart(43, "a"),
          upload: {
            method: "PUT",
            url: `https://media.example.test/photo-${token}`,
            expiresAt: new Date(Date.now() + 600000).toISOString(),
            headers: { "content-type": body.mimeType },
          },
        });
      if (state.mutation === "hold")
        await new Promise<void>((r) => {
          state.releaseMutation = r;
        });
      if (state.mutation === "stale") return fail(409, "STALE_VERSION");
      if (state.mutation === "error") return fail(503, "DATABASE_UNAVAILABLE");
      if (state.mutation === "malformed") return ok({ version: state.version + 1 });
      const receiptKey = JSON.stringify(body);
      if (req.method() === "POST" && receipts.has(receiptKey))
        return ok(receipts.get(receiptKey));
      if (body.expectedVersion !== state.version) return fail(409, "STALE_VERSION");
      const id = endpoint.split("/").at(-1);
      if (req.method() === "DELETE") {
        state.images = state.images.filter((i) => i.id !== id);
        if (state.images.length && !state.images.some((i) => i.isPrimary))
          state.images[0].isPrimary = true;
      } else if (req.method() === "PATCH") {
        if (body.isPrimary)
          state.images.forEach((i) => {
            i.isPrimary = i.id === id;
          });
        state.images = state.images.map((i) => (i.id === id ? { ...i, ...body } : i));
      } else
        state.images.push({
          ...photoRecord(3 + state.version),
          sortOrder: body.sortOrder,
          isPrimary: state.images.length === 0,
        });
      state.images.sort((a, b) => a.sortOrder - b.sortOrder);
      state.version++;
      const result = { version: state.version, images: state.images };
      if (req.method() === "POST") receipts.set(receiptKey, result);
      if (state.mutation === "lost-response") {
        state.mutation = "normal";
        return fail(503, "DATABASE_UNAVAILABLE");
      }
      return ok(result);
    }
    return ok({ items: [] });
  });
  return state;
}
