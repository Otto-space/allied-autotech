"use client";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CircleHelp, MessageCircle, X } from "lucide-react";
import { answerFaq, business, faqs } from "@/lib/business";
export function SupportWidget() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [answer, setAnswer] = useState<ReturnType<typeof answerFaq> | undefined>();
  if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) return null;
  return (
    <>
      <div className="support-controls" aria-label="Customer support">
        <button
          ref={trigger}
          className="support-trigger"
          onClick={() => dialog.current?.showModal()}
          aria-haspopup="dialog"
          aria-label="Quick help"
          title="Quick help"
        >
          <CircleHelp size={22} aria-hidden="true" />
        </button>
        <a
          className="whatsapp-control"
          href={business.whatsapp}
          target="_blank"
          rel="noreferrer"
          aria-label="Message Allied AutoTech on WhatsApp (opens a new tab)"
          title="WhatsApp"
        >
          <MessageCircle size={22} aria-hidden="true" />
        </a>
      </div>
      <dialog
        className="support-dialog"
        ref={dialog}
        aria-labelledby="support-title"
        onClose={() => trigger.current?.focus()}
      >
        <div className="dialog-header">
          <div>
            <h2 id="support-title">How can we help?</h2>
            <p className="muted">Automated guide · General questions only</p>
          </div>
          <button
            className="icon-button"
            aria-label="Close help"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          This automated guide uses our published help information. It cannot access your
          account or check a transaction. Please avoid sharing personal or payment
          details.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setAnswer(
              answerFaq(String(new FormData(event.currentTarget).get("question") ?? "")),
            );
          }}
        >
          <div className="field">
            <label htmlFor="quick-question">Your question</label>
            <input
              id="quick-question"
              name="question"
              maxLength={300}
              required
              placeholder="For example: where is the workshop?"
            />
          </div>
          <button className="button">Find an answer</button>
        </form>
        <div className="faq-suggestions">
          {faqs.slice(0, 4).map((faq) => (
            <button
              className="text-link"
              key={faq.question}
              onClick={() => setAnswer(faq)}
            >
              {faq.question}
            </button>
          ))}
        </div>
        <div aria-live="polite" aria-atomic="true">
          {answer !== undefined && (
            <div className="notice">
              <p>
                {answer?.answer ??
                  "I don’t have an approved answer to that question. Please contact Allied AutoTech for help."}
              </p>
              <a
                className="text-link"
                href={answer?.href ?? business.whatsapp}
                onClick={() => dialog.current?.close()}
              >
                {answer?.action ?? "Message Allied AutoTech"} →
              </a>
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <a
            className="button secondary"
            href={business.whatsapp}
            target="_blank"
            rel="noreferrer"
          >
            Talk to Allied AutoTech ↗
          </a>
          <Link
            className="text-link"
            href="/help"
            onClick={() => dialog.current?.close()}
          >
            Help centre
          </Link>
        </div>
      </dialog>
    </>
  );
}
