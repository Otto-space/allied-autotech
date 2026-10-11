import "../garage.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GarageImages } from "../../../components/garage-images";
export const metadata: Metadata = {
  title: "Vehicle photos",
  robots: { index: false, follow: false },
};
export default async function GarageImagesPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      vehicleId,
    )
  )
    notFound();
  return <GarageImages vehicleId={vehicleId} />;
}
