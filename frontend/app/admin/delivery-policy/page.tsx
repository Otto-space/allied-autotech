import type { Metadata } from "next";
import { DeliveryPolicy } from "@/app/components/delivery-policy";
import "./delivery-policy.css";
export const metadata: Metadata = { title: "Delivery setup" };
export default function Page() {
  return <DeliveryPolicy />;
}
