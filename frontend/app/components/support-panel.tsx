"use client";

import { MessageSquarePlus, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { Page, SupportMessage, SupportThread } from "@/lib/api/types";
import { Feedback } from "./feedback";

type MessagePage = {
  items: SupportMessage[];
  cursor: string | null;
  hasMore: boolean;
  pollAfterMs: number;
};

export function SupportPanel() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadThreads() {
    const result = await apiRequest<Page<SupportThread>>(
      "/customers/support/enquiries?limit=50",
    );
    const values = result.data?.items ?? [];
    setThreads(values);
    setSelected((current) => current || values[0]?.id || "");
  }

  useEffect(() => {
    let active = true;
    void apiRequest<Page<SupportThread>>("/customers/support/enquiries?limit=50")
      .then((result) => {
        if (!active) return;
        const values = result.data?.items ?? [];
        setThreads(values);
        setSelected(values[0]?.id ?? "");
      })
      .catch((value: unknown) => {
        if (active)
          setError(
            value instanceof Error
              ? value.message
              : "Customer-care conversations could not be loaded.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    let nextCursor: string | null = null;
    const poll = async () => {
      try {
        const query = nextCursor
          ? `?limit=100&cursor=${encodeURIComponent(nextCursor)}`
          : "?limit=100";
        const result = await apiRequest<MessagePage>(
          `/customers/support/enquiries/${encodeURIComponent(selected)}/messages${query}`,
        );
        if (!active) return;
        const incoming = result.data?.items ?? [];
        setMessages((current) => {
          const map = new Map(current.map((item) => [item.id, item]));
          for (const item of incoming) map.set(item.id, item);
          return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        });
        nextCursor = result.data?.cursor ?? nextCursor;
      } catch (value) {
        if (active)
          setError(
            value instanceof Error ? value.message : "Conversation refresh failed.",
          );
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selected]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<SupportThread>("/customers/support/enquiries", {
        method: "POST",
        csrf: true,
        body: {
          type: "GENERAL",
          subject: String(form.get("subject") ?? ""),
          message: String(form.get("message") ?? ""),
        },
      });
      event.currentTarget.reset();
      await loadThreads();
      if (result.data?.id) {
        setMessages([]);
        setSelected(result.data.id);
      }
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Conversation could not be created.",
      );
    }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("message") ?? "");
    if (!selected || !value) return;
    try {
      const result = await apiRequest<SupportMessage>(
        `/customers/support/enquiries/${encodeURIComponent(selected)}/messages`,
        { method: "POST", csrf: true, body: { message: value } },
      );
      if (result.data)
        setMessages((current) => [...current, result.data as SupportMessage]);
      event.currentTarget.reset();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Message could not be sent.");
    }
  }

  function selectThread(value: string) {
    setMessages([]);
    setSelected(value);
  }

  return (
    <>
      <span className="eyebrow">Customer care</span>
      <h1>Secure conversations.</h1>
      <p className="muted">
        Messages refresh automatically every five seconds. No response-time promise is
        implied.
      </p>
      <Feedback message={error} />
      <form className="card" onSubmit={create}>
        <h3>
          <MessageSquarePlus size={18} /> Start a conversation
        </h3>
        <div className="field">
          <label htmlFor="subject">Subject</label>
          <input id="subject" name="subject" required maxLength={160} />
        </div>
        <div className="field">
          <label htmlFor="opening-message">Message</label>
          <textarea id="opening-message" name="message" required maxLength={4000} />
        </div>
        <button className="button">Create conversation</button>
      </form>
      {threads.length > 0 && (
        <div className="field">
          <label htmlFor="thread">Conversation</label>
          <select
            id="thread"
            value={selected}
            onChange={(event) => selectThread(event.target.value)}
          >
            {threads.map((thread) => (
              <option key={thread.id} value={thread.id}>
                {thread.subject} · {thread.status}
              </option>
            ))}
          </select>
        </div>
      )}
      {selected && (
        <section className="chat" aria-label="Customer care messages">
          <div className="messages" aria-live="polite">
            {messages.map((item) => (
              <article
                className={`bubble ${item.authorType === "CUSTOMER" ? "customer" : ""}`}
                key={item.id}
              >
                <strong>
                  {item.authorType === "CUSTOMER" ? "You" : "Allied AutoTech"}
                </strong>
                <br />
                {item.body}
                <br />
                <small className="muted">
                  {new Date(item.createdAt).toLocaleString("en-NG")}
                </small>
              </article>
            ))}
          </div>
          <form className="chat-form" onSubmit={send}>
            <label className="sr-only" htmlFor="chat-message">
              Reply
            </label>
            <input
              id="chat-message"
              name="message"
              required
              maxLength={4000}
              placeholder="Write a message"
            />
            <button className="button" aria-label="Send message">
              <Send size={17} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
