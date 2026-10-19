import { StaffInventory } from "@/app/components/staff-inventory";
import type { Metadata } from "next";
import "../services/services.css";
import "./inventory.css";
export const metadata: Metadata = { title: "Product inventory" };
export default function Page() {
  return <StaffInventory />;
}
