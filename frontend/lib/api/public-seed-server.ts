import "server-only";
import { cache } from "react";
import { publicData } from "./public-server";
import type { PublicSeed } from "./public-seed";
// React cache deduplicates metadata and page reads within this request only.
export const loadPublicSeed = cache(
  async <T>(path: string, parse: (value: unknown) => T): Promise<PublicSeed<T>> => {
    try {
      return { path, data: await publicData(path, parse) };
    } catch {
      return {
        path,
        error: "This information is temporarily unavailable. Please try again.",
      };
    }
  },
);
