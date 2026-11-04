// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import type { AttendanceEvent } from "../../lib/api/booking-attendance";
import {
  BookingAttendance,
  BookingAttendanceHistory,
} from "../../app/components/booking-attendance";
const state = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  error: undefined as string | undefined,
  refresh: vi.fn(),
  request: vi.fn(),
  actor: "a0000000-0000-4000-8000-000000000001",
  role: "ADMIN",
  paths: [] as string[],
}));
vi.mock("../../app/components/dashboard-shell", () => ({
  useAccountSession: () => ({ user: { id: state.actor, role: state.role } }),
}));
vi.mock("../../lib/api/use-resource", () => ({
  useResource: (path: string) => {
    state.paths.push(path);
    return {
      data: state.row,
      error: state.error,
      refreshError: undefined,
      loading: false,
      refreshing: false,
      refresh: state.refresh,
    };
  },
}));
vi.mock("../../lib/api/client", () => ({
  apiRequest: (...args: unknown[]) => state.request(...args),
  ApiError: class ApiError extends Error {
    constructor(public status: number) {
      super("Rejected attendance update");
    }
  },
}));
const id = "b0000000-0000-4000-8000-000000000001",
  operation = "c0000000-0000-4000-8000-000000000001",
  actor = state.actor;
function snapshot() {
  return {
    bookingId: id,
    bookingVersion: 4,
    scheduleVersion: 2,
    status: "CONFIRMED",
    startedAt: null,
    serverTime: "2026-11-04T12:20:00Z",
    policy: { graceMinutes: 15, source: "DELEGATED_DEFAULT", policyVersionId: null },
    checkAt: "2026-11-04T12:15:00Z",
    checkAttendance: true,
    workReviewRequired: false,
    current: null,
    events: [],
    receipt: null,
  };
}
function event(): AttendanceEvent {
  return {
    id: operation,
    kind: "ARRIVED",
    reason: "Arrival recorded by the workshop",
    createdAt: "2026-11-04T12:20:00Z",
    bookingVersion: 5,
    scheduleVersion: 2,
    graceMinutes: null,
    graceSource: null,
  };
}
beforeEach(() => {
  state.row = snapshot();
  state.error = undefined;
  state.actor = actor;
  state.role = "ADMIN";
  state.paths = [];
  state.refresh.mockReset();
  state.request.mockReset();
  sessionStorage.clear();
  vi.spyOn(crypto, "randomUUID").mockReturnValue(operation);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("attendance actions and recovery", () => {
  it("does not turn missing arrival or RSVP into a missed status", () => {
    render(<BookingAttendance bookingId={id} onUpdated={vi.fn()} />);
    expect(
      screen.getByText("No workshop arrival recorded for this appointment"),
    ).toBeTruthy();
    expect(state.request).not.toHaveBeenCalled();
  });
  it("sends a version-bound arrival and verifies the actor/operation receipt", async () => {
    state.request.mockResolvedValue({
      data: {
        event: event(),
        performedByUserId: actor,
        attendance: {
          ...snapshot(),
          bookingVersion: 5,
          current: event(),
          events: [event()],
        },
      },
    });
    const updated = vi.fn();
    render(<BookingAttendance bookingId={id} onUpdated={updated} />);
    fireEvent.click(screen.getByRole("button", { name: "Save attendance update" }));
    await screen.findByText("Attendance update saved.");
    expect(state.request).toHaveBeenCalledWith(
      `/staff/bookings/${id}/attendance`,
      expect.objectContaining({
        method: "POST",
        csrf: true,
        body: { operationId: operation, expectedVersion: 4, kind: "ARRIVED" },
      }),
    );
    expect(updated).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledWith("Attendance update saved.");
    expect(sessionStorage.getItem(`aat-attendance:${actor}:${id}`)).toBeNull();
  });
  it("requires an explicit staff absence check", () => {
    render(<BookingAttendance bookingId={id} onUpdated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Update"), {
      target: { value: "ABSENCE_CONFIRMED" },
    });
    expect(
      screen.getByRole("button", { name: "Confirm missed appointment" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByLabelText("I checked that the customer has not arrived."),
    );
    expect(
      screen.getByRole("button", { name: "Confirm missed appointment" }),
    ).not.toBeDisabled();
    expect(state.request).not.toHaveBeenCalled();
  });
  it("does not offer a missed action before the server's check time", () => {
    state.row = { ...snapshot(), checkAttendance: false };
    render(<BookingAttendance bookingId={id} onUpdated={vi.fn()} />);
    expect(
      screen.queryByRole("option", { name: "Check attendance and mark missed" }),
    ).toBeNull();
  });
  it("retains only an opaque marker after an uncertain response and never automatically retries", async () => {
    state.request.mockRejectedValue(Error("Network interrupted"));
    render(<BookingAttendance bookingId={id} onUpdated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Factual note (optional)"), {
      target: { value: "Private factual test note" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save attendance update" }));
    await screen.findByText(/earlier update has not been verified/);
    expect(sessionStorage.getItem(`aat-attendance:${actor}:${id}`)).toBe(operation);
    expect(JSON.stringify(sessionStorage)).not.toContain("Private factual test note");
    expect(state.paths.some((p) => p.endsWith(`receiptId=${operation}`))).toBe(true);
    expect(state.request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Save attendance update" })).toBeDisabled();
  });
  it("recognises a saved operation after reload using the scoped receipt", async () => {
    sessionStorage.setItem(`aat-attendance:${actor}:${id}`, operation);
    state.row = { ...snapshot(), receipt: event(), current: event(), events: [event()] };
    render(<BookingAttendance bookingId={id} onUpdated={vi.fn()} />);
    expect(screen.getByText(/saved update has been found/)).toBeTruthy();
    expect(state.request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continue with saved update" }));
    await waitFor(() =>
      expect(sessionStorage.getItem(`aat-attendance:${actor}:${id}`)).toBeNull(),
    );
  });
  it("does not accept a mismatched mutation receipt as success", async () => {
    state.request.mockResolvedValue({
      data: {
        event: { ...event(), id: "d0000000-0000-4000-8000-000000000001" },
        performedByUserId: actor,
        attendance: snapshot(),
      },
    });
    render(<BookingAttendance bookingId={id} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Save attendance update" }));
    await screen.findByText(/could not be verified/);
    expect(screen.queryByText("Attendance update saved.")).toBeNull();
    expect(sessionStorage.getItem(`aat-attendance:${actor}:${id}`)).toBe(operation);
  });
  it("masks stale data after a read failure", () => {
    state.error = "Access changed";
    render(<BookingAttendance bookingId={id} onUpdated={vi.fn()} />);
    expect(screen.queryByLabelText("Update")).toBeNull();
    expect(state.request).not.toHaveBeenCalled();
  });
  it("has no staff mutation controls in a customer session", () => {
    state.role = "CUSTOMER";
    render(<BookingAttendance bookingId={id} onUpdated={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("shows factual, dated history without calling a write endpoint", () => {
    render(<BookingAttendanceHistory events={[event()]} />);
    expect(screen.getByText("Arrival recorded")).toBeTruthy();
    expect(screen.getByText("Arrival recorded by the workshop")).toBeTruthy();
    expect(state.request).not.toHaveBeenCalled();
  });
});
