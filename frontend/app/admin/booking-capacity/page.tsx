import type { Metadata } from "next";
import { BookingCapacity } from "@/app/components/booking-capacity";
export const metadata: Metadata = { title: "Booking capacity" };
export default function Page() {
  return <BookingCapacity />;
}
