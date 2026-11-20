import type { Metadata } from "next";
import { AuditLog } from "@/app/components/audit-log";
import "../../audit/audit.css";
export const metadata: Metadata = { title: "Access change history" };
export default function AccessHistoryPage() {
  return <AuditLog accessChanges />;
}
