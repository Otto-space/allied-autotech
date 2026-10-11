"use client";
import { ApiError, invalidateSession } from "./client";

export async function fetchDocumentPdf(
  kind: "invoice" | "receipt",
  id: string,
  signal: AbortSignal,
): Promise<File> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))
    throw new Error("Invalid document identifier");
  const path =
    kind === "invoice"
      ? `/customers/invoices/${id}/download`
      : `/customers/payments/${id}/receipt`;
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
  const response = await fetch(`/api/v1${path}`, {
    headers: { Accept: "application/pdf" },
    credentials: "include",
    cache: "no-store",
    redirect: "error",
    signal: requestSignal,
  });
  requestSignal.throwIfAborted();
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    if (response.status === 401) invalidateSession();
    throw new ApiError(response.status, body);
  }
  if (
    response.headers.get("content-type")?.split(";")[0].trim() !== "application/pdf" ||
    response.headers.get("x-document-id") !== id ||
    response.headers.get("x-document-type") !== kind ||
    !response.body
  )
    throw new Error("Invalid document response");
  const reader = response.body.getReader(),
    chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    while (true) {
      requestSignal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4 * 1024 * 1024) throw new Error("Document is too large");
      chunks.push(new Uint8Array(value));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  requestSignal.throwIfAborted();
  const blob = new Blob(chunks, { type: "application/pdf" });
  if ((await blob.slice(0, 5).text()) !== "%PDF-")
    throw new Error("Invalid PDF document");
  requestSignal.throwIfAborted();
  const suppliedName = response.headers
    .get("content-disposition")
    ?.match(/filename="([a-zA-Z0-9_-]+\.pdf)"/)?.[1];
  return new File([blob], suppliedName ?? `${kind}-${id}.pdf`, {
    type: "application/pdf",
  });
}
