import type { Metadata } from "next";
import { CustomerDirectoryDetail } from "@/app/components/customer-directory-detail";
export const metadata: Metadata = { title: "Customer details" };
export default async function Page({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  return <CustomerDirectoryDetail customerId={customerId} />;
}
