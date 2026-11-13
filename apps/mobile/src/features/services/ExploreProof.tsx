import { useInfiniteQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useApi } from "../../api/client/context";
import { queryKey } from "../../api/queries";
import { useSession } from "../../auth/session";
import { Screen, Button, Text } from "../../components/ui";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/feedback";
import { servicesSchema } from "./contracts";
import { ServiceSummary } from "./ServiceSummary";
import { spacing } from "../../design/tokens";

export default function ExploreProof() {
  const api = useApi();
  const router = useRouter();
  const { sessionGeneration } = useSession();
  const query = useInfiniteQuery({
    queryKey: queryKey("public", sessionGeneration, "services"),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ signal, pageParam }) =>
      api.get(
        "/public/services",
        servicesSchema,
        signal,
        pageParam ? { cursor: pageParam } : undefined,
      ),
    getNextPageParam: (last, _pages, _param, params) =>
      last.nextCursor && !params.includes(last.nextCursor) ? last.nextCursor : undefined,
  });
  const services = [
    ...new Map(
      query.data?.pages.flatMap((page) =>
        page.items.map((service) => [service.id, service] as const),
      ),
    ).values(),
  ];
  return (
    <Screen title="Services">
      <Text>Explore our services and choose one for your next workshop visit.</Text>
      {query.isPending ? (
        <LoadingSkeleton label="Loading services" />
      ) : query.isError && !query.data ? (
        <ErrorState
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : services.length === 0 ? (
        <EmptyState
          title="No services listed"
          message="There are no published services in this response. Try again later."
        />
      ) : (
        services.map((service) => (
          <View key={service.id} style={{ gap: spacing[2] }}>
            <ServiceSummary service={service} />
            <Button
              label={`View ${service.name}`}
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/services/[serviceId]",
                  params: { serviceId: service.id },
                })
              }
            />
          </View>
        ))
      )}
      {query.isError && query.data ? (
        <ErrorState
          error={query.error}
          onRetry={() => {
            if (query.isFetchNextPageError) void query.fetchNextPage();
            else void query.refetch();
          }}
        />
      ) : null}
      {query.isFetchingNextPage ? (
        <LoadingSkeleton label="Loading more services" />
      ) : null}
      {query.hasNextPage && !query.isError ? (
        <Button
          label="Load more services"
          variant="secondary"
          disabled={query.isFetching}
          onPress={() => {
            void query.fetchNextPage();
          }}
        />
      ) : null}
      {services.length === 0 && !query.isPending && !query.isError ? (
        <Button
          label="Refresh services"
          variant="secondary"
          onPress={() => {
            void query.refetch();
          }}
        />
      ) : null}
    </Screen>
  );
}
