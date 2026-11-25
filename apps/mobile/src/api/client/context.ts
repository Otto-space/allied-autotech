import { createContext, useContext } from "react";
import type { ApiClient } from ".";
export const ApiContext = createContext<ApiClient | null>(null);
export function useApi() {
  const api = useContext(ApiContext);
  if (!api) throw new Error("ApiProvider is required");
  return api;
}
