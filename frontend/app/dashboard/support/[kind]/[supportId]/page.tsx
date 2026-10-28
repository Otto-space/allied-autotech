import { notFound } from "next/navigation";
import { z } from "zod";
import { SupportThread } from "@/app/components/support-thread";
import "../../conversation.css";
export const metadata = { title: "Support conversation" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; supportId: string }>;
  searchParams: Promise<{ messageId?: string | string[] }>;
}) {
  const { kind, supportId } = await params;
  const { messageId } = await searchParams;
  if (messageId !== undefined && !z.uuid().safeParse(messageId).success) notFound();
  if (
    (kind !== "enquiries" && kind !== "complaints") ||
    !z.uuid().safeParse(supportId).success
  )
    notFound();
  return (
    <SupportThread
      key={`${kind}:${supportId}:${messageId ?? ""}`}
      kind={kind}
      id={supportId}
      messageId={messageId as string | undefined}
    />
  );
}
