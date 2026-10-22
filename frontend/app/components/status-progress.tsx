import type { ReactNode } from "react";
import { progressStages, statusLabel, type Workflow } from "@/lib/status-progress";

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
  return (
    <section
      className="workflow-progress"
      aria-label={`${statusLabel(workflow)} progress`}
    >
      <p className="workflow-progress-heading">
        Current stage: <StatusBadge status={status} />
      </p>
      <ol className="workflow-stages" aria-label="Workflow stages">
        {progressStages(workflow, status).map((step) => (
          <li
            key={step}
            data-status={step}
            aria-current={step === status ? "step" : undefined}
          >
            <span className="workflow-stage-dot" aria-hidden="true" />
            <span>{statusLabel(step)}</span>
            {step === status && <strong>Current</strong>}
          </li>
        ))}
      </ol>
      <p className="workflow-progress-note">
        Stages show the workflow, not a percentage complete. Some stages may be skipped;
        only the current stage is confirmed here. Use recorded dates and history to check
        completed actions.
      </p>
    </section>
  );
}
