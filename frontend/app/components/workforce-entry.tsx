"use client";
import { useState } from "react";
import Link from "next/link";
import { useAccountSession } from "./dashboard-shell";
import { WorkforceAccessPanel } from "./workforce-access-panel";
import { Feedback } from "./feedback";
export function WorkforceEntry() {
  const session = useAccountSession();
  const [userId, setUserId] = useState("");
  if (session?.user.role !== "SUPER_ADMIN")
    return (
      <>
        <h1>Responsibility management unavailable</h1>
        <Feedback message="Responsibility workspace access requires enrollment or an owner access review." />
        <Link className="button secondary" href="/admin">
          Return to overview
        </Link>
      </>
    );
  return (
    <>
      <h1>Team responsibilities</h1>
      <p>
        Review a verified staff account before changing its responsibilities. Workforce
        positions do not create employees or accounts.
      </p>
      <p>
        Use the staff directory to find a verified account and open its responsibility
        details. You can also review an account below if you already have its reference.
      </p>
      <p>
        <Link className="button secondary" href="/admin/staff">
          Find a staff account
        </Link>
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setUserId(String(new FormData(event.currentTarget).get("userId")));
        }}
      >
        <div className="field">
          <label htmlFor="workforce-target">Staff user reference</label>
          <input
            id="workforce-target"
            name="userId"
            required
            pattern="[0-9a-fA-F-]{36}"
          />
        </div>
        <button className="button">Review staff responsibilities</button>
      </form>
      {userId && <WorkforceAccessPanel key={userId} userId={userId} />}
    </>
  );
}
