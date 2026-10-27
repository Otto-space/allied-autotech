"use client";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { learningPage, type LearningCatalogue } from "@/lib/learning/contracts";
import {
  createConversationClient,
  type AllieConversation,
  type AllieRecent,
} from "@/lib/learning/conversation";

function failureCopy(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error ? error.status : 0;
  if (status === 429)
    return "Allie has reached a temporary usage limit. Reviewed help remains available. Check the conversation before sending again.";
  if (status === 422)
    return "Review your question. Remove passwords, codes, tokens and bank or card details. Your question has not been sent to Customer Care.";
  if (status === 401 || status === 403 || status === 404)
    return "This conversation is no longer available with your current access. Reopen help after checking your session.";
  if (status === 409)
    return "The conversation changed or that turn was interrupted. Check it before reviewing and sending another question.";
  return "Allie could not verify the result. Check the conversation before sending again; do not assume the question failed or an answer was saved. Reviewed help remains available.";
}

export function AllieConversationPanel({
  data,
  onNavigate,
}: {
  data: LearningCatalogue;
  onNavigate: () => void;
}) {
  const uid = useId(),
    path = usePathname(),
    page = learningPage(path);
  const [client] = useState(() => createConversationClient(data));
  const [conversation, setConversation] = useState<AllieConversation | null>(null);
  const [recent, setRecent] = useState<AllieRecent>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState("Checking recent conversations…");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [checking, setChecking] = useState(false);
  const [clearReview, setClearReview] = useState(false);
  const mounted = useRef(false),
    generation = useRef(0),
    controller = useRef<AbortController | null>(null);
  const creationId = useRef<string | null>(null);
  const lastAttempt = useRef<{
    conversationId: string;
    operationId: string;
    question: string;
  } | null>(null);

  function adopt(next: AllieConversation) {
    creationId.current = null;
    setAttemptId(null);
    setConversation(next);
    setUncertain(false);
    setChecking(false);
    if (next.historyReset) {
      setQuestion("");
      lastAttempt.current = null;
      setNotice(
        "Your help context changed. Earlier guidance was cleared; review your next question.",
      );
    } else if (
      lastAttempt.current &&
      next.messages.some((m) => m.operationId === lastAttempt.current!.operationId)
    ) {
      const sent = lastAttempt.current.question;
      setQuestion((value) => (value === sent ? "" : value));
      lastAttempt.current = null;
    }
  }
  async function perform<T>(
    label: string,
    task: (signal: AbortSignal) => Promise<T>,
    done: (value: T) => void,
  ) {
    const ticket = ++generation.current;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(label);
    setError("");
    try {
      const value = await task(request.signal);
      request.signal.throwIfAborted();
      if (mounted.current && ticket === generation.current) done(value);
    } catch (reason) {
      if (mounted.current && ticket === generation.current && !request.signal.aborted) {
        setError(failureCopy(reason));
        setUncertain(true);
        const status =
          reason && typeof reason === "object" && "status" in reason ? reason.status : 0;
        if (status === 401 || status === 403 || status === 404) {
          setConversation(null);
          setRecent([]);
          setQuestion("");
          lastAttempt.current = null;
        }
      }
    } finally {
      if (mounted.current && ticket === generation.current) {
        setBusy("");
        setChecking(false);
      }
    }
  }
  async function reload() {
    setChecking(true);
    const selected = conversation;
    if (selected)
      await perform(
        "Checking conversation…",
        (signal) => client.read(selected.id, signal),
        adopt,
      );
    else
      await perform(
        "Checking recent conversations…",
        async (signal) => {
          try {
            return await client.list(signal);
          } catch (reason) {
            if (
              data.audience === "public" &&
              reason &&
              typeof reason === "object" &&
              "status" in reason &&
              reason.status === 404
            )
              return [];
            throw reason;
          }
        },
        (items) => {
          setRecent(items);
          setUncertain(false);
        },
      );
  }
  const initialize = useEffectEvent(() => void reload());
  const recheck = useEffectEvent(() => {
    if (!busy && document.visibilityState === "visible") void reload();
  });
  useEffect(() => {
    mounted.current = true;
    const initial = setTimeout(initialize, 0);
    const check = () => recheck();
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    return () => {
      clearTimeout(initial);
      mounted.current = false;
      controller.current?.abort();
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
    };
    // The parent remounts this boundary when the eligible catalogue changes.
  }, [client]);
  useEffect(() => {
    if (!conversation) return;
    const timer = setTimeout(
      () => {
        generation.current++;
        controller.current?.abort();
        setBusy("");
        setConversation(null);
        setQuestion("");
        lastAttempt.current = null;
        setRecent([]);
        setNotice("This help conversation expired. Start another when you are ready.");
      },
      Math.max(0, Date.parse(conversation.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [conversation]);
  useEffect(() => {
    if (!conversation?.pending || busy) return;
    const timer = setTimeout(initialize, 3000);
    return () => clearTimeout(timer);
  }, [conversation, busy]);

  const pendingId = attemptId ?? conversation?.pending?.operationId;
  function send() {
    if (!conversation || busy || uncertain || conversation.pending || !question.trim())
      return;
    const input = {
      operationId: crypto.randomUUID(),
      expectedVersion: conversation.version,
      question: question.trim(),
      page,
    };
    lastAttempt.current = {
      conversationId: conversation.id,
      operationId: input.operationId,
      question,
    };
    setAttemptId(input.operationId);
    setNotice("");
    void perform(
      "Preparing an AI answer…",
      (signal) => client.turn(conversation.id, input, signal),
      (next) => {
        adopt(next);
        setNotice("Allie’s answer is ready. Check the sources and any limitations.");
      },
    );
  }
  function stop() {
    if (!conversation || !pendingId) return;
    void perform(
      "Stopping generation…",
      async (signal) => {
        await client.cancel(conversation.id, pendingId, signal);
        return client.read(conversation.id, signal);
      },
      (next) => {
        adopt(next);
        setNotice(
          "Generation stopped or had already finished. Check the conversation. Already incurred usage may still apply.",
        );
      },
    );
  }

  return (
    <section className="allie-chat" aria-labelledby={uid + "-heading"}>
      <h3 id={uid + "-heading"}>
        Help conversation <span className="allie-ai-label">AI help</span>
      </h3>
      <p className="allie-boundary" id={uid + "-notice"}>
        Allie uses OpenAI to explain reviewed help and may be wrong. It cannot see your
        records, change work or send messages. Keep personal records, passwords and codes
        out.
      </p>
      <details className="allie-privacy">
        <summary>What is shared and kept?</summary>
        <p>
          Only your typed question, eligible reviewed help and recent help context are
          sent to OpenAI. We do not include forms, uploads, private records or support
          threads. Secret screening is limited and may miss sensitive text.
        </p>
        <p>
          Allie uses up to six recent turns as context. Conversation data and temporary
          turn receipts are encrypted on our server, expiring after 15 minutes without a
          completed answer or one hour overall, possibly sooner with your session. Clear
          removes the conversation from active server history; backups follow their own
          policy. Expired payload cleanup depends on our retention worker.
        </p>
        <p>
          We request no stored provider response. OpenAI’s abuse-monitoring rules may
          still apply; Clear does not promise provider deletion. No transcript is saved in
          this browser’s storage.
        </p>
        <Link href="/privacy" prefetch={false} onClick={onNavigate}>
          Website privacy notice
        </Link>
      </details>
      <p className="allie-chat-status" role="status">
        {busy || notice}
      </p>
      {error && (
        <div className="allie-chat-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button secondary"
            disabled={!!busy}
            onClick={() => void reload()}
          >
            {conversation ? "Check conversation" : "Check recent conversations"}
          </button>
        </div>
      )}
      {!conversation ? (
        <>
          <p>
            Choose Start to send help questions to Allie. You can use reviewed help
            without AI at any time.
          </p>
          <button
            type="button"
            className="button"
            disabled={!!busy || uncertain}
            onClick={() => {
              creationId.current ??= crypto.randomUUID();
              void perform(
                "Starting conversation…",
                (signal) => client.create(creationId.current!, signal),
                (next) => {
                  adopt(next);
                  creationId.current = null;
                  setNotice("Ready for your help question.");
                },
              );
            }}
          >
            Start help conversation
          </button>
          {recent.length > 0 && (
            <div className="allie-recent">
              <h4>Recent help in this session</h4>
              {recent.map((item, index) => (
                <button
                  type="button"
                  className="allie-topic"
                  key={item.id}
                  disabled={!!busy}
                  onClick={() =>
                    void perform(
                      "Opening conversation…",
                      (signal) => client.read(item.id, signal),
                      adopt,
                    )
                  }
                >
                  Resume conversation {index + 1}
                  <span>
                    Started{" "}
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="allie-chat-tools">
            <button
              type="button"
              className="button secondary"
              aria-label="Refresh conversation"
              disabled={!!busy}
              onClick={() => void reload()}
            >
              Refresh
            </button>
            <button
              type="button"
              className="button secondary"
              aria-label="Clear conversation"
              disabled={!!busy}
              onClick={() => setClearReview(true)}
            >
              Clear history
            </button>
          </div>
          {clearReview && (
            <fieldset className="allie-clear-review">
              <legend>Clear this help conversation?</legend>
              <p>
                This removes its active server history and stops pending generation. It
                does not delete support records, backups or provider records.
              </p>
              <div className="learning-actions">
                <button
                  type="button"
                  className="button"
                  disabled={!!busy}
                  onClick={() =>
                    void perform(
                      "Clearing conversation…",
                      (signal) => client.clear(conversation.id, signal),
                      () => {
                        setConversation(null);
                        setQuestion("");
                        setRecent((items) =>
                          items.filter((i) => i.id !== conversation.id),
                        );
                        lastAttempt.current = null;
                        setClearReview(false);
                        setUncertain(false);
                        setNotice("Active help history cleared.");
                      },
                    )
                  }
                >
                  Confirm clear
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={!!busy}
                  onClick={() => setClearReview(false)}
                >
                  Keep conversation
                </button>
              </div>
            </fieldset>
          )}
          <div hidden={checking} inert={checking}>
            <ol className="allie-transcript" aria-label="Help conversation">
              {conversation.messages.map((message) => (
                <li key={message.operationId}>
                  <div className="allie-user-message">
                    <span className="allie-message-label">You</span>
                    <p>{message.question}</p>
                  </div>
                  <article className="allie-ai-message">
                    <h4>
                      Allie <span className="allie-ai-label">AI answer</span>
                    </h4>
                    <p>{message.answer.answer}</p>
                    {message.answer.steps.length > 0 && (
                      <ol>
                        {message.answer.steps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ol>
                    )}
                    {message.answer.caveat && (
                      <p className="allie-caveat">{message.answer.caveat}</p>
                    )}
                    {message.answer.sources.length > 0 && (
                      <div className="allie-citations">
                        <p>Reviewed sources</p>
                        {message.answer.sources.map((source) => (
                          <Link
                            key={source.id}
                            href={source.href}
                            prefetch={false}
                            onClick={onNavigate}
                          >
                            {source.title} · v{source.version}
                          </Link>
                        ))}
                      </div>
                    )}
                    <div className="learning-actions">
                      {message.answer.actions.map((action) => (
                        <Link
                          className="button secondary"
                          key={action.id}
                          href={action.href}
                          prefetch={false}
                          onClick={onNavigate}
                        >
                          {action.label}
                        </Link>
                      ))}
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </div>
          {(conversation.pending || busy === "Preparing an AI answer…") && (
            <p className="allie-pending">
              {conversation.pending?.state === "interrupted"
                ? "A previous answer was interrupted. Check it, then review before sending another question."
                : "An answer is being prepared. You can stop it below."}
            </p>
          )}
          {pendingId && (conversation.pending || busy === "Preparing an AI answer…") && (
            <button
              type="button"
              className="button secondary"
              onClick={stop}
              disabled={busy === "Stopping generation…"}
            >
              Stop generation
            </button>
          )}
          <form
            data-no-draft
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <label htmlFor={uid + "-question"}>Your help question</label>
            <textarea
              id={uid + "-question"}
              value={question}
              maxLength={1200}
              rows={3}
              required
              readOnly={!!busy}
              aria-describedby={uid + "-notice " + uid + "-hint"}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about a website task, or follow up on an answer"
            />
            <p className="allie-input-hint" id={uid + "-hint"}>
              {question.length}/1200 characters. Nothing is sent until you choose Send.
            </p>
            <button
              className="button"
              disabled={!!busy || uncertain || !!conversation.pending || !question.trim()}
            >
              Send question
            </button>
          </form>
          <button
            type="button"
            className="learning-text-button allie-back"
            disabled={!!busy}
            onClick={() => {
              setConversation(null);
              setQuestion("");
              setUncertain(false);
              lastAttempt.current = null;
              void perform(
                "Checking recent conversations…",
                (signal) => client.list(signal),
                setRecent,
              );
            }}
          >
            Back to conversations
          </button>
        </>
      )}
    </section>
  );
}
