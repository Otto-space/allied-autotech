import type { Metadata } from "next";
import { CustomerVehicles } from "../../components/customer-vehicles";
export const metadata: Metadata = {
  title: "Your vehicles",
  robots: { index: false, follow: false },
};
export default function CustomerVehiclesPage() {
  return <CustomerVehicles />;
}
