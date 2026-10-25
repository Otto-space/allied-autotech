"use client";
import { useAccountSession } from "./dashboard-shell";
import { NotificationWorkspace } from "./notification-workspace";

export function CustomerNotifications() {
  const session = useAccountSession();
  if (!session || session.user.role !== "CUSTOMER") return null;
  return (
    <div className="customer-notifications" key={session.user.id}>
      <NotificationWorkspace userId={session.user.id} />
    </div>
  );
}
