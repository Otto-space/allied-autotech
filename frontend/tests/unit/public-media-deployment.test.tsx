// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getImageProps } from "next/image";
import { PublicMedia } from "@/app/components/public-media";

vi.hoisted(() => {
  document.documentElement.dataset.dplId = "dpl_media_contract_fixture";
});

afterEach(cleanup);
const id = "f0000000-0000-4000-8000-000000000001";

it.each([
  { src: `/api/v1/public/catalog/products/images/${id}` },
  { src: `/api/v1/public/vehicles/images/${id}` },
  {
    src: `/api/v1/admin/catalog/products/${id}/images/${id}/content`,
    adminPreview: true,
  },
  {
    src: `/api/v1/staff/vehicles/${id}/images/${id}/content`,
    stockPreview: true,
  },
])("preserves the exact media endpoint during a deployment: $src", (props) => {
  // Exercise the real installed framework under its deployment-ID bootstrap.
  expect(
    getImageProps({ src: props.src, alt: "Control", fill: true, unoptimized: true }).props
      .src,
  ).toContain("?dpl=dpl_media_contract_fixture");
  render(<PublicMedia {...props} alt="Synthetic media" />);
  const image = screen.getByRole("img", { name: "Synthetic media" });
  const url = new URL(image.getAttribute("src")!, window.location.origin);
  expect(url.origin).toBe(window.location.origin);
  expect(url.pathname + url.search).toBe(props.src);
  expect(image.getAttribute("loading")).toBe("lazy");
  fireEvent.error(image);
  if (props.src.startsWith("/api/v1/public/")) {
    expect(image.getAttribute("srcset")).toBeNull();
    fireEvent.error(image);
  }
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("Image unavailable")).toBeTruthy();
});

it("keeps protected previews opt-in and rejects unexpected endpoint queries", () => {
  const src = `/api/v1/admin/catalog/products/${id}/images/${id}/content`;
  const view = render(<PublicMedia src={src} alt="Private preview" />);
  expect(screen.queryByRole("img")).toBeNull();
  view.rerender(<PublicMedia src={`${src}?dpl=unexpected`} adminPreview alt="Preview" />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("Image unavailable")).toBeTruthy();
});
