import type { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { invoiceDocumentSchema, receiptDocumentSchema } from "./document.schemas.js";

export function registerFinancialDocumentsOpenApi(registry: OpenAPIRegistry): void {
  for (const kind of ["invoice", "receipt"] as const) {
    const invoice = kind === "invoice";
    const base = invoice
      ? "/customers/invoices/{invoiceId}"
      : "/customers/payments/{paymentId}/receipt";
    const params = invoice
      ? z.object({ invoiceId: z.uuid() })
      : z.object({ paymentId: z.uuid() });
    const schema = invoice ? invoiceDocumentSchema : receiptDocumentSchema;
    for (const download of [false, true]) {
      registry.registerPath({
        method: "get",
        path: download ? `${base}${invoice ? "/download" : ""}` : `${base}/document`,
        summary: `${download ? "Download" : "Read"} an owned ${invoice ? "invoice" : "confirmed payment receipt"} document`,
        description:
          "CUSTOMER only. Ownership is checked on every request. Draft invoices are unavailable. Receipts require the selected successful, verified settlement, with matching NGN amount; a submitted manual report is insufficient. Completed refunds are stated separately. Documents do not confirm fulfilment or full invoice settlement. Private, uncached response; no public share URL. Downloads are rate limited.",
        security: [{ sessionCookie: [] }],
        request: { params, query: z.object({}).strict() },
        responses: {
          200: {
            description: download
              ? "Private PDF attachment with sanitized filename"
              : "Authoritative document projection",
            headers: {
              "Cache-Control": {
                schema: { type: "string", enum: ["private, no-store"] },
              },
              ...(download
                ? {
                    "Content-Disposition": { schema: { type: "string" } },
                    "X-Document-Id": { schema: { type: "string", format: "uuid" } },
                    "X-Document-Type": { schema: { type: "string", enum: [kind] } },
                  }
                : {}),
            },
            content: download
              ? { "application/pdf": { schema: { type: "string", format: "binary" } } }
              : {
                  "application/json": {
                    schema: z.object({
                      success: z.literal(true),
                      message: z.string(),
                      data: schema,
                      meta: z.object({ requestId: z.string() }),
                    }),
                  },
                },
          },
          401: { description: "Authentication required" },
          403: { description: "Customer role required" },
          404: { description: "Record unavailable or not owned" },
          409: { description: "No eligible settlement or inconsistent document data" },
          ...(download ? { 429: { description: "Download rate limit exceeded" } } : {}),
        },
      });
    }
  }
}
