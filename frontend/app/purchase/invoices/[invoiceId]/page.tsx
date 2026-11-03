import { notFound } from "next/navigation";
import { z } from "zod";
import { PurchaseInvoicePage } from "../../../components/purchase-invoice";
export default async function Page({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  if (!z.uuid().safeParse(invoiceId).success) notFound();
  return <PurchaseInvoicePage invoiceId={invoiceId} />;
}
