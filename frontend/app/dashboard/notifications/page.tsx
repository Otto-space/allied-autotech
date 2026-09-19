import type { Metadata } from "next";
import { NotificationsPanel } from "../../components/notifications-panel";
export const metadata: Metadata = { title: "Notifications" };
export default function Page() {
  return <NotificationsPanel />;
}
