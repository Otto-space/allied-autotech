import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiContext } from "../../src/api/client/context";
import { createApiClient } from "../../src/api/client";
import { makeQueryClient } from "../../src/api/queries";
import { SessionProvider } from "../../src/auth/session";
import ExploreProof from "../../src/features/services/ExploreProof";
import {
  apiResponse,
  serviceFixture,
  serviceId,
  otherServiceId,
} from "../fixtures/services";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

async function mount(fetcher: typeof fetch) {
  const client = makeQueryClient();
  const view = await render(
    <QueryClientProvider client={client}>
      <ApiContext.Provider
        value={createApiClient("http://127.0.0.1:4000/api/v1", fetcher)}
      >
        <SessionProvider>
          <ExploreProof />
        </SessionProvider>
      </ApiContext.Provider>
    </QueryClientProvider>,
  );
  return { ...view, client };
}
const ok = (items: unknown[]) => apiResponse({ items });
describe("Service catalogue (mocked API; not real-backend acceptance)", () => {
  test("loading state is accessible", async () => {
    const result = await mount(
      jest.fn(
        (_url, options: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            options.signal?.addEventListener(
              "abort",
              () => reject(new Error("cancelled")),
              { once: true },
            );
          }),
      ) as typeof fetch,
    );
    expect(screen.getByRole("progressbar", { name: "Loading services" })).toBeTruthy();
    await result.unmount();
    await result.client.cancelQueries();
    result.client.clear();
  });
  test("success displays only names returned by the server", async () => {
    const result = await mount(jest.fn().mockResolvedValue(ok([serviceFixture])));
    expect(await screen.findByText("Synthetic contract fixture")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "View Synthetic contract fixture" }),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/services/[serviceId]",
      params: { serviceId },
    });
    await result.unmount();
    result.client.clear();
  });
  test("empty is distinct from error", async () => {
    const result = await mount(jest.fn().mockResolvedValue(ok([])));
    expect(await screen.findByText("No services listed")).toBeTruthy();
    await result.unmount();
    result.client.clear();
  });
  test("error-with-retry recovers without fake empty data", async () => {
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(ok([]));
    const result = await mount(fetcher);
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.queryByText("No services listed")).toBeNull();
    await fireEvent.press(retry);
    await waitFor(() => expect(screen.getByText("No services listed")).toBeTruthy());
    expect(fetcher).toHaveBeenCalledTimes(2);
    await result.unmount();
    result.client.clear();
  });
  test("pagination failure preserves earlier services and retries the same cursor", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        apiResponse({ items: [serviceFixture], nextCursor: serviceId }),
      )
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        apiResponse({
          items: [
            { ...serviceFixture, id: otherServiceId, name: "Synthetic second service" },
          ],
        }),
      );
    const result = await mount(fetcher);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Load more services" }),
    );
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.getByText(serviceFixture.name)).toBeTruthy();
    await fireEvent.press(retry);
    expect(await screen.findByText("Synthetic second service")).toBeTruthy();
    expect(fetcher.mock.calls.slice(1).map((call) => call[0])).toEqual([
      `http://127.0.0.1:4000/api/v1/public/services?cursor=${serviceId}`,
      `http://127.0.0.1:4000/api/v1/public/services?cursor=${serviceId}`,
    ]);
    expect(screen.queryByRole("button", { name: "Load more services" })).toBeNull();
    await result.unmount();
    result.client.clear();
  });
  test("malformed catalogue is an error, never an invented or empty service list", async () => {
    const result = await mount(
      jest.fn().mockResolvedValue(ok([{ id: serviceId, name: "Incomplete fixture" }])),
    );
    expect(await screen.findByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("No services listed")).toBeNull();
    expect(screen.queryByText("Incomplete fixture")).toBeNull();
    await result.unmount();
    result.client.clear();
  });
});
