import type { Metadata } from "next";
import { AuditLog } from "@/app/components/audit-log";
import "./audit.css";
export const metadata: Metadata = { title: "Audit log" };
export default function AuditPage() {
  return <AuditLog />;
}
