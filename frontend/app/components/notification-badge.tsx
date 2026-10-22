export function NotificationBadge({
  count,
  dot = false,
}: {
  count: number;
  dot?: boolean;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={`notification-badge${dot ? " notification-badge-dot" : ""}`}
      aria-hidden="true"
    >
      {dot ? null : count > 99 ? "99+" : count}
    </span>
  );
}
