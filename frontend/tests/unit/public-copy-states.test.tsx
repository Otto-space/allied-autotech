// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  HomePartsPreview,
  HomeVehiclesPreview,
} from "@/app/components/home-catalogue-preview";
import { HomeReviewsPreview } from "@/app/components/home-reviews-preview";
import { ServiceList } from "@/app/components/service-list";
import {
  id,
  product,
  listing,
  service,
  quoteService,
} from "../fixtures/public-account-actions";

const state = vi.hoisted(() => ({
  data: undefined as unknown,
  loading: false,
  refreshing: false,
  error: undefined as string | undefined,
  refreshError: undefined as string | undefined,
  refresh: vi.fn(),
}));
vi.mock("@/lib/api/use-resource", () => ({ useResource: () => state }));
beforeEach(() => {
  state.data = { items: [] };
  state.loading = false;
  state.error = undefined;
  state.refreshError = undefined;
  state.refresh.mockClear();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const photographed = {
  ...product,
  images: [
    {
      id: id(70),
      url: `/api/v1/public/catalog/products/images/${id(70)}`,
      altText: "Actual fixture product",
      isPrimary: true,
    },
  ],
};

it("excludes known missing or invalid product media without claiming an empty catalogue", () => {
  state.data = {
    items: [
      product,
      { ...product, id: id(72), images: [{ url: "http://untrusted.invalid/image.jpg" }] },
    ],
  };
  const view = render(<HomePartsPreview />);
  expect(view.container.querySelectorAll(".home-product-card")).toHaveLength(0);
  expect(screen.queryByText(/No products are published/)).toBeNull();
  expect(screen.getByText(/Find published products/)).toBeTruthy();
});

it("retains authoritative unknown and out-of-stock states on eligible real-media products", () => {
  state.data = {
    items: [
      { ...photographed, availability: [] },
      {
        ...photographed,
        id: id(73),
        name: "Second product",
        availability: [{ ...product.availability[0], inStock: false }],
      },
    ],
  };
  const view = render(<HomePartsPreview />);
  expect(view.container.querySelectorAll(".home-product-card")).toHaveLength(2);
  expect(screen.getByText("Availability not listed")).toBeTruthy();
  expect(screen.getByText("Unavailable at listed branches")).toBeTruthy();
  const image = screen.getAllByRole("img")[0];
  expect(screen.queryByText("Image unavailable")).toBeNull();
  fireEvent.error(image);
  expect(screen.getByText("Image unavailable")).toBeTruthy();
});

it("distinguishes a successful empty product catalogue from a failed or pending read", () => {
  const view = render(<HomePartsPreview />);
  expect(screen.getByText(/No products are published/)).toBeTruthy();
  state.data = undefined;
  state.error = "Products temporarily unavailable";
  view.rerender(<HomePartsPreview />);
  expect(screen.queryByText(/No products are published/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry products" }));
  expect(state.refresh).toHaveBeenCalledOnce();
  state.error = undefined;
  state.loading = true;
  view.rerender(<HomePartsPreview />);
  expect(screen.getByRole("status").textContent).toContain("Loading products");
  expect(view.container.querySelectorAll(".home-preview-loading")).toHaveLength(4);
});

it("changes the vehicle enquiry panel only on verified successful empty data", () => {
  const view = render(<HomeVehiclesPreview />);
  expect(screen.getByRole("heading", { name: "Looking for a vehicle?" })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Discuss a vehicle" }).getAttribute("href"),
  ).toBe("/contact?vehicle=1#enquiry");
  state.refreshError = "Vehicle refresh temporarily unavailable";
  view.rerender(<HomeVehiclesPreview />);
  expect(screen.queryByText(/no published listings yet/)).toBeNull();
  state.refreshError = undefined;
  state.error = "Vehicles temporarily unavailable";
  view.rerender(<HomeVehiclesPreview />);
  expect(screen.queryByText(/no published listings yet/)).toBeNull();
  expect(screen.getByRole("button", { name: "Retry vehicles" })).toBeTruthy();
  state.error = undefined;
  state.data = { items: [listing, { ...listing, id: id(75), title: "Second vehicle" }] };
  view.rerender(<HomeVehiclesPreview />);
  expect(
    screen.getByRole("heading", { name: "Explore our vehicle listings" }),
  ).toBeTruthy();
  expect(view.container.querySelectorAll(".home-vehicle-card")).toHaveLength(2);
});

for (const count of [0, 1, 3])
  it(`handles ${count} published services without competing source copy`, () => {
    state.data = {
      items: Array.from({ length: count }, (_, n) => ({
        ...quoteService,
        id: id(80 + n),
        name: `Service ${n}`,
        description: service.description,
      })),
    };
    const view = render(<ServiceList preview />);
    expect(view.container.querySelectorAll(".service-discovery__item")).toHaveLength(
      count,
    );
    expect(screen.queryAllByText("Quotation required")).toHaveLength(count);
    expect(screen.queryAllByText(service.description)).toHaveLength(count);
  });

it("does not render an empty review stage while retaining a real published review", () => {
  const view = render(<HomeReviewsPreview initial={{ data: { items: [] } }} />);
  expect(view.container.innerHTML).toBe("");
  state.data = {
    items: [
      {
        id: id(90),
        targetType: "BUSINESS",
        rating: 4,
        title: "Published fixture review",
        comment: "Synthetic layout acceptance",
        createdAt: "2026-10-01T10:00:00Z",
        product: null,
        service: null,
      },
    ],
  };
  view.rerender(<HomeReviewsPreview initial={{ data: { items: [] } }} />);
  expect(screen.getByText("Published fixture review")).toBeTruthy();
});

it("shows one eligible product without borrowing media from a missing-photo record", () => {
  state.data = {
    items: [photographed, { ...product, id: id(99), name: "No photograph" }],
  };
  const view = render(<HomePartsPreview />);
  expect(view.container.querySelectorAll(".home-product-card")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: product.name })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "No photograph" })).toBeNull();
});
