import type { Metadata } from "next";
import { CustomerNotifications } from "../../components/customer-notifications";
import "./notifications.css";
export const metadata: Metadata = { title: "Notifications" };
export default function Page() {
  return <CustomerNotifications />;
}
