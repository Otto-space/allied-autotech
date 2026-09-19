import Link from "next/link";
import type { Metadata } from "next";
import { NewVehicleRecord } from "@/app/components/vehicle-record-form";
export const metadata: Metadata = { title: "Add vehicle record" };
export default function Page() {
  return (
    <>
      <Link className="text-link" href="/admin/vehicles">
        Back to vehicle stock
      </Link>
      <h1>Add vehicle record</h1>
      <p>Record the stock vehicle first, then create its sale listing.</p>
      <NewVehicleRecord />
    </>
  );
}
