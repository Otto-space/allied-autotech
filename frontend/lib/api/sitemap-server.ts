import "server-only";
import { z } from "zod";
import { publicData } from "./public-server";
import { publicPaths } from "../seo";
const idPage = z.object({
  items: z.array(z.object({ id: z.uuid() })),
  nextCursor: z.uuid().optional(),
});
const sources = [
  { api: "/public/services", page: "/services" },
  { api: "/public/catalog/products", page: "/parts" },
  { api: "/public/vehicles", page: "/vehicles" },
];
async function sourcePaths(source: (typeof sources)[number], signal: AbortSignal) {
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 100; page++) {
    const result = await publicData(
      `${source.api}?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      (value) => idPage.parse(value),
      signal,
    );
    for (const item of result.items) {
      if (ids.has(item.id)) throw new Error("Catalogue changed while paging");
      ids.add(item.id);
    }
    if (!result.nextCursor) return [...ids].map((id) => `${source.page}/${id}`);
    if (cursors.has(result.nextCursor)) throw new Error("Repeated catalogue cursor");
    cursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error("Catalogue exceeds sitemap scan limit");
}
export async function sitemapPaths() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const catalogues = await Promise.all(
      sources.map((source) => sourcePaths(source, controller.signal)),
    );
    return [...publicPaths, ...catalogues.flat()];
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
export function sitemapXml(origin: string, paths: readonly string[]) {
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${escape(new URL(path, origin).href)}</loc></url>`).join("")}</urlset>`;
}
