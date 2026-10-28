"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Settings2 } from "lucide-react";
import {
  AccountNotificationInbox,
  AccountNotificationPreferences,
} from "./account-notifications";

export function NotificationWorkspace({
  userId,
  role = "CUSTOMER",
}: {
  userId: string;
  role?: "CUSTOMER" | "STAFF" | "ADMIN" | "SUPER_ADMIN";
}) {
  const [settings, setSettings] = useState(false);
  const [settingsVisited, setSettingsVisited] = useState(false);
  return (
    <>
      <header className="cn-page-heading">
        <div>
          <h1>Notifications</h1>
          <p>
            {role === "CUSTOMER"
              ? "Keep track of your account, requests and service updates."
              : "Keep track of your account and work updates."}
            {role === "CUSTOMER" && (
              <>
                {" "}
                <Link className="cn-help-link" href="/help">
                  Help centre
                </Link>
              </>
            )}
          </p>
        </div>
        <button
          className="button secondary"
          aria-expanded={settings}
          aria-controls="notification-settings"
          onClick={() => {
            setSettingsVisited(true);
            setSettings(!settings);
          }}
        >
          {settings ? (
            <ArrowLeft size={17} aria-hidden="true" />
          ) : (
            <Settings2 size={17} aria-hidden="true" />
          )}
          {settings ? "Hide settings" : "Notification settings"}
        </button>
      </header>
      <div className="cn-layout">
        <div id="notification-settings" hidden={!settings}>
          {settingsVisited && (
            <AccountNotificationPreferences userId={userId} role={role} />
          )}
        </div>
        <AccountNotificationInbox userId={userId} role={role} />
      </div>
    </>
  );
}
