import {
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import { mediaError } from "../../modules/media/media.errors.js";
import type { MediaStoragePort } from "./media-storage.port.js";
import {
  readStorageBody,
  StorageByteLimitError,
  withStorageDeadline,
} from "./storage-io.js";
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

export class S3ObjectStorageAdapter implements ObjectStoragePort, MediaStoragePort {
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
    // Missing configuration is an outage, never evidence that bytes exist.
    const bucket = this.bucket();
    try {
      return await withStorageDeadline(async (signal) => {
        const metadata = await this.client.send(
          new HeadObjectCommand({
            Bucket: bucket,
            Key: request.key,
            ChecksumMode: "ENABLED",
          }),
          { abortSignal: signal },
        );
        signal.throwIfAborted();
        const metadataMatches =
          metadata.ContentLength === request.sizeBytes &&
          metadata.ContentType === request.mimeType &&
          metadata.ChecksumSHA256 ===
            Buffer.from(request.checksumSha256, "hex").toString("base64");
        if (!metadataMatches) return false;
        const object = await this.client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: request.key,
            Range: "bytes=0-15",
          }),
          { abortSignal: signal },
        );
        const bytes = await readStorageBody(object, 16, signal);
        return (
          bytes !== undefined && matchesAllowedFileSignature(request.mimeType, bytes)
        );
      });
    } catch (error) {
      if (
        error instanceof StorageByteLimitError ||
        (error instanceof Error && ["NoSuchKey", "NotFound"].includes(error.name))
      )
        return false;
      throw new AppError({
        code: "PROVIDER_UNAVAILABLE",
        statusCode: 503,
        message: "File storage is temporarily unavailable",
        retryable: true,
      });
    }
  }

  private bucket(): string {
    if (env.OBJECT_STORAGE_BUCKET === undefined)
      throw new AppError({
        code: "PROVIDER_UNAVAILABLE",
        statusCode: 503,
        message: "File storage is temporarily unavailable",
        retryable: true,
      });
    return env.OBJECT_STORAGE_BUCKET;
  }

  async read(key: string, maximumBytes: number): Promise<Buffer> {
    try {
      return await withStorageDeadline(async (signal) => {
        const response = await this.client.send(
          new GetObjectCommand({ Bucket: this.bucket(), Key: key }),
          { abortSignal: signal },
        );
        const bytes = await readStorageBody(response, maximumBytes, signal);
        if (bytes === undefined) throw mediaError("MEDIA_OBJECT_MISSING", 404);
        return bytes;
      });
    } catch (error) {
      if (error instanceof StorageByteLimitError) throw mediaError("MEDIA_TOO_LARGE");
      if (
        error instanceof Error &&
        "code" in error &&
        typeof error.code === "string" &&
        error.code.startsWith("MEDIA_")
      )
        throw error;
      if (error instanceof Error && error.name === "NoSuchKey")
        throw mediaError("MEDIA_OBJECT_MISSING", 404);
      throw mediaError("MEDIA_STORAGE_UNAVAILABLE", 503);
    }
  }
  async write(key: string, bytes: Buffer, mimeType: string): Promise<void> {
    try {
      await withStorageDeadline((signal) =>
        this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket(),
            Key: key,
            Body: bytes,
            ContentType: mimeType,
            ContentLength: bytes.length,
            ServerSideEncryption: "AES256",
            CacheControl: "private, no-store",
          }),
          { abortSignal: signal },
        ),
      );
    } catch {
      throw mediaError("MEDIA_STORAGE_UNAVAILABLE", 503);
    }
  }
  async delete(key: string): Promise<void> {
    try {
      await withStorageDeadline((signal) =>
        this.client.send(new DeleteObjectCommand({ Bucket: this.bucket(), Key: key }), {
          abortSignal: signal,
        }),
      );
    } catch {
      throw mediaError("MEDIA_STORAGE_UNAVAILABLE", 503);
    }
  }
}

// Production and local runtime both fail closed. Tests inject storage explicitly.
export const objectStorage: ObjectStoragePort = new S3ObjectStorageAdapter();
export const mediaStorage: MediaStoragePort = new S3ObjectStorageAdapter();
