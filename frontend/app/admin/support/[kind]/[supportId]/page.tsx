import { notFound } from "next/navigation";
import { z } from "zod";
import { SupportThread } from "@/app/components/support-thread";
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
  return <SupportThread key={`${kind}:${supportId}`} kind={kind} id={supportId} staff />;
}
