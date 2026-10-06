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
      <p>Save the vehicle details, add its photos, then create its sale listing.</p>
      <p className="notice">
        Vehicle photos are added after this record is saved. You will go straight to the
        photo editor, where you can upload images and choose the primary photo.
      </p>
      <NewVehicleRecord />
    </>
  );
}
