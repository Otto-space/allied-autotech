import { afterEach, expect, it, vi } from "vitest";
import { assetStorageHosts, trustedAssetUrl } from "../../lib/assets";
import { prepareVehicleAsset, validateAssetFile } from "../../lib/api/vehicle-assets";
import { invalidateSession, setCsrfToken } from "../../lib/api/client";
afterEach(() => {
  invalidateSession();
  vi.unstubAllGlobals();
});
it("accepts only explicit bare storage hostnames", () => {
  expect(
    assetStorageHosts(
      " files.example.test,https://bad.test,*.example.test,files.example.test,localhost,good.test/path",
    ),
  ).toEqual(["files.example.test"]);
});
it.each([
  "http://files.example.test/a",
  "https://files.example.test.evil.test/a",
  "https://user:secret@files.example.test/a",
  "https://files.example.test:8443/a",
  "https://files.example.test/a#token",
  "javascript:alert(1)",
])("rejects unsafe private destination %s", (value) => {
  expect(() => trustedAssetUrl(value, ["files.example.test"])).toThrow();
});
it("allows an exact HTTPS storage host and retains its required signature", () => {
  expect(
    trustedAssetUrl("https://files.example.test/a?signature=isolated", [
      "files.example.test",
    ]),
  ).toBe("https://files.example.test/a?signature=isolated");
});
it("rejects same-origin uploads even when a misconfigured allowlist includes the app host", () => {
  expect(() =>
    trustedAssetUrl(
      "https://app.example.test/upload",
      ["app.example.test"],
      "https://app.example.test",
    ),
  ).toThrow();
});
it("enforces handover PDF and file size before transfer", () => {
  expect(() => validateAssetFile({ type: "image/png", size: 100 }, "HANDOVER")).toThrow(
    "PDF",
  );
  expect(() =>
    validateAssetFile({ type: "application/pdf", size: 0 }, "HANDOVER"),
  ).toThrow("nonempty");
  expect(() =>
    validateAssetFile(
      { type: "application/pdf", size: 20 * 1024 * 1024 + 1 },
      "HANDOVER",
    ),
  ).toThrow("20 MiB");
  expect(
    validateAssetFile({ type: "application/pdf", size: 20 * 1024 * 1024 }, "HANDOVER"),
  ).toBe("application/pdf");
  expect(() =>
    validateAssetFile({ type: "image/png", size: 10 * 1024 * 1024 + 1 }, "IMAGE"),
  ).toThrow("10 MiB");
});
it.each(["untrusted destination", "expired ticket", "unexpected header"])(
  "rejects %s before exposing file bytes to storage",
  async (reason) => {
    setCsrfToken("isolated-upload-csrf-token-".repeat(3));
    const file = new File(["%PDF-isolated"], "isolated.pdf", { type: "application/pdf" });
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
            data: {
              assetToken: "isolated-ticket-".repeat(4),
              upload: {
                method: "PUT",
                url:
                  reason === "untrusted destination"
                    ? "https://unapproved.test/upload"
                    : "https://files.example.test/upload",
                expiresAt: new Date(
                  Date.now() + (reason === "expired ticket" ? -1000 : 60000),
                ).toISOString(),
                headers: {
                  "content-type": "application/pdf",
                  ...(reason === "unexpected header"
                    ? { authorization: "do-not-forward" }
                    : {}),
                },
              },
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
      ),
    );
    await expect(
      prepareVehicleAsset({
        file,
        kind: "HANDOVER",
        vehicleId: "70000000-0000-4000-8000-000000000005",
        hosts: ["files.example.test"],
        signal: new AbortController().signal,
        onProgress: vi.fn(),
      }),
    ).rejects.toThrow(
      reason === "untrusted destination"
        ? "not approved"
        : reason === "expired ticket"
          ? "expired"
          : "headers could not be verified",
    );
    expect(xhr).not.toHaveBeenCalled();
  },
);
