import { normalizeServiceQuery } from "./service-discovery";
import { normalizeProductQuery } from "./product-discovery";
import { normalizeVehicleQuery } from "./vehicle-discovery";

export const publicSearchScopes = [
  { value: "all", label: "Everything", maxLength: 100 },
  { value: "services", label: "Services", maxLength: 100 },
  { value: "parts", label: "Shop", maxLength: 100 },
  { value: "vehicles", label: "Vehicles", maxLength: 100 },
  { value: "help", label: "Help", maxLength: 100 },
] as const;
type Scope = (typeof publicSearchScopes)[number]["value"];
type SearchResult = {
  scope: Scope;
  query: string;
  href?: string;
  error?: string;
  invalidField?: "scope" | "search";
};

/** Only the existing public catalogues; a user-supplied scope is never a URL. */
export function resolvePublicSearch(input: {
  scope?: string | string[];
  search?: string | string[];
}): SearchResult {
  const scope: Scope = publicSearchScopes.some((item) => item.value === input.scope)
    ? (input.scope as Scope)
    : "all";
  const query = typeof input.search === "string" ? input.search.trim() : "";
  if (Array.isArray(input.scope) || (input.scope !== undefined && input.scope !== scope))
    return {
      scope,
      query,
      error: "Choose where to search and enter one search phrase.",
      invalidField: "scope",
    };
  if (Array.isArray(input.search))
    return { scope, query, error: "Enter one search phrase.", invalidField: "search" };
  if (input.search === undefined) return { scope, query };
  const limit = publicSearchScopes.find((item) => item.value === scope)!.maxLength;
  if (!query)
    return {
      scope,
      query,
      error: "Enter what you would like to find.",
      invalidField: "search",
    };
  if ((scope === "services" || scope === "all") && query.length < 2)
    return {
      scope,
      query,
      error: "Use at least two characters to search services.",
      invalidField: "search",
    };
  if (
    query.length > limit ||
    ![...query].every((char) => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127)
  )
    return {
      scope,
      query,
      error: `Use up to ${limit} characters without line breaks.`,
      invalidField: "search",
    };
  if (scope === "all" || scope === "help") return { scope, query };
  const normalizer = {
    services: normalizeServiceQuery,
    parts: normalizeProductQuery,
    vehicles: normalizeVehicleQuery,
  }[scope];
  const result = normalizer(new URLSearchParams({ search: query }));
  if (result.invalid || result.params.get("search") !== query)
    return {
      scope,
      query,
      error: "Check your search phrase and try again.",
      invalidField: "search",
    };
  return { scope, query, href: `/${scope}?${new URLSearchParams({ search: query })}` };
}
