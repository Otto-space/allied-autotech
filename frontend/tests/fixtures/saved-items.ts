import type { Page } from "@playwright/test";
import path from "node:path";
import { id, product, listing } from "./public-account-actions";
export { id };
const image = (n: number, kind: "products" | "vehicles") => ({
  id: id(n),
  url: `/api/v1/public/${kind === "products" ? "catalog/products" : "vehicles"}/images/${id(n)}`,
  altText: null as string | null,
  isPrimary: true,
});
export const savedParts = [
  "Engine oil filter",
  "Front brake pads",
  "Cabin air filter",
].map((name, i) => ({
  id: id(101 + i),
  product: {
    ...product,
    id: id(201 + i),
    name,
    brand: "Toyota",
    priceKobo: String((12500 + i * 6000) * 100),
    images: i === 2 ? [] : [image(601 + i, "products")],
    category: { ...product.category, name: "Maintenance" },
    availability: [{ ...product.availability[0], inStock: i !== 2 }],
  },
}));
export const savedVehicles = ["Toyota Highlander", "Mercedes-Benz C-Class"].map(
  (title, i) => ({
    id: id(301 + i),
    vehicleListing: {
      ...listing,
      id: id(401 + i),
      title,
      priceKobo: String((32000000 + i * 1000000) * 100),
      vehicle: {
        ...listing.vehicle,
        make: i ? "Mercedes-Benz" : "Toyota",
        model: i ? "C-Class" : "Highlander",
        year: 2021,
        mileageKm: 42000,
        images: [image(701 + i, "vehicles")],
      },
    },
  }),
);
export async function savedFixture(page: Page) {
  const state = {
    parts: structuredClone(savedParts),
    vehicles: structuredClone(savedVehicles),
    partError: false,
    vehicleError: false,
    signedIn: true,
    userId: id(91),
    role: "CUSTOMER",
    writes: [] as { path: string; csrf?: string; body: unknown }[],
    reads: [] as string[],
    failDelete: false,
    rejectDelete: false,
    delayDelete: false,
    release: undefined as (() => void) | undefined,
    nextCursor: undefined as string | undefined,
    brokenImages: false,
  };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      u = new URL(req.url()),
      p = u.pathname.replace(/^\/api\/v1/, "");
    const reply = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        json: {
          success: status < 400,
          message:
            status < 400 ? "Isolated response" : "Saved items could not be loaded.",
          data,
          meta: { requestId: "saved-qa" },
        },
      });
    if (p.includes("/images/"))
      return state.brokenImages
        ? route.abort()
        : route.fulfill({
            contentType: "image/webp",
            path: path.resolve(
              `public/images/allied-autotech/${p.includes("catalog") ? "parts" : "showroom"}-editorial.webp`,
            ),
          });
    if (p === "/auth/session")
      return state.signedIn
        ? reply({
            id: id(90),
            user: { id: state.userId, email: "saved@example.test", role: state.role },
            mfaRequired: false,
            mfaVerifiedAt: null,
            expiresAt: "2099-01-01T00:00:00Z",
            idleExpiresAt: "2099-01-01T00:00:00Z",
          })
        : reply(null, 401);
    if (p === "/auth/csrf") return reply({ csrfToken: "s".repeat(64) });
    if (req.method() === "DELETE") {
      state.writes.push({
        path: p,
        csrf: req.headers()["x-csrf-token"],
        body: req.postDataJSON(),
      });
      if (state.delayDelete)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      if (state.failDelete) return route.abort();
      if (state.rejectDelete) return reply(null, 409);
      state.parts = state.parts.filter((x) => !p.endsWith(x.product.id));
      state.vehicles = state.vehicles.filter((x) => !p.endsWith(x.vehicleListing.id));
      return reply({});
    }
    if (p === "/customers/favourites") {
      state.reads.push(p + u.search);
      return reply(
        { items: state.parts, nextCursor: state.nextCursor },
        state.partError ? 503 : 200,
      );
    }
    if (p === "/customers/saved-vehicles/page") {
      state.reads.push(p + u.search);
      const after = u.searchParams.get("cursor")?.slice(0, 36);
      const limit = Number(u.searchParams.get("limit") ?? 12);
      const rows = state.vehicles
        .filter((row) => !after || row.id > after)
        .sort((a, b) => a.id.localeCompare(b.id));
      const items = rows.slice(0, limit);
      return reply(
        {
          items,
          ...(rows.length > limit
            ? { nextCursor: `${items.at(-1)!.id}_${"a".repeat(64)}` }
            : {}),
        },
        state.vehicleError ? 503 : 200,
      );
    }
    if (p.includes("notifications")) return reply({ items: [], unreadCount: 0 });
    return reply({ items: [] });
  });
  return state;
}
