import {
  demoCategories,
  demoProducts,
  demoListings,
  demoMakes,
  demoModels,
  demoServices,
  demoReviews,
  demoBranch,
} from "./discovery-demo.mjs";

export const demoCursor = "d".repeat(120);
/** Read-only API simulation; deliberately no database, account, payment or write implementation. */
/** @param {URL} url @param {"populated" | "empty" | "error" | "no-fitment"} mode */
export function discoveryResponse(url, mode = "populated") {
  const path = url.pathname.replace(/^\/api\/v1/, "");
  const query = url.searchParams;
  const limit = Math.min(50, Math.max(1, Number(query.get("limit") ?? 20)));
  const empty = mode === "empty";
  if (
    path === "/public/catalog/products" ||
    path === "/public/catalog/products/discovery"
  ) {
    let items = empty ? [] : demoProducts;
    const search = query.get("search")?.toLowerCase();
    if (search)
      items = items.filter((item) =>
        `${item.name} ${item.sku} ${item.brand ?? ""} ${item.manufacturerPartNumber ?? ""}`
          .toLowerCase()
          .includes(search),
      );
    if (query.has("categoryId"))
      items = items.filter((item) => item.category.id === query.get("categoryId"));
    if (query.get("fitment") === "verified") items = [];
    const start = query.has("cursor") ? 12 : 0;
    return {
      items: items.slice(start, start + limit),
      totalMatches: items.length,
      ...(items.length > start + limit ? { nextCursor: demoCursor } : {}),
      ...(query.has("vehicleModelId") ? { verifiedMatches: 0 } : {}),
    };
  }
  if (path.startsWith("/public/catalog/products/"))
    return demoProducts.find((item) => path.endsWith(item.id));
  if (path === "/public/vehicles" || path === "/public/vehicles/discovery") {
    let items = empty ? [] : demoListings;
    if (query.get("search"))
      items = items.filter((item) =>
        item.title.toLowerCase().includes((query.get("search") ?? "").toLowerCase()),
      );
    const conditions = query.get("conditions") ?? query.get("condition");
    if (conditions)
      items = items.filter((item) =>
        conditions.split(",").includes(item.vehicle.condition),
      );
    return { items: items.slice(0, limit), totalMatches: items.length };
  }
  if (path.startsWith("/public/vehicles/") && !path.endsWith("/facets"))
    return demoListings.find((item) => path.endsWith(item.id));
  if (path === "/public/catalog/categories")
    return { items: empty ? [] : demoCategories };
  if (path.startsWith("/public/catalog/categories/"))
    return demoCategories.find((item) => path.endsWith(item.id));
  if (path === "/public/catalog/facets") return { items: [] };
  if (path === "/public/vehicles/facets")
    return {
      items: (query.get("field") === "model"
        ? demoModels.filter((item) => item.make.name === query.get("make"))
        : demoMakes
      ).map((item) => ({ value: item.name, label: item.name })),
    };
  if (path === "/public/fitment/makes")
    return {
      items:
        empty || mode === "no-fitment"
          ? []
          : demoMakes.filter((item) =>
              item.name
                .toLowerCase()
                .startsWith(query.get("search")?.toLowerCase() ?? ""),
            ),
    };
  if (path === "/public/fitment/models")
    return { items: demoModels.filter((item) => item.makeId === query.get("makeId")) };
  if (path.startsWith("/public/fitment/models/"))
    return demoModels.find((item) => path.endsWith(item.id));
  if (path === "/public/services")
    return { items: empty ? [] : demoServices.slice(0, limit) };
  if (path.startsWith("/public/services/"))
    return demoServices.find((item) => path.endsWith(item.id));
  if (path === "/public/support/reviews") return { items: empty ? [] : demoReviews };
  if (path === "/public/branches") return { items: [demoBranch] };
  return { items: [] };
}
