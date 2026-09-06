import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../../config/env.js";
import type {
  ObjectStoragePort,
  SignedUpload,
  UploadRequest,
} from "./object-storage.port.js";

export function matchesAllowedFileSignature(
  mimeType: string,
  bytes: Uint8Array,
): boolean {
  if (mimeType === "application/pdf")
    return Buffer.from(bytes.subarray(0, 5)).equals(Buffer.from("%PDF-"));
  if (mimeType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png")
    return Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  if (mimeType === "image/webp")
    return (
      Buffer.from(bytes.subarray(0, 4)).equals(Buffer.from("RIFF")) &&
      Buffer.from(bytes.subarray(8, 12)).equals(Buffer.from("WEBP"))
    );
  return false;
}

export class S3ObjectStorageAdapter implements ObjectStoragePort {
  private readonly client = new S3Client({
    region: env.OBJECT_STORAGE_REGION,
    ...(env.OBJECT_STORAGE_ENDPOINT === undefined
      ? {}
      : { endpoint: env.OBJECT_STORAGE_ENDPOINT }),
    forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE,
    ...(env.OBJECT_STORAGE_ACCESS_KEY_ID === undefined ||
    env.OBJECT_STORAGE_SECRET_ACCESS_KEY === undefined
      ? {}
      : {
          credentials: {
            accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
            secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
          },
        }),
  });

  async createUpload(request: UploadRequest): Promise<SignedUpload> {
    const checksum = Buffer.from(request.checksumSha256, "hex").toString("base64");
    const command = new PutObjectCommand({
      Bucket: this.bucket(),
      Key: request.key,
      ContentType: request.mimeType,
      ContentLength: request.sizeBytes,
      ChecksumSHA256: checksum,
      ServerSideEncryption: "AES256",
    });
    return {
      method: "PUT",
      url: await getSignedUrl(this.client, command, {
        expiresIn: env.ASSET_UPLOAD_TTL_SECONDS,
      }),
      expiresAt: new Date(Date.now() + env.ASSET_UPLOAD_TTL_SECONDS * 1_000),
      headers: {
        "content-type": request.mimeType,
        "x-amz-checksum-sha256": checksum,
        "x-amz-server-side-encryption": "AES256",
      },
    };
  }

  async createDownload(key: string, downloadName: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        ResponseContentDisposition: `attachment; filename="${downloadName.replaceAll('"', "")}"`,
      }),
      { expiresIn: env.ASSET_DOWNLOAD_TTL_SECONDS },
    );
  }

  async createView(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket(),
        Key: key,
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: env.ASSET_DOWNLOAD_TTL_SECONDS },
    );
  }

  async verifyObject(request: UploadRequest): Promise<boolean> {
    try {
      const metadata = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket(),
          Key: request.key,
          ChecksumMode: "ENABLED",
        }),
      );
      const metadataMatches =
        metadata.ContentLength === request.sizeBytes &&
        metadata.ContentType === request.mimeType &&
        metadata.ChecksumSHA256 ===
          Buffer.from(request.checksumSha256, "hex").toString("base64");
      if (!metadataMatches) return false;
      const object = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket(),
          Key: request.key,
          Range: "bytes=0-15",
        }),
      );
      if (object.Body === undefined) return false;
      return matchesAllowedFileSignature(
        request.mimeType,
        await object.Body.transformToByteArray(),
      );
    } catch {
      return false;
    }
  }

  private bucket(): string {
    if (env.OBJECT_STORAGE_BUCKET === undefined)
      throw new Error("Object storage is not configured");
    return env.OBJECT_STORAGE_BUCKET;
  }
}

class SyntheticObjectStorageAdapter implements ObjectStoragePort {
  async createUpload(request: UploadRequest): Promise<SignedUpload> {
    return {
      method: "PUT",
      url: `https://storage.invalid/upload/${encodeURIComponent(request.key)}`,
      expiresAt: new Date(Date.now() + env.ASSET_UPLOAD_TTL_SECONDS * 1_000),
      headers: { "content-type": request.mimeType },
    };
  }
  async createDownload(key: string): Promise<string> {
    return `https://storage.invalid/download/${encodeURIComponent(key)}`;
  }
  async createView(key: string): Promise<string> {
    return `https://storage.invalid/view/${encodeURIComponent(key)}`;
  }
  async verifyObject(): Promise<boolean> {
    return true;
  }
}

export const objectStorage: ObjectStoragePort =
  env.OBJECT_STORAGE_BUCKET === undefined
    ? new SyntheticObjectStorageAdapter()
    : new S3ObjectStorageAdapter();
