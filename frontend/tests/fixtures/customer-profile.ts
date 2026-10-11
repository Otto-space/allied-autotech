import type { Page } from "@playwright/test";
import type { z } from "zod";
import type { profileSchema } from "@/lib/api/profile-schemas";
export const profileId = (n: number) =>
  `e7000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function profileRecord(): z.infer<typeof profileSchema> {
  return {
    mediaVersion: 0,
    photo: null,
    firstName: "Amara",
    lastName: "Okafor",
    phone: "08031234567",
    address: "12 Aba Road",
    city: "Port Harcourt",
    state: "Rivers",
    country: "Nigeria",
    user: { id: profileId(1), email: "amara@example.test" },
  };
}
export async function profileFixture(page: Page) {
  const state = {
    record: profileRecord(),
    mode: "normal",
    saveMode: "normal",
    role: "CUSTOMER",
    reads: 0,
    writes: [] as { method: string; path: string; body: Record<string, unknown> }[],
    held: undefined as (() => void) | undefined,
  };
  const success = (data: unknown) => ({
    success: true,
    message: "Isolated QA",
    meta: { requestId: "profile-qa" },
    data,
  });
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      endpoint = new URL(req.url()).pathname.replace("/api/v1", ""),
      method = req.method();
    if (method !== "GET")
      state.writes.push({ method, path: endpoint, body: req.postDataJSON() ?? {} });
    const fail = (status: number, code: string) =>
      route.fulfill({
        status,
        headers: { "Retry-After": "2" },
        json: { success: false, error: { code }, meta: { requestId: "profile-qa" } },
      });
    if (endpoint === "/auth/session")
      return route.fulfill({
        json: success({
          id: profileId(2),
          user: { id: profileId(1), email: "amara@example.test", role: state.role },
          mfaRequired: state.role !== "CUSTOMER",
          mfaVerifiedAt: state.role === "CUSTOMER" ? null : "2026-10-11T09:00:00Z",
          expiresAt: "2027-01-01T00:00:00Z",
          idleExpiresAt: "2027-01-01T00:00:00Z",
        }),
      });
    if (endpoint === "/auth/csrf")
      return route.fulfill({
        json: success({ csrfToken: "synthetic-profile-csrf-token" }),
      });
    if (endpoint === "/customers/profile") {
      if (method === "PATCH") {
        if (state.saveMode === "rate") return fail(429, "RATE_LIMITED");
        if (state.saveMode === "invalid")
          return route.fulfill({
            status: 400,
            json: {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                fields: { "body.phone": ["Invalid phone"] },
              },
              meta: { requestId: "profile-qa" },
            },
          });
        if (state.saveMode === "hold")
          await new Promise<void>((resolve) => {
            state.held = resolve;
          });
        Object.assign(state.record, req.postDataJSON());
        if (state.saveMode === "lost") return fail(503, "DATABASE_UNAVAILABLE");
        return route.fulfill({ json: success(state.record) });
      }
      state.reads++;
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (state.mode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      if (state.mode === "denied") return fail(403, "FORBIDDEN");
      if (state.mode === "missing") return fail(404, "CUSTOMER_RESOURCE_NOT_FOUND");
      if (state.mode === "offline") return route.abort("internetdisconnected");
      if (state.mode === "malformed")
        return route.fulfill({ json: success({ firstName: "Unexpected" }) });
      return route.fulfill({ json: success(state.record) });
    }
    if (endpoint === "/customers/profile/photo/upload")
      return fail(503, "MEDIA_STORAGE_UNAVAILABLE");
    if (endpoint === "/customers/profile/photo" && method === "DELETE") {
      state.record.photo = null;
      state.record.mediaVersion++;
      return route.fulfill({
        json: success({ version: state.record.mediaVersion, images: [] }),
      });
    }
    if (endpoint.startsWith("/customers/media/images/"))
      return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ json: success({ items: [] }) });
  });
  return state;
}
