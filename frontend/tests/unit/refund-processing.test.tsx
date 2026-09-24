// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RefundTransferForm } from "@/app/components/refund-transfer-form";
import { RefundEvidenceCheck } from "@/app/components/refund-evidence-check";
import { AssetStorageProvider } from "@/app/components/asset-storage-context";
import { apiRequest } from "@/lib/api/client";
import {
  prepareRefundEvidence,
  type ProcessingRefund,
} from "@/lib/api/refund-processing";
import type { MutationProposal } from "@/app/components/mutation-review";
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: vi.fn(),
}));
vi.mock("@/lib/api/refund-processing", async (original) => ({
  ...(await original<typeof import("@/lib/api/refund-processing")>()),
  prepareRefundEvidence: vi.fn(),
}));
const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row: ProcessingRefund = {
  id: id(20),
  refundNumber: "ISOLATED-REFUND-20",
  paymentAttemptId: id(30),
  paymentAttempt: { provider: "MANUAL" },
  authorizationKind: "HUMAN",
  status: "NEEDS_ATTENTION",
  amountKobo: "1234567890123456",
  currency: "NGN",
  reason: "Synthetic return",
  requestedByUserId: id(1),
  approvedByUserId: id(2),
  approvedAt: "2026-09-17T09:00:00Z",
  requestedAt: "2026-09-17T08:00:00Z",
  updatedAt: "2026-09-17T09:00:00Z",
  failedAt: null,
  processedAt: null,
  providerStatus: null,
  failureCode: null,
  dueAt: null,
  clockStatus: "NOT_STARTED",
  transferredByUserId: null,
  transferRecordedAt: null,
  bankTransferAt: null,
  checkedByUserId: null,
  checkedAt: null,
};
const transferredAt = "2026-09-17T10:00:00.000Z";
const beneficiary = {
  bankName: "Synthetic bank",
  accountName: "Synthetic recipient",
  accountNumber: "0123456789",
};
const response = (data: unknown) => ({
  success: true as const,
  data,
  message: "Isolated",
  meta: { requestId: "refund-test" },
});
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.mocked(apiRequest).mockReset();
  vi.mocked(prepareRefundEvidence).mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
