"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function RetrySearch() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? "Retrying search…" : "Retry search"}
    </button>
  );
}
