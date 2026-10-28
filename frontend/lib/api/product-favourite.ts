import { z } from "zod";
import { apiRequest } from "./client";

const pageSchema = z.object({
  items: z
    .array(z.object({ id: z.uuid(), product: z.object({ id: z.uuid() }) }))
    .max(100),
  nextCursor: z.uuid().optional(),
});

// The current API exposes an owned paginated collection, not a per-product read.
// Never infer absence from only the first page or from a failed/incomplete read.
export async function readProductFavourite(productId: string, signal: AbortSignal) {
  let cursor: string | undefined;
  const visited = new Set<string>();
  for (let pages = 0; pages < 100; pages++) {
    signal.throwIfAborted();
    const response = await apiRequest(
      `/customers/favourites?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal },
    );
    signal.throwIfAborted();
    const page = pageSchema.parse(response.data);
    if (page.items.some((item) => item.product.id === productId)) return true;
    if (!page.nextCursor) return false;
    if (visited.has(page.nextCursor)) throw new Error("Repeated favourites cursor");
    visited.add(page.nextCursor);
    cursor = page.nextCursor;
  }
  throw new Error("Favourites check incomplete");
}