it("records the exact prepared evidence, recipient and Lagos time only after explicit review", async () => {
  const onReview = vi.fn<(p: MutationProposal) => void>();
  const prepared = {
    name: "evidence.pdf",
    token: "x".repeat(90),
    expiresAt: Date.now() + 60000,
  };
  vi.mocked(prepareRefundEvidence).mockResolvedValue(prepared);
  render(
    <AssetStorageProvider hosts={["storage.invalid"]}>
      <RefundTransferForm
        refund={row}
        actorId={id(3)}
        disabled={false}
        onReview={onReview}
        onUncertain={vi.fn()}
      />
    </AssetStorageProvider>,
  );
  fill("Bank transfer reference", "SYNTHETIC-REF");
  fill("Transfer time (Lagos time)", "2026-09-17T11:00");
  fill("Recipient bank", beneficiary.bankName);
  fill("Recipient account name", beneficiary.accountName);
  fill("Recipient account number", beneficiary.accountNumber);
  fireEvent.click(screen.getByRole("button", { name: "Review transfer record" }));
  expect(onReview).not.toHaveBeenCalled();
  const file = new File(["%PDF-1.4\nSynthetic"], "evidence.pdf", {
    type: "application/pdf",
  });
  fireEvent.change(screen.getByLabelText("Bank transfer evidence"), {
    target: { files: [file] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload selected file" }));
  await waitFor(() => expect(prepareRefundEvidence).toHaveBeenCalledTimes(1));
  await screen.findByText(/File uploaded. Ready to attach/);
  fireEvent.click(screen.getByRole("button", { name: "Review transfer record" }));
  expect(onReview).toHaveBeenCalledTimes(1);
  expect(apiRequest).not.toHaveBeenCalled();
  const proposal = onReview.mock.calls[0][0];
  expect(proposal.description).toContain("does not send money");
  expect(proposal.facts).toContainEqual({ label: "Account number", value: "0123456789" });
  expect(proposal.retryAfterRejection).toBe(false);
  vi.mocked(apiRequest).mockResolvedValue(
    response({
      id: row.id,
      status: "PROCESSING",
      amountKobo: row.amountKobo,
      bankReference: "SYNTHETIC-REF",
      transferredAt,
      transferredByUserId: id(3),
      checkedAt: null,
      checkedByUserId: null,
    }),
  );
  await proposal.submit();
  expect(apiRequest).toHaveBeenCalledWith(`/staff/refunds/${row.id}/transfer`, {
    method: "POST",
    csrf: true,
    body: {
      bankReference: "SYNTHETIC-REF",
      transferredAt,
      beneficiary,
      evidenceToken: prepared.token,
    },
  });
  vi.mocked(apiRequest).mockResolvedValue(
    response({
      id: row.id,
      status: "PROCESSING",
      amountKobo: "1",
      bankReference: "SYNTHETIC-REF",
      transferredAt,
      transferredByUserId: id(3),
      checkedAt: null,
      checkedByUserId: null,
    }),
  );
  await expect(proposal.submit()).rejects.toThrow("Unexpected refund transfer record");
});
for (const accepted of [true, false])
  it(`requires inspected evidence and an explicit ${accepted ? "accept" : "dispute"} result`, async () => {
    const onReview = vi.fn<(p: MutationProposal) => void>();
    vi.mocked(apiRequest).mockResolvedValue(
      response({
        id: row.id,
        url: "https://storage.invalid/evidence?signature=synthetic",
        amountKobo: row.amountKobo,
        bankReference: "SYNTHETIC-REF",
        transferredAt,
        beneficiary,
      }),
    );
    render(
      <AssetStorageProvider hosts={["storage.invalid"]}>
        <RefundEvidenceCheck
          refund={{
            ...row,
            status: "PROCESSING",
            transferredByUserId: id(3),
            bankTransferAt: transferredAt,
          }}
          actorId={id(4)}
          disabled={false}
          onReview={onReview}
          onUncertain={vi.fn()}
        />
      </AssetStorageProvider>,
    );
    expect(apiRequest).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Check outcome")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Load private transfer evidence" }),
    );
    const link = await screen.findByRole("link", {
      name: "Open private evidence in a new tab",
    });
    expect(link.getAttribute("href")).toBe(
      "https://storage.invalid/evidence?signature=synthetic",
    );
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("referrerpolicy")).toBe("no-referrer");
    fill("Check outcome", accepted ? "ACCEPT" : "DISPUTE");
    fill(
      "Independent check note",
      "Synthetic independent recipient and amount reconciliation",
    );
    fireEvent.submit(screen.getByLabelText("Independent check note").closest("form")!);
    expect(onReview).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByLabelText(
        "I reviewed the evidence, recipient, amount and bank reference.",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Review independent check" }));
    expect(onReview).toHaveBeenCalledTimes(1);
    const proposal = onReview.mock.calls[0][0];
    expect(proposal.facts).toContainEqual({
      label: "Recipient",
      value: beneficiary.accountName,
    });
    vi.mocked(apiRequest).mockResolvedValue(
      response({
        id: row.id,
        status: accepted ? "SUCCEEDED" : "NEEDS_ATTENTION",
        amountKobo: row.amountKobo,
        bankReference: "SYNTHETIC-REF",
        transferredAt,
        transferredByUserId: id(3),
        checkedByUserId: id(4),
        checkedAt: "2026-09-17T11:00:00Z",
      }),
    );
    await proposal.submit();
    expect(apiRequest).toHaveBeenLastCalledWith(`/staff/refunds/${row.id}/check`, {
      method: "POST",
      csrf: true,
      body: {
        accepted,
        evidenceChecked: true,
        note: "Synthetic independent recipient and amount reconciliation",
      },
    });
    vi.mocked(apiRequest).mockResolvedValue(
      response({
        id: row.id,
        status: accepted ? "SUCCEEDED" : "NEEDS_ATTENTION",
        amountKobo: row.amountKobo,
        bankReference: "SYNTHETIC-REF",
        transferredAt,
        transferredByUserId: id(3),
        checkedByUserId: id(99),
        checkedAt: "2026-09-17T11:00:00Z",
      }),
    );
    await expect(proposal.submit()).rejects.toThrow("Unexpected refund check result");
  });
