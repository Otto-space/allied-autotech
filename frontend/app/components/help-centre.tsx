"use client";
import { useState } from "react";
import Link from "next/link";
import { faqs } from "@/lib/business";
export function HelpCentre() {
  const [query, setQuery] = useState("");
  const matches = faqs.filter((faq) =>
    `${faq.question} ${faq.answer} ${faq.keywords}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  return (
    <>
      <div className="field search-field">
        <label htmlFor="faq-search">Search help topics</label>
        <input
          id="faq-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Booking, payments, account access…"
        />
      </div>
      <p className="muted" role="status">
        {matches.length} {matches.length === 1 ? "topic" : "topics"}
      </p>
      <div className="faq-list">
        {matches.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
            <Link className="text-link" href={faq.href}>
              {faq.action} →
            </Link>
          </details>
        ))}
      </div>
      {matches.length === 0 && (
        <div className="empty">
          <h2>No matching topics</h2>
          <p>Try a shorter search, or contact us for help.</p>
          <button className="button secondary" onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      )}
    </>
  );
}
