import type { Metadata } from "next";
import { DashboardShell } from "../components/dashboard-shell";
import { AssetStorageProvider } from "../components/asset-storage-context";
import { assetStorageHosts } from "@/lib/assets";
export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AssetStorageProvider hosts={assetStorageHosts(process.env.ASSET_STORAGE_HOSTS)}>
      <DashboardShell audience="staff">{children}</DashboardShell>
    </AssetStorageProvider>
  );
}
