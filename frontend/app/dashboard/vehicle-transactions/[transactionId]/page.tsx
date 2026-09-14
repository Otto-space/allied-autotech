import type { Metadata } from "next";
import { VehicleTransactionDetail } from "../../../components/vehicle-transaction-detail";
export const metadata: Metadata = { title: "Vehicle purchase progress" };
export default async function Page({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  return <VehicleTransactionDetail transactionId={(await params).transactionId} />;
}
