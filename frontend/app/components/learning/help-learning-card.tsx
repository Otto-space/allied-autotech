"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { assistantName } from "@/lib/learning/search";
import { OPEN_LEARNING } from "./learning-entry";
import { AllieAvatar } from "./allie-avatar";
export function HelpLearningCard() {
  return (
    <section
      className="help-learning-card help-wrap"
      aria-labelledby="help-learning-title"
    >
      <AllieAvatar />
      <div>
        <h2 id="help-learning-title">Let {assistantName} show you around.</h2>
        <p>Find an answer, follow a guide or try a task with sample data.</p>
      </div>
      <div className="learning-actions">
        <Link className="button" href="/learn">
          Explore Help &amp; Learn <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <button
          className="button secondary"
          onClick={() => window.dispatchEvent(new Event(OPEN_LEARNING))}
        >
          Ask {assistantName}
        </button>
      </div>
    </section>
  );
}
