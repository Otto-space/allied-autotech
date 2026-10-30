// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resource = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/use-resource", () => ({ useResource: resource }));
import { ServiceDiscoveryControls } from "@/app/components/service-discovery-controls";

const categories = [
  {
    id: "a7100000-0000-4000-8000-000000000001",
    name: "Diagnostics",
    slug: "diagnostics",
  },
  {
    id: "a7100000-0000-4000-8000-000000000002",
    name: "Maintenance",
    slug: "maintenance",
  },
];
const refresh = vi.fn();
let longList = true;
beforeEach(() => {
  longList = true;
  resource.mockImplementation((path: string | null) => {
    const search = path
      ? new URL(path, "https://qa.invalid").searchParams.get("search")
      : null;
    return {
      data:
        path && !path.includes("?")
          ? categories[0]
          : {
              items: search
                ? categories.filter((item) =>
                    item.name.toLowerCase().includes(search.toLowerCase()),
                  )
                : categories,
              ...(!search && longList ? { nextCursor: "A".repeat(120) } : {}),
            },
      loading: false,
      error: undefined,
      refresh,
    };
  });
});
afterEach(() => {
  cleanup();
  resource.mockReset();
  refresh.mockReset();
});

describe("service category finder", () => {
  it("uses one select for a complete small category list", () => {
    longList = false;
    const change = vi.fn();
    render(<ServiceDiscoveryControls params={new URLSearchParams()} change={change} />);
    expect(screen.queryByText("Find a category")).toBeNull();
    fireEvent.change(screen.getByLabelText("Service category"), {
      target: { value: categories[0].id },
    });
    expect(change).toHaveBeenCalledWith("categoryId", categories[0].id);
  });
  it("searches only on submission and lets customers directly choose a matching category", () => {
    const change = vi.fn();
    render(<ServiceDiscoveryControls params={new URLSearchParams()} change={change} />);
    fireEvent.click(screen.getByText("Find a category"));
    const input = screen.getByLabelText("Category name");
    fireEvent.change(input, { target: { value: "Diagnostics" } });
    expect(resource.mock.calls.some(([path]) => String(path).includes("search="))).toBe(
      false,
    );
    fireEvent.submit(input.closest("form")!);
    expect(
      resource.mock.calls.some(([path]) => String(path).includes("search=Diagnostics")),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Diagnostics", exact: true }));
    expect(change).toHaveBeenCalledWith("categoryId", categories[0].id);
  });
  it("makes an empty search recoverable and restores the complete category list", () => {
    render(<ServiceDiscoveryControls params={new URLSearchParams()} change={vi.fn()} />);
    fireEvent.click(screen.getByText("Find a category"));
    const input = screen.getByLabelText("Category name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "not-a-category" } });
    fireEvent.submit(input.closest("form")!);
    expect(screen.getByText(/No categories match/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear category search" }));
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("button", { name: "Maintenance", exact: true })).toBeTruthy();
  });
  it("identifies the selected category in the result list", () => {
    render(
      <ServiceDiscoveryControls
        params={new URLSearchParams({ categoryId: categories[0].id })}
        change={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Find a category"));
    expect(
      screen
        .getByRole("button", { name: "Diagnostics", exact: true })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Maintenance", exact: true })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
});
