import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StaffAccountDetail } from "@/app/components/staff-account-detail";
import "./staff-account.css";
export const metadata: Metadata = { title: "Staff account" };
export default async function Page({
  params,
}: {
  params: Promise<{ staffUserId: string }>;
}) {
  const { staffUserId } = await params;
  if (!z.uuid().safeParse(staffUserId).success) notFound();
  return <StaffAccountDetail id={staffUserId} />;
}
