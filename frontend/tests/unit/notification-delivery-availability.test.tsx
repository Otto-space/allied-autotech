// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { deliveryAvailability } from "@/lib/notifications/delivery-availability";
import { NotificationDeliveryStatus } from "@/app/components/notification-delivery-status";

afterEach(cleanup);
const channels = { email: true, sms: false, marketing: false };
it.each([
  ["OPERATIONAL", "EMAIL", channels, false, "Service enabled"],
  ["OPERATIONAL", "SMS", channels, false, "Delivery unavailable"],
  ["MARKETING", "EMAIL", channels, false, "Delivery unavailable"],
  ["MARKETING", "SMS", { ...channels, marketing: true }, false, "Delivery unavailable"],
  ["MARKETING", "EMAIL", { ...channels, marketing: true }, false, "Service enabled"],
  ["OPERATIONAL", "EMAIL", channels, true, "Availability unknown"],
  ["MARKETING", "EMAIL", channels, true, "Availability unknown"],
  ["OPERATIONAL", "SMS", undefined, false, "Availability unknown"],
  ["MARKETING", "EMAIL", undefined, false, "Availability unknown"],
] as const)(
  "%s %s handles known, missing and stale delivery data",
  (category, channel, current, stale, label) => {
    expect(deliveryAvailability(category, channel, current, stale).label).toBe(label);
  },
);

it.each([true, false])(
  "a saved preference %s does not change unavailable SMS into available delivery",
  (enabled) => {
    render(
      <NotificationDeliveryStatus
        id="status"
        category="OPERATIONAL"
        channel="SMS"
        channels={channels}
        enabled={enabled}
        isDefault={false}
        stale={false}
      />,
    );
    expect(screen.getByText(`Saved preference: ${enabled ? "On" : "Off"}`)).toBeTruthy();
    expect(screen.getByText("Delivery unavailable")).toBeTruthy();
  },
);

it("distinguishes defaults from a stale previously saved preference", () => {
  const props = {
    id: "status",
    category: "OPERATIONAL",
    channel: "EMAIL",
    channels,
    enabled: true,
    isDefault: true,
    stale: false,
  } as const;
  const { rerender } = render(<NotificationDeliveryStatus {...props} />);
  expect(screen.getByText("Default preference: On")).toBeTruthy();
  rerender(<NotificationDeliveryStatus {...props} isDefault={false} stale />);
  expect(screen.getByText("Last known preference: On")).toBeTruthy();
  expect(screen.queryByText("Service enabled")).toBeNull();
  expect(screen.getByText("Availability unknown")).toBeTruthy();
});
