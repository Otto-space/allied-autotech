import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import {
  renderRouter,
  screen,
  fireEvent,
  waitFor,
  testRouter,
} from "expo-router/testing-library";
import { ApiContext } from "../../src/api/client/context";
import { createApiClient } from "../../src/api/client";
import { makeQueryClient } from "../../src/api/queries";
import { SessionProvider } from "../../src/auth/session";
import Explore from "../../app/(tabs)/explore";
import Detail from "../../app/services/[serviceId]";
import Selected from "../../app/services/[serviceId]/selected";
import {
  apiResponse,
  serviceFixture,
  serviceId,
  otherServiceId,
} from "../fixtures/services";

async function mount(fetcher: typeof fetch, initialUrl = "/explore") {
  const client = makeQueryClient();
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>
        <ApiContext.Provider
          value={createApiClient("http://127.0.0.1:4000/api/v1", fetcher)}
        >
          <SessionProvider>{children}</SessionProvider>
        </ApiContext.Provider>
      </QueryClientProvider>
    );
  }
  const view = await renderRouter(
    {
      _layout: () => <Stack screenOptions={{ headerShown: false, animation: "none" }} />,
      "(tabs)/explore": Explore,
      "services/[serviceId]/index": Detail,
      "services/[serviceId]/selected": Selected,
    },
    { initialUrl, wrapper: Wrapper },
  );
  return { ...view, client };
}

describe("Service list/detail/selection navigation (isolated API responses)", () => {
  test("selects the actual API service, retains its ID, and back navigation preserves the choice", async () => {
    const fetcher = jest.fn(async (url: string) =>
      apiResponse(
        url.endsWith("/public/services") ? { items: [serviceFixture] } : serviceFixture,
      ),
    );
    const result = await mount(fetcher as typeof fetch);
    await fireEvent.press(
      await screen.findByRole("button", { name: `View ${serviceFixture.name}` }),
    );
    expect(await screen.findByText(serviceFixture.description)).toBeTruthy();
    expect(result.getPathname()).toBe(`/services/${serviceId}`);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Select this service" }),
    );
    expect(await screen.findByText(`You selected ${serviceFixture.name}.`)).toBeTruthy();
    expect(result.getPathname()).toBe(`/services/${serviceId}/selected`);
    expect(
      screen.getByText(/No appointment has been requested or confirmed/),
    ).toBeTruthy();
    await testRouter.back(`/services/${serviceId}`);
    expect(
      await screen.findByRole("button", { name: "Select this service" }),
    ).toBeTruthy();
    for (const [url, options] of fetcher.mock.calls as unknown as [
      string,
      RequestInit,
    ][]) {
      expect(url).toMatch(/\/public\/services(?:\/[^/?]+)?$/);
      expect(options.method).toBe("GET");
      expect(options.credentials).toBe("omit");
    }
    await result.unmount();
    result.client.clear();
  });

  test("detail failure retries the same service and handles quote-required/missing descriptions", async () => {
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        apiResponse({
          ...serviceFixture,
          pricingType: "QUOTE_REQUIRED",
          priceKobo: null,
          description: null,
          shortDescription: null,
          durationMinutes: null,
        }),
      );
    const result = await mount(fetcher, `/services/${serviceId}`);
    await fireEvent.press(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Quote required")).toBeTruthy();
    expect(
      screen.getByText("No description is available for this service."),
    ).toBeTruthy();
    expect(screen.getByText("Duration will be confirmed by the workshop.")).toBeTruthy();
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual(
      Array(2).fill(`http://127.0.0.1:4000/api/v1/public/services/${serviceId}`),
    );
    await result.unmount();
    result.client.clear();
  });

  test("detail loading exposes an accessible pending state", async () => {
    const fetcher = jest.fn(
      (_url, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          options.signal?.addEventListener(
            "abort",
            () => reject(new Error("cancelled")),
            { once: true },
          );
        }),
    );
    const result = await mount(fetcher as typeof fetch, `/services/${serviceId}`);
    expect(
      screen.getByRole("progressbar", { name: "Loading service details" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Select this service" })).toBeNull();
    await result.unmount();
    await result.client.cancelQueries();
    result.client.clear();
  });

  test("handoff retry retains the service identity and its back action restores the detail", async () => {
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(apiResponse(serviceFixture));
    const result = await mount(fetcher, `/services/${serviceId}/selected`);
    await fireEvent.press(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText(`You selected ${serviceFixture.name}.`)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Back to service details" }),
    );
    expect(
      await screen.findByRole("button", { name: "Select this service" }),
    ).toBeTruthy();
    expect(result.getPathname()).toBe(`/services/${serviceId}`);
    await result.unmount();
    result.client.clear();
  });

  test("selection direct link reloads from the API instead of trusting route names or prices", async () => {
    const fetcher = jest.fn().mockResolvedValue(apiResponse(serviceFixture));
    const result = await mount(
      fetcher,
      `/services/${serviceId}/selected?name=Untrusted&priceKobo=1`,
    );
    expect(await screen.findByText(`You selected ${serviceFixture.name}.`)).toBeTruthy();
    expect(screen.queryByText("Untrusted")).toBeNull();
    expect(fetcher).toHaveBeenCalledWith(
      `http://127.0.0.1:4000/api/v1/public/services/${serviceId}`,
      expect.anything(),
    );
    await result.unmount();
    result.client.clear();
  });

  test("invalid service IDs cannot initiate a request", async () => {
    const fetcher = jest.fn();
    const result = await mount(fetcher, "/services/not-a-service");
    expect(await screen.findByText("Service unavailable")).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
    await result.unmount();
    result.client.clear();
  });

  test("withdrawn service cannot be selected or presented as an existing booking", async () => {
    const fetcher = jest.fn().mockResolvedValue(apiResponse(null, 404));
    const result = await mount(fetcher, `/services/${serviceId}/selected`);
    expect(await screen.findByText("Service unavailable")).toBeTruthy();
    expect(screen.queryByText(/^You selected/)).toBeNull();
    await result.unmount();
    result.client.clear();
  });

  test("mismatched detail identity fails validation", async () => {
    const result = await mount(
      jest.fn().mockResolvedValue(apiResponse({ ...serviceFixture, id: otherServiceId })),
      `/services/${serviceId}`,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy(),
    );
    expect(screen.queryByRole("button", { name: "Select this service" })).toBeNull();
    await result.unmount();
    result.client.clear();
  });
});
