export interface UploadRequest {
  key: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface SignedUpload {
  method: "PUT";
  url: string;
  expiresAt: Date;
  headers: Readonly<Record<string, string>>;
}

export interface ObjectStoragePort {
  createUpload(request: UploadRequest): Promise<SignedUpload>;
  verifyObject(request: UploadRequest): Promise<boolean>;
  createDownload(key: string, downloadName: string): Promise<string>;
  createView(key: string): Promise<string>;
}
