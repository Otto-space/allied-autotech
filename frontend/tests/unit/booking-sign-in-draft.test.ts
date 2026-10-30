// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  saveBookingSignInDraft,
  saveConcernSignInDraft,
  consumeConcernSignInDraft,
  consumeBookingSignInDraft,
  bookingSignInDestination,
} from "@/lib/forms/booking-sign-in-draft";
import { invalidateSession } from "@/lib/api/client";
vi.mock("@/lib/notifications/browser-push", () => ({ clearBrowserPush: vi.fn() }));
const draft = {
  serviceId: "a9000000-0000-4000-8000-000000000002",
  branchId: "a9000000-0000-4000-8000-000000000003",
  branchName: "Port Harcourt",
  slotId: "",
  preferredTime: "2026-11-10T10:30",
  notes: "Check the brakes",
};
describe("explicit anonymous booking sign-in handoff", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());
  it("survives only explicit sign-in rotations and is consumed once for the matching service", () => {
    expect(saveBookingSignInDraft(draft)).toBe(true);
    invalidateSession("sign-in");
    invalidateSession("sign-in");
    expect(consumeBookingSignInDraft(crypto.randomUUID())).toBeNull();
    expect(consumeBookingSignInDraft(draft.serviceId)).toMatchObject(draft);
    expect(consumeBookingSignInDraft(draft.serviceId)).toBeNull();
  });
  it("keeps entered notes when sign-in starts before a branch is chosen", () => {
    expect(
      saveBookingSignInDraft({
        ...draft,
        branchId: "",
        branchName: "",
        preferredTime: "",
      }),
    ).toBe(true);
    expect(consumeBookingSignInDraft(draft.serviceId)).toMatchObject({
      notes: draft.notes,
      branchId: "",
    });
  });
  it("clears on logout, expiry, external account invalidation and password changes", () => {
    for (const reason of [undefined, "password-changed"] as const) {
      saveBookingSignInDraft(draft);
      invalidateSession(reason);
      expect(bookingSignInDestination()).toBeNull();
    }
    saveBookingSignInDraft(draft);
    vi.advanceTimersByTime(15 * 60_000);
    expect(bookingSignInDestination()).toBeNull();
  });
  it("does not carry prices, consent, account vehicles, submission keys or arbitrary redirects", () => {
    for (const extra of [
      { priceKobo: "1" },
      { accepted: true },
      { vehicleId: crypto.randomUUID() },
      { idempotencyKey: "old" },
      { next: "https://example.test" },
    ]) {
      expect(saveBookingSignInDraft({ ...draft, ...extra })).toBe(false);
    }
    saveBookingSignInDraft(draft);
    expect(bookingSignInDestination()).toBe(`/services/${draft.serviceId}`);
  });
});

const concernDraft = {
  branchId: draft.branchId,
  branchName: draft.branchName,
  preferredTime: draft.preferredTime,
  notes: draft.notes,
  customerConcern: "The vehicle vibrates when braking",
};
describe("concern request sign-in handoff", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());
  it("returns to the concern form and cannot be consumed by a service form", () => {
    expect(saveConcernSignInDraft(concernDraft)).toBe(true);
    invalidateSession("sign-in");
    expect(bookingSignInDestination()).toBe("/services/request");
    expect(consumeBookingSignInDraft(draft.serviceId)).toBeNull();
    expect(consumeConcernSignInDraft()).toMatchObject(concernDraft);
    expect(consumeConcernSignInDraft()).toBeNull();
    expect(bookingSignInDestination()).toBeNull();
  });
  it("does not consume an unrelated service request", () => {
    saveBookingSignInDraft(draft);
    expect(consumeConcernSignInDraft()).toBeNull();
    expect(consumeBookingSignInDraft(draft.serviceId)).toMatchObject(draft);
  });
  it("expires and clears on account invalidation", () => {
    saveConcernSignInDraft(concernDraft);
    vi.advanceTimersByTime(15 * 60_000);
    expect(consumeConcernSignInDraft()).toBeNull();
    saveConcernSignInDraft(concernDraft);
    invalidateSession();
    expect(consumeConcernSignInDraft()).toBeNull();
  });
  it("rejects account records, payment facts and redirect injection", () => {
    for (const extra of [
      { vehicleId: crypto.randomUUID() },
      { priceKobo: "100" },
      { idempotencyKey: "retry" },
      { next: "https://example.test" },
      { accepted: true },
    ])
      expect(saveConcernSignInDraft({ ...concernDraft, ...extra })).toBe(false);
    expect(bookingSignInDestination()).toBeNull();
  });
});
