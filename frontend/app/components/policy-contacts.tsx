"use client";
import { useState } from "react";
import {
  parsePolicyContact,
  parsePolicyContacts,
} from "@/lib/api/operational-policy-schemas";
import { parseCapabilityGrants } from "@/lib/api/capability-schemas";
import { useResource } from "@/lib/api/use-resource";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { ActionButton } from "./action";

type Contacts = ReturnType<typeof parsePolicyContacts>["items"];
function ContactChoice({
  name,
  label,
  initialId,
  choices,
  dispute,
  showIdentity = false,
}: {
  name: string;
  label: string;
  initialId: string;
  choices: Contacts;
  dispute: boolean;
  showIdentity?: boolean;
}) {
  const [selected, setSelected] = useState(initialId);
  const person = useResource(
    selected ? `/admin/staff/${selected}` : null,
    parsePolicyContact,
  );
  const grants = useResource(
    selected && dispute ? `/admin/capabilities?userId=${selected}&activeOnly=true` : null,
    parseCapabilityGrants,
  );
  const eligible =
    !!selected &&
    !person.loading &&
    !person.error &&
    !person.refreshing &&
    !person.refreshError &&
    person.data?.id === selected &&
    person.data.status === "ACTIVE" &&
    !!person.data.emailVerifiedAt &&
    (dispute ? ["STAFF", "ADMIN", "SUPER_ADMIN"] : ["ADMIN", "SUPER_ADMIN"]).includes(
      person.data.role,
    ) &&
    (!dispute ||
      (!grants.loading &&
        !grants.error &&
        !grants.refreshing &&
        !grants.refreshError &&
        !!grants.data &&
        grants.data.every((g) => g.userId === selected) &&
        grants.data.some((g) => g.capability === "DISPUTE_MANAGE" && !g.revokedAt)));
  const labelFor = (p: Contacts[number]) =>
    `${p.staffProfile ? `${p.staffProfile.firstName} ${p.staffProfile.lastName} · ` : ""}${p.email} (${p.role.replaceAll("_", " ")})`;
  return (
    <div className="field">
      <label htmlFor={`policy-${name}`}>{label}</label>
      <select
        id={`policy-${name}`}
        value={selected}
        required
        onChange={(e) => setSelected(e.target.value)}
        aria-describedby={`policy-${name}-help`}
      >
        <option value="">Choose an eligible account</option>
        {selected && !choices.some((p) => p.id === selected) && (
          <option value={selected}>
            {person.data?.id === selected
              ? labelFor(person.data)
              : "Selected account — checking eligibility"}
          </option>
        )}
        {choices.map((p) => (
          <option key={p.id} value={p.id}>
            {labelFor(p)}
          </option>
        ))}
      </select>
      <input type="hidden" name={name} value={eligible ? selected : ""} />
      {showIdentity && person.data?.id === selected && (
        <p className="policy-selected-contact">Selected: {labelFor(person.data)}</p>
      )}
      <input
        type="hidden"
        name={`${name}Label`}
        value={eligible && person.data ? labelFor(person.data) : ""}
      />
      <span id={`policy-${name}-help`} className="field-hint">
        {dispute
          ? "Requires an active, verified account with permission to manage disputes."
          : "Requires an active, verified Admin or Super Admin account."}
      </span>
      {(person.loading || grants.loading) && (
        <p role="status">Checking {label.toLowerCase()}…</p>
      )}
      <Feedback
        message={
          person.error ?? person.refreshError ?? grants.error ?? grants.refreshError
        }
      />
      {selected &&
        !person.loading &&
        !grants.loading &&
        !eligible &&
        !person.error &&
        !grants.error && (
          <Feedback message="This account is not currently eligible. Choose another account or review its access in the staff directory." />
        )}
      {selected && (
        <button
          type="button"
          className="text-link"
          onClick={() => {
            person.refresh();
            grants.refresh();
          }}
        >
          Recheck {label.toLowerCase()}
        </button>
      )}
    </div>
  );
}
export function PolicyContacts({
  dispute,
  initial,
  searchable = false,
  paired = false,
}: {
  dispute: boolean;
  initial: Record<string, unknown> | undefined;
  searchable?: boolean;
  paired?: boolean;
}) {
  const pagination = useCursorPage();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState<string>();
  function applySearch() {
    const value = search.trim();
    if (value && (value.length < 2 || value.length > 100)) {
      setSearchError("Enter 2–100 characters, or clear the search.");
      document.getElementById("policy-contact-search")?.focus();
      return;
    }
    setSearchError(undefined);
    pagination.reset();
    setQuery(value);
  }
  const record = useResource(
    `/admin/staff?status=ACTIVE&limit=50${query ? `&q=${encodeURIComponent(query)}` : ""}${pagination.cursor ? `&cursor=${encodeURIComponent(pagination.cursor)}` : ""}`,
    parsePolicyContacts,
  );
  const choices = !record.error
    ? (record.data?.items ?? []).filter(
        (p) =>
          p.status === "ACTIVE" &&
          p.emailVerifiedAt &&
          (dispute
            ? ["STAFF", "ADMIN", "SUPER_ADMIN"]
            : ["ADMIN", "SUPER_ADMIN"]
          ).includes(p.role),
      )
    : [];
  const contacts = (
    dispute
      ? [
          ["primaryUserId", "Primary contact"],
          ["backupUserId", "Backup contact"],
        ]
      : [["escalationUserId", "Escalation contact"]]
  ).map(([name, label]) => (
    <ContactChoice
      key={name}
      name={name!}
      label={label!}
      initialId={typeof initial?.[name!] === "string" ? String(initial[name!]) : ""}
      choices={choices}
      dispute={dispute}
      showIdentity={searchable}
    />
  ));
  return (
    <fieldset>
      <legend>{dispute ? "Dispute contacts" : "Complaint escalation contact"}</legend>
      <p>
        Choose an account from the staff directory. Publication rechecks eligibility on
        the server.
      </p>
      {searchable && (
        <div className="policy-contact-search">
          <div className="field">
            <label htmlFor="policy-contact-search">Search staff contacts</label>
            <input
              id="policy-contact-search"
              type="search"
              value={search}
              maxLength={100}
              aria-invalid={!!searchError}
              aria-describedby={searchError ? "policy-contact-search-error" : undefined}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applySearch();
                }
              }}
            />
          </div>
          <div className="policy-search-actions">
            <button className="button secondary" type="button" onClick={applySearch}>
              Search contacts
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setSearch("");
                setQuery("");
                setSearchError(undefined);
                pagination.reset();
              }}
            >
              Clear search
            </button>
          </div>
          <div id="policy-contact-search-error">
            <Feedback message={searchError} />
          </div>
          {query && <p role="status">Contacts matching “{query}”.</p>}
        </div>
      )}
      <Feedback message={record.error} />
      {record.loading && <p role="status">Loading policy contacts…</p>}
      {!record.loading && !record.error && choices.length === 0 && (
        <p>
          No eligible contacts on this page. Check another page or review staff access.
        </p>
      )}
      {paired ? <div className="policy-contact-pair">{contacts}</div> : contacts}
      <ActionButton
        type="button"
        variant="secondary"
        disabled={record.loading || record.refreshing}
        aria-busy={record.loading || record.refreshing}
        onClick={record.refresh}
      >
        Refresh contact directory
      </ActionButton>
      {(record.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={record.error ? undefined : record.data?.nextCursor}
          disabled={record.loading || !!record.error}
          label="Policy contacts"
        />
      )}
    </fieldset>
  );
}
