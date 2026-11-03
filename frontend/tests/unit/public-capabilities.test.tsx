// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
import { capabilityView, parsePublicCapabilities } from "@/lib/public-capabilities";
import {
  PublicCapabilitiesProvider,
  usePublicCapabilities,
} from "@/app/components/public-capabilities";
const mocks = vi.hoisted(() => ({ request: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ apiRequest: mocks.request }));
const router = { refresh: mocks.refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
function Probe() {
  const capabilities = usePublicCapabilities();
  const [draft, setDraft] = useState("");
  return (
    <>
      <input
        aria-label="Draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button disabled={!capabilities.checkoutEnabled}>Checkout</button>
      <button disabled={!capabilities.bookingRequestsEnabled}>Book</button>
      <span>{capabilities.mode ?? "unknown"}</span>
    </>
  );
}
const reply = (mode: "full" | "browse_enquiries") => ({
  data: publicCapabilitiesFixture(mode),
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
describe("authoritative availability", () => {
  it("restarts an unfinished availability check after server props refresh, preserving drafts", async () => {
    const pending: Array<(value: unknown) => void> = [];
    mocks.request.mockImplementation(() => new Promise((done) => pending.push(done)));
    const view = render(
      <PublicCapabilitiesProvider initial={publicCapabilitiesFixture("full")}>
        <Probe />
      </PublicCapabilitiesProvider>,
    );
    fireEvent.change(screen.getByLabelText("Draft"), {
      target: { value: "Keep my details" },
    });
    fireEvent(window, new Event("focus"));
    expect((screen.getByText("Checkout") as HTMLButtonElement).disabled).toBe(true);
    view.rerender(
      <PublicCapabilitiesProvider initial={publicCapabilitiesFixture("full")}>
        <Probe />
      </PublicCapabilitiesProvider>,
    );
    expect(pending).toHaveLength(2);
    await act(async () => pending[1](reply("full")));
    await act(async () => pending[0](reply("browse_enquiries")));
    expect((screen.getByText("Checkout") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText("Draft") as HTMLInputElement).value).toBe(
      "Keep my details",
    );
  });
  it.each([
    [true, false],
    [false, true],
    [false, false],
    [true, true],
  ])("accepts independent full-mode booking=%s purchasing=%s", (bookings, purchases) => {
    const snapshot = publicCapabilitiesFixture("full", purchases);
    snapshot.release.bookingRequestsEnabled = bookings;
    snapshot.release.inspectionRequestsEnabled = bookings;
    const view = capabilityView(parsePublicCapabilities(snapshot));
    expect(view.bookingRequestsEnabled).toBe(bookings);
    expect(view.checkoutEnabled).toBe(purchases);
    expect(view.restrictedLaunchPage("/checkout")).toBe(!purchases);
  });
  it("updates independent switches in the same mode without losing a draft", async () => {
    const next = publicCapabilitiesFixture("full", false);
    next.release.bookingRequestsEnabled = false;
    next.release.inspectionRequestsEnabled = false;
    mocks.request.mockResolvedValueOnce({ data: next });
    render(
      <PublicCapabilitiesProvider initial={publicCapabilitiesFixture("full")}>
        <Probe />
      </PublicCapabilitiesProvider>,
    );
    fireEvent.change(screen.getByLabelText("Draft"), {
      target: { value: "Keep the pending request" },
    });
    await act(async () => fireEvent(window, new Event("focus")));
    expect((screen.getByText("Checkout") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Book") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Draft") as HTMLInputElement).value).toBe(
      "Keep the pending request",
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
  it("separates financial approval from full-mode appointment requests and rejects contradictory summaries", () => {
    const current = capabilityView(
      parsePublicCapabilities(publicCapabilitiesFixture("full", false)),
    );
    expect(current.checkoutEnabled).toBe(false);
    expect(current.bookingRequestsEnabled).toBe(true);
    expect(current.restrictedLaunchPage("/checkout")).toBe(true);
    expect(current.restrictedLaunchPage("/dashboard/bookings/owned")).toBe(false);
    expect(() =>
      parsePublicCapabilities(publicCapabilitiesFixture("browse_enquiries", true)),
    ).toThrow();
    expect(() => parsePublicCapabilities({ checkoutEnabled: true })).toThrow();
    const missing = capabilityView(null);
    expect(missing.checkoutEnabled).toBe(false);
    expect(missing.enquiriesEnabled).toBe(false);
    expect(missing.restrictedLaunchPage("/register")).toBe(true);
    expect(missing.restrictedLaunchPage("/dashboard/orders/owned")).toBe(false);
  });
  it("closes stale actions on focus, preserves the draft and applies a changed release", async () => {
    let resolve!: (value: unknown) => void;
    mocks.request.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(
      <PublicCapabilitiesProvider initial={publicCapabilitiesFixture("full")}>
        <Probe />
      </PublicCapabilitiesProvider>,
    );
    fireEvent.change(screen.getByLabelText("Draft"), {
      target: { value: "Keep these details" },
    });
    expect((screen.getByText("Checkout") as HTMLButtonElement).disabled).toBe(false);
    fireEvent(window, new Event("focus"));
    expect((screen.getByText("Checkout") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => resolve(reply("browse_enquiries")));
    expect((screen.getByText("Book") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Draft") as HTMLInputElement).value).toBe(
      "Keep these details",
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.request.mock.calls[0][0]).toBe("/public/capabilities");
    expect(mocks.request.mock.calls[0][1]).not.toHaveProperty("method");
  });
  it("shows unavailable feedback and retries without turning missing data into permission", async () => {
    mocks.request
      .mockRejectedValueOnce(Error("Network unavailable"))
      .mockResolvedValueOnce(reply("full"));
    render(
      <PublicCapabilitiesProvider initial={publicCapabilitiesFixture("full")}>
        <Probe />
      </PublicCapabilitiesProvider>,
    );
    await act(async () => fireEvent(window, new Event("focus")));
    expect(screen.getByText(/Online actions are temporarily unavailable/)).toBeTruthy();
    expect((screen.getByText("Checkout") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => fireEvent.click(screen.getByText("Check availability again")));
    expect((screen.getByText("Checkout") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/Online actions are temporarily unavailable/)).toBeNull();
  });
  it("ignores an older response after a second check and closes immediately offline", async () => {
    const pending: Array<(value: unknown) => void> = [];
    mocks.request.mockImplementation(() => new Promise((done) => pending.push(done)));
    render(
      <PublicCapabilitiesProvider initial={publicCapabilitiesFixture("full")}>
        <Probe />
      </PublicCapabilitiesProvider>,
    );
    fireEvent(window, new Event("focus"));
    fireEvent(window, new Event("focus"));
    await act(async () => pending[1](reply("full")));
    await act(async () => pending[0](reply("browse_enquiries")));
    expect((screen.getByText("Checkout") as HTMLButtonElement).disabled).toBe(false);
    fireEvent(window, new Event("offline"));
    expect((screen.getByText("Checkout") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Book") as HTMLButtonElement).disabled).toBe(true);
  });
});
