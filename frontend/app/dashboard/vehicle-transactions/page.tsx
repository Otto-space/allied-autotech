import type { Metadata } from "next";
import { VehicleTransactions } from "../../components/vehicle-transactions";
import "./purchases.css";
export const metadata: Metadata = {
  title: "Vehicle enquiries & purchases",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <VehicleTransactions />;
}
