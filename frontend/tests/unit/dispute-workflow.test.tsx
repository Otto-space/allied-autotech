// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DisputeEvidence } from "@/app/components/dispute-evidence";
import { DisputeProgress } from "@/app/components/dispute-progress";
import { AssetStorageProvider } from "@/app/components/asset-storage-context";
import { apiRequest } from "@/lib/api/client";
import { prepareDisputeEvidence } from "@/lib/api/dispute-workflow";
import type { MutationProposal } from "@/app/components/mutation-review";
import { disputeId as id, disputeFixture } from "../fixtures/dispute-work";
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: vi.fn(),
}));
vi.mock("@/lib/api/dispute-workflow", async (original) => ({
  ...(await original<typeof import("@/lib/api/dispute-workflow")>()),
  prepareDisputeEvidence: vi.fn(),
}));
const response = (data: unknown) => ({
  success: true as const,
  data,
  message: "Isolated",
  meta: { requestId: "dispute-test" },
});
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(apiRequest).mockReset();
  vi.mocked(prepareDisputeEvidence).mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("preserves a complete private bundle only after three acknowledgements and explicit review", async () => {
  const record = disputeFixture(),
    onReview = vi.fn<(p: MutationProposal) => void>();
  vi.mocked(prepareDisputeEvidence).mockResolvedValue({
    name: "bundle.pdf",
    token: "x".repeat(90),
    expiresAt: Date.now() + 60000,
  });
  render(
    <AssetStorageProvider hosts={["storage.invalid"]}>
      <DisputeEvidence record={record} disabled={false} onReview={onReview} />
    </AssetStorageProvider>,
  );
  const input = screen.getByLabelText("Dispute evidence bundle");
  fireEvent.change(input, {
    target: {
      files: [
        new File(["%PDF-1.4\nSynthetic"], "bundle.pdf", { type: "application/pdf" }),
      ],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload selected file" }));
  await screen.findByText(/File uploaded. Ready to attach/);
  const note = screen.getByLabelText("Evidence bundle note");
  fireEvent.change(note, {
    target: { value: "Synthetic complete invoice, handover and message evidence" },
  });
  fireEvent.submit(note.closest("form")!);
  expect(onReview).not.toHaveBeenCalled();
  for (const label of [
    "The invoice is included.",
    "Fulfillment or handover proof is included.",
    "Relevant customer messages are included.",
  ])
    fireEvent.click(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole("button", { name: "Review evidence bundle" }));
  expect(onReview).toHaveBeenCalledTimes(1);
  expect(apiRequest).not.toHaveBeenCalled();
  const proposal = onReview.mock.calls[0][0];
  expect(proposal.description).toContain("cannot be replaced");
  expect(proposal.description).toContain("not automatically sent");
  const checklist = {
    invoice: true as const,
    fulfillmentOrHandoverProof: true as const,
    relevantCustomerMessages: true as const,
    note: "Synthetic complete invoice, handover and message evidence",
  };
  vi.mocked(apiRequest).mockResolvedValue(
    response({ ...record, hasEvidence: true, evidenceChecklist: checklist }),
  );
  await proposal.submit();
  expect(apiRequest).toHaveBeenCalledWith(`/staff/disputes/${record.id}/evidence`, {
    method: "POST",
    csrf: true,
    body: {
      ...checklist,
      evidenceToken: "x".repeat(90),
      expectedUpdatedAt: record.updatedAt,
    },
  });
  vi.mocked(apiRequest).mockResolvedValue(
    response({
      ...record,
      hasEvidence: true,
      evidenceChecklist: { ...checklist, note: "Different recorded bundle" },
    }),
  );
  await expect(proposal.submit()).rejects.toThrow("Unexpected dispute action result");
});
it("validates the dispute identity before exposing a trusted temporary evidence link", async () => {
  const record = { ...disputeFixture(), hasEvidence: true };
  vi.mocked(apiRequest).mockResolvedValue(
    response({
      id: id(999),
      url: "https://storage.invalid/evidence?signature=synthetic",
    }),
  );
  render(
    <AssetStorageProvider hosts={["storage.invalid"]}>
      <DisputeEvidence record={record} disabled={false} onReview={vi.fn()} />
    </AssetStorageProvider>,
  );
  expect(apiRequest).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Load private dispute evidence" }));
  await screen.findByText(
    "The private dispute evidence could not be verified. Refresh the record before trying again.",
  );
  expect(screen.queryByRole("link")).toBeNull();
  vi.mocked(apiRequest).mockResolvedValue(
    response({
      id: record.id,
      url: "https://storage.invalid/evidence?signature=synthetic",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Load private dispute evidence" }));
  const link = await screen.findByRole("link", {
    name: "Open dispute evidence in a new tab",
  });
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(link.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(link.getAttribute("href")).toContain("https://storage.invalid/");
});
it("aborts private evidence access when its record is removed", async () => {
  let signal: AbortSignal | undefined;
  vi.mocked(apiRequest).mockImplementation(async (_path, options) => {
    signal = options?.signal ?? undefined;
    return new Promise(() => {});
  });
  const { unmount } = render(
    <AssetStorageProvider hosts={["storage.invalid"]}>
      <DisputeEvidence
        record={{ ...disputeFixture(), hasEvidence: true }}
        disabled={false}
        onReview={vi.fn()}
      />
    </AssetStorageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Load private dispute evidence" }));
  await waitFor(() => expect(signal).toBeDefined());
  unmount();
  expect(signal!.aborted).toBe(true);
});
it("rejects changed provider receipt details and does not accept a different timestamp", async () => {
  const record = { ...disputeFixture(), hasEvidence: true },
    onReview = vi.fn<(p: MutationProposal) => void>();
  render(
    <DisputeProgress
      record={record}
      actorId={id(10)}
      disabled={false}
      onReview={onReview}
    />,
  );
  fireEvent.change(screen.getByLabelText("Provider submission reference"), {
    target: { value: "SYNTHETIC-RECEIPT" },
  });
  fireEvent.change(screen.getByLabelText("Submission time (Lagos time)"), {
    target: { value: "2026-09-17T13:00" },
  });
  fireEvent.change(screen.getByLabelText("Submission note"), {
    target: { value: "Synthetic dashboard submission receipt" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review provider receipt" }));
  const proposal = onReview.mock.calls[0][0];
  vi.mocked(apiRequest).mockResolvedValue(
    response({
      ...record,
      providerSubmissionReference: "SYNTHETIC-RECEIPT",
      respondedAt: "2026-09-17T12:01:00Z",
    }),
  );
  await expect(proposal.submit()).rejects.toThrow("Unexpected dispute action result");
  vi.mocked(apiRequest).mockResolvedValue(
    response({
      ...record,
      providerSubmissionReference: "SYNTHETIC-RECEIPT",
      respondedAt: "2026-09-17T12:00:00Z",
    }),
  );
  await proposal.submit();
  expect(proposal.retryAfterRejection).toBe(false);
});
