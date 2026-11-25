import { View } from "react-native";
import { ApiError } from "../../api/errors";
import { Text, Button, Card } from "../ui";

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <Text accessibilityRole="header" style={{ fontWeight: "700" }}>
        {title}
      </Text>
      <Text>{message}</Text>
    </Card>
  );
}
export function ErrorState({ error, onRetry }: { error: Error; onRetry(): void }) {
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
      <Text accessibilityRole="alert">{error.message}</Text>
      {error instanceof ApiError && error.retryAfterSeconds !== undefined ? (
        <Text>Try again after {error.retryAfterSeconds} seconds.</Text>
      ) : null}
      <Button label="Try again" onPress={onRetry} variant="secondary" />
    </View>
  );
}
// Static skeleton intentionally has no pulsing/shimmer: respects Reduce Motion.
export function LoadingSkeleton({ label = "Loading information" }: { label?: string }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
    >
      <Card>
        <Text>{label}…</Text>
      </Card>
    </View>
  );
}
export function OfflineBanner() {
  return (
    <Text accessibilityRole="alert">
      You are offline. Connect to load current information.
    </Text>
  );
}
export function UnavailableCapabilityNotice({
  message = "Availability could not be verified. You can browse, but sending requests is unavailable.",
}: {
  message?: string;
}) {
  return (
    <View accessibilityLiveRegion="polite">
      <Card>
        <Text accessibilityRole="alert">{message}</Text>
      </Card>
    </View>
  );
}
