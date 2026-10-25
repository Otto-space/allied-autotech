import type { Metadata } from "next";
import { WorkNotifications } from "@/app/components/work-notifications";
import "@/app/dashboard/notifications/notifications.css";
import "./notifications.css";
export const metadata: Metadata = { title: "Notifications" };
export default function Page() {
  return <WorkNotifications />;
}
