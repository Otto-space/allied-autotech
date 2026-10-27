import type { Metadata } from "next";
import { BookingCapacity } from "@/app/components/booking-capacity";
import "./booking-capacity.css";
export const metadata: Metadata = { title: "Booking capacity" };
export default function Page() {
  return <BookingCapacity />;
}
