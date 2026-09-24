"use client";
import { useCallback, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import {
  capabilityLabels,
  capabilitySchema,
  capabilityGrantSchema,
  parseCapabilityGrants,
  parseCapabilityRevocation,
} from "@/lib/api/capability-schemas";
import type { StaffMember } from "@/lib/api/staff-admin-schemas";
import { useResource } from "@/lib/api/use-resource";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

function label(value: string) {
  const parsed = capabilitySchema.safeParse(value);
  return parsed.success ? capabilityLabels[parsed.data] : value.replaceAll("_", " ");
}

export function StaffCapabilities({
  member,
  disabled,
}: {
  member: StaffMember;
  disabled: boolean;
}) {
  const parse = useCallback(
    (value: unknown) => {
      const grants = parseCapabilityGrants(value);
      if (grants.some((grant) => grant.userId !== member.id))
        throw new Error("Unexpected account permissions");
      return grants;
    },
    [member.id],
  );
  const parseActive = useCallback(
    (value: unknown) => {
      const grants = parse(value);
      if (grants.some((grant) => grant.revokedAt !== null))
        throw new Error("Unexpected revoked permission");
      return grants;
    },
    [parse],
  );
  const active = useResource(
    `/admin/capabilities?userId=${member.id}&activeOnly=true`,
    parseActive,
  );
  const history = useResource(`/admin/capabilities?userId=${member.id}`, parse);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [revokeId, setRevokeId] = useState("");
  const [message, setMessage] = useState<string>();
  const [validation, setValidation] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  const locked =
    disabled ||
    active.loading ||
    !!active.error ||
    !active.data ||
    !!proposal ||
    uncertain;
  const eligible = member.status === "ACTIVE" && !!member.emailVerifiedAt;
  const available = capabilitySchema.options.filter(
    (value) => !active.data?.some((grant) => grant.capability === value),
  );
  const selected = active.data?.find((grant) => grant.id === revokeId);
  function refresh() {
    active.refresh();
    history.refresh();
  }
  function reviewGrant(form: FormData) {
    if (locked || !eligible) return;
    const capability = capabilitySchema.safeParse(form.get("capability"));
    if (!capability.success || !available.includes(capability.data)) return;
    const body: RequestBody<"/admin/capabilities", "post"> = {
      userId: member.id,
      capability: capability.data,
    };
    setMessage(undefined);
    setProposal({
      title: "Grant this permission?",
      description:
        "This permits the selected duty within the account’s existing role and branch access. MFA and independent refund checks still apply.",
      facts: [
        { label: "Account", value: member.email },
        { label: "Permission", value: label(capability.data) },
      ],
      submit: async () => {
        const response = await apiRequest("/admin/capabilities", {
          method: "POST",
          csrf: true,
          body,
        });
        const grant = capabilityGrantSchema.parse(response.data);
        if (
          grant.userId !== member.id ||
          grant.capability !== capability.data ||
          grant.revokedAt !== null
        )
          throw new Error("Unexpected permission result");
      },
      onUncertain: () => setUncertain(true),
    });
  }
  function reviewRevoke(form: FormData) {
    if (locked || !selected) return;
    const reason = String(form.get("reason") ?? "").trim();
    setValidation(undefined);
    if (reason.length < 10 || reason.length > 1000) {
      setValidation("Explain the permission removal in 10–1,000 characters.");
      document.getElementById("capability-reason")?.focus();
      return;
    }
    const body: RequestBody<"/admin/capabilities/{id}/revoke", "post"> = { reason };
    setMessage(undefined);
    setProposal({
      title: "Revoke this permission?",
      description:
        "The server will reject future actions requiring this grant. The account’s other permissions remain available.",
      facts: [
        { label: "Account", value: member.email },
        { label: "Permission", value: label(selected.capability) },
        { label: "Reason", value: reason },
      ],
      submit: async () => {
        const response = await apiRequest(`/admin/capabilities/${selected.id}/revoke`, {
          method: "POST",
          csrf: true,
          body,
        });
        const result = parseCapabilityRevocation(response.data);
        if (result.id !== selected.id)
          throw new Error("Unexpected permission removal result");
      },
      onUncertain: () => setUncertain(true),
    });
  }
  return (
    <section className="detail-section" aria-labelledby="capabilities-title">
      <h2 id="capabilities-title">Operational permissions</h2>
      <p>
        Grant only the duties this person needs. These permissions do not change their
        role or branch assignment. Refund approval, transfer and checking require
        different people.
      </p>
      <Feedback message={active.error} />
      <Feedback message={validation} />
      <Feedback message={message} tone="success" toast="Permission change recorded." />
      {uncertain && (
        <Feedback
          tone="warning"
          message="The change could not be confirmed. Review the refreshed permissions before reloading this page to make another change."
        />
      )}
      <button
        className="button secondary"
        disabled={active.loading || history.loading || !!proposal}
        onClick={refresh}
      >
        Refresh permissions
      </button>
      {active.loading && <p role="status">Checking current permissions…</p>}
      {active.data && (
        <>
          {active.data.length === 0 ? (
            <p>No active operational permissions.</p>
          ) : (
            <ul className="record-list">
              {active.data.map((grant) => (
                <li key={grant.id}>
                  <strong>{label(grant.capability)}</strong>
                  <p className="muted">Granted {formatBusinessDate(grant.grantedAt)}</p>
                  <button
                    className="button secondary"
                    disabled={locked}
                    onClick={() => {
                      setRevokeId(grant.id);
                      setValidation(undefined);
                    }}
                  >
                    Revoke {label(grant.capability).toLowerCase()}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                reviewRevoke(new FormData(event.currentTarget));
              }}
            >
              <h3>Remove: {label(selected.capability)}</h3>
              <div className="field">
                <label htmlFor="capability-reason">Reason for removal</label>
                <textarea
                  key={selected.id}
                  id="capability-reason"
                  name="reason"
                  required
                  minLength={10}
                  maxLength={1000}
                />
              </div>
              <div className="actions">
                <button className="button" disabled={locked}>
                  Review permission removal
                </button>
                <button
                  type="button"
                  className="button secondary"
                  disabled={!!proposal}
                  onClick={() => setRevokeId("")}
                >
                  Cancel removal
                </button>
              </div>
            </form>
          )}
          {eligible ? (
            available.length > 0 && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  reviewGrant(new FormData(event.currentTarget));
                }}
              >
                <div className="field">
                  <label htmlFor="capability-grant">Permission to grant</label>
                  <select
                    id="capability-grant"
                    name="capability"
                    required
                    disabled={locked}
                    defaultValue=""
                  >
                    <option value="">Choose a duty</option>
                    {available.map((value) => (
                      <option key={value} value={value}>
                        {capabilityLabels[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="button" disabled={locked}>
                  Review permission grant
                </button>
              </form>
            )
          ) : (
            <p className="notice">
              New permissions require an active account with a verified email. Existing
              grants can still be revoked.
            </p>
          )}
        </>
      )}
      <details>
        <summary>Recent permission history</summary>
        <p>
          Latest 100 grant records, including revoked grants. Current permissions above
          include all active grants.
        </p>
        <Feedback message={history.error} />
        {history.loading && <p role="status">Loading permission history…</p>}
        {history.data?.length === 0 && <p>No permission history.</p>}
        <ul>
          {history.data?.map((grant) => (
            <li key={grant.id}>
              {label(grant.capability)} — granted {formatBusinessDate(grant.grantedAt)};{" "}
              {grant.revokedAt
                ? `revoked ${formatBusinessDate(grant.revokedAt)}`
                : "active"}
              .
            </li>
          ))}
        </ul>
      </details>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            refresh();
          }}
          onSuccess={() => {
            setMessage(
              "Permission change recorded. Current permissions are being refreshed.",
            );
            setRevokeId("");
          }}
        />
      )}
    </section>
  );
}
