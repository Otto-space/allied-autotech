import type { Metadata } from "next";
import { NotificationsPanel } from "@/app/components/notifications-panel";
export const metadata: Metadata = { title: "My notifications" };
export default function Page() {
  return <NotificationsPanel audience="staff" />;
}
