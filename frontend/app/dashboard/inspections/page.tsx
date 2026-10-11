import type { Metadata } from "next";
import "./inspections.css";
import { InspectionHistory } from "../../components/inspection-history";
export const metadata: Metadata = {
  title: "Vehicle inspections",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <InspectionHistory />;
}
