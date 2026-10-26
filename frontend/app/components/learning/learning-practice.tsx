"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { practiceSchema, type PracticeDefinition } from "@/lib/learning/contracts";
import { readLearning, useLearningCatalogue } from "@/lib/learning/read";
import {
  createPracticeAdapter,
  type PracticeCommand,
} from "@/lib/learning/practice-adapter";

export function LearningPractice({ id }: { id: string }) {
  const resource = useLearningCatalogue();
  const scenario = resource.data?.scenarios.find((s) => s.id === id);
  return (
    <>
      {resource.loading && <p role="status">Checking practice access…</p>}
      {resource.error && (
        <div role="alert">
          <p>{resource.error}</p>
          <button className="button secondary" onClick={resource.refresh}>
            Retry practice access
          </button>
        </div>
      )}
      {resource.data && (
        <div hidden={resource.loading} inert={resource.loading}>
          {scenario ? (
            <Definition
              key={resource.data.accessKey + ":" + id + ":" + scenario.version}
              id={id}
            />
          ) : (
            <p role="status">
              This practice scenario is unavailable under your current access.{" "}
              <Link href="/learn">Choose available learning</Link>.
            </p>
          )}
        </div>
      )}
    </>
  );
}
function Definition({ id }: { id: string }) {
  const [resource, setResource] = useState<{
    definition?: PracticeDefinition;
    error?: string;
  }>({});
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 10000);
    readLearning("scenarios", id, controller.signal)
      .then((data) => {
        if (alive && !controller.signal.aborted)
          setResource({ definition: practiceSchema.parse(data) });
      })
      .catch(() => {
        if (!alive) return;
        setResource({
          error: "Practice could not be loaded. No fictional or real work was submitted.",
        });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, attempt]);
  if (resource.error)
    return (
      <div role="alert">
        <p>{resource.error}</p>
        <button
          className="button secondary"
          onClick={() => {
            setResource({});
            retry((v) => v + 1);
          }}
        >
          Retry scenario
        </button>
      </div>
    );
  return resource.definition ? (
    <PracticeSession definition={resource.definition} />
  ) : (
    <p role="status">Loading fictional scenario…</p>
  );
}
export function PracticeSession({ definition }: { definition: PracticeDefinition }) {
  const [session] = useState(() => {
    const nonce = crypto.randomUUID();
    return { nonce, adapter: createPracticeAdapter(definition, nonce) };
  });
  const [state, setState] = useState(() => session.adapter.snapshot()),
    [choice, setChoice] = useState(""),
    [replace, setReplace] = useState(false);
  const errors = useRef<HTMLDivElement>(null),
    example = useRef<HTMLButtonElement>(null),
    confirm = useRef<HTMLDialogElement>(null);
  function execute(command: PracticeCommand) {
    const next = session.adapter.execute(command);
    setState(next);
    if (Object.keys(next.errors).length)
      requestAnimationFrame(() => errors.current?.focus());
  }
  function fill() {
    execute({ type: "example", replace: true });
    setChoice("");
    setReplace(false);
    confirm.current?.close();
    example.current?.focus();
  }
  return (
    <section className="learning-practice-session" aria-labelledby="practice-title">
      <div className="learning-fiction" role="note">
        <strong>Practice mode · Fictional data only</strong>
        <p>
          This simulation cannot send messages, change records, create bookings, take
          payment or grant access. Inputs stay in this page’s memory and clear when you
          leave.
        </p>
      </div>
      <p className="learning-mode-label">Practice mode &middot; Fictional data only</p>
      <p className="learning-eyebrow">Local simulation · version {definition.version}</p>
      <h2 id="practice-title">{definition.title}</h2>
      <p>{definition.objective}</p>
      <p>
        Use invented information only. Completion means you reviewed this exercise; it is
        not an assessment or permission to perform live work.
      </p>
      <div className="learning-actions">
        <button
          ref={example}
          className="button secondary"
          onClick={() => {
            if (Object.values(state.values).some(Boolean)) {
              setReplace(true);
              confirm.current?.showModal();
            } else fill();
          }}
        >
          Fill fictional example
        </button>
        <button
          className="button secondary"
          onClick={() => {
            execute({ type: "reset", nonce: session.nonce });
            setChoice("");
          }}
        >
          Reset this practice
        </button>
        <Link href="/learn">Leave practice</Link>
      </div>
      <dialog
        ref={confirm}
        className="learning-dialog"
        aria-labelledby="practice-replace-title"
        onClose={() => {
          setReplace(false);
          example.current?.focus();
        }}
      >
        <h2 id="practice-replace-title">Replace fictional inputs?</h2>
        <p>
          Your current practice entries will be replaced by the editable example. Nothing
          will be submitted.
        </p>
        {replace && (
          <div className="learning-actions">
            <button
              className="button secondary"
              autoFocus
              onClick={() => confirm.current?.close()}
            >
              Keep my practice entries
            </button>
            <button className="button" onClick={fill}>
              Replace with example
            </button>
          </div>
        )}
      </dialog>
      <form
        data-no-draft
        onSubmit={(event) => {
          event.preventDefault();
          execute({ type: "review", choice });
        }}
      >
        {!!Object.keys(state.errors).length && (
          <div ref={errors} tabIndex={-1} role="alert" className="learning-errors">
            <p>Check the fictional exercise:</p>
            <ul>
              {Object.entries(state.errors).map(([field, message]) => (
                <li key={field}>
                  <a href={`#practice-${field}`}>{message}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="learning-fields">
          {definition.fields.map((field) => (
            <div className="field" key={field.id}>
              <label htmlFor={`practice-${field.id}`}>
                {field.label} <span>(fictional)</span>
              </label>
              {field.options ? (
                <select
                  id={`practice-${field.id}`}
                  value={state.values[field.id] ?? ""}
                  disabled={!!field.dependsOn && !state.values[field.dependsOn]}
                  aria-invalid={!!state.errors[field.id]}
                  aria-describedby={`practice-${field.id}-help`}
                  onChange={(e) =>
                    execute({ type: "edit", field: field.id, value: e.target.value })
                  }
                >
                  <option value="">Choose an example</option>
                  {field.options.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : field.max > 160 ? (
                <textarea
                  id={`practice-${field.id}`}
                  rows={4}
                  maxLength={field.max}
                  value={state.values[field.id] ?? ""}
                  aria-invalid={!!state.errors[field.id]}
                  aria-describedby={`practice-${field.id}-help`}
                  onChange={(e) =>
                    execute({ type: "edit", field: field.id, value: e.target.value })
                  }
                />
              ) : (
                <input
                  id={`practice-${field.id}`}
                  maxLength={field.max}
                  value={state.values[field.id] ?? ""}
                  aria-invalid={!!state.errors[field.id]}
                  aria-describedby={`practice-${field.id}-help`}
                  onChange={(e) =>
                    execute({ type: "edit", field: field.id, value: e.target.value })
                  }
                />
              )}
              <p id={`practice-${field.id}-help`}>
                {state.errors[field.id] ??
                  `Use ${field.min}–${field.max} characters.${field.dependsOn ? " Choose the preceding field first; changing it clears dependent choices." : ""}`}
              </p>
            </div>
          ))}
        </div>
        {definition.kind === "fitment" && (
          <section className="learning-scope" aria-label="Fictional fitment examples">
            <h3>Compare fictional evidence</h3>
            <button
              type="button"
              className="button secondary"
              id="practice-search"
              onClick={() => execute({ type: "search" })}
            >
              Search fictional catalogue
            </button>
            {state.errors.search && <p>{state.errors.search}</p>}
            {state.results && (
              <>
                <p>{state.results.length} fictional candidates</p>
                <ul className="learning-topics">
                  {state.results.map((part) => (
                    <li key={part.id}>
                      <h4>{part.name}</h4>
                      <strong>{part.status}</strong>
                      <details>
                        <summary>Inspect fictional evidence</summary>
                        <p>{part.evidence}</p>
                      </details>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p>
              These are teaching examples, not catalogue stock or real fitment decisions.
            </p>
          </section>
        )}
        <fieldset
          id="practice-choice"
          aria-describedby={state.errors.choice ? "practice-choice-error" : undefined}
        >
          <legend>Choose the safest fictional next step</legend>
          {definition.choices.map((option) => (
            <label className="learning-choice" key={option.id}>
              <input
                type="radio"
                name="practice-choice"
                value={option.id}
                checked={choice === option.id}
                onChange={() => {
                  setChoice(option.id);
                  setState((previous) => ({
                    ...previous,
                    completed: false,
                    reviewed: false,
                    feedback: "",
                  }));
                }}
              />
              {option.label}
            </label>
          ))}
          {state.errors.choice && <p id="practice-choice-error">{state.errors.choice}</p>}
        </fieldset>
        <button className="button" type="submit">
          Review fictional work
        </button>
      </form>
      {state.feedback && (
        <div className="learning-feedback" role="status">
          <h3>{state.completed ? "Practice review complete" : "Practice feedback"}</h3>
          <p>{state.feedback}</p>
          {state.completed && <p>{definition.outcome}</p>}
          <strong>Practice only. No real work was submitted.</strong>
        </div>
      )}
      <p className="learning-scope">
        Ready for real work? Leave practice deliberately and check your current
        permissions and actual facts.
      </p>
      <Link href={definition.liveHref}>Leave practice and open the real page</Link>
    </section>
  );
}
