import { Screen, Text, StatusBadge } from "../../src/components/ui";
import {
  ErrorState,
  LoadingSkeleton,
  UnavailableCapabilityNotice,
} from "../../src/components/feedback";
import { useCapabilities } from "../../src/capabilities";
export default function Home() {
  const { snapshot, loading, error, retry } = useCapabilities();
  return (
    <Screen title="Allied AutoTech" screenId="S05 Personalized Home">
      <Text>
        Your vehicles and car-care updates will be together here. For now, explore public
        information without signing in.
      </Text>
      <StatusBadge label="Signed out · Read-only scaffold" />
      {loading ? (
        <LoadingSkeleton label="Checking availability" />
      ) : error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : null}
      {!snapshot ? (
        <UnavailableCapabilityNotice />
      ) : (
        <Text>Server availability received. This scaffold supports browsing only.</Text>
      )}
    </Screen>
  );
}
