"use client";
import { lazy, Suspense, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { learningPage, type LearningCatalogue } from "@/lib/learning/contracts";
import { assistantArticles, assistantName } from "@/lib/learning/search";
import { useLearningCatalogue } from "@/lib/learning/read";
import { START_LEARNING_GUIDE } from "./learning-entry";
import { AllieAvatar } from "./allie-avatar";
const Conversation = lazy(() =>
  import("./allie-conversation").then((m) => ({ default: m.AllieConversationPanel })),
);

export function AlliePanel({ onNavigate }: { onNavigate: () => void }) {
  const resource = useLearningCatalogue();
  const page = learningPage(usePathname());
  const conversational = resource.data?.flags.ai && page !== "security";
  return (
    <div className="allie-content">
      {!conversational && (
        <p className="allie-boundary">
          Answers from reviewed help. I cannot view or change your records. Keep personal
          details, passwords and codes out of questions.
        </p>
      )}
      {resource.loading && <p role="status">Checking available help…</p>}
      {resource.error && (
        <div role="alert">
          <p>{resource.error}</p>
          <button className="button secondary" onClick={resource.refresh}>
            Retry help
          </button>
        </div>
      )}
      {resource.data && (
        <div hidden={resource.loading} inert={resource.loading}>
          <Assistance
            key={JSON.stringify(resource.data)}
            data={resource.data}
            onNavigate={onNavigate}
          />
        </div>
      )}
      <footer className="allie-footer">
        <Link href="/learn" onClick={onNavigate}>
          Open full Help &amp; Learn <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link href="/contact" onClick={onNavigate}>
          Contact the team
        </Link>
        <Link href="/help" onClick={onNavigate}>
          Help Centre FAQs
        </Link>
      </footer>
    </div>
  );
}
function Assistance({
  data,
  onNavigate,
}: {
  data: LearningCatalogue;
  onNavigate: () => void;
}) {
  const page = learningPage(usePathname());
  const ai = data.flags.ai && page !== "security";
  const [mode, setMode] = useState<"ai" | "reviewed">(ai ? "ai" : "reviewed");
  return (
    <>
      {ai && (
        <div className="allie-modes" aria-label="Help mode">
          <button
            type="button"
            aria-pressed={mode === "ai"}
            onClick={() => setMode("ai")}
          >
            Ask Allie
          </button>
          <button
            type="button"
            aria-pressed={mode === "reviewed"}
            onClick={() => setMode("reviewed")}
          >
            Reviewed help
          </button>
        </div>
      )}
      {ai && mode === "ai" ? (
        <Suspense fallback={<p role="status">Loading conversation controls…</p>}>
          <Conversation data={data} onNavigate={onNavigate} />
        </Suspense>
      ) : (
        <Answers data={data} onNavigate={onNavigate} />
      )}
      {page === "security" && (
        <p className="allie-boundary">
          On account and security pages, use reviewed recovery help. Conversational input
          is unavailable here.
        </p>
      )}
    </>
  );
}
function Answers({
  data,
  onNavigate,
}: {
  data: LearningCatalogue;
  onNavigate: () => void;
}) {
  const uid = useId(),
    path = usePathname(),
    page = learningPage(path);
  const [question, setQuestion] = useState(""),
    [asked, setAsked] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [intent, setIntent] = useState<
    "answer" | "guide" | "practice" | "context" | null
  >(null);
  const matches = asked ? assistantArticles(data, asked) : [];
  const article =
    data.articles.find((a) => a.id === selected) ??
    (intent === "answer" ? matches[0] : undefined);
  const relevant = page === "other" ? [] : data.articles.filter((a) => a.page === page);
  const guides = data.guides
    .filter((g) => data.flags.guides && (page === "other" || g.page === page))
    .slice(0, 3);
  const scenarios = data.scenarios
    .filter(
      (s) =>
        data.flags.practice &&
        (page === "other" || relevant.some((a) => a.id === s.articleId)),
    )
    .slice(0, 3);
  function selectIntent(next: typeof intent) {
    setIntent(next);
    setSelected(null);
    setAsked("");
  }
  function start(id: string) {
    onNavigate();
    window.dispatchEvent(new CustomEvent(START_LEARNING_GUIDE, { detail: id }));
  }
  return (
    <>
      <form
        data-no-draft
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(question.trim());
          setSelected(null);
          setIntent("answer");
        }}
      >
        <label htmlFor={uid + "-question"}>What do you need help with?</label>
        <div className="allie-question">
          <input
            id={uid + "-question"}
            value={question}
            maxLength={120}
            required
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="For example: find a part"
          />
          <button className="button" aria-label="Find reviewed help">
            <Search size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
      <div className="allie-prompts" aria-label="Suggested help">
        <button onClick={() => selectIntent("context")}>Explain this page</button>
        <button onClick={() => selectIntent("guide")}>Show me the steps</button>
        <button onClick={() => selectIntent("practice")}>Let me practise</button>
      </div>
      {!intent && (
        <p className="allie-welcome">
          Hi, I’m {assistantName}, your website guide. Ask about a task or choose a
          starting point.
        </p>
      )}
      <div className="allie-response" aria-live="polite" aria-atomic="false">
        {intent === "answer" && !article && (
          <p>
            I couldn’t find a reviewed answer for that. Try a task such as parts, support
            or account access, or contact the team.
          </p>
        )}
        {intent === "context" && (
          <>
            <h3>{path === "/learn" ? "Three ways to learn" : "Help for this page"}</h3>
            {path === "/learn" ? (
              <p>
                Read an answer, follow optional steps on the relevant page, or practise
                with sample data. Choose a mode to get started.
              </p>
            ) : relevant.length ? (
              <p>
                Choose the task you want help with. These instructions describe the page;
                they don’t inspect its records.
              </p>
            ) : (
              <p>
                I don’t have a specific reviewed explanation for this page. Find a topic
                in Help &amp; Learn or contact the team.
              </p>
            )}
            {relevant.slice(0, 3).map((a) => (
              <button
                className="allie-topic"
                key={a.id}
                onClick={() => {
                  setSelected(a.id);
                  setIntent("answer");
                }}
              >
                {a.title}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ))}
          </>
        )}
        {intent === "guide" && (
          <>
            <h3>Choose a walkthrough</h3>
            <p>You use the page controls. The guide never fills or submits a form.</p>
            {!guides.length && (
              <p>
                No walkthrough is available for this page and your current access. Use the
                written help or open the full hub.
              </p>
            )}
            {guides.map((g) =>
              g.page === page ? (
                <button className="allie-topic" key={g.id} onClick={() => start(g.id)}>
                  {g.title}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <Link
                  className="allie-topic"
                  key={g.id}
                  href={g.href + "#learn=" + g.id}
                  onClick={onNavigate}
                >
                  {g.title}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ),
            )}
          </>
        )}
        {intent === "practice" && (
          <>
            <h3>Try a sample task</h3>
            <p>Practice uses local sample data and cannot change live work.</p>
            {!scenarios.length && (
              <p>
                No practice is available for this page and your current access. Browse the
                full hub for available tasks.
              </p>
            )}
            {scenarios.map((s) => (
              <Link
                className="allie-topic"
                key={s.id}
                href={"/learn/practice/" + s.id}
                onClick={onNavigate}
              >
                {s.title}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </>
        )}
        {article && (
          <article className="allie-answer">
            <AllieAvatar state="helpful" />
            <h3>{article.title}</h3>
            <p>{article.summary}</p>
            <p>{article.steps.slice(0, 2).join(" ")}</p>
            <p className="learning-source">
              Reviewed {article.reviewedAt} · version {article.version} · Website guide,
              no generative AI
            </p>
            <div className="learning-actions">
              <Link
                className="button"
                href={"/learn?article=" + article.id}
                onClick={onNavigate}
              >
                Read answer
              </Link>
              {data.guides
                .filter((g) => data.flags.guides && g.articleId === article.id)
                .slice(0, 1)
                .map((g) =>
                  g.page === page ? (
                    <button
                      key={g.id}
                      className="button secondary"
                      onClick={() => start(g.id)}
                    >
                      Start guide
                    </button>
                  ) : (
                    <Link
                      key={g.id}
                      className="button secondary"
                      href={g.href + "#learn=" + g.id}
                      onClick={onNavigate}
                    >
                      Start guide
                    </Link>
                  ),
                )}
            </div>
            {!selected && matches.length > 1 && (
              <details>
                <summary>Did you mean another task?</summary>
                {matches.slice(1).map((a) => (
                  <button
                    className="allie-topic"
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                  >
                    {a.title}
                  </button>
                ))}
              </details>
            )}
          </article>
        )}
      </div>
    </>
  );
}
