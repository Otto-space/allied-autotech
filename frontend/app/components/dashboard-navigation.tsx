"use client";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { isDashboardDestination, type DashboardGroup } from "@/lib/dashboard-navigation";
import { NotificationBadge } from "./notification-badge";

export function DashboardNavigation({
  groups,
  pathname,
  onNavigate,
  label,
  collapsed = false,
  onExpand,
  unreadCounts = {},
}: {
  groups: DashboardGroup[];
  pathname: string;
  onNavigate: () => void;
  label: string;
  collapsed?: boolean;
  onExpand?: () => void;
  unreadCounts?: Readonly<Record<string, number>>;
}) {
  const pendingGroup = useRef<string | null>(null);
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (collapsed || !pendingGroup.current) return;
    const group = navigation.current?.querySelector<HTMLDetailsElement>(
      `#dashboard-group-${CSS.escape(pendingGroup.current)}`,
    );
    if (group) {
      group.open = true;
      group.querySelector("summary")?.focus();
    }
    pendingGroup.current = null;
  }, [collapsed]);
  const activeHref = groups
    .flatMap((group) => group.links)
    .filter((link) => isDashboardDestination(pathname, link.href))
    .reduce((match, link) => (link.href.length > match.length ? link.href : match), "");
  return (
    <nav className="side-nav" aria-label={label} key={pathname} ref={navigation}>
      {groups.map((group) => {
        const active = group.links.some((link) => link.href === activeHref);
        const destination = group.links[0];
        const hasUnread = group.links.some((link) => (unreadCounts[link.href] ?? 0) > 0);
        if (!destination) return null;
        if (group.links.length === 1)
          return (
            <Link
              key={group.id}
              href={destination.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              aria-label={
                hasUnread
                  ? `${group.label}, ${unreadCounts[destination.href]} unread updates`
                  : group.label
              }
              title={collapsed ? group.label : undefined}
              onClick={onNavigate}
            >
              <group.icon size={20} aria-hidden="true" />
              <span>{group.label}</span>
              <NotificationBadge
                count={unreadCounts[destination.href] ?? 0}
                dot={collapsed}
              />
            </Link>
          );
        if (collapsed)
          return (
            <button
              key={group.id}
              className="dashboard-nav-compact"
              aria-label={`Open ${group.label} navigation${hasUnread ? ", unread updates" : ""}`}
              title={group.label}
              aria-expanded={false}
              data-active={active}
              onClick={() => {
                pendingGroup.current = group.id;
                onExpand?.();
              }}
            >
              <group.icon size={20} aria-hidden="true" />
              <NotificationBadge count={hasUnread ? 1 : 0} dot />
            </button>
          );
        return (
          <details
            key={group.id}
            id={`dashboard-group-${group.id}`}
            open={active}
            className="dashboard-nav-group"
          >
            <summary
              aria-label={hasUnread ? `${group.label}, unread updates` : undefined}
            >
              <group.icon size={20} aria-hidden="true" />
              <span>{group.label}</span>
              <NotificationBadge count={hasUnread ? 1 : 0} dot />
              <ChevronDown className="nav-chevron" size={15} aria-hidden="true" />
            </summary>
            <div className="dashboard-nav-children">
              {group.links.map((link) => (
                <Link
                  href={link.href}
                  key={link.href}
                  prefetch={false}
                  aria-current={link.href === activeHref ? "page" : undefined}
                  aria-label={
                    (unreadCounts[link.href] ?? 0) > 0
                      ? `${link.label}, ${unreadCounts[link.href]} unread updates`
                      : undefined
                  }
                  onClick={onNavigate}
                >
                  {link.label}
                  <NotificationBadge count={unreadCounts[link.href] ?? 0} />
                </Link>
              ))}
            </div>
          </details>
        );
      })}
    </nav>
  );
}

export function DashboardPageSearch({ groups }: { groups: DashboardGroup[] }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const term = query.trim().toLocaleLowerCase();
  const matches = groups
    .flatMap((group) => group.links.map((link) => ({ ...link, group: group.label })))
    .filter((link) => `${link.group} ${link.label}`.toLocaleLowerCase().includes(term));
  return (
    <div
      className="dashboard-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <Search size={18} aria-hidden="true" />
      <input
        type="search"
        aria-label="Search dashboard pages"
        placeholder="Find a page"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setFocused(true);
        }}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setQuery("");
            setFocused(false);
          }
        }}
      />
      {term && focused && (
        <div className="dashboard-search-results">
          <p role="status">
            {matches.length ? `${matches.length} matching pages` : "No matching pages"}
          </p>
          {matches.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              onClick={() => {
                setQuery("");
                setFocused(false);
              }}
            >
              <span>{link.label}</span>
              <small>{link.group}</small>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
