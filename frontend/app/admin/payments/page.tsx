import type { Metadata } from "next";
import { StaffPayments } from "@/app/components/staff-payments";
import { FinanceAccess } from "@/app/components/finance-access";
export const metadata: Metadata = { title: "Manage payment records" };
export default function Page() {
  return (
    <FinanceAccess>
      <StaffPayments />
    </FinanceAccess>
  );
}
