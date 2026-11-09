import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "../../api/client/context";
import { queryKey } from "../../api/queries";
import { useSession } from "../../auth/session";
import { Screen, Card, Text } from "../../components/ui";
import { EmptyState, ErrorState, LoadingSkeleton } from "../../components/feedback";

// Validated projection of the committed list contract. Prices and durations are
// intentionally absent from this scaffold; no generated `any` is trusted.
export const servicesSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), name: z.string().min(1) })),
  nextCursor: z.uuid().optional(),
});
export default function ExploreProof() {
  const api = useApi();
  const { sessionGeneration } = useSession();
  const query = useQuery({
    queryKey: queryKey("public", sessionGeneration, "services"),
    queryFn: ({ signal }) => api.get("/public/services", servicesSchema, signal),
  });
  return (
    <Screen
      title="Explore"
      screenId="S07 Services catalogue/detail · S08 Shop · S09 Vehicles"
    >
      <Text>
        Services, parts and vehicles will be here. This first read-only proof loads
        published service names.
      </Text>
      {query.isPending ? (
        <LoadingSkeleton label="Loading services" />
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          title="No services listed"
          message="There are no published services in this response. Try again later."
        />
      ) : (
        query.data.items.map((service) => (
          <Card key={service.id}>
            <Text>{service.name}</Text>
          </Card>
        ))
      )}
    </Screen>
  );
}
