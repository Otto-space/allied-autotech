"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  learningMatches,
  learningPage,
  type LearningArticle,
  type LearningGuide,
} from "@/lib/learning/contracts";
import { useLearningCatalogue } from "@/lib/learning/read";
import { START_LEARNING_GUIDE } from "./learning-entry";

export function ArticleBody({ article }: { article: LearningArticle }) {
  return (
    <article className="learning-article" aria-label={article.title}>
      <p className="learning-eyebrow">
        Reviewed instructions · version {article.version}
      </p>
      <h2>{article.title}</h2>
      <p className="learning-summary">{article.summary}</p>
      <h3>Before you start</h3>
      <p>{article.prerequisites}</p>
      <ol>
        {article.steps.map((step, n) => (
          <li key={n}>{step}</li>
        ))}
      </ol>
      <h3>Expected outcome</h3>
      <p>{article.outcome}</p>
      <details>
        <summary>Problems and recovery</summary>
        <p>{article.recovery}</p>
      </details>
      <p className="learning-source">
        Source: {article.source}. Reviewed {article.reviewedAt}.
      </p>
    </article>
  );
}
export function WrittenGuide({ guide }: { guide: LearningGuide }) {
  return (
    <section className="learning-written">
      <h3>{guide.title} — written steps</h3>
      <p>Optional reading. These steps do not activate controls or submit work.</p>
      <ol>
        {guide.steps.map((step) => (
          <li key={step.id}>{step.text}</li>
        ))}
      </ol>
    </section>
  );
}
export function LearningPanel({
  full = false,
  onNavigate = () => {},
}: {
  full?: boolean;
  onNavigate?: () => void;
}) {
  const uid = useId();
  const resource = useLearningCatalogue(),
    pathname = usePathname(),
    params = useSearchParams();
  const [localQuery, setQuery] = useState("");
  const query = full ? (params.get("q") ?? "").slice(0, 120) : localQuery;
  const [selected, setSelected] = useState<string | null>(null);
  const data = resource.data;
  const requested = full ? params.get("article") : selected;
  const article = data?.articles.find((a) => a.id === requested);
  const requestedGuide = full ? params.get("guide") : null;
  const written = data?.guides.find((g) => g.id === requestedGuide);
  const page = learningPage(pathname);
  const matches = data?.articles.filter((a) => learningMatches(a, query)) ?? [];
  function search(value: string) {
    setQuery(value);
    setSelected(null);
    if (full) {
      const p = new URLSearchParams();
      if (value) p.set("q", value);
      window.history.replaceState(null, "", "/learn" + (p.size ? "?" + p : ""));
    }
  }
  return (
    <div className="learning-content">
      <p>
        Understand the website, follow optional steps, or practise with fictional data.
        Help does not look up your records or act on your behalf.
      </p>
      {resource.loading && <p role="status">Checking available learning…</p>}
      {resource.error && (
        <div role="alert">
          <p>{resource.error}</p>
          <button className="button secondary" onClick={resource.refresh}>
            Retry learning
          </button>
        </div>
      )}
      {data && (
        <div hidden={resource.loading} inert={resource.loading}>
          <p className="learning-scope">
            {data.audience === "public"
              ? "Public help"
              : data.audience === "customer"
                ? "Customer help — your own authorised tasks"
                : "Work help — current responsibilities only"}
            {data.mode !== "full"
              ? " · Customer online transactions remain restricted."
              : ""}
          </p>
          <form data-no-draft role="search" onSubmit={(e) => e.preventDefault()}>
            <label htmlFor={uid + "-learning-search"}>Find an answer</label>
            <div className="learning-search">
              <input
                id={uid + "-learning-search"}
                type="search"
                value={query}
                maxLength={120}
                onChange={(e) => search(e.target.value)}
                placeholder="Parts, support, access…"
                aria-controls={uid + "-learning-results"}
              />
              <button
                type="button"
                className="button secondary"
                onClick={() => search("")}
              >
                Clear search
              </button>
            </div>
          </form>
          {(requested && !article) || (requestedGuide && !written) ? (
            <p role="status">
              This learning item is unavailable. Choose an available topic below.
            </p>
          ) : null}
          {article && (
            <>
              <ArticleBody article={article} />
              <div className="learning-actions">
                <Link
                  className="button secondary"
                  href={article.href}
                  onClick={onNavigate}
                >
                  Open the relevant page
                </Link>
                {!full && (
                  <Link href={`/learn?article=${article.id}`} onClick={onNavigate}>
                    Open article page
                  </Link>
                )}
                {!full && (
                  <button className="button secondary" onClick={() => setSelected(null)}>
                    Back to topics
                  </button>
                )}
              </div>
            </>
          )}
          {written && <WrittenGuide guide={written} />}
          {!article && !written && (
            <section id={uid + "-learning-results"} aria-label="Available help topics">
              <p role="status">
                {matches.length} available {matches.length === 1 ? "topic" : "topics"}
                {query ? " matching your search" : ""}
              </p>
              {!matches.length && (
                <p>
                  No matching topics. Clear the search, try a shorter phrase, or contact
                  support. This is documentation, not a live record search.
                </p>
              )}
              <ul className="learning-topics">
                {matches.map((a) => (
                  <li key={a.id}>
                    {full ? (
                      <Link href={`/learn?article=${a.id}`}>{a.title}</Link>
                    ) : (
                      <button type="button" onClick={() => setSelected(a.id)}>
                        {a.title}
                      </button>
                    )}
                    <p>{a.summary}</p>
                    {a.page === page && <small>Relevant to this page</small>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.flags.guides && (
            <section aria-labelledby={uid + "-learning-guides"}>
              <h2 id={uid + "-learning-guides"}>Guide me</h2>
              <p>No guide sends a real request or confirms an operational change.</p>
              <ul className="learning-topics">
                {[...data.guides]
                  .sort((a, b) => Number(b.page === page) - Number(a.page === page))
                  .map((g) => (
                    <li key={g.id}>
                      <strong>{g.title}</strong>
                      <div className="learning-actions">
                        {g.page === page ? (
                          <button
                            className="button secondary"
                            onClick={() => {
                              onNavigate();
                              window.dispatchEvent(
                                new CustomEvent(START_LEARNING_GUIDE, { detail: g.id }),
                              );
                            }}
                          >
                            Start optional guide
                          </button>
                        ) : (
                          <Link href={`${g.href}#learn=${g.id}`} onClick={onNavigate}>
                            Open its page to start
                          </Link>
                        )}
                        <Link href={`/learn?guide=${g.id}`} onClick={onNavigate}>
                          Written steps
                        </Link>
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          )}
          {data.flags.practice && (
            <section aria-labelledby={uid + "-learning-practice"}>
              <h2 id={uid + "-learning-practice"}>Practise safely</h2>
              <p>
                Local simulations with fictional data. They do not prove production
                workflow completion.
              </p>
              <ul className="learning-topics">
                {data.scenarios.map((s) => (
                  <li key={s.id}>
                    <Link href={`/learn/practice/${s.id}`} onClick={onNavigate}>
                      {s.title}
                    </Link>
                    <p>{s.objective}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      <footer className="learning-actions">
        <Link href="/learn" onClick={onNavigate}>
          Help & Learn page
        </Link>
        <Link href="/help" onClick={onNavigate}>
          Existing Help Centre
        </Link>
        <Link href="/contact" onClick={onNavigate}>
          Contact support
        </Link>
      </footer>
    </div>
  );
}
