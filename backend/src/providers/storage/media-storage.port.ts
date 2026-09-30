import type { SignedUpload, UploadRequest } from "./object-storage.port.js";

export interface MediaStoragePort {
  createUpload(request: UploadRequest): Promise<SignedUpload>;
  read(key: string, maximumBytes: number): Promise<Buffer>;
  write(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  delete(key: string): Promise<void>;
}
