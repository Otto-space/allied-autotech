import type { Metadata } from "next";
import { BookingDetail } from "../../../components/booking-detail";
export const metadata: Metadata = {
  title: "Booking details",
  robots: { index: false, follow: false },
};
export default async function BookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  return <BookingDetail bookingId={(await params).bookingId} />;
}
