import type { Metadata } from "next";
import { OrderDetail } from "../../../components/order-detail";
export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false, follow: false },
};
export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <OrderDetail key={orderId} orderId={orderId} />;
}
