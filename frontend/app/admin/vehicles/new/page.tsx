import type { Metadata } from "next";
import { NewVehicleRecord } from "@/app/components/vehicle-record-form";
import "./vehicle-create.css";
export const metadata: Metadata = { title: "Add vehicle record" };
export default function Page() {
  return <NewVehicleRecord />;
}
