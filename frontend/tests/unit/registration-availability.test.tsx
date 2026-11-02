// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { capabilityView } from "@/lib/public-capabilities";
import { publicCapabilitiesFixture } from "../fixtures/public-capabilities";
const state = vi.hoisted(() => ({ enabled: false, request: vi.fn() }));
vi.mock("@/app/components/public-capabilities", () => ({
  usePublicCapabilities: () =>
    capabilityView(state.enabled ? publicCapabilitiesFixture("full") : null),
}));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: state.request,
}));
import { RegisterForm } from "@/app/components/register-form";
afterEach(() => {
  cleanup();
  state.enabled = false;
  state.request.mockClear();
});
it("preserves typed registration details but refuses an unavailable submit, including a direct form event", () => {
  const view = render(<RegisterForm />);
  const input = view.container.querySelector<HTMLInputElement>(
    'input[name="firstName"]',
  )!;
  fireEvent.change(input, { target: { value: "Synthetic" } });
  expect(
    (
      screen.getByRole("button", {
        name: "Create account",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.submit(view.container.querySelector("form")!);
  expect(state.request).not.toHaveBeenCalled();
  state.enabled = true;
  view.rerender(<RegisterForm />);
  expect(input.value).toBe("Synthetic");
  expect(
    (
      screen.getByRole("button", {
        name: "Create account",
        exact: true,
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  expect(state.request).not.toHaveBeenCalled();
});
