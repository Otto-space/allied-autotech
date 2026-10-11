import type { Metadata } from "next";
import { BookingDetail } from "../../../components/booking-detail";
import "./booking-detail.css";
export const metadata: Metadata = {
  title: "Booking details",
  robots: { index: false, follow: false },
};
export default async function BookingPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return <BookingDetail key={bookingId} bookingId={bookingId} />;
}
