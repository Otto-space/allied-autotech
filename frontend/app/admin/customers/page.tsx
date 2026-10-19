import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkCustomers } from "@/app/components/work-customers";
import "../inspections/inspections.css";
import "./customers.css";
export const metadata: Metadata = { title: "Customers" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading customers…</p>}>
      <WorkCustomers />
    </Suspense>
  );
}
