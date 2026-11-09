import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "../errors";

export const queryKey = (
  scope: "public" | "private",
  sessionGeneration: number,
  resource: string,
) => [scope, sessionGeneration, resource] as const;
export async function clearPrivateCache(client: QueryClient): Promise<void> {
  const filter = {
    predicate: (query: { queryKey: readonly unknown[] }) =>
      query.queryKey[0] === "private",
  };
  await client.cancelQueries(filter);
  client.removeQueries(filter);
}
export function makeQueryClient(
  onForbidden: (
    error: ApiError,
    resource: unknown,
    client: QueryClient,
  ) => void = () => {},
) {
  const client = new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => {
        if (error instanceof ApiError && error.status === 403)
          onForbidden(error, "mutation", client);
      },
    }),
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (error instanceof ApiError && error.status === 403)
          onForbidden(error, query.queryKey[2], client);
      },
    }),
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0, refetchOnReconnect: true },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return client;
}
