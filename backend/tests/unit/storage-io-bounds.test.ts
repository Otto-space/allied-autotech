import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-s3", async (original) => ({
  ...(await original<typeof import("@aws-sdk/client-s3")>()),
  S3Client: class {
    send = send;
  },
}));
vi.mock("../../src/config/env.js", async (original) => {
  const value = await original<typeof import("../../src/config/env.js")>();
  return {
    ...value,
    env: { ...value.env, OBJECT_STORAGE_BUCKET: "synthetic-private-bucket" },
  };
});
import { S3ObjectStorageAdapter } from "../../src/providers/storage/s3-object-storage.adapter.js";
const upload = {
  key: "private/synthetic-only",
  mimeType: "application/pdf",
  sizeBytes: 128,
  checksumSha256: "a".repeat(64),
};
const metadata = () => ({
  ContentLength: upload.sizeBytes,
  ContentType: upload.mimeType,
  ChecksumSHA256: Buffer.from(upload.checksumSha256, "hex").toString("base64"),
});
function body(
  chunks: Uint8Array[],
  options: { stall?: boolean; stalledCancel?: boolean } = {},
) {
  const cancel = vi.fn(() =>
    options.stalledCancel ? new Promise<void>(() => {}) : undefined,
  );
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (!options.stall) controller.close();
    },
    cancel,
  });
  return {
    cancel,
    transformToWebStream: () => stream,
    transformToByteArray: () =>
      options.stall
        ? new Promise<Uint8Array>(() => {})
        : Promise.resolve(Buffer.concat(chunks)),
  };
}
function observe(promise: Promise<unknown>) {
  const result: { state: "pending" | "resolved" | "rejected"; value?: unknown } = {
    state: "pending",
  };
  void promise.then(
    (value) => {
      result.state = "resolved";
      result.value = value;
    },
    (error) => {
      result.state = "rejected";
      result.value = error;
    },
  );
  return result;
}
beforeEach(() => {
  vi.useFakeTimers();
  send.mockReset();
});
afterEach(() => vi.useRealTimers());
describe("bounded storage I/O", () => {
  it("does not start a range request when metadata arrives after the deadline", async () => {
    let release: (value: ReturnType<typeof metadata>) => void = () => {};
    send.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const result = observe(new S3ObjectStorageAdapter().verifyObject(upload));
    await vi.advanceTimersByTimeAsync(20001);
    expect(result.state).toBe("rejected");
    release(metadata());
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it.each(["verify", "read", "write", "delete"])(
    "bounds an unresponsive %s transport and aborts it",
    async (operation) => {
      send.mockImplementation(() => new Promise(() => {}));
      const adapter = new S3ObjectStorageAdapter();
      const request =
        operation === "verify"
          ? adapter.verifyObject(upload)
          : operation === "read"
            ? adapter.read(upload.key, 100)
            : operation === "write"
              ? adapter.write(upload.key, Buffer.from("test"), "image/png")
              : adapter.delete(upload.key);
      const result = observe(request);
      await vi.advanceTimersByTimeAsync(20001);
      expect(result.state).toBe("rejected");
      expect(result.value).toMatchObject({
        statusCode: 503,
        code:
          operation === "verify" ? "PROVIDER_UNAVAILABLE" : "MEDIA_STORAGE_UNAVAILABLE",
      });
      expect(send.mock.calls[0]?.[1]?.abortSignal.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it("shares one deadline between metadata and signature reads", async () => {
    send.mockImplementation((command) =>
      command instanceof HeadObjectCommand
        ? new Promise((resolve) => setTimeout(() => resolve(metadata()), 15000))
        : new Promise(() => {}),
    );
    const result = observe(new S3ObjectStorageAdapter().verifyObject(upload));
    await vi.advanceTimersByTimeAsync(15000);
    expect(send).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5001);
    expect(result.state).toBe("rejected");
    expect(result.value).toMatchObject({ code: "PROVIDER_UNAVAILABLE", statusCode: 503 });
    expect(send.mock.calls[0]?.[1]?.abortSignal).toBe(
      send.mock.calls[1]?.[1]?.abortSignal,
    );
  });
  it.each(["verify", "read"])(
    "bounds a %s body that never finishes, even when cancellation stalls",
    async (operation) => {
      const bytes = body([Buffer.from("%PDF-")], { stall: true, stalledCancel: true });
      send.mockImplementation((command) =>
        Promise.resolve(
          command instanceof HeadObjectCommand ? metadata() : { Body: bytes },
        ),
      );
      const adapter = new S3ObjectStorageAdapter();
      const result = observe(
        operation === "verify"
          ? adapter.verifyObject(upload)
          : adapter.read(upload.key, 128),
      );
      await vi.advanceTimersByTimeAsync(20001);
      expect(result.state).toBe("rejected");
      expect(result.value).toMatchObject({ statusCode: 503 });
      expect(bytes.cancel).toHaveBeenCalled();
    },
  );
  it("rejects a provider ignoring the 16-byte signature range without buffering the full object", async () => {
    const bytes = body([Buffer.from("%PDF-"), Buffer.alloc(1000)], { stall: true });
    send.mockImplementation((command) =>
      Promise.resolve(
        command instanceof HeadObjectCommand ? metadata() : { Body: bytes },
      ),
    );
    const result = observe(new S3ObjectStorageAdapter().verifyObject(upload));
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toEqual({ state: "resolved", value: false });
    expect(bytes.cancel).toHaveBeenCalled();
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(GetObjectCommand);
    expect(send.mock.calls[1]?.[0].input.Range).toBe("bytes=0-15");
  });
  it("cancels a known-oversized body before rejecting it", async () => {
    const bytes = body([], { stall: true });
    send.mockResolvedValue({ ContentLength: 101, Body: bytes });
    await expect(
      new S3ObjectStorageAdapter().read(upload.key, 100),
    ).rejects.toMatchObject({ code: "MEDIA_TOO_LARGE" });
    expect(bytes.cancel).toHaveBeenCalled();
  });
  it("does not wait for broken cancellation after detecting oversized streamed bytes", async () => {
    const bytes = body([Buffer.alloc(101)], { stall: true, stalledCancel: true });
    send.mockResolvedValue({ Body: bytes });
    const result = observe(new S3ObjectStorageAdapter().read(upload.key, 100));
    await vi.advanceTimersByTimeAsync(0);
    expect(result.state).toBe("rejected");
    expect(result.value).toMatchObject({ code: "MEDIA_TOO_LARGE" });
    expect(bytes.cancel).toHaveBeenCalled();
  });
  it("distinguishes provider failure from invalid or missing uploaded bytes", async () => {
    const adapter = new S3ObjectStorageAdapter();
    send.mockRejectedValue(new Error("Private provider endpoint and credential details"));
    const error = await adapter.verifyObject(upload).catch((error) => error);
    expect(error).toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
      statusCode: 503,
      retryable: true,
    });
    expect(String(error)).not.toContain("credential");
    send.mockRejectedValue(Object.assign(new Error("private"), { name: "NotFound" }));
    await expect(adapter.verifyObject(upload)).resolves.toBe(false);
    send.mockResolvedValue({ ...metadata(), ContentLength: 1 });
    await expect(adapter.verifyObject(upload)).resolves.toBe(false);
  });
  it("preserves valid signatures and exact bounded media reads and clears timers", async () => {
    const adapter = new S3ObjectStorageAdapter();
    send.mockImplementation((command) =>
      Promise.resolve(
        command instanceof HeadObjectCommand
          ? metadata()
          : { Body: body([Buffer.from("%PDF-test")]) },
      ),
    );
    await expect(adapter.verifyObject(upload)).resolves.toBe(true);
    await expect(adapter.read(upload.key, 9)).resolves.toEqual(Buffer.from("%PDF-test"));
    expect(vi.getTimerCount()).toBe(0);
  });
});
