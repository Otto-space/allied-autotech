"use client";
import { z } from "zod";
import { trustedAssetUrl } from "../assets";
export type PreparedUpload = { name: string; token: string; expiresAt: number };
export type UploadOptions = {
  file: File;
  hosts: readonly string[];
  signal: AbortSignal;
  onProgress: (percentage: number) => void;
};
const instructions = z.object({
  token: z.string().min(40).max(4096),
  upload: z.object({
    method: z.literal("PUT"),
    url: z.string(),
    expiresAt: z.string().datetime({ offset: true }),
    headers: z.record(z.string(), z.string()),
  }),
});
export async function prepareSignedUpload({
  file,
  hosts,
  signal,
  onProgress,
  prepare,
}: UploadOptions & {
  prepare: (metadata: { sizeBytes: number; checksumSha256: string }) => Promise<unknown>;
}): Promise<PreparedUpload> {
  if (!hosts.length)
    throw new Error(
      "Document uploads are unavailable. Contact customer care or an administrator.",
    );
  const bytes = await file.arrayBuffer();
  signal.throwIfAborted();
  const checksum = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const checksumSha256 = Array.from(checksum, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  signal.throwIfAborted();
  const parsed = instructions.safeParse(
    await prepare({ sizeBytes: file.size, checksumSha256 }),
  );
  if (!parsed.success)
    throw new Error("The upload instructions could not be read. Try again.");
  const { upload, token } = parsed.data;
  const url = trustedAssetUrl(
    upload.url,
    hosts,
    typeof window === "undefined" ? undefined : window.location.origin,
  );
  const expiresAt = Date.parse(upload.expiresAt);
  if (expiresAt <= Date.now())
    throw new Error("The upload instructions expired. Upload the file again.");
  const headers = Object.entries(upload.headers);
  const expected: Record<string, string> = {
    "content-type": file.type,
    "x-amz-checksum-sha256": btoa(String.fromCharCode(...checksum)),
    "x-amz-server-side-encryption": "AES256",
  };
  if (
    !headers.some(
      ([key, value]) => key.toLowerCase() === "content-type" && value === file.type,
    ) ||
    headers.some(([key, value]) => expected[key.toLowerCase()] !== value)
  )
    throw new Error(
      "The upload headers could not be verified. Contact an administrator.",
    );
  await uploadFile(file, url, headers, signal, onProgress);
  signal.throwIfAborted();
  if (expiresAt <= Date.now())
    throw new Error(
      "The attachment authorisation expired. Upload the file again before saving.",
    );
  return { name: file.name, token, expiresAt };
}

function uploadFile(
  file: File,
  url: string,
  headers: [string, string][],
  signal: AbortSignal,
  onProgress: (percentage: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const request = new XMLHttpRequest();
    const abort = () => request.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    request.open("PUT", url);
    request.withCredentials = false;
    request.timeout = 120_000;
    for (const [key, value] of headers) request.setRequestHeader(key, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () =>
      finish(
        request.status >= 200 && request.status < 300
          ? undefined
          : new Error(
              "Storage did not confirm the upload. No document has been attached. Try uploading again.",
            ),
      );
    request.onerror = () =>
      finish(
        new Error(
          "The upload was interrupted. No document has been attached. Check your connection and try again.",
        ),
      );
    request.ontimeout = () =>
      finish(
        new Error(
          "The upload timed out. No document has been attached. Try uploading again.",
        ),
      );
    request.onabort = () => finish(new DOMException("Upload cancelled", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else request.send(file);
  });
}
