import PDFDocument from "pdfkit";
import { fileURLToPath } from "node:url";
import type { InvoiceDocument, ReceiptDocument } from "./document.schemas.js";

const font = fileURLToPath(
  new URL("../../../assets/fonts/Quicksand-Regular.ttf", import.meta.url),
);
const bold = fileURLToPath(
  new URL("../../../assets/fonts/Quicksand-Bold.ttf", import.meta.url),
);
const ink = "#01121A",
  red = "#E60301",
  muted = "#435563",
  line = "#CFD8DF",
  grey = "#F1F4F6";
const clean = (value: string) =>
  Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 32 || code === 127 ? " " : character;
  }).join("");
export const documentMoney = (value: string) => {
  const amount = BigInt(value);
  return `NGN ${(amount / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${(amount % 100n).toString().padStart(2, "0")}`;
};
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Lagos",
      }).format(new Date(value))
    : "Not specified";
export function documentFilename(kind: "invoice" | "receipt", reference: string): string {
  return `${kind}-${reference.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || "document"}.pdf`;
}

/** Deterministic local assets only. No HTML, remote URLs or user-supplied PDF commands. */
export function renderFinancialPdf(
  document: InvoiceDocument | ReceiptDocument,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const invoice = "invoiceNumber" in document;
    const reference = invoice ? document.invoiceNumber : document.paymentNumber;
    const pdf = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
      info: {
        Title: `${invoice ? "Invoice" : "Payment receipt"} ${reference}`,
        Author: document.issuer.name,
        Creator: "Allied AutoTech",
      },
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    pdf.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 4 * 1024 * 1024)
        pdf.destroy(new Error("Document exceeds export limit"));
      else chunks.push(chunk);
    });
    pdf.on("error", reject);
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    try {
      pdf.registerFont("Body", font).registerFont("Strong", bold).font("Body");
      const left = 42,
        right = 553,
        width = right - left;
      let y = 42;
      const text = (
        value: string,
        x: number,
        top: number,
        maxWidth: number,
        size = 10,
        color = ink,
        align: "left" | "right" = "left",
      ) => {
        pdf
          .font(size >= 12 ? "Strong" : "Body")
          .fontSize(size)
          .fillColor(color)
          .text(clean(value), x, top, { width: maxWidth, align, lineGap: 3 });
      };
      const height = (value: string, maxWidth: number, size = 10) =>
        pdf
          .font(size >= 12 ? "Strong" : "Body")
          .fontSize(size)
          .heightOfString(clean(value), { width: maxWidth, lineGap: 3 });
      const rule = (top: number, color = line) =>
        pdf
          .strokeColor(color)
          .lineWidth(color === red ? 2 : 0.6)
          .moveTo(left, top)
          .lineTo(right, top)
          .stroke();
      const newPage = () => {
        pdf.addPage();
        text(document.issuer.name, left, 32, 300, 12);
        text(reference, 330, 32, 223, 9, muted, "right");
        rule(56, red);
        y = 76;
      };
      const space = (needed: number) => {
        if (needed > 640) throw new Error("Document section exceeds export limit");
        if (y + needed > 758) newPage();
      };
      const paragraph = (value: string, size = 10, color = muted) => {
        const h = height(value, width, size);
        space(h + 12);
        text(value, left, y, width, size, color);
        y += h + 12;
      };
      const pair = (label: string, value: string, emphasis = false) => {
        const h =
          Math.max(height(label, 205), height(value, 245, emphasis ? 12 : 10)) + 18;
        space(h);
        if (emphasis) pdf.rect(left, y - 4, width, h).fill(grey);
        text(label, left + 10, y + 3, 205, emphasis ? 12 : 10);
        text(value, left + 222, y + 3, width - 232, emphasis ? 12 : 10, ink, "right");
        y += h;
        rule(y - 4);
      };
      const issuerHeight = Math.max(
        height(document.issuer.name, 255, 22) + 34,
        height(document.issuer.address, 220, 9) + 24,
      );
      text(document.issuer.name, left, y, 255, 22);
      text(
        "Built on Trust, Driven by Quality.",
        left,
        y + height(document.issuer.name, 255, 22) + 8,
        255,
        9,
        muted,
      );
      text(document.issuer.address, 333, y, 220, 9, muted);
      text(
        "08136075567",
        333,
        y + height(document.issuer.address, 220, 9) + 8,
        220,
        9,
        muted,
      );
      y += issuerHeight + 18;
      rule(y, red);
      y += 24;
      paragraph(invoice ? "INVOICE" : "PAYMENT RECEIPT", 22, ink);
      if (invoice) {
        paragraph(
          `${reference} | ${document.status === "PAID" ? "Paid" : document.status === "VOID" ? "Void" : "Issued"}`,
          11,
          ink,
        );
        paragraph(
          `Issued: ${date(document.issuedAt)}${document.dueAt ? `    Due: ${date(document.dueAt)}` : ""}`,
          10,
        );
        paragraph(`Bill to: ${document.billTo.name}`, 11, ink);
        if (document.billTo.address) paragraph(document.billTo.address);
        paragraph(`Account reference: ${document.billTo.reference}`, 9);
        paragraph(`${document.source.description}: ${document.source.reference}`, 10);
        if (document.status === "VOID")
          paragraph("This invoice is void. Do not use it to make a payment.", 11, red);
        const tableHeader = () => {
          space(36);
          pdf.rect(left, y, width, 30).fill(grey);
          text("Description / quantity x unit price", left + 10, y + 8, 325, 10);
          text("Amount", 400, y + 8, 143, 10, ink, "right");
          y += 39;
        };
        tableHeader();
        for (const item of document.lines) {
          const detail = `${item.quantity} x ${documentMoney(item.unitPriceKobo)}`;
          const h = height(item.description, 320, 10) + height(detail, 320, 9) + 23;
          if (y + h > 758) {
            newPage();
            tableHeader();
          }
          text(item.description, left + 10, y, 320, 10);
          text(
            detail,
            left + 10,
            y + height(item.description, 320, 10) + 5,
            320,
            9,
            muted,
          );
          text(documentMoney(item.subtotalKobo), 384, y, 159, 10, ink, "right");
          y += h;
          rule(y - 9);
        }
        y += 6;
        space(180);
        if (BigInt(document.discountKobo) > 0n)
          pair("Discount", `- ${documentMoney(document.discountKobo)}`);
        if (BigInt(document.deliveryKobo) > 0n)
          pair("Delivery", documentMoney(document.deliveryKobo));
        pair("Subtotal", documentMoney(document.subtotalKobo));
        pair("Tax", documentMoney(document.taxKobo));
        pair("Deposit credit applied", documentMoney(document.depositCreditKobo));
        pair("Invoice total", documentMoney(document.totalKobo), true);
        y += 16;
        if (document.detailBasis === "LEGACY_SUMMARY")
          paragraph(
            "A historical itemized breakdown is unavailable. This document shows the recorded invoice subtotal and adjustments.",
          );
        else if (document.detailBasis === "SOURCE_RECORDS")
          paragraph(
            "Historical invoice: details are drawn from its recorded source. Unrecorded billing details are omitted.",
          );
        if (document.issuer.paymentTerms) paragraph(document.issuer.paymentTerms);
        paragraph(
          "Keep this invoice for your records. A separate receipt records a confirmed payment.",
        );
      } else {
        pair("Payment reference", reference);
        pair("Confirmed", date(document.confirmedAt));
        pair("Method", document.method);
        y += 20;
        space(100);
        pdf.rect(left, y, width, 92).fill(ink);
        rule(y, red);
        text("Amount received", left + 18, y + 15, 450, 11, "#FFFFFF");
        text(documentMoney(document.amountKobo), left + 18, y + 40, 465, 26, "#FFFFFF");
        y += 112;
        pair(document.source.description, document.source.reference);
        pair("Account reference", document.customerReference);
        pair("Refunds completed", documentMoney(document.refundedKobo));
        y += 18;
        paragraph(
          "This receipt records the confirmed payment above. It does not confirm delivery, completion of service or full settlement of an invoice.",
        );
        paragraph(
          "Refund information reflects completed refunds when this document was generated. Pending refunds are not included.",
        );
      }
      const pages = pdf.bufferedPageRange();
      if (pages.count > 50) throw new Error("Document exceeds page limit");
      for (let index = 0; index < pages.count; index++) {
        pdf.switchToPage(index);
        rule(787);
        pdf
          .fontSize(8)
          .fillColor(muted)
          .text("Allied AutoTech | alliedautotech26@gmail.com", left, 798, {
            width: 390,
            height: 18,
            lineBreak: false,
          });
        pdf.text(`${index + 1} / ${pages.count}`, 495, 798, {
          width: 58,
          height: 18,
          align: "right",
          lineBreak: false,
        });
      }
      pdf.end();
    } catch (error) {
      pdf.destroy();
      reject(error);
    }
  });
}
