"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useAccountSession } from "./dashboard-shell";
import {
  AccountNotificationInbox,
  AccountNotificationPreferences,
} from "./account-notifications";

export function WorkNotifications() {
  const session = useAccountSession();
  if (!session) return null;
  const { id, role } = session.user;
  if (role !== "STAFF" && role !== "ADMIN" && role !== "SUPER_ADMIN") return null;
  return (
    <div className="customer-notifications work-notifications" key={`${id}:${role}`}>
      <nav aria-label="Breadcrumb" className="wn-breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={16} aria-hidden="true" />
            <span aria-current="page">My notifications</span>
          </li>
        </ol>
      </nav>
      <header className="cn-page-heading">
        <h1>My notifications</h1>
        <p>Read your account updates and manage optional delivery.</p>
      </header>
      <div className="cn-layout">
        <AccountNotificationInbox userId={id} role={role} />
        <AccountNotificationPreferences userId={id} role={role} />
      </div>
    </div>
  );
}
