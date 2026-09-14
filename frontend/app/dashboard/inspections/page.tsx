import type { Metadata } from "next";
import { InspectionHistory } from "../../components/inspection-history";
export const metadata: Metadata = { title: "Vehicle inspections" };
export default function Page() {
  return <InspectionHistory />;
}
