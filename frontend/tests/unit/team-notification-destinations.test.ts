import { describe, expect, it } from "vitest";
import {
  notificationNavigationCounts,
  staffNotificationDestination,
} from "@/lib/notifications/destinations";
const id = "b3000000-0000-4000-8000-000000000040";
const item = {
  resourceType: "ENQUIRY",
  resourceId: id,
  category: "OPERATIONAL" as const,
  supportMessageId: id,
};
describe("staff notification awareness", () => {
  it("uses exact legacy conversation and message destinations", () => {
    expect(
      staffNotificationDestination(item, { managed: false, links: ["/admin/support"] })
        ?.href,
    ).toBe(`/admin/support/enquiries/${id}?messageId=${id}#support-entry-${id}`);
  });
  it("opens scoped workforce details and cannot fall back to broad legacy access", () => {
    expect(
      staffNotificationDestination(item, {
        managed: true,
        links: ["/admin/workforce/enquiries"],
      })?.href,
    ).toBe(`/admin/workforce/enquiries?selected=${id}`);
    expect(
      staffNotificationDestination(item, { managed: true, links: ["/admin/support"] }),
    ).toBeNull();
    expect(staffNotificationDestination(item, { managed: false, links: [] })).toBeNull();
    expect(
      staffNotificationDestination(
        { ...item, resourceId: `${id}?other=true` },
        { managed: false, links: ["/admin/support"] },
      ),
    ).toBeNull();
  });
  it("counts only accessible sidebar destinations while preserving total inbox count", () => {
    const summary = {
      unreadCount: 5,
      groups: [
        {
          resourceType: "ENQUIRY",
          category: "OPERATIONAL" as const,
          type: "ENQUIRY" as const,
          count: 3,
        },
        {
          resourceType: "PAYMENT",
          category: "TRANSACTIONAL" as const,
          type: "PAYMENT" as const,
          count: 2,
        },
      ],
    };
    expect(
      notificationNavigationCounts(summary, false, {
        managed: true,
        links: ["/admin/workforce/enquiries"],
      }),
    ).toEqual({ "/admin/notifications": 5, "/admin/workforce/enquiries": 3 });
  });
});
