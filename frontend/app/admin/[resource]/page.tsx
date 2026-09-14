import { notFound } from "next/navigation";
import { adminResources } from "@/lib/admin/resources";
import { AdminResourcePanel } from "../../components/admin-resource";
export default async function AdminResourcePage({
  params,
}: Readonly<{
  params: Promise<{ resource: string }>;
}>) {
  const key = (await params).resource;
  if (!Object.hasOwn(adminResources, key)) notFound();
  return <AdminResourcePanel config={adminResources[key]} />;
}
