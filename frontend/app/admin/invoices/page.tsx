import { StaffInvoices } from "@/app/components/staff-invoices";
import { FinanceAccess } from "@/app/components/finance-access";
export default function Page() {
  return (
    <FinanceAccess>
      <StaffInvoices />
    </FinanceAccess>
  );
}
