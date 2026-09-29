// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MediaGallery } from "@/app/components/media-gallery";
vi.mock("@/app/components/public-media", () => ({
  PublicMedia: ({ src, alt }: { src?: string; alt: string }) => (
    <span data-testid={alt ? "selected-media" : "thumbnail"} data-src={src}>
      {alt}
    </span>
  ),
}));
afterEach(cleanup);
it("starts with the primary image without losing an earlier image and wraps at either end", () => {
  render(
    <MediaGallery
      title="Test vehicle"
      images={[
        { id: "first", url: "first.jpg", altText: "Front view", isPrimary: false },
        { id: "second", url: "second.jpg", altText: "Side view", isPrimary: true },
      ]}
    />,
  );
  expect(screen.getByTestId("selected-media").getAttribute("data-src")).toBe(
    "second.jpg",
  );
  fireEvent.click(screen.getByRole("button", { name: "Next image" }));
  expect(screen.getByTestId("selected-media").getAttribute("data-src")).toBe("first.jpg");
  fireEvent.click(screen.getByRole("button", { name: "Previous image" }));
  expect(screen.getByTestId("selected-media").getAttribute("data-src")).toBe(
    "second.jpg",
  );
  fireEvent.click(screen.getByRole("button", { name: "Show image 1: Front view" }));
  expect(screen.getByRole("status").textContent).toBe("Image 1 of 2");
});
it("does not create controls or fictional images for an empty gallery", () => {
  render(<MediaGallery title="Unpictured product" images={[]} />);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  expect(screen.getByTestId("selected-media").getAttribute("data-src")).toBeNull();
});
