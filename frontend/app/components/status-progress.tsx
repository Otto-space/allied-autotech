import type { ReactNode } from "react";
import {
  progressStages,
  statusLabel,
  workflowStages,
  type Workflow,
} from "@/lib/status-progress";

export function StatusBadge({
  status,
  children,
}: {
  status: string;
  children?: ReactNode;
}) {
  return (
    <span className="aat-status" data-status={status}>
      {children ?? statusLabel(status)}
    </span>
  );
}

export function WorkflowProgress({
  workflow,
  status,
}: {
  workflow: Workflow;
  status: string;
}) {
  const stages = progressStages(workflow, status);
  const expectedStages: readonly string[] = workflowStages[workflow];
  const currentIndex = expectedStages.indexOf(status);
  return (
    <div
      className="workflow-progress"
      role="group"
      aria-label={`${statusLabel(workflow)} progress`}
    >
      <p className="workflow-progress-heading">
        Current stage: <StatusBadge status={status} />
        <span className="workflow-progress-position">
          {currentIndex >= 0
            ? `Stage ${currentIndex + 1} of ${expectedStages.length}`
            : "Needs attention outside the usual stages"}
        </span>
      </p>
      <ol className="workflow-stages" aria-label="Workflow stages">
        {stages.map((step, index) => (
          <li
            key={step}
            data-status={step}
            data-position={
              step === status
                ? "current"
                : currentIndex >= 0 && index < currentIndex
                  ? "earlier"
                  : "later"
            }
            aria-current={step === status ? "step" : undefined}
          >
            <span className="workflow-stage-dot" aria-hidden="true" />
            <span>{statusLabel(step)}</span>
            {step === status && <strong>Current</strong>}
          </li>
        ))}
      </ol>
    </div>
  );
}
