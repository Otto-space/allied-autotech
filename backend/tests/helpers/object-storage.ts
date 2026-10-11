import { createHash } from "node:crypto";
import type {
  ObjectStoragePort,
  UploadRequest,
} from "../../src/providers/storage/object-storage.port.js";
import { matchesAllowedFileSignature } from "../../src/providers/storage/s3-object-storage.adapter.js";

// Explicit test storage: successful verification requires actual matching bytes.
export class MemoryObjectStorage implements ObjectStoragePort {
  readonly prepared: UploadRequest[] = [];
  readonly objects = new Map<string, Buffer>();

  async createUpload(input: UploadRequest) {
    this.prepared.push(input);
    return {
      method: "PUT" as const,
      url: `https://private.example.test/upload/${encodeURIComponent(input.key)}`,
      expiresAt: new Date(Date.now() + 300_000),
      headers: { "content-type": input.mimeType },
    };
  }
  async verifyObject(input: UploadRequest) {
    const bytes = this.objects.get(input.key);
    return (
      !!bytes &&
      bytes.length === input.sizeBytes &&
      createHash("sha256").update(bytes).digest("hex") === input.checksumSha256 &&
      matchesAllowedFileSignature(input.mimeType, bytes)
    );
  }
  async createDownload(key: string) {
    if (!this.objects.has(key)) throw new Error("Synthetic object is missing");
    return `https://private.example.test/download/${encodeURIComponent(key)}`;
  }
  async createView(key: string) {
    return this.createDownload(key);
  }
}
