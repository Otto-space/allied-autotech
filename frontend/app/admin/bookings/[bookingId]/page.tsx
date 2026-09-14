import { notFound } from "next/navigation";
import { z } from "zod";
import { StaffBookingDetail } from "@/app/components/staff-booking-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  if (!z.string().uuid().safeParse(bookingId).success) notFound();
  return <StaffBookingDetail bookingId={bookingId} />;
}
