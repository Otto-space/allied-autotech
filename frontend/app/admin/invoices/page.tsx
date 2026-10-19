import { StaffInvoices } from "@/app/components/staff-invoices";
import { FinanceAccess } from "@/app/components/finance-access";
import type { Metadata } from "next";
import { Suspense } from "react";
import "../inspections/inspections.css";
import "./invoices.css";
export const metadata: Metadata = { title: "Manage invoices" };
export default function Page() {
  return (
    <FinanceAccess>
      <Suspense fallback={<p role="status">Loading invoices…</p>}>
        <StaffInvoices />
      </Suspense>
    </FinanceAccess>
  );
}
