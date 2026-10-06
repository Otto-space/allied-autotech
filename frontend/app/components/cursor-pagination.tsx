"use client";
import { useState } from "react";

export function useCursorPage() {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  return {
    cursor: cursors.at(-1),
    page: cursors.length,
    previous: () =>
      setCursors((value) => (value.length > 1 ? value.slice(0, -1) : value)),
    next: (cursor: string) => setCursors((value) => [...value, cursor]),
    reset: () => setCursors([undefined]),
  };
}

export function CursorPagination({
  pagination,
  nextCursor,
  disabled,
  label,
}: {
  pagination: ReturnType<typeof useCursorPage>;
  nextCursor?: string;
  disabled: boolean;
  label: string;
}) {
  return (
    <nav className="pagination" aria-label={`${label} pages`}>
      <input
        hidden
        aria-hidden="true"
        tabIndex={-1}
        data-draft-context
        name={`draft-page:${label}`}
        value={pagination.cursor ?? ""}
        onChange={(event) => {
          const cursor = event.target.value;
          if (cursor === (pagination.cursor ?? "")) return;
          if (!cursor) pagination.reset();
          else if (/^[A-Za-z0-9_-]{1,1024}$/.test(cursor)) pagination.next(cursor);
        }}
      />
      <button
        type="button"
        className="button secondary"
        disabled={pagination.page === 1 || disabled}
        onClick={pagination.previous}
      >
        Previous
      </button>
      <span>Page {pagination.page}</span>
      <button
        type="button"
        className="button secondary"
        disabled={!nextCursor || disabled}
        onClick={() => {
          if (nextCursor) pagination.next(nextCursor);
        }}
      >
        Next
      </button>
    </nav>
  );
}
