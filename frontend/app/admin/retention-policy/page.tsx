import type { Metadata } from "next";
import { RetentionPolicy } from "@/app/components/retention-policy";
import "./retention-policy.css";
export const metadata: Metadata = { title: "Retention policy" };
export default function Page() {
  return <RetentionPolicy />;
}
