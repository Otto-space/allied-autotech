// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WorkflowProgress, StatusBadge } from "@/app/components/status-progress";
import { SupportEmailDeliverySummary } from "@/app/components/support-email-delivery";
import { progressStages, workflowStages } from "@/lib/status-progress";
afterEach(cleanup);
describe("workflow progress and delivery clarity", () => {
  it.each(Object.keys(workflowStages) as (keyof typeof workflowStages)[])(
    "marks only the actual current %s stage",
    (workflow) => {
      const stages = workflowStages[workflow];
      const current = stages[1];
      const { container } = render(
        <WorkflowProgress workflow={workflow} status={current} />,
      );
      expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
      expect(container.querySelector('[aria-current="step"]')?.textContent).toContain(
        "Current",
      );
      expect(container.querySelector('[role="progressbar"]')).toBeNull();
      expect(screen.getByText(/not a percentage complete/)).toBeTruthy();
    },
  );
  it.each(["CANCELLED", "EXPIRED", "REJECTED", "NO_SHOW", "NEW_SERVER_STATE"])(
    "keeps %s explicit without claiming success",
    (status) => {
      const { container } = render(
        <WorkflowProgress workflow="booking" status={status} />,
      );
      const step = container.querySelector('[aria-current="step"]');
      expect(step?.textContent).not.toContain("Completed");
      expect(progressStages("booking", status).at(-1)).toBe(status);
    },
  );
  it("keeps status readable without colour", () => {
    render(<StatusBadge status="AWAITING_PARTS" />);
    expect(screen.getByText("Awaiting parts").getAttribute("data-status")).toBe(
      "AWAITING_PARTS",
    );
  });
  it("distinguishes provider acceptance from confirmed inbox delivery and renders retry advice", () => {
    render(
      <SupportEmailDeliverySummary
        loading={false}
        onRefresh={() => {}}
        page={{
          items: [
            {
              id: "51000000-0000-4000-8000-000000000001",
              status: "SENT",
              reason: null,
              createdAt: "2026-10-22T09:00:00Z",
              sentAt: "2026-10-22T09:00:05Z",
              attempts: 1,
              nextRetryAt: null,
            },
            {
              id: "51000000-0000-4000-8000-000000000002",
              status: "RETRYING",
              reason: "SUPPORT_EMAIL_FAILED",
              createdAt: "2026-10-22T09:00:00Z",
              sentAt: null,
              attempts: 2,
              nextRetryAt: "2026-10-22T09:01:00Z",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText(/inbox placement/)).toBeTruthy();
    expect(screen.getByText(/Provider accepted/)).toBeTruthy();
    expect(screen.getByText(/Send attempts: 2/)).toBeTruthy();
    expect(screen.getByText(/Do not send the same reply again/)).toBeTruthy();
    expect(screen.getByText("Sent")).toBeTruthy();
  });
});
