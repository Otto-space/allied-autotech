"use client";
import { useAccountSession } from "./dashboard-shell";
import {
  AccountNotificationInbox,
  AccountNotificationPreferences,
} from "./account-notifications";

export function CustomerNotifications() {
  const session = useAccountSession();
  if (!session || session.user.role !== "CUSTOMER") return null;
  return (
    <div className="customer-notifications" key={session.user.id}>
      <header className="cn-page-heading">
        <h1>Notifications</h1>
        <p>Read your account updates and manage optional delivery.</p>
      </header>
      <div className="cn-layout">
        <AccountNotificationInbox userId={session.user.id} />
        <AccountNotificationPreferences userId={session.user.id} />
      </div>
    </div>
  );
}
