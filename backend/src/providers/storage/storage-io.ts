import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";

const operationTimeoutMs = 20_000;
export class StorageByteLimitError extends Error {}

/** Includes SDK retries, response consumption and cancellation in one wall-clock budget. */
export async function withStorageDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error("Storage operation timed out");
      controller.abort(error);
      reject(error);
    }, operationTimeoutMs);
    timer.unref();
  });
  try {
    // Race as well as abort: a provider/stream ignoring cancellation must not hold callers.
    return await Promise.race([operation(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export async function readStorageBody(
  response: GetObjectCommandOutput,
  maximumBytes: number,
  signal: AbortSignal,
): Promise<Buffer | undefined> {
  if (!response.Body) return undefined;
  const reader = response.Body.transformToWebStream().getReader();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    if (response.ContentLength !== undefined && response.ContentLength > maximumBytes)
      throw new StorageByteLimitError();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const result = await reader.read();
      signal.throwIfAborted();
      if (result.done) break;
      size += result.value.length;
      if (size > maximumBytes) throw new StorageByteLimitError();
      chunks.push(result.value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    signal.removeEventListener("abort", cancel);
    // Do not await a potentially broken remote stream's cancellation promise.
    cancel();
  }
}
