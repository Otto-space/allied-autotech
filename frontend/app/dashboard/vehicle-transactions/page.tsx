import type { Metadata } from "next";
import { VehicleTransactions } from "../../components/vehicle-transactions";
export const metadata: Metadata = { title: "Vehicle enquiries & purchases" };
export default function Page() {
  return <VehicleTransactions />;
}
