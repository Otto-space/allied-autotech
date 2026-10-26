"use client";
import { CircleHelp } from "lucide-react";
import { learningEnabled } from "@/lib/learning/contracts";
export const OPEN_LEARNING = "aat:open-learning";
export const START_LEARNING_GUIDE = "aat:start-learning-guide";
export function LearningEntry() {
  if (!learningEnabled()) return null;
  return (
    <button
      type="button"
      className="learning-entry"
      data-learning-entry
      aria-label="Help & Learn"
      title="Help & Learn"
      aria-haspopup="dialog"
      onClick={() => window.dispatchEvent(new Event(OPEN_LEARNING))}
    >
      <CircleHelp size={19} aria-hidden="true" />
      <span>Help & Learn</span>
    </button>
  );
}
