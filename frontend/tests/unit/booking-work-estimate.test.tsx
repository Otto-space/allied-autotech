// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { BookingWorkEstimate } from "../../app/components/booking-work-estimate";
afterEach(cleanup);
const estimate = {
  reviewedAt: "2040-01-01T10:00:00.000Z",
  remainingMinutes: 45,
  estimatedWorkEndsAt: "2040-01-01T10:45:00.000Z",
};
it("shows an estimate with its review time and clearly separates it from collection", () => {
  render(<BookingWorkEstimate estimate={estimate} status="IN_PROGRESS" />);
  expect(
    screen.getByRole("heading", { name: "Updated work estimate" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/estimated about 45 minutes of work remaining/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/not a promised completion or vehicle-collection time/),
  ).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it.each(["COMPLETED", "CANCELLED", "NO_SHOW"])(
  "does not show stale remaining-work instructions for %s",
  (status) => {
    const { container } = render(
      <BookingWorkEstimate estimate={estimate} status={status} />,
    );
    expect(container).toBeEmptyDOMElement();
  },
);
