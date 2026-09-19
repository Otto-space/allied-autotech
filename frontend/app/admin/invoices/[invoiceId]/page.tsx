import { notFound } from "next/navigation";
import { z } from "zod";
import { StaffInvoiceDetail } from "@/app/components/staff-invoice-detail";
import { FinanceAccess } from "@/app/components/finance-access";
export default async function Page({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  if (!z.string().uuid().safeParse(invoiceId).success) notFound();
  return (
    <FinanceAccess>
      <StaffInvoiceDetail invoiceId={invoiceId} />
    </FinanceAccess>
  );
}
