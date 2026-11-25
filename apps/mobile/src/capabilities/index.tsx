import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "../api/client/context";
import { queryKey } from "../api/queries";
import { capabilitiesSchema, type Capabilities } from "./model";
import { useSession } from "../auth/session";
const MAX_AGE_MS = 60000;
const Context = createContext<{
  snapshot: Capabilities | null;
  loading: boolean;
  error: Error | null;
  retry(): void;
}>({ snapshot: null, loading: true, error: null, retry() {} });
export function CapabilitiesProvider({ children }: PropsWithChildren) {
  const api = useApi();
  const { sessionGeneration } = useSession();
  const query = useQuery({
    queryKey: queryKey("public", sessionGeneration, "capabilities"),
    queryFn: ({ signal }) => api.get("/public/capabilities", capabilitiesSchema, signal),
    staleTime: MAX_AGE_MS,
    refetchInterval: MAX_AGE_MS,
  });
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, query.dataUpdatedAt + MAX_AGE_MS - Date.now()),
    );
    const subscription = AppState.addEventListener("change", () => setNow(Date.now()));
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [query.dataUpdatedAt]);
  const fresh = now - query.dataUpdatedAt < MAX_AGE_MS;
  const snapshot = query.isSuccess && fresh ? (query.data ?? null) : null;
  return (
    <Context.Provider
      value={{
        snapshot,
        loading: query.isPending,
        error: query.error,
        retry: () => {
          void query.refetch();
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useCapabilities = () => useContext(Context);
