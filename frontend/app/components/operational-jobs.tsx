"use client";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { parseJobs, parseJobRetry } from "@/lib/api/operations-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { OperationsQueue } from "./operations-queue";
import { OperationActionForm } from "./operation-action-form";
export function OperationalJobs() {
  return (
    <OperationsQueue
      title="Processing jobs"
      description="Review failed or active background work. A retry queues another processing attempt and can trigger business actions; it does not prove successful delivery or payment settlement."
      endpoint="/admin/operations/jobs"
      parse={parseJobs}
      paginate={false}
      initialFilters={{ source: "OUTBOX" }}
      filters={[
        {
          name: "source",
          label: "Job source",
          options: ["OUTBOX", "PAYMENT_WEBHOOK"],
          required: true,
        },
        {
          name: "status",
          label: "Job status",
          options: ["FAILED", "DEAD_LETTER", "PROCESSING"],
        },
      ]}
      render={(job, actions) => {
        const attempts = job.source === "OUTBOX" ? job.attempts : job.processingAttempts;
        const source = job.source === "OUTBOX" ? "outbox" : "webhook";
        const key = `${source}-${job.id}`;
        return (
          <section className="detail-section" key={key} aria-labelledby={`job-${key}`}>
            <h2 id={`job-${key}`}>{job.eventType}</h2>
            <p className="status">{job.status.replaceAll("_", " ")}</p>
            <dl className="totals">
              <dt>Source</dt>
              <dd>{job.source.replaceAll("_", " ")}</dd>
              <dt>Job reference</dt>
              <dd>{job.id}</dd>
              <dt>Processing attempts</dt>
              <dd>{attempts}</dd>
              <dt>Last updated</dt>
              <dd>{formatBusinessDate(job.updatedAt)}</dd>
              {job.source === "OUTBOX" ? (
                <>
                  <dt>Related record</dt>
                  <dd>
                    {job.aggregateType}: {job.aggregateId}
                  </dd>
                  <dt>Available from</dt>
                  <dd>{formatBusinessDate(job.availableAt)}</dd>
                </>
              ) : (
                <>
                  <dt>Received</dt>
                  <dd>{formatBusinessDate(job.receivedAt)}</dd>
                  {job.nextAttemptAt && (
                    <>
                      <dt>Next scheduled attempt</dt>
                      <dd>{formatBusinessDate(job.nextAttemptAt)}</dd>
                    </>
                  )}
                </>
              )}
              {job.lockedAt && (
                <>
                  <dt>Processing lock recorded</dt>
                  <dd>{formatBusinessDate(job.lockedAt)}</dd>
                </>
              )}
            </dl>
            <p className="muted">
              Use the job reference in authorized operational logs to investigate failure
              details.
            </p>
            {job.status === "PROCESSING" ? (
              <p className="notice">
                Processing is already in progress. Refresh to check its outcome; a manual
                retry is unavailable.
              </p>
            ) : attempts < 1 || attempts > 1000 ? (
              <p className="notice">
                This attempt count is outside the supported manual retry range.
                Operational investigation is required.
              </p>
            ) : (
              <OperationActionForm
                id={key}
                revision={`${job.status}:${attempts}`}
                label="Job retry"
                options={["RETRY"]}
                maxLength={500}
                disabled={actions.disabled}
                uncertain={actions.uncertain(key)}
                onReview={(proposal) => actions.review(key, proposal)}
                proposal={(values) => {
                  const body: RequestBody<
                    "/admin/operations/jobs/{source}/{jobId}/retry",
                    "post"
                  > = { expectedAttempts: attempts, reason: values.reason };
                  return {
                    title: "Queue another processing attempt?",
                    description:
                      source === "outbox"
                        ? "This can send a notification or run another business event. Investigate the failure and any prior delivery before retrying. Queueing does not confirm that the event completed."
                        : "This queues the stored payment webhook for processing again. It may update financial or fulfilment records. Reconcile previous processing before retrying; this does not prove payment or refund completion.",
                    facts: [
                      { label: "Job", value: job.id },
                      { label: "Event", value: job.eventType },
                      { label: "Recorded attempts", value: String(attempts) },
                      { label: "Reason", value: values.reason },
                    ],
                    submit: () =>
                      apiRequest(`/admin/operations/jobs/${source}/${job.id}/retry`, {
                        method: "POST",
                        csrf: true,
                        body,
                      }).then((result) => parseJobRetry(result.data)),
                  };
                }}
              />
            )}
          </section>
        );
      }}
    />
  );
}
