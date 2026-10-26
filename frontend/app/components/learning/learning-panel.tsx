"use client";
import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Compass,
  Play,
  Search,
  Users,
  CarFront,
  KeyRound,
  MessagesSquare,
  BriefcaseBusiness,
  Wrench,
} from "lucide-react";
import type { LearningArticle, LearningGuide } from "@/lib/learning/contracts";
import {
  learningModes,
  learningResults,
  learningReturn,
  type LearningMode,
} from "@/lib/learning/search";
import { useLearningCatalogue } from "@/lib/learning/read";

export function ArticleBody({ article }: { article: LearningArticle }) {
  return (
    <article className="learning-article" aria-label={article.title}>
      <h2>{article.title}</h2>
      <p className="learning-summary">{article.summary}</p>
      <section className="learning-prerequisite">
        <h3>Before you start</h3>
        <p>{article.prerequisites}</p>
      </section>
      <h3>Follow these steps</h3>
      <ol>
        {article.steps.map((step, n) => (
          <li key={n}>{step}</li>
        ))}
      </ol>
      <section className="learning-outcome">
        <h3>What to expect</h3>
        <p>{article.outcome}</p>
      </section>
      <details>
        <summary>Something not working?</summary>
        <p>{article.recovery}</p>
      </details>
      <details className="learning-source">
        <summary>Reviewed source ? version {article.version}</summary>
        <p>
          {article.source}. Reviewed {article.reviewedAt}.
        </p>
      </details>
    </article>
  );
}
export function WrittenGuide({ guide }: { guide: LearningGuide }) {
  return (
    <section className="learning-written">
      <h3>{guide.title} ? written steps</h3>
      <p>Read at your own pace. You choose when to use the page controls.</p>
      <ol>
        {guide.steps.map((step) => (
          <li key={step.id}>{step.text}</li>
        ))}
      </ol>
    </section>
  );
}
const modes = [
  {
    id: "answer",
    title: "Find an answer",
    text: "Get a clear answer to a common question.",
    Icon: BookOpen,
  },
  {
    id: "guide",
    title: "Guide me",
    text: "Follow step-by-step guidance for a task.",
    Icon: Compass,
  },
  { id: "practice", title: "Practise", text: "Try a task with sample data.", Icon: Play },
] as const;
function taskIcon(page: string, articleId: string) {
  if (articleId === "security-basics" || articleId === "privileged-recovery")
    return KeyRound;
  if (articleId === "service-request") return Wrench;
  if (page === "parts") return Search;
  if (page === "vehicles") return CarFront;
  if (page === "customer-care" || page === "staff-care") return MessagesSquare;
  if (page === "work") return BriefcaseBusiness;
  return BookOpen;
}
export function LearningPanel() {
  const uid = useId(),
    params = useSearchParams(),
    resource = useLearningCatalogue();
  const query = (params.get("q") ?? "").slice(0, 120);
  const selectedMode = learningModes.includes(params.get("mode") as LearningMode)
    ? (params.get("mode") as LearningMode)
    : "answer";
  const requested = params.get("article"),
    requestedGuide = params.get("guide"),
    data = resource.data;
  const article = data?.articles.find((a) => a.id === requested),
    guide = data?.guides.find((g) => g.id === requestedGuide);
  const returnHref = learningReturn(params);
  const resultFocus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (requested || requestedGuide) resultFocus.current?.focus({ preventScroll: true });
  }, [requested, requestedGuide]);
  const results = data ? learningResults(data, query) : [];
  const shown = results.filter((r) =>
    query && !params.has("mode") ? true : r.kind === selectedMode,
  );
  function update(value: string, mode?: LearningMode | null) {
    const p = new URLSearchParams(params.toString());
    p.delete("article");
    p.delete("guide");
    if (value) p.set("q", value);
    else p.delete("q");
    if (mode === null) p.delete("mode");
    else if (mode) p.set("mode", mode);
    window.history.replaceState(null, "", "/learn" + (p.size ? "?" + p : ""));
  }
  function itemHref(kind: LearningMode, id: string) {
    const p = new URLSearchParams(params.toString());
    p.delete("article");
    p.delete("guide");
    if (kind === "practice") return "/learn/practice/" + id + (p.size ? "?" + p : "");
    p.set(kind === "answer" ? "article" : "guide", id);
    return "/learn?" + p;
  }
  return (
    <div className="learning-content">
      {resource.loading && <p role="status">Checking available learning?</p>}
      {resource.error && (
        <div className="learning-load-error" role="alert">
          <p>{resource.error}</p>
          <button className="button secondary" onClick={resource.refresh}>
            Retry learning
          </button>
        </div>
      )}
      {data && (
        <div hidden={resource.loading} inert={resource.loading}>
          {requested || requestedGuide ? (
            <div ref={resultFocus} tabIndex={-1} className="learning-detail">
              <Link href={returnHref} className="learning-back">
                <ArrowLeft size={17} aria-hidden="true" /> Back to results
              </Link>
              {article ? (
                <>
                  <ArticleBody article={article} />
                  <div className="learning-actions">
                    <Link className="button" href={article.href}>
                      Open the relevant page <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    {data.guides
                      .filter((g) => g.articleId === article.id)
                      .map((g) => (
                        <Link
                          key={g.id}
                          href={g.href + "#learn=" + g.id}
                          className="button secondary"
                        >
                          Start walkthrough
                        </Link>
                      ))}
                    {data.scenarios
                      .filter((s) => s.articleId === article.id)
                      .slice(0, 1)
                      .map((s) => (
                        <Link
                          key={s.id}
                          href={itemHref("practice", s.id)}
                          className="button secondary"
                        >
                          Try practice
                        </Link>
                      ))}
                  </div>
                </>
              ) : guide ? (
                <>
                  <h2>{guide.title}</h2>
                  <p>{data.articles.find((a) => a.id === guide.articleId)?.summary}</p>
                  <Link className="button" href={guide.href + "#learn=" + guide.id}>
                    Start walkthrough <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <WrittenGuide guide={guide} />
                  <Link href={itemHref("answer", guide.articleId)}>
                    Read the full answer
                  </Link>
                </>
              ) : (
                <p role="status">
                  This learning item is unavailable. Choose an available topic from the
                  results.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="learning-audience">
                {data.audience === "work"
                  ? "For your work account"
                  : data.audience === "customer"
                    ? "For your account"
                    : "Start with the help you need"}
              </p>
              <form data-no-draft role="search" onSubmit={(e) => e.preventDefault()}>
                <label htmlFor={uid + "-search"}>What would you like to do?</label>
                <div className="learning-search">
                  <Search size={20} aria-hidden="true" />
                  <input
                    id={uid + "-search"}
                    type="search"
                    value={query}
                    maxLength={120}
                    onChange={(e) => update(e.target.value)}
                    placeholder="Search for a question, task or topic?"
                    aria-controls={uid + "-results"}
                  />
                  {query && (
                    <button
                      type="button"
                      className="learning-text-button"
                      onClick={() => update("")}
                    >
                      Clear search
                    </button>
                  )}
                </div>
                <p className="learning-search-help">
                  Search articles, guides and practice. Use task words; leave out personal
                  details.
                </p>
              </form>
              <div className="learning-modes" role="tablist" aria-label="Ways to learn">
                {modes.map(({ id, title, text, Icon }, index) => (
                  <button
                    key={id}
                    role="tab"
                    id={uid + "-" + id}
                    aria-selected={selectedMode === id}
                    tabIndex={selectedMode === id ? 0 : -1}
                    aria-controls={uid + "-results"}
                    onClick={() => update(query, id)}
                    onKeyDown={(e) => {
                      let next: number | undefined;
                      if (e.key === "ArrowRight") next = (index + 1) % 3;
                      if (e.key === "ArrowLeft") next = (index + 2) % 3;
                      if (e.key === "Home") next = 0;
                      if (e.key === "End") next = 2;
                      if (next !== undefined) {
                        e.preventDefault();
                        update(query, modes[next].id);
                        document.getElementById(uid + "-" + modes[next].id)?.focus();
                      }
                    }}
                  >
                    <span className="learning-mode-icon">
                      <Icon size={23} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{title}</strong>
                      <small>{text}</small>
                    </span>
                  </button>
                ))}
              </div>
              <section
                id={uid + "-results"}
                role="tabpanel"
                aria-labelledby={uid + "-" + selectedMode}
                tabIndex={0}
              >
                <div className="learning-results-head">
                  <h2>{query ? "Search results" : "Recommended"}</h2>
                  <p role="status">
                    {shown.length} available {shown.length === 1 ? "task" : "tasks"}
                    {query ? " matching your search" : ""}
                  </p>
                </div>
                {query && params.has("mode") && (
                  <button
                    className="learning-text-button"
                    onClick={() => update(query, null)}
                  >
                    Search all modes
                  </button>
                )}
                {!shown.length && (
                  <div className="learning-empty">
                    <h3>
                      {query ? "No matching topics." : "No tasks in this mode yet."}
                    </h3>
                    <p>
                      {query
                        ? "Try parts, support, access or a shorter phrase. You can also search all modes or contact the team."
                        : "Choose another mode or use the Help Centre for more answers."}
                    </p>
                    <Link href="/contact">Contact the team</Link>
                  </div>
                )}
                <ul className="learning-topics">
                  {shown.map((item) => {
                    const Icon =
                      item.kind === "answer"
                        ? taskIcon(item.page, item.articleId)
                        : item.kind === "guide"
                          ? Compass
                          : Play;
                    return (
                      <li key={item.kind + item.id}>
                        <span className="learning-task-icon">
                          <Icon size={21} aria-hidden="true" />
                        </span>
                        <h3>
                          <Link href={itemHref(item.kind, item.id)}>{item.title}</Link>
                        </h3>
                        <p>{item.summary}</p>
                        <small>
                          {item.kind === "answer"
                            ? "Article"
                            : item.kind === "guide"
                              ? "Walkthrough ? " + item.count + " steps"
                              : "Practice ? Sample data"}
                        </small>
                        <Link
                          href={itemHref(item.kind, item.id)}
                          className="learning-card-action"
                          aria-label={
                            (item.kind === "answer"
                              ? "Read answer"
                              : item.kind === "guide"
                                ? "View guide"
                                : "Try practice") +
                            ": " +
                            item.title
                          }
                        >
                          {item.kind === "answer"
                            ? "Read answer"
                            : item.kind === "guide"
                              ? "View guide"
                              : "Try practice"}
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </>
          )}
        </div>
      )}
      <footer className="learning-human">
        <Users size={23} aria-hidden="true" />
        <div>
          <strong>Need a person?</strong>
          <p>Contact the team for help with your actual request.</p>
        </div>
        <Link className="button secondary" href="/contact">
          Contact the team <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/help">Help Centre FAQs</Link>
      </footer>
    </div>
  );
}
