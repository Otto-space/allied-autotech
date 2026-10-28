"use client";
import { AllieAvatar } from "./allie-avatar";
import { assistantName } from "@/lib/learning/search";
import { learningEnabled } from "@/lib/learning/contracts";
export const OPEN_LEARNING = "aat:open-learning";
let pendingOpen = false;
export function requestLearningOpen() {
  pendingOpen = true;
  window.dispatchEvent(new Event(OPEN_LEARNING));
}
export function consumeLearningOpen() {
  const pending = pendingOpen;
  pendingOpen = false;
  return pending;
}
export const START_LEARNING_GUIDE = "aat:start-learning-guide";
export function LearningEntry() {
  if (!learningEnabled()) return null;
  return (
    <button
      type="button"
      className="learning-entry"
      data-learning-entry
      aria-label={`Ask ${assistantName}`}
      title={`Ask ${assistantName}`}
      aria-haspopup="dialog"
      onClick={requestLearningOpen}
    >
      <AllieAvatar />
      <span>Ask {assistantName}</span>
    </button>
  );
}
