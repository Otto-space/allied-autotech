"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CircleHelp, MessageCircle, X } from "lucide-react";
import { answerFaq, business, faqs } from "@/lib/business";
import { HelpAccountAction } from "./help-account-action";
import { SESSION_CHANGED } from "@/lib/api/client";
import { learningEnabled } from "@/lib/learning/contracts";
import { OPEN_LEARNING } from "./learning/learning-entry";
import { containDialogFocus } from "@/lib/dialog-focus";
import { AllieAvatar } from "./learning/allie-avatar";
import {
  assistantName,
  ASSISTANT_HIDDEN_KEY,
  ASSISTANT_VISIBILITY,
} from "@/lib/learning/search";
export function SupportWidget() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const questionForm = useRef<HTMLFormElement>(null);
  const [answer, setAnswer] = useState<ReturnType<typeof answerFaq> | undefined>();
  const [helpHidden, setHelpHidden] = useState(false);
  useEffect(() => {
    function visibility() {
      try {
        setHelpHidden(sessionStorage.getItem(ASSISTANT_HIDDEN_KEY) === "true");
      } catch {
        setHelpHidden(false);
      }
    }
    visibility();
    window.addEventListener(ASSISTANT_VISIBILITY, visibility);
    return () => window.removeEventListener(ASSISTANT_VISIBILITY, visibility);
  }, []);
  useEffect(() => {
    function discard() {
      dialog.current?.close();
      questionForm.current?.reset();
      setAnswer(undefined);
    }
    window.addEventListener(SESSION_CHANGED, discard);
    return () => window.removeEventListener(SESSION_CHANGED, discard);
  }, []);
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/dashboard/support") ||
    pathname.startsWith("/learn/practice/") ||
    pathname === "/dashboard/notifications" ||
    [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
      "/verify-email",
      "/mfa",
    ].includes(pathname)
  )
    return null;
  return (
    <>
      <nav className="support-controls" aria-label="Customer support">
        {!(learningEnabled() && helpHidden) && (
          <button
            ref={trigger}
            className={
              learningEnabled() ? "support-trigger allie-trigger" : "support-trigger"
            }
            onClick={() =>
              learningEnabled()
                ? window.dispatchEvent(new Event(OPEN_LEARNING))
                : dialog.current?.showModal()
            }
            aria-haspopup="dialog"
            aria-label={learningEnabled() ? `Ask ${assistantName}` : "Quick help"}
            title={learningEnabled() ? `Ask ${assistantName}` : "Quick help"}
          >
            {learningEnabled() ? (
              <AllieAvatar />
            ) : (
              <CircleHelp size={22} aria-hidden="true" />
            )}
            <span className="support-control-label" aria-hidden="true">
              {learningEnabled() ? `Ask ${assistantName}` : "Help"}
            </span>
          </button>
        )}
        <a
          className="whatsapp-control"
          href={business.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Message Allied AutoTech on WhatsApp (opens a new tab)"
          title="Whatsapp"
        >
          <MessageCircle size={22} aria-hidden="true" />
          <span className="support-control-label" aria-hidden="true">
            Whatsapp
          </span>
        </a>
      </nav>
      <dialog
        className="support-dialog"
        ref={dialog}
        aria-labelledby="support-title"
        onKeyDown={containDialogFocus}
        onClose={() => {
          setAnswer(undefined);
          trigger.current?.focus();
        }}
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
          data-draft-key="support-widget:1"
          ref={questionForm}
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
              {answer?.href.startsWith("/dashboard/") ? (
                <HelpAccountAction
                  key={answer.id}
                  href={answer.href}
                  action={answer.action}
                  compact
                  onNavigate={() => dialog.current?.close()}
                />
              ) : (
                <Link
                  className="text-link"
                  href={answer?.href ?? business.whatsapp}
                  onClick={() => dialog.current?.close()}
                  {...((answer?.href ?? business.whatsapp).startsWith("https://")
                    ? {
                        target: "_blank",
                        rel: "noopener noreferrer",
                        "aria-label": `${answer?.action ?? "Message Allied AutoTech"} (opens in a new tab)`,
                      }
                    : {})}
                >
                  {answer?.action ?? "Message Allied AutoTech"}{" "}
                  <span aria-hidden="true">
                    {(answer?.href ?? business.whatsapp).startsWith("https://")
                      ? "\u2197"
                      : "\u2192"}
                  </span>
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <a
            className="button secondary"
            href={business.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            Whatsapp ↗
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
