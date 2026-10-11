import type { Metadata } from "next";
import { InvoiceDetail } from "../../../components/invoice-detail";
export const metadata: Metadata = { title: "Invoice details" };
export default async function Page({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return <InvoiceDetail key={invoiceId} invoiceId={invoiceId} />;
}
