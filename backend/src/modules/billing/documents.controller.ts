import type { Request, Response } from "express";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { successResponse } from "../../common/http/api-response.js";
import { financialDocumentsService } from "./documents.service.js";
import { documentFilename, renderFinancialPdf } from "./document-pdf.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { staffInvoiceDownloadQuerySchema } from "./document.schemas.js";

const actor = (request: Request) => request.actor as AuthenticatedActor;
const context = (request: Request): RequestSecurityContext => ({
  requestId: String(request.id),
  ipAddress: request.ip ?? null,
  userAgent: request.get("user-agent") ?? null,
});
const id = (response: Response, field: "invoiceId" | "paymentId") => {
  const params = response.locals.validated?.["params"] as
    Record<string, string> | undefined;
  const value = params?.[field];
  if (!value) throw new Error("Validated document identifier is missing");
  return value;
};
const privateResponse = (response: Response) =>
  response
    .set("Cache-Control", "private, no-store")
    .set("X-Content-Type-Options", "nosniff");
export const invoiceDocument = async (request: Request, response: Response) => {
  privateResponse(response);
  const document = await financialDocumentsService.invoice(
    actor(request),
    id(response, "invoiceId"),
  );
  return response.json(
    successResponse("Invoice document retrieved", request.id, document),
  );
};
export const invoiceDownload = async (request: Request, response: Response) => {
  privateResponse(response);
  const document = await financialDocumentsService.invoice(
    actor(request),
    id(response, "invoiceId"),
  );
  const pdf = await renderFinancialPdf(document);
  return response
    .set("X-Document-Id", document.id)
    .set("X-Document-Type", "invoice")
    .type("application/pdf")
    .attachment(documentFilename("invoice", document.invoiceNumber))
    .send(pdf);
};
export const receiptDocument = async (request: Request, response: Response) => {
  privateResponse(response);
  const document = await financialDocumentsService.receipt(
    actor(request),
    id(response, "paymentId"),
  );
  return response.json(
    successResponse("Payment receipt retrieved", request.id, document),
  );
};
export const staffInvoiceDocument = async (request: Request, response: Response) => {
  privateResponse(response);
  const document = await financialDocumentsService.staffInvoice(
    actor(request),
    id(response, "invoiceId"),
    context(request),
    "document",
  );
  return response.json(
    successResponse("Invoice document retrieved", request.id, document),
  );
};
export const staffInvoiceDownload = async (request: Request, response: Response) => {
  privateResponse(response);
  const expected = staffInvoiceDownloadQuerySchema.parse(
    response.locals.validated?.["query"],
  );
  const document = await financialDocumentsService.staffInvoice(
    actor(request),
    id(response, "invoiceId"),
    context(request),
    "download",
    expected,
  );
  const pdf = await renderFinancialPdf(document);
  return response
    .set("X-Document-Id", document.id)
    .set("X-Document-Type", "invoice")
    .set("X-Document-Version", String(document.version))
    .set("X-Document-Status", document.status)
    .type("application/pdf")
    .attachment(
      documentFilename(
        "invoice",
        document.status === "DRAFT"
          ? `DRAFT-${document.invoiceNumber}`
          : document.invoiceNumber,
      ),
    )
    .send(pdf);
};
export const receiptDownload = async (request: Request, response: Response) => {
  privateResponse(response);
  const document = await financialDocumentsService.receipt(
    actor(request),
    id(response, "paymentId"),
  );
  const pdf = await renderFinancialPdf(document);
  return response
    .set("X-Document-Id", document.paymentId)
    .set("X-Document-Type", "receipt")
    .type("application/pdf")
    .attachment(documentFilename("receipt", document.paymentNumber))
    .send(pdf);
};
