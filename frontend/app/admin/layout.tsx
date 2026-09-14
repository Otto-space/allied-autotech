import type { Metadata } from "next";
import { DashboardShell } from "../components/dashboard-shell";
export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell audience="staff">{children}</DashboardShell>;
}
