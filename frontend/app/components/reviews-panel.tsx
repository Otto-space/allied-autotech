"use client";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { Page, Review } from "@/lib/api/types";
import { Feedback } from "./feedback";
export function ReviewsPanel() {
  const [items, setItems] = useState<Review[]>([]);
  const [target, setTarget] = useState("BUSINESS");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    const r = await apiRequest<Page<Review>>("/customers/support/reviews?limit=50");
    setItems(r.data?.items ?? []);
  }
  useEffect(() => {
    let active = true;
    void apiRequest<Page<Review>>("/customers/support/reviews?limit=50")
      .then((r) => {
        if (active) setItems(r.data?.items ?? []);
      })
      .catch((v) => {
        if (active)
          setError(v instanceof Error ? v.message : "Reviews could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      targetType: target,
      rating: Number(f.get("rating")),
      title: String(f.get("title") ?? "") || undefined,
      comment: String(f.get("comment") ?? ""),
    };
    if (target === "PRODUCT") {
      body.productId = String(f.get("targetId") ?? "");
      body.orderItemId = String(f.get("proofId") ?? "");
    }
    if (target === "SERVICE") {
      body.serviceId = String(f.get("targetId") ?? "");
      body.bookingId = String(f.get("proofId") ?? "");
    }
    setError(null);
    try {
      const r = await apiRequest<Review>("/customers/support/reviews", {
        method: "POST",
        csrf: true,
        body,
      });
      setMessage(r.message);
      e.currentTarget.reset();
      await load();
    } catch (v) {
      setError(v instanceof Error ? v.message : "Review could not be submitted.");
    }
  }
  return (
    <>
      <span className="eyebrow">Your feedback</span>
      <h1>Reviews.</h1>
      <p className="muted">
        Overall experience, product, and completed-service reviews all use a 1–5 rating
        and are moderated before public display.
      </p>
      <Feedback message={message} tone="success" />
      <Feedback message={error} />
      <form className="card" onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="target">Review type</label>
            <select
              id="target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="BUSINESS">Overall experience</option>
              <option value="PRODUCT">Product</option>
              <option value="SERVICE">Service</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="rating">Rating</label>
            <select id="rating" name="rating" defaultValue="5">
              {[5, 4, 3, 2, 1].map((v) => (
                <option key={v} value={v}>
                  {v} star{v === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>
        </div>
        {target !== "BUSINESS" && (
          <div className="form-row">
            <div className="field">
              <label htmlFor="targetId">
                {target === "PRODUCT" ? "Product" : "Service"} ID
              </label>
              <input id="targetId" name="targetId" required pattern="[0-9a-fA-F-]{36}" />
            </div>
            <div className="field">
              <label htmlFor="proofId">
                {target === "PRODUCT" ? "Order item" : "Completed booking"} ID
              </label>
              <input id="proofId" name="proofId" required pattern="[0-9a-fA-F-]{36}" />
            </div>
          </div>
        )}
        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input id="title" name="title" maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="comment">Your review</label>
          <textarea id="comment" name="comment" required maxLength={2000} />
        </div>
        <button className="button">
          <Star size={16} />
          Submit for moderation
        </button>
      </form>
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2>Your submissions</h2>
      </div>
      <div className="list">
        {items.map((r) => (
          <article className="list-item" key={r.id}>
            <div>
              <h3>{r.title ?? r.targetType.replaceAll("_", " ")}</h3>
              <p>{r.comment}</p>
              <span aria-label={`${r.rating} out of 5 stars`}>
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
              </span>
            </div>
            <span className="status">{r.status}</span>
          </article>
        ))}
      </div>
    </>
  );
}
