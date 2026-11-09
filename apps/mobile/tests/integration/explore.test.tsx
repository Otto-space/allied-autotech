import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiContext } from "../../src/api/client/context";
import { createApiClient } from "../../src/api/client";
import { makeQueryClient } from "../../src/api/queries";
import { SessionProvider } from "../../src/auth/session";
import ExploreProof from "../../src/features/services/ExploreProof";

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
const ok = (items: unknown[]) =>
  ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => ({
      success: true,
      message: "Synthetic test response",
      data: { items },
      meta: { requestId: "fixture-request" },
    }),
  }) as unknown as Response;
describe("MOB-008 Explore read-only proof (mocked API)", () => {
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
    const result = await mount(
      jest.fn().mockResolvedValue(
        ok([
          {
            id: "00000000-0000-4000-8000-000000000001",
            name: "Synthetic contract fixture",
          },
        ]),
      ),
    );
    expect(await screen.findByText("Synthetic contract fixture")).toBeTruthy();
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
});
