/** One wall-clock budget for headers, body consumption and provider processing. */
export async function withProviderResponse<T>(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number,
  consume: (response: Response, signal: AbortSignal) => T | Promise<T>,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)
    throw new Error("Invalid provider timeout");
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error("Provider request timed out");
      controller.abort(error);
      reject(error);
    }, timeoutMs);
    timer.unref();
  });
  const operation = (async () => {
    let response: Response | undefined;
    try {
      response = await fetcher(input, {
        ...init,
        redirect: "error",
        signal: controller.signal,
      });
      // A transport that ignores abort can deliver headers after our deadline.
      controller.signal.throwIfAborted();
      return await consume(response, controller.signal);
    } finally {
      // Status-only responses and late headers still need their body released.
      // Cancellation itself must never hold a worker or an API caller.
      if (response?.body && !response.body.locked)
        void response.body.cancel().catch(() => undefined);
    }
  })();
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export async function readProviderBytes(
  response: Response,
  maximumBytes: number,
  signal: AbortSignal,
): Promise<Buffer> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0)
    throw new Error("Invalid provider byte limit");
  signal.throwIfAborted();
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maximumBytes) throw new Error("Provider response too large");
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const result = await reader.read();
      signal.throwIfAborted();
      if (result.done) break;
      size += result.value.byteLength;
      // Count decoded bytes as they arrive, including chunked/gzip responses.
      if (size > maximumBytes) throw new Error("Provider response too large");
      chunks.push(result.value);
    }
    return Buffer.concat(chunks, size);
  } finally {
    signal.removeEventListener("abort", cancel);
    cancel();
    reader.releaseLock();
  }
}
