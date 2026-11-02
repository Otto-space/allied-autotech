import { getPublicCapabilities } from "@/lib/api/public-capabilities-server";
import { redirect } from "next/navigation";
import { DashboardShell } from "../components/dashboard-shell";
import type { Metadata } from "next";
import { AssetStorageProvider } from "../components/asset-storage-context";
import { assetStorageHosts } from "@/lib/assets";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Layout({ children }: { children: React.ReactNode }) {
  if ((await getPublicCapabilities()).mode === "catalogue") redirect("/contact#enquiry");
  return (
    <AssetStorageProvider hosts={assetStorageHosts(process.env.ASSET_STORAGE_HOSTS)}>
      <DashboardShell>{children}</DashboardShell>
    </AssetStorageProvider>
  );
}
