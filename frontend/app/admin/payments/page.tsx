import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffPayments } from "@/app/components/staff-payments";
import { FinanceAccess } from "@/app/components/finance-access";
import "../inspections/inspections.css";
import "./payments.css";
export const metadata: Metadata = { title: "Manage payment records" };
export default function Page() {
  return (
    <FinanceAccess>
      <Suspense fallback={<p role="status">Loading payment records…</p>}>
        <StaffPayments />
      </Suspense>
    </FinanceAccess>
  );
}
