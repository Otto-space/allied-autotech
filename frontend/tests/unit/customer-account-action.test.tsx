// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { CustomerAccountAction } from "@/app/components/customer-account-action";
import { apiRequest, ApiError } from "@/lib/api/client";
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiRequest: vi.fn(),
}));
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const customer = {
  id: "51000000-0000-4000-8000-000000000002",
  firstName: "Synthetic",
  lastName: "Customer",
  email: "account@example.test",
  phone: "",
  status: "ACTIVE" as const,
  emailVerified: true,
  phoneVerified: false,
  createdAt: "2026-10-25T09:00:00Z",
};
it("keeps the reviewed transition fixed when a background refresh changes the account", async () => {
  vi.mocked(apiRequest).mockRejectedValue(
    new ApiError(409, { error: { code: "ACCOUNT_ALREADY_SUSPENDED" } }),
  );
  const refresh = vi.fn(),
    { rerender } = render(
      <CustomerAccountAction customer={customer} onChanged={refresh} />,
    );
  fireEvent.click(screen.getByRole("button", { name: /Suspend account/ }));
  rerender(
    <CustomerAccountAction
      customer={{ ...customer, status: "SUSPENDED" }}
      onChanged={refresh}
    />,
  );
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("heading").textContent).toBe("Suspend account");
  fireEvent.change(within(dialog).getByLabelText("Reason (required)"), {
    target: { value: "Synthetic reviewed account restriction" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Suspend account", exact: true }),
  );
  await waitFor(() => expect(within(dialog).getByText(/already suspended/)).toBeTruthy());
  expect(apiRequest).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      body: {
        expectedStatus: "ACTIVE",
        status: "SUSPENDED",
        reason: "Synthetic reviewed account restriction",
      },
    }),
  );
  expect(
    (
      within(dialog).getByRole("button", {
        name: "Suspend account",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    within(dialog).queryByRole("button", { name: "Reactivate account", exact: true }),
  ).toBeNull();
  expect(refresh).toHaveBeenCalledOnce();
});
