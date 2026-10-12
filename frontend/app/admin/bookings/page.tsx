import type { Metadata } from "next";
import { StaffBookings } from "../../components/staff-bookings";
import "./bookings.css";
export const metadata: Metadata = { title: "Workshop bookings" };
export default function Page() {
  return <StaffBookings />;
}
