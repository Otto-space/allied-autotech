import { Card, Text } from "../../components/ui";
import { colors } from "../../design/tokens";
import { servicePrice, type CatalogueService } from "./contracts";

export function ServiceSummary({
  service,
  detail = false,
}: {
  service: CatalogueService;
  detail?: boolean;
}) {
  const description = detail
    ? service.description?.trim() || service.shortDescription?.trim()
    : service.shortDescription?.trim();
  return (
    <Card>
      <Text accessibilityRole="header" style={{ color: colors.ink, fontWeight: "700" }}>
        {service.name}
      </Text>
      <Text style={{ fontWeight: "600" }}>{servicePrice(service)}</Text>
      {description ? (
        <Text>{description}</Text>
      ) : detail ? (
        <Text>No description is available for this service.</Text>
      ) : null}
      {detail ? (
        <Text>
          {service.durationMinutes === null
            ? "Duration will be confirmed by the workshop."
            : `Listed duration: ${service.durationMinutes} minutes. Appointment timing is subject to workshop review.`}
        </Text>
      ) : null}
    </Card>
  );
}
