import type { Metadata } from "next";
import { ReservationTermsPolicy } from "@/app/components/reservation-terms-policy";
export const metadata: Metadata = { title: "Vehicle reservation agreements" };
export default function Page() {
  return <ReservationTermsPolicy />;
}
