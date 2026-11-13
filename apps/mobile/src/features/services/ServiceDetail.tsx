import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { z } from "zod";
import { useApi } from "../../api/client/context";
import { queryKey } from "../../api/queries";
import { ApiError } from "../../api/errors";
import { useSession } from "../../auth/session";
import { Button, Screen, Text } from "../../components/ui";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/feedback";
import { serviceSchema } from "./contracts";
import { ServiceSummary } from "./ServiceSummary";

export default function ServiceDetail({ selected = false }: { selected?: boolean }) {
  const { serviceId } = useLocalSearchParams<{ serviceId?: string | string[] }>();
  const parsedId = z.uuid().safeParse(serviceId);
  const id = parsedId.success ? parsedId.data.toLowerCase() : null;
  const api = useApi();
  const router = useRouter();
  const { sessionGeneration } = useSession();
  const query = useQuery({
    queryKey: queryKey("public", sessionGeneration, `service:${id}`),
    enabled: id !== null,
    queryFn: ({ signal }) =>
      api.get(
        `/public/services/${id}`,
        serviceSchema.refine((service) => service.id.toLowerCase() === id),
        signal,
      ),
  });
  const backToServices = () => router.replace("/(tabs)/explore");
  const back = () => (router.canGoBack() ? router.back() : backToServices());
  const unavailable =
    id === null || (query.error instanceof ApiError && query.error.status === 404);
  return (
    <Screen title={selected ? "Selected service" : "Service details"}>
      <Button
        label={selected ? "Back to service details" : "Back to services"}
        variant="quiet"
        onPress={
          selected && id
            ? () => {
                if (router.canGoBack()) router.back();
                else
                  router.replace({
                    pathname: "/services/[serviceId]",
                    params: { serviceId: id },
                  });
              }
            : back
        }
      />
      {unavailable ? (
        <>
          <EmptyState
            title="Service unavailable"
            message="This service could not be found. Choose a service from the current catalogue."
          />
          <Button label="Browse services" onPress={backToServices} />
        </>
      ) : query.isPending ? (
        <LoadingSkeleton label="Loading service details" />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : query.data ? (
        <>
          <ServiceSummary service={query.data} detail />
          {query.isFetching ? (
            <LoadingSkeleton label="Checking current service details" />
          ) : null}
          {selected ? (
            <>
              <Text accessibilityLiveRegion="polite">
                You selected {query.data.name}.
              </Text>
              <Text>
                Appointment requests are not available in this version. No appointment has
                been requested or confirmed.
              </Text>
              <Button
                label="Choose another service"
                variant="secondary"
                onPress={backToServices}
              />
            </>
          ) : (
            <Button
              label="Select this service"
              disabled={query.isFetching}
              onPress={() =>
                router.push({
                  pathname: "/services/[serviceId]/selected",
                  params: { serviceId: query.data.id },
                })
              }
            />
          )}
        </>
      ) : null}
    </Screen>
  );
}
