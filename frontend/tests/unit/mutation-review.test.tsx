// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { MutationReview, type MutationProposal } from "@/app/components/mutation-review";
import { ApiError } from "@/lib/api/client";

vi.mock("@/app/components/feedback", () => ({
  Feedback: ({ message }: { message?: string }) =>
    message ? <p role="alert">{message}</p> : null,
}));
const originalShowModal = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
beforeAll(() =>
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  }),
);
afterAll(() => {
  if (originalShowModal)
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShowModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
});
afterEach(cleanup);
function review(submit: MutationProposal["submit"], retrySafely = true) {
  const onSuccess = vi.fn(),
    onClose = vi.fn(),
    onUncertain = vi.fn();
  render(
    <MutationReview
      proposal={{
        title: "Review payment",
        description: "Isolated test",
        facts: [],
        submit,
        retrySafely,
        retryAfterRejection: false,
        onUncertain,
      }}
      onSuccess={onSuccess}
      onClose={onClose}
    />,
  );
  return { onSuccess, onClose, onUncertain };
}
it("locks a definite rejection until the review is closed even when unknown outcomes support replay", async () => {
  const submit = vi
    .fn()
    .mockRejectedValue(new ApiError(409, { error: { code: "PAYMENT_ATTEMPT_PENDING" } }));
  const callbacks = review(submit);
  fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Confirm change" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
  expect(submit).toHaveBeenCalledTimes(1);
  expect(callbacks.onUncertain).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Go back" }));
  expect(callbacks.onClose).toHaveBeenCalledTimes(1);
});
it("permits an explicit original-request replay after an unknown network outcome", async () => {
  const submit = vi
    .fn()
    .mockRejectedValueOnce(new Error("Synthetic lost response"))
    .mockResolvedValueOnce({});
  const callbacks = review(submit);
  fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
  const retry = await screen.findByRole("button", { name: "Retry same request" });
  expect(retry).toBeEnabled();
  expect(callbacks.onUncertain).toHaveBeenCalledTimes(1);
  fireEvent.click(retry);
  await waitFor(() => expect(callbacks.onSuccess).toHaveBeenCalledTimes(1));
  expect(submit).toHaveBeenCalledTimes(2);
});
it("never enables replay for an unknown outcome without an idempotent contract", async () => {
  const submit = vi.fn().mockRejectedValue(new Error("Synthetic lost response"));
  const callbacks = review(submit, false);
  fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
  await screen.findByRole("button", { name: "Close & review record" });
  expect(screen.getByRole("button", { name: "Confirm change" })).toBeDisabled();
  expect(callbacks.onUncertain).toHaveBeenCalledTimes(1);
  expect(submit).toHaveBeenCalledTimes(1);
});
