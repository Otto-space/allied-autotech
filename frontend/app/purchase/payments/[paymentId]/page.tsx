import { notFound } from "next/navigation";
import { z } from "zod";
import { PurchasePaymentPage } from "../../../components/purchase-records";
export default async function Page({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  if (!z.uuid().safeParse(paymentId).success) notFound();
  return <PurchasePaymentPage paymentId={paymentId} />;
}
