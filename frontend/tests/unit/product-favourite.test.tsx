// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import { ProductActions } from "@/app/components/product-actions";
import { readProductFavourite } from "@/lib/api/product-favourite";
import { product, id } from "../fixtures/public-account-actions";

vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: vi.fn(),
}));
const request = vi.mocked(apiRequest);
const result = (data: unknown) => ({ data }) as Awaited<ReturnType<typeof apiRequest>>;
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  request.mockReset();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("loads a saved product from a later page without writing or trusting the first page", async () => {
  request.mockImplementation(async (path) =>
    path === "/auth/session"
      ? result({ user: { role: "CUSTOMER" } })
      : result(
          path.includes("cursor=")
            ? { items: [{ id: id(201), product }] }
            : { items: [], nextCursor: id(200) },
        ),
  );
  render(<ProductActions productId={product.id} available />);
  expect(
    screen.queryByRole("button", { name: "Save to favourites", exact: true }),
  ).toBeNull();
  expect(
    (
      await screen.findByRole("button", { name: "Saved to favourites", exact: true })
    ).hasAttribute("disabled"),
  ).toBe(true);
  expect(screen.getByRole("link", { name: "View favourites" }).getAttribute("href")).toBe(
    "/dashboard/saved",
  );
  expect(
    request.mock.calls.filter(([path]) => path.includes("favourites?")),
  ).toHaveLength(2);
  expect(request.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
});

it("reads the server again after remount and after an external removal", async () => {
  let saved = false;
  request.mockImplementation(async (path, options) => {
    if (path === "/auth/session") return result({ user: { role: "CUSTOMER" } });
    if (options?.method === "PUT") {
      saved = true;
      return result({ product });
    }
    return result({ items: saved ? [{ id: id(201), product }] : [] });
  });
  const first = render(<ProductActions productId={product.id} available />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Save to favourites", exact: true }),
  );
  await screen.findByRole("button", { name: "Saved to favourites", exact: true });
  first.unmount();
  const second = render(<ProductActions productId={product.id} available />);
  await screen.findByRole("button", { name: "Saved to favourites", exact: true });
  second.unmount();
  saved = false;
  render(<ProductActions productId={product.id} available />);
  await screen.findByRole("button", { name: "Save to favourites", exact: true });
  expect(
    request.mock.calls.filter(([, options]) => options?.method === "PUT"),
  ).toHaveLength(1);
});

it("does not turn a failed read into an unsaved state and retries without writing", async () => {
  let failed = true;
  request.mockImplementation(async (path) => {
    if (path === "/auth/session") return result({ user: { role: "CUSTOMER" } });
    if (failed) throw Error("offline");
    return result({ items: [{ id: id(201), product }] });
  });
  render(<ProductActions productId={product.id} available />);
  await screen.findByText("We could not check whether this product is saved.");
  expect(
    screen.queryByRole("button", { name: "Save to favourites", exact: true }),
  ).toBeNull();
  failed = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry favourites check" }));
  await screen.findByRole("button", { name: "Saved to favourites", exact: true });
  expect(request.mock.calls.some(([, options]) => options?.method === "PUT")).toBe(false);
});

it("discards a late favourites read when the session becomes staff", async () => {
  let role = "CUSTOMER";
  let resolve!: (data: Awaited<ReturnType<typeof apiRequest>>) => void;
  request.mockImplementation(async (path) =>
    path === "/auth/session"
      ? result({ user: { role } })
      : new Promise((r) => {
          resolve = r;
        }),
  );
  render(<ProductActions productId={product.id} available />);
  await screen.findByRole("button", { name: "Checking favourites…", exact: true });
  await waitFor(() => expect(resolve).toBeDefined());
  await act(async () => {
    role = "STAFF";
    window.dispatchEvent(new Event(SESSION_CHANGED));
    resolve(result({ items: [{ id: id(201), product }] }));
  });
  await screen.findByText(/Saving favourites is available to customer accounts/);
  expect(screen.queryByRole("button", { name: /favourites/ })).toBeNull();
});

it("does not carry a saved badge across product navigation", async () => {
  request.mockImplementation(async (path) =>
    path === "/auth/session"
      ? result({ user: { role: "CUSTOMER" } })
      : result({ items: [{ id: id(201), product }] }),
  );
  const view = render(<ProductActions productId={product.id} available />);
  await screen.findByRole("button", { name: "Saved to favourites", exact: true });
  view.rerender(<ProductActions productId={id(4)} available />);
  expect(
    screen.queryByRole("button", { name: "Saved to favourites", exact: true }),
  ).toBeNull();
  await screen.findByRole("button", { name: "Save to favourites", exact: true });
});

it("fails closed on repeated cursors and malformed saved identities", async () => {
  request.mockResolvedValue(result({ items: [], nextCursor: id(200) }));
  await expect(
    readProductFavourite(product.id, new AbortController().signal),
  ).rejects.toThrow("Repeated favourites cursor");
  request.mockResolvedValue(
    result({ items: [{ id: id(201), product: { id: "invalid" } }] }),
  );
  await expect(
    readProductFavourite(product.id, new AbortController().signal),
  ).rejects.toThrow();
});
