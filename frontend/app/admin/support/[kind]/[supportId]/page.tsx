import { notFound } from "next/navigation";
import { z } from "zod";
import { Suspense } from "react";
import { WorkSupportDetail } from "@/app/components/work-support-detail";
import "../../../inspections/inspections.css";
import "./support-detail.css";
export const metadata = { title: "Support conversation" };
export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; supportId: string }>;
}) {
  const { kind, supportId } = await params;
  if (
    (kind !== "enquiries" && kind !== "complaints") ||
    !z.uuid().safeParse(supportId).success
  )
    notFound();
  return (
    <Suspense fallback={<p role="status">Loading conversation…</p>}>
      <WorkSupportDetail kind={kind} id={supportId.toLowerCase()} />
    </Suspense>
  );
}
