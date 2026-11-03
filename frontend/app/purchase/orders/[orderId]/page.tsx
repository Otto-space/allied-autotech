import { notFound } from "next/navigation";
import { z } from "zod";
import { PurchaseOrderPage } from "../../../components/purchase-records";
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  if (!z.uuid().safeParse(orderId).success) notFound();
  return <PurchaseOrderPage orderId={orderId} />;
}
