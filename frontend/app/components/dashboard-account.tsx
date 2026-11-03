"use client";
import Image from "next/image";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionState } from "@/lib/api/types";
import { parseProfile } from "@/lib/api/profile-schemas";
import { useResource } from "@/lib/api/use-resource";
import { useOwnStaffPermissions } from "./dashboard-shell";
import "./dashboard-account.css";

import { PROFILE_UPDATED } from "@/lib/api/profile-events";
export function DashboardAccount({ session }: { session: SessionState }) {
  return session.user.role === "CUSTOMER" ? (
    <CustomerAccount key={session.user.id} session={session} />
  ) : (
    <WorkAccount key={session.user.id} session={session} />
  );
}
type Props = Parameters<typeof DashboardAccount>[0];
function CustomerAccount(props: Props) {
  const parseOwned = useCallback(
    (value: unknown) => {
      const profile = parseProfile(value);
      if (profile.user.id !== props.session.user.id)
        throw Error("Profile owner mismatch");
      return profile;
    },
    [props.session.user.id],
  );
  const resource = useResource("/customers/profile", parseOwned);
  useEffect(() => {
    window.addEventListener(PROFILE_UPDATED, resource.refresh);
    return () => window.removeEventListener(PROFILE_UPDATED, resource.refresh);
  }, [resource.refresh]);
  const profile =
    !resource.loading && !resource.error && !resource.refreshError
      ? resource.data
      : undefined;
  return (
    <AccountMenu
      {...props}
      name={profile && [profile.firstName, profile.lastName].filter(Boolean).join(" ")}
      photo={profile?.photo?.url}
      profileHref="/dashboard/profile"
    />
  );
}
function WorkAccount(props: Props) {
  const access = useOwnStaffPermissions();
  const record =
    !access.loading &&
    !access.error &&
    !access.refreshError &&
    access.data?.id === props.session.user.id
      ? access.data.staffProfile
      : undefined;
  return (
    <AccountMenu
      {...props}
      name={record && [record.firstName, record.lastName].filter(Boolean).join(" ")}
      profileHref="/admin/profile"
    />
  );
}
function AccountMenu({
  session,
  name,
  photo,
  profileHref,
}: Props & {
  name?: string | null;
  photo?: string;
  profileHref?: string;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [failedPhoto, setFailedPhoto] = useState<string>();
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target))
        menu.current?.removeAttribute("open");
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return (
    <details
      className="dashboard-account-menu"
      ref={menu}
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          event.stopPropagation();
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary className="dashboard-account-link" aria-label="Account options">
        <span className="dashboard-avatar" aria-hidden="true">
          {photo && failedPhoto !== photo ? (
            <Image
              src={photo}
              overrideSrc={photo}
              width={36}
              height={36}
              alt=""
              unoptimized
              onError={() => setFailedPhoto(photo)}
            />
          ) : name?.trim() ? (
            <span className="dashboard-avatar-initials">
              {name
                .trim()
                .split(/\s+/u)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => Array.from(part)[0])
                .join("")
                .toLocaleUpperCase()}
            </span>
          ) : (
            <UserRound size={19} />
          )}
        </span>
        <span className="dashboard-account-email">{name || "My account"}</span>
      </summary>
      <nav
        className="dashboard-account-popover"
        aria-label="Your account"
        onClick={(event) => {
          if ((event.target as Element).closest("a"))
            menu.current?.removeAttribute("open");
        }}
      >
        <p>
          {name || "My account"}
          <small>{session.user.email}</small>
        </p>
        {profileHref && (
          <Link href={profileHref} prefetch={false}>
            My profile
          </Link>
        )}
        <Link
          href={
            session.user.role === "CUSTOMER" ? "/dashboard/security" : "/admin/security"
          }
          prefetch={false}
        >
          Account security
        </Link>
      </nav>
    </details>
  );
}
