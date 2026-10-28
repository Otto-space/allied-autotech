"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Mail,
  MapPin,
  Phone,
  Search,
} from "lucide-react";
import { z } from "zod";
import { business, faqs } from "@/lib/business";
import { resolveHelpAction, type HelpAccess } from "@/lib/help-actions";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";

const categories = ["All topics", ...new Set(faqs.map((faq) => faq.category))];
const identity = z.object({
  user: z.object({
    id: z.uuid(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  }),
});
type Access = HelpAccess;
function validTopic(value: string) {
  return categories.includes(value) ? value : "All topics";
}
function helpUrl(query: string, topic: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (topic !== "All topics") params.set("topic", topic);
  return `/help${params.size ? `?${params}` : ""}`;
}
function TopicAction({ faq, access }: { faq: (typeof faqs)[number]; access: Access }) {
  const target = resolveHelpAction(faq, access);
  if (!target) return null;
  if ("notice" in target)
    return <span className="help-account-note">{target.notice}</span>;
  const { href, label } = target;
  const external = href.startsWith("https://");
  return (
    <Link
      className="help-text-link"
      href={href}
      {...(external
        ? {
            target: "_blank",
            rel: "noopener noreferrer",
            "aria-label": `${label} (opens in a new tab)`,
          }
        : {})}
    >
      {label}
      {external ? (
        <ArrowUpRight size={16} aria-hidden="true" />
      ) : (
        <ArrowRight size={16} aria-hidden="true" />
      )}
    </Link>
  );
}
export function HelpCentre({
  initialQuery = "",
  initialTopic = "All topics",
}: {
  initialQuery?: string;
  initialTopic?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(validTopic(initialTopic));
  const [access, setAccess] = useState<Access>("checking");
  const [retry, setRetry] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLElement>(null);
  useEffect(() => {
    function back() {
      const params = new URLSearchParams(window.location.search);
      setQuery((params.get("q") ?? "").slice(0, 200));
      setCategory(validTopic(params.get("topic") ?? "All topics"));
    }
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    let pending: AbortController | undefined;
    async function check() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      try {
        const response = await apiRequest("/auth/session", {
          optionalSession: true,
          signal: controller.signal,
        });
        const session = identity.parse(response.data);
        if (!controller.signal.aborted)
          setAccess(session.user.role === "CUSTOMER" ? "customer" : "work");
      } catch (error) {
        if (!controller.signal.aborted)
          setAccess(
            error instanceof ApiError && error.status === 401 ? "anonymous" : "error",
          );
      }
    }
    function changed() {
      setAccess("checking");
      void check();
    }
    void check();
    window.addEventListener(SESSION_CHANGED, changed);
    return () => {
      pending?.abort();
      window.removeEventListener(SESSION_CHANGED, changed);
    };
  }, [retry]);
  function update(nextQuery: string, nextCategory: string, push = false) {
    setQuery(nextQuery);
    setCategory(nextCategory);
    const url = helpUrl(nextQuery, nextCategory);
    if (push) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    if (push)
      requestAnimationFrame(() => {
        results.current?.scrollIntoView({ block: "start", behavior: "instant" });
      });
  }
  function clear() {
    update("", "All topics");
    search.current?.focus();
  }
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = faqs.filter(
    (faq) =>
      (category === "All topics" || faq.category === category) &&
      words.every((word) =>
        `${faq.category} ${faq.question} ${faq.answer} ${faq.keywords}`
          .toLowerCase()
          .includes(word),
      ),
  );
  const filtered = Boolean(query || category !== "All topics");
  const count = (topic: string) =>
    topic === "All topics"
      ? faqs.length
      : faqs.filter((faq) => faq.category === topic).length;
  return (
    <>
      <div className="help-search-band">
        <form
          className="help-wrap help-search-form"
          action="/help"
          method="get"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            results.current?.focus({ preventScroll: true });
            results.current?.scrollIntoView({ block: "start", behavior: "instant" });
          }}
        >
          <label htmlFor="faq-search">Search help topics</label>
          <div className="help-search-controls">
            <div className="help-search-input">
              <Search size={18} aria-hidden="true" />
              <input
                ref={search}
                id="faq-search"
                name="q"
                type="search"
                maxLength={200}
                value={query}
                onChange={(event) => update(event.target.value, category)}
                placeholder="Booking, payments, account access…"
                aria-controls="help-results"
              />
            </div>
            <input type="hidden" name="topic" value={category} />
            <button className="button" type="submit">
              Search <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
      <section className="help-workspace" aria-label="Help topics">
        <div className="help-wrap help-layout">
          <aside className="help-topic-rail" aria-label="Browse help categories">
            <div className="help-desktop-topics">
              <h2>Browse by topic</h2>
              <div
                className="help-topic-buttons"
                role="group"
                aria-label="Help categories"
              >
                {categories.map((item) => (
                  <form
                    action="/help"
                    method="get"
                    key={item}
                    onSubmit={(event) => {
                      event.preventDefault();
                      update(query, item, true);
                    }}
                  >
                    <input type="hidden" name="q" value={query} />
                    <button
                      name="topic"
                      value={item}
                      type="submit"
                      aria-controls="help-results"
                      aria-pressed={category === item}
                      aria-label={item}
                    >
                      <span>{item}</span>
                      <span aria-hidden="true">{count(item)}</span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
            <form className="help-mobile-topics" action="/help" method="get">
              <label htmlFor="help-topic">Browse by topic</label>
              <input type="hidden" name="q" value={query} />
              <select
                id="help-topic"
                aria-controls="help-results"
                name="topic"
                value={category}
                onChange={(event) => update(query, event.target.value, true)}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item} ({count(item)})
                  </option>
                ))}
              </select>
              <noscript>
                <button className="button" type="submit">
                  Apply topic
                </button>
              </noscript>
            </form>
            <div className="help-topic-guidance">
              <h3>Need help with your request?</h3>
              <p>
                Find an answer here, or contact the workshop with your request reference.
              </p>
              <Link className="help-text-link" href="/contact#enquiry">
                Contact customer care <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </aside>
          <section
            ref={results}
            id="help-results"
            data-reading-focus
            className="help-results"
            tabIndex={-1}
            aria-labelledby="help-results-title"
          >
            <div className="help-results-heading">
              <div>
                <h2 id="help-results-title">Find an answer</h2>
                <p role="status" aria-live="polite" aria-atomic="true">
                  {matches.length} {matches.length === 1 ? "topic" : "topics"}
                  {category !== "All topics" ? ` in ${category}` : ""}
                </p>
              </div>
              {filtered && (
                <form
                  action="/help"
                  method="get"
                  onSubmit={(event) => {
                    event.preventDefault();
                    clear();
                  }}
                >
                  <button className="help-text-link" type="submit">
                    Clear search
                  </button>
                </form>
              )}
            </div>
            <div className="help-answers">
              {matches.map((faq) => (
                <details key={faq.id}>
                  <summary>
                    {faq.question}
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <div className="help-answer-content">
                    <p>{faq.answer}</p>
                    <div className="help-answer-actions">
                      <Link className="help-text-link" href={`/help/${faq.id}`}>
                        Read article <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                      <TopicAction faq={faq} access={access} />
                    </div>
                  </div>
                </details>
              ))}
            </div>
            {matches.length === 0 && (
              <div className="help-empty">
                <Search size={26} aria-hidden="true" />
                <h3>No matching topics</h3>
                <p>
                  Try a shorter search or another topic. Our team can help if you cannot
                  find an answer.
                </p>
                <Link className="help-text-link" href="/contact#enquiry">
                  Contact customer care <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            )}
          </section>
        </div>
      </section>
      <section className="help-contact" aria-labelledby="help-contact-title">
        <div className="help-wrap help-contact-layout">
          <div>
            <h2 id="help-contact-title">Keep the conversation going.</h2>
            <p>Send an enquiry or complaint, or follow a request in your account.</p>
            <Link className="button" href="/contact#enquiry">
              Contact customer care <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <div className="help-account-options">
              {access === "checking" ? (
                <p role="status">Checking your account options…</p>
              ) : access === "error" ? (
                <>
                  <p>
                    Account options are unavailable. You can still read help and contact
                    the team.
                  </p>
                  <button
                    type="button"
                    className="help-text-link"
                    onClick={() => {
                      setAccess("checking");
                      setRetry((value) => value + 1);
                    }}
                  >
                    Retry account check
                  </button>
                </>
              ) : (
                <Link
                  className="help-text-link"
                  href={
                    access === "work"
                      ? "/admin/support"
                      : access === "customer"
                        ? "/dashboard/support"
                        : "/login?next=%2Fdashboard%2Fsupport"
                  }
                >
                  {access === "work"
                    ? "Open support workspace"
                    : access === "customer"
                      ? "My support requests"
                      : "Sign in to customer care"}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
          <div className="help-contact-details">
            <a href={`tel:${business.internationalPhone}`}>
              <Phone size={18} aria-hidden="true" />
              <span>Call our team</span>
            </a>
            <a href={`mailto:${business.email}`}>
              <Mail size={18} aria-hidden="true" />
              <span>{business.email}</span>
            </a>
            <a
              href={business.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Whatsapp (opens in a new tab)"
            >
              Whatsapp <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            <p>
              <MapPin size={18} aria-hidden="true" />
              <span>{business.address}</span>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
