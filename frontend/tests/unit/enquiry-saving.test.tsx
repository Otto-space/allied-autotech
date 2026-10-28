// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProductActions } from "@/app/components/product-actions";
import { VehicleActions } from "@/app/components/vehicle-actions";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { product, listing, id } from "../fixtures/public-account-actions";

vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: vi.fn(),
}));
const request = vi.mocked(apiRequest);
const session = { data: { user: { id: id(90), role: "CUSTOMER" } } };
const result = (data: unknown) => ({ data }) as Awaited<ReturnType<typeof apiRequest>>;
function vehicle() {
  return (
    <VehicleActions
      listingId={listing.id}
      listingTitle={listing.title}
      branchName="Test branch"
      gallery={<p>Gallery</p>}
      summary={<p>Price</p>}
    >
      <p>Features</p>
    </VehicleActions>
  );
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "browse_enquiries");
  request.mockReset();
  request.mockImplementation(async (path) => {
    if (path === "/auth/session") return result(session.data);
    if (path === `/customers/favourites/${product.id}`) return result({ product });
    if (path === `/customers/saved-vehicles/${listing.id}`)
      return result({ vehicleListingId: listing.id });
    throw new Error(`Unexpected request ${path}`);
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each(["product", "vehicle"])(
  "saves a %s with CSRF while transaction controls stay unavailable",
  async (kind) => {
    render(
      kind === "product" ? (
        <ProductActions productId={product.id} available />
      ) : (
        vehicle()
      ),
    );
    const button = await screen.findByRole("button", {
      name: kind === "product" ? "Save to favourites" : "Save vehicle",
      exact: true,
    });
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: /cart|inspect|reserve|Enquire about this vehicle/i,
      }),
    ).toBeNull();
    fireEvent.click(button);
    await screen.findByText(
      kind === "product"
        ? "Product saved to your favourites."
        : "This vehicle is saved to your account.",
    );
    const writes = request.mock.calls.filter(([, opts]) => opts?.method === "PUT");
    expect(writes).toHaveLength(1);
    expect(writes[0][0]).toBe(
      `/customers/${kind === "product" ? "favourites" : "saved-vehicles"}/${kind === "product" ? product.id : listing.id}`,
    );
    expect(writes[0][1]).toMatchObject({ csrf: true, body: {} });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(
      screen
        .getByRole("link", {
          name: kind === "product" ? /View favourites/ : /View saved vehicles/,
        })
        .getAttribute("href"),
    ).toBe("/dashboard/saved");
  },
);
it.each(["product", "vehicle"])("keeps catalogue-only %s saving closed", (kind) => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "catalogue");
  render(
    kind === "product" ? <ProductActions productId={product.id} available /> : vehicle(),
  );
  expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
  expect(request).not.toHaveBeenCalled();
});
it.each(["product", "vehicle"])(
  "requires customer login before saving a %s",
  async (kind) => {
    request.mockRejectedValue(new ApiError(401, { error: { code: "UNAUTHORIZED" } }));
    render(
      kind === "product" ? (
        <ProductActions productId={product.id} available />
      ) : (
        vehicle()
      ),
    );
    const login = await screen.findByRole("link", {
      name: kind === "product" ? /Sign in to save this product/ : /Sign in to continue/,
    });
    if (kind === "product") {
      expect(login.getAttribute("href")).toBe(
        `/login?next=${encodeURIComponent(`/parts/${product.id}`)}`,
      );
      expect(login.classList.contains("button")).toBe(false);
      expect(
        screen.queryByRole("link", { name: "Ask our team", exact: true }),
      ).toBeNull();
    }
    expect(
      screen.queryByRole("button", { name: /Save to favourites|Save vehicle/ }),
    ).toBeNull();
  },
);
it.each(["product", "vehicle"])(
  "does not save a %s after the account becomes staff",
  async (kind) => {
    render(
      kind === "product" ? (
        <ProductActions productId={product.id} available />
      ) : (
        vehicle()
      ),
    );
    const button = await screen.findByRole("button", {
      name: kind === "product" ? "Save to favourites" : "Save vehicle",
      exact: true,
    });
    request.mockResolvedValue(result({ user: { id: id(91), role: "SUPER_ADMIN" } }));
    fireEvent.click(button);
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Save to favourites|Save vehicle/ }),
      ).toBeNull(),
    );
    expect(request.mock.calls.some(([, opts]) => opts?.method === "PUT")).toBe(false);
  },
);
it("discards a pending save on a session change", async () => {
  render(vehicle());
  const button = await screen.findByRole("button", { name: "Save vehicle", exact: true });
  let resolve: (value: Awaited<ReturnType<typeof apiRequest>>) => void = () => {};
  request.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  fireEvent.click(button);
  await act(async () => {
    window.dispatchEvent(new Event(SESSION_CHANGED));
    resolve(result(session.data));
  });
  expect(request.mock.calls.some(([, opts]) => opts?.method === "PUT")).toBe(false);
});
it("keeps the full-mode product cart available", async () => {
  vi.stubEnv("NEXT_PUBLIC_PUBLIC_LAUNCH_MODE", "full");
  render(<ProductActions productId={product.id} available />);
  await screen.findByRole("button", { name: "Save quantity to cart" });
  expect(screen.getByRole("spinbutton")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save to favourites" })).toBeTruthy();
});
