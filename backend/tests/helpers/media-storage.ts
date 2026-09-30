import type { MediaStoragePort } from "../../src/providers/storage/media-storage.port.js";
import type { UploadRequest } from "../../src/providers/storage/object-storage.port.js";
import { mediaError } from "../../src/modules/media/media.errors.js";

export class MemoryMediaStorage implements MediaStoragePort {
  readonly objects = new Map<string, Buffer>();
  readonly prepared: UploadRequest[] = [];
  readonly deleted: string[] = [];
  unavailable = false;
  private available() {
    if (this.unavailable) throw mediaError("MEDIA_STORAGE_UNAVAILABLE", 503);
  }
  async createUpload(request: UploadRequest) {
    this.available();
    this.prepared.push(request);
    return {
      method: "PUT" as const,
      url: `https://media.example.test/${request.key}`,
      headers: { "content-type": request.mimeType },
      expiresAt: new Date(Date.now() + 300000),
    };
  }
  async read(key: string, maximumBytes: number) {
    this.available();
    const bytes = this.objects.get(key);
    if (!bytes) throw mediaError("MEDIA_OBJECT_MISSING", 404);
    if (bytes.length > maximumBytes) throw mediaError("MEDIA_TOO_LARGE");
    return bytes;
  }
  async write(key: string, bytes: Buffer) {
    this.available();
    this.objects.set(key, bytes);
  }
  async delete(key: string) {
    this.available();
    this.deleted.push(key);
    this.objects.delete(key);
  }
}
