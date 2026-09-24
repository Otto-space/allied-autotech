import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { prepareDisputeEvidence } from "@/lib/api/dispute-workflow";
import type { UploadOptions } from "@/lib/api/signed-upload";
import { prepareRefundEvidence } from "@/lib/api/refund-processing";
import { invalidateSession, setCsrfToken } from "@/lib/api/client";
const entityId = "a0000000-0000-4000-8000-000000000001";
const flows = [
  {
    kind: "refunds",
    prepare: (options: UploadOptions) =>
      prepareRefundEvidence({ ...options, refundId: entityId }),
  },
  {
    kind: "disputes",
    prepare: (options: UploadOptions) =>
      prepareDisputeEvidence({ ...options, disputeId: entityId }),
  },
];
afterEach(() => {
  invalidateSession();
  vi.unstubAllGlobals();
});
it.each(flows)(
  "prepares $kind evidence without forwarding application credentials",
  async ({ kind, prepare }) => {
    setCsrfToken("isolated-csrf-".repeat(5));
    const bytes = "%PDF-1.4\nSynthetic refund transfer";
    const checksum = createHash("sha256").update(bytes);
    const hex = checksum.copy().digest("hex"),
      base64 = checksum.digest("base64");
    const file = new File([bytes], "evidence.pdf", { type: "application/pdf" });
    const open = vi.fn(),
      header = vi.fn(),
      send = vi.fn();
    const credentials: boolean[] = [];
    class StorageRequest {
      withCredentials = true;
      status = 204;
      timeout = 0;
      upload = { onprogress: undefined };
      onload?: () => void;
      onerror?: () => void;
      onabort?: () => void;
      ontimeout?: () => void;
      open = open;
      setRequestHeader = header;
      send(value: File) {
        send(value);
        credentials.push(this.withCredentials);
        this.onload?.();
      }
      abort() {
        this.onabort?.();
      }
    }
    vi.stubGlobal("XMLHttpRequest", StorageRequest);
    const expiresAt = new Date(Date.now() + 60000).toISOString();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          message: "Isolated",
          meta: { requestId: "refund-upload-test" },
          data: {
            evidenceToken: "x".repeat(90),
            upload: {
              method: "PUT",
              url: "https://storage.invalid/refunds/evidence?signature=synthetic",
              expiresAt,
              headers: {
                "content-type": "application/pdf",
                "x-amz-checksum-sha256": base64,
                "x-amz-server-side-encryption": "AES256",
              },
            },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const prepared = await prepare({
      file,
      hosts: ["storage.invalid"],
      signal: new AbortController().signal,
      onProgress: vi.fn(),
    });
    expect(prepared).toEqual({
      name: file.name,
      token: "x".repeat(90),
      expiresAt: Date.parse(expiresAt),
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain(
      `/staff/${kind}/${entityId}/evidence-upload`,
    );
    const options = fetcher.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual({
      mimeType: "application/pdf",
      sizeBytes: file.size,
      checksumSha256: hex,
    });
    expect(new Headers(options.headers).get("x-csrf-token")).toBeTruthy();
    expect(open).toHaveBeenCalledWith(
      "PUT",
      "https://storage.invalid/refunds/evidence?signature=synthetic",
    );
    expect(send).toHaveBeenCalledWith(file);
    expect(credentials).toEqual([false]);
    expect(header.mock.calls).toEqual([
      ["content-type", "application/pdf"],
      ["x-amz-checksum-sha256", base64],
      ["x-amz-server-side-encryption", "AES256"],
    ]);
  },
);
it.each(flows)(
  "does not request a $kind ticket without approved storage",
  async ({ prepare }) => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      prepare({
        file: new File(["%PDF-test"], "test.pdf", { type: "application/pdf" }),
        hosts: [],
        signal: new AbortController().signal,
        onProgress: vi.fn(),
      }),
    ).rejects.toThrow("Document uploads are unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  },
);
