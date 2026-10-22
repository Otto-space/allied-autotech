// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SupportTimelineEntry } from "@/app/components/support-timeline-entry";
import { customerNotificationDestination } from "@/lib/notifications/destinations";
import { parseSupportMessages } from "@/lib/api/support-schemas";
const id = "b3000000-0000-4000-8000-000000000040";
const entry = {
  id,
  authorType: "STAFF" as const,
  visibility: "CUSTOMER" as const,
  body: "Please send a photograph",
  createdAt: "2026-10-22T10:00:00Z",
};
afterEach(cleanup);
describe("support timeline distinction", () => {
  it("renders status transitions separately from conversational replies", () => {
    render(
      <>
        <SupportTimelineEntry
          entry={{
            ...entry,
            kind: "STATUS_CHANGE",
            fromStatus: "OPEN",
            toStatus: "IN_PROGRESS",
            body: "We are investigating",
          }}
        />
        <SupportTimelineEntry entry={{ ...entry, id: "reply", kind: "REPLY" }} />
      </>,
    );
    expect(
      screen.getByLabelText("Status update from Allied AutoTech team").textContent,
    ).toContain("changed to");
    expect(screen.getByText("In progress")).toBeTruthy();
    expect(
      screen.getByLabelText("Reply from Allied AutoTech team").textContent,
    ).toContain("Please send a photograph");
  });
  it("keeps historical messages neutral instead of guessing their original purpose", () => {
    render(
      <SupportTimelineEntry entry={{ ...entry, body: "Your enquiry is resolved" }} />,
    );
    expect(screen.getByText("Message")).toBeTruthy();
    expect(screen.queryByText("Status update")).toBeNull();
  });
  it("never renders an internal note in a customer view, including inconsistent visibility", () => {
    const { container } = render(
      <>
        <SupportTimelineEntry entry={{ ...entry, visibility: "INTERNAL" }} />
        <SupportTimelineEntry entry={{ ...entry, kind: "INTERNAL_NOTE" }} />
      </>,
    );
    expect(container.textContent).toBe("");
    expect(() =>
      parseSupportMessages(false, {
        items: [{ ...entry, visibility: "INTERNAL" }],
        cursor: id,
        hasMore: false,
        pollAfterMs: 30000,
      }),
    ).toThrow();
  });
  it("labels staff-only notes explicitly", () => {
    render(
      <SupportTimelineEntry
        staff
        entry={{ ...entry, visibility: "INTERNAL", kind: "INTERNAL_NOTE" }}
      />,
    );
    expect(screen.getByText("Internal note")).toBeTruthy();
    expect(screen.getByText(/Staff only/)).toBeTruthy();
  });
  it("links valid support entries precisely without letting arbitrary types alter routes", () => {
    expect(
      customerNotificationDestination({
        resourceType: "ENQUIRY",
        resourceId: id,
        supportMessageId: id,
        category: "OPERATIONAL",
      })?.href,
    ).toBe(`/dashboard/support/enquiries/${id}?messageId=${id}#support-entry-${id}`);
    expect(
      customerNotificationDestination({
        resourceType: "BOOKING",
        resourceId: id,
        supportMessageId: id,
        category: "OPERATIONAL",
      })?.href,
    ).toBe(`/dashboard/bookings/${id}`);
    expect(
      customerNotificationDestination({
        resourceType: "ENQUIRY",
        resourceId: id,
        supportMessageId: "bad",
        category: "OPERATIONAL",
      })?.href,
    ).toBe(`/dashboard/support/enquiries/${id}`);
  });
});
