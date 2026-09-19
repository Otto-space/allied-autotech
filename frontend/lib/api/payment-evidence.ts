"use client";
import { z } from "zod";
import { apiRequest } from "./client";
import type { RequestBody } from "./contracts";
import { prepareSignedUpload, type UploadOptions } from "./signed-upload";
export function validatePaymentEvidence(file: Pick<File, "size" | "type">) {
  const mime = z
    .enum(["application/pdf", "image/jpeg", "image/png"])
    .safeParse(file.type);
  if (!mime.success) throw new Error("Choose a PDF, JPEG or PNG file.");
  if (file.size < 1 || file.size > 10 * 1024 * 1024)
    throw new Error("Choose a nonempty file no larger than 10 MiB.");
  return mime.data;
}
export function preparePaymentEvidence(options: UploadOptions & { paymentId: string }) {
  const mimeType = validatePaymentEvidence(options.file);
  return prepareSignedUpload({
    ...options,
    prepare: async (metadata) => {
      const body: RequestBody<
        "/customers/payments/{paymentId}/manual-evidence/upload",
        "post"
      > = { ...metadata, mimeType };
      const result = await apiRequest(
        `/customers/payments/${options.paymentId}/manual-evidence/upload`,
        { method: "POST", csrf: true, body, signal: options.signal },
      );
      const parsed = z
        .object({ evidenceToken: z.string().min(80).max(4096), upload: z.unknown() })
        .safeParse(result.data);
      if (!parsed.success)
        throw new Error("The evidence upload instructions could not be read. Try again.");
      return { token: parsed.data.evidenceToken, upload: parsed.data.upload };
    },
  });
}
