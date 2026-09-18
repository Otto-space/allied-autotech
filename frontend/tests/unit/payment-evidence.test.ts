import { afterEach, expect, it, vi } from "vitest";
import {
  preparePaymentEvidence,
  validatePaymentEvidence,
} from "../../lib/api/payment-evidence";
import { invalidateSession, setCsrfToken } from "../../lib/api/client";
afterEach(() => {
  invalidateSession();
  vi.unstubAllGlobals();
});
it("applies the narrower payment receipt MIME and byte limits", () => {
  for (const type of ["application/pdf", "image/jpeg", "image/png"])
    expect(validatePaymentEvidence({ type, size: 10 * 1024 * 1024 })).toBe(type);
  expect(() => validatePaymentEvidence({ type: "image/webp", size: 100 })).toThrow(
    "PDF, JPEG or PNG",
  );
  expect(() => validatePaymentEvidence({ type: "application/pdf", size: 0 })).toThrow(
    "nonempty",
  );
  expect(() =>
    validatePaymentEvidence({ type: "application/pdf", size: 10 * 1024 * 1024 + 1 }),
  ).toThrow("10 MiB");
});
it("rejects a vehicle attachment token in a customer payment response before storage transfer", async () => {
  setCsrfToken("isolated-csrf-".repeat(5));
  const xhr = vi.fn();
  vi.stubGlobal("XMLHttpRequest", xhr);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: "Isolated",
          meta: { requestId: "test" },
          data: { assetToken: "wrong-kind-".repeat(10), upload: {} },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
  await expect(
    preparePaymentEvidence({
      file: new File(["%PDF-test"], "test.pdf", { type: "application/pdf" }),
      paymentId: "b0000000-0000-4000-8000-000000000001",
      hosts: ["files.example.test"],
      signal: new AbortController().signal,
      onProgress: vi.fn(),
    }),
  ).rejects.toThrow();
  expect(xhr).not.toHaveBeenCalled();
});
