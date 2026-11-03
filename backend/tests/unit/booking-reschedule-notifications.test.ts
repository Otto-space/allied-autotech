import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock("../../src/modules/notifications/notifications.service.js", () => ({
  enqueueNotification: mocks.enqueue,
}));
import { ServiceOperationsService } from "../../src/modules/service-operations/service-operations.service.js";
const service = new ServiceOperationsService({} as never) as unknown as {
  notifyReschedule: (
    tx: unknown,
    booking: { id: string; assignedStaffId: string | null },
    buyer: string,
    title: string,
    message: string,
    version: number,
    previousStaff?: string | null,
  ) => Promise<void>;
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.enqueue.mockResolvedValue(undefined);
});
it("queues the approval update for the customer and both affected active staff, using distinct receipts", async () => {
  const lookup = vi.fn(async ({ where }: { where: { id: string } }) => ({
    userId: `${where.id}-user`,
    user: { status: "ACTIVE" },
  }));
  await service.notifyReschedule(
    { staffProfile: { findUnique: lookup } },
    { id: "booking", assignedStaffId: "new-staff" },
    "buyer",
    "Reschedule approved",
    "Review the new confirmed time",
    3,
    "old-staff",
  );
  const messages = mocks.enqueue.mock.calls.map((call) => call[1]);
  expect(messages.map((message) => message.userId).sort()).toEqual([
    "buyer",
    "new-staff-user",
    "old-staff-user",
  ]);
  expect(new Set(messages.map((message) => message.deduplicationKey)).size).toBe(3);
  expect(
    messages.every(
      (message) =>
        message.resourceId === "booking" && message.category === "TRANSACTIONAL",
    ),
  ).toBe(true);
});
it("does not queue duplicates when the assignment stays unchanged or shares the customer identity", async () => {
  const lookup = vi.fn(async () => ({ userId: "buyer", user: { status: "ACTIVE" } }));
  await service.notifyReschedule(
    { staffProfile: { findUnique: lookup } },
    { id: "booking", assignedStaffId: "same" },
    "buyer",
    "Update",
    "Synthetic",
    2,
    "same",
  );
  expect(lookup).toHaveBeenCalledOnce();
  expect(mocks.enqueue).toHaveBeenCalledOnce();
});
it("does not notify inactive or missing staff and keeps the customer's update", async () => {
  const lookup = vi.fn(async ({ where }: { where: { id: string } }) =>
    where.id === "inactive"
      ? { userId: "inactive-user", user: { status: "SUSPENDED" } }
      : null,
  );
  await service.notifyReschedule(
    { staffProfile: { findUnique: lookup } },
    { id: "booking", assignedStaffId: "inactive" },
    "buyer",
    "Update",
    "Synthetic",
    2,
    "missing",
  );
  expect(mocks.enqueue).toHaveBeenCalledOnce();
  expect(mocks.enqueue.mock.calls[0]?.[1].userId).toBe("buyer");
});
