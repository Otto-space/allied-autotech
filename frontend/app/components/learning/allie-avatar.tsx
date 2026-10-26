export function AllieAvatar({
  state = "idle",
}: {
  state?: "idle" | "searching" | "helpful" | "unavailable" | "success";
}) {
  return (
    <svg
      className="allie-avatar"
      data-state={state}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M32 13V7" stroke="#c32026" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3" fill="#c32026" />
      <rect x="3" y="27" width="7" height="17" rx="3.5" fill="#414951" />
      <rect x="54" y="27" width="7" height="17" rx="3.5" fill="#414951" />
      <rect
        x="8"
        y="15"
        width="48"
        height="41"
        rx="18"
        fill="#fff"
        stroke="#88939e"
        strokeWidth="1.5"
      />
      <path
        d="M17 49c8 4 22 4 30 0"
        stroke="#e2e5e8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="14" y="24" width="36" height="23" rx="11.5" fill="#172129" />
      <circle className="allie-eye" cx="25" cy="35" r="3.2" fill="#e0f5fc" />
      <circle className="allie-eye" cx="39" cy="35" r="3.2" fill="#e0f5fc" />
    </svg>
  );
}
