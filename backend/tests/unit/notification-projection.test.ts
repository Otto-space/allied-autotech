import { describe, expect, it } from "vitest";
import { projectNotification } from "../../src/modules/notifications/notification-projection.js";
const row = {
  id: "fixture",
  type: "ENQUIRY",
  category: "OPERATIONAL",
  title: "Private subject",
  message: "Private message",
  resourceType: "ENQUIRY",
  resourceId: "source",
  supportMessageId: "reply",
  readAt: null,
};
describe("current-access notification projection", () => {
  it("preserves authorized content and does not mutate historical records", () => {
    const target = {
      href: "/dashboard/support",
      section: "/dashboard/support",
      label: "View update",
    };
    expect(projectNotification(row, new Map([[row.id, target]]))).toEqual({
      ...row,
      destination: target,
    });
    const hidden = projectNotification(row, new Map());
    expect(hidden.title + hidden.message).not.toMatch(/Private|source|reply/);
    expect(hidden).toMatchObject({
      id: row.id,
      readAt: null,
      resourceType: null,
      destination: null,
    });
    expect(row.message).toBe("Private message");
  });
  it("retains source-free account messages with no guessed action", () => {
    const account = {
      ...row,
      resourceType: null,
      resourceId: null,
      supportMessageId: null,
    };
    expect(projectNotification(account, new Map())).toEqual({
      ...account,
      destination: null,
    });
  });
});
