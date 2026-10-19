import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { WorkCustomerDetail } from "@/app/components/work-customer-detail";
import "../../inspections/inspections.css";
import "../customers.css";
import "./customer-detail.css";
export const metadata: Metadata = { title: "Customer details" };
export default async function Page({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  if (!z.uuid().safeParse(customerId).success) notFound();
  return (
    <Suspense fallback={<p role="status">Loading customer details…</p>}>
      <WorkCustomerDetail customerId={customerId.toLowerCase()} />
    </Suspense>
  );
}
