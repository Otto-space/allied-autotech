import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { useMutation } from "@tanstack/react-query";
import { AppProviders } from "../../src/api/queries/provider";
import { useCapabilities } from "../../src/capabilities";
import {
  canSendEnquiry,
  canCreateAccount,
  canCheckout,
  canRequestBooking,
  canRequestInspection,
  canUseAllie,
} from "../../src/capabilities/model";
import { ApiError } from "../../src/api/errors";
import { Text, Button } from "../../src/components/ui";

const fixture = {
  scope: "POLICY_SUMMARY",
  serverTime: "2026-11-09T00:00:00.000Z",
  release: {
    mode: "browse_enquiries",
    customerAccountsEnabled: true,
    enquiriesEnabled: true,
    bookingRequestsEnabled: false,
    inspectionRequestsEnabled: false,
  },
  checkoutEnabled: false,
  collection: { enabled: true, address: "Synthetic address" },
  delivery: { enabled: false },
  vehicleDeposits: { enabled: false },
  finance: { approvalStatus: null, draftVatBasisPoints: 750, pricesIncludeVat: false },
  booking: {
    confirmation: "STAFF_REVIEW",
    cancellationFeeKobo: "0",
    reminderMinutes: 60,
  },
  marketing: { enabled: false },
  destructiveRetention: { enabled: false },
};
const response = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      success: true,
      message: "Fixture",
      data,
      meta: { requestId: "fixture" },
    }),
  }) as unknown as Response;
function Probe({ rejectWrite }: { rejectWrite?: () => Promise<never> }) {
  const { snapshot } = useCapabilities();
  const mutation = useMutation({ mutationFn: rejectWrite });
  const actions = [
    canCreateAccount,
    canSendEnquiry,
    canRequestBooking,
    canRequestInspection,
    canCheckout,
    canUseAllie,
  ].map((helper) => helper(snapshot));
  return (
    <>
      <Text>{snapshot ? "known" : "unknown"}</Text>
      <Text>{JSON.stringify(actions)}</Text>
      {rejectWrite ? (
        <Button label="Simulate rejected operation" onPress={() => mutation.mutate()} />
      ) : null}
    </>
  );
}
test.each(["failed", "malformed", "inconsistent"])(
  "MOB-022 provider fails closed for %s capabilities",
  async (state) => {
    global.fetch =
      state === "failed"
        ? jest.fn().mockRejectedValue(new Error("offline"))
        : jest
            .fn()
            .mockResolvedValue(
              response(
                state === "malformed" ? {} : { ...fixture, checkoutEnabled: true },
              ),
            );
    const view = await render(
      <AppProviders baseUrl="http://127.0.0.1:4000/api/v1">
        <Probe />
      </AppProviders>,
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(screen.getByText("unknown")).toBeTruthy();
    expect(screen.getByText("[false,false,false,false,false,false]")).toBeTruthy();
    await view.unmount();
  },
);
test("MOB-022 403 displays the server message, refreshes capabilities and never retries the operation", async () => {
  global.fetch = jest.fn().mockResolvedValue(response(fixture));
  const rejectWrite = jest
    .fn()
    .mockRejectedValue(
      new ApiError("Online transactions are not available yet.", 403, "FORBIDDEN"),
    );
  const view = await render(
    <AppProviders baseUrl="http://127.0.0.1:4000/api/v1">
      <Probe rejectWrite={rejectWrite} />
    </AppProviders>,
  );
  await screen.findByText("known");
  await fireEvent.press(
    screen.getByRole("button", { name: "Simulate rejected operation" }),
  );
  expect(
    await screen.findByText("Online transactions are not available yet."),
  ).toBeTruthy();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(rejectWrite).toHaveBeenCalledTimes(1);
  await view.unmount();
});
test("MOB-022 capabilities become unknown once freshness expires while refresh is pending", async () => {
  jest.useFakeTimers();
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(response(fixture))
    .mockImplementation(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => reject(new Error("cancelled")));
        }),
    );
  const view = await render(
    <AppProviders baseUrl="http://127.0.0.1:4000/api/v1">
      <Probe />
    </AppProviders>,
  );
  await screen.findByText("known");
  await act(async () => {
    await jest.advanceTimersByTimeAsync(60001);
  });
  expect(screen.getByText("unknown")).toBeTruthy();
  await view.unmount();
  jest.useRealTimers();
});
