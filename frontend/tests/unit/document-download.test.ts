// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDocumentPdf } from "../../lib/api/document-download";
const id = "f7000000-0000-4000-8000-000000000001";
const headers = {
  "content-type": "application/pdf",
  "x-document-id": id,
  "x-document-type": "invoice",
  "content-disposition": 'attachment; filename="invoice-AA-1.pdf"',
};
afterEach(() => vi.unstubAllGlobals());
describe("private document download", () => {
  it("uses a fixed authenticated private endpoint and checks the binary identity", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("%PDF-synthetic", { headers }));
    vi.stubGlobal("fetch", fetch);
    const file = await fetchDocumentPdf("invoice", id, new AbortController().signal);
    expect(file.name).toBe("invoice-AA-1.pdf");
    expect(file.type).toBe("application/pdf");
    expect(await file.text()).toBe("%PDF-synthetic");
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/customers/invoices/${id}/download`,
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
        redirect: "error",
      }),
    );
  });
  it.each(["../elsewhere", "https://example.test", `${id}/other`])(
    "rejects an invalid identifier %s before fetching",
    async (value) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      await expect(
        fetchDocumentPdf("invoice", value, new AbortController().signal),
      ).rejects.toThrow();
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it.each([
    { "content-type": "text/html" },
    { "x-document-id": "other" },
    { "x-document-type": "receipt" },
  ])("rejects unexpected document metadata %o", async (change) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("%PDF-synthetic", { headers: { ...headers, ...change } }),
        ),
    );
    await expect(
      fetchDocumentPdf("invoice", id, new AbortController().signal),
    ).rejects.toThrow("Invalid document response");
  });
  it("rejects disguised non-PDF content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>private error</html>", { headers })),
    );
    await expect(
      fetchDocumentPdf("invoice", id, new AbortController().signal),
    ).rejects.toThrow("Invalid PDF document");
  });
  it("bounds the body even when Content-Length is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(new Uint8Array(4 * 1024 * 1024 + 1), { headers }),
        ),
    );
    await expect(
      fetchDocumentPdf("invoice", id, new AbortController().signal),
    ).rejects.toThrow("too large");
  });
  it("rejects a response arriving after cancellation", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        controller.abort();
        return Promise.resolve(new Response("%PDF-synthetic", { headers }));
      }),
    );
    await expect(
      fetchDocumentPdf("invoice", id, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("does not expose a raw server diagnostic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "NOT_FOUND", message: "private database diagnostic" },
          }),
          { status: 404, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    try {
      await fetchDocumentPdf("invoice", id, new AbortController().signal);
      throw new Error("Expected failure");
    } catch (error) {
      expect(error).toMatchObject({ status: 404 });
      expect(String(error)).not.toContain("database diagnostic");
    }
  });
});
