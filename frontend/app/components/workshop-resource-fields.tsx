"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import {
  resourceDays,
  parseResourceOptions,
  type ResourceOption,
  type ResourceKind,
  type ResourceDraft,
  type ResourceCalendar,
} from "@/lib/admin/workshop-resource-draft";
import { Feedback } from "./feedback";
export function useResourceNames(
  branch: string,
  services: string[],
  technicians: string[],
  onDenied: () => void,
) {
  const serviceIds = services.join(","),
    staffIds = technicians.join(",");
  const parseServices = useCallback(
    (v: unknown) => parseResourceOptions(v, branch, "SERVICE"),
    [branch],
  );
  const parseStaff = useCallback(
    (v: unknown) => parseResourceOptions(v, branch, "TECHNICIAN"),
    [branch],
  );
  const service = useResource(
    serviceIds
      ? `/admin/policies/booking-resources/${branch}/options?kind=SERVICE&ids=${serviceIds}`
      : null,
    parseServices,
  );
  const staff = useResource(
    staffIds
      ? `/admin/policies/booking-resources/${branch}/options?kind=TECHNICIAN&ids=${staffIds}`
      : null,
    parseStaff,
  );
  useEffect(() => {
    if (service.denied || staff.denied) onDenied();
  }, [service.denied, staff.denied, onDenied]);
  return {
    labels: Object.fromEntries(
      [...(service.data?.items ?? []), ...(staff.data?.items ?? [])].map((r) => [
        r.id,
        r,
      ]),
    ) as Record<string, ResourceOption>,
    loading: !!((serviceIds && service.loading) || (staffIds && staff.loading)),
    error: service.error ?? service.refreshError ?? staff.error ?? staff.refreshError,
    refresh: () => {
      service.refresh();
      staff.refresh();
    },
  };
}
function ReferencePicker({
  branch,
  kind,
  selected,
  onPick,
  onDenied,
}: {
  branch: string;
  kind: ResourceKind;
  selected: string[];
  onPick: (r: ResourceOption) => void;
  onDenied: () => void;
}) {
  const [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [cursor, setCursor] = useState("");
  const parse = useCallback(
    (v: unknown) => parseResourceOptions(v, branch, kind),
    [branch, kind],
  );
  const result = useResource(
    `/admin/policies/booking-resources/${branch}/options?kind=${kind}&q=${encodeURIComponent(search)}${cursor ? `&cursor=${cursor}` : ""}`,
    parse,
  );
  useEffect(() => {
    if (result.denied) onDenied();
  }, [result.denied, onDenied]);
  const name = kind === "SERVICE" ? "service" : "technician";
  function find() {
    setCursor("");
    setSearch(q.trim());
    result.refresh();
  }
  return (
    <div className="resource-picker">
      <label>
        Search existing {name}s
        <input
          value={q}
          maxLength={80}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              find();
            }
          }}
        />
      </label>
      <button type="button" className="button secondary" onClick={find}>
        Search {name}s
      </button>
      <Feedback message={result.error ?? result.refreshError} />
      {result.loading && <p role="status">Loading {name}s…</p>}
      {result.data && (
        <>
          <label>
            Add an existing {name}
            <select
              value=""
              onChange={(e) => {
                const row = result.data?.items.find((r) => r.id === e.target.value);
                if (row?.eligible && !selected.includes(row.id)) onPick(row);
              }}
            >
              <option value="">Choose {name}</option>
              {result.data.items.map((r) => (
                <option
                  value={r.id}
                  key={r.id}
                  disabled={!r.eligible || selected.includes(r.id)}
                >
                  {r.label}
                  {selected.includes(r.id)
                    ? " — already added"
                    : !r.eligible
                      ? " — unavailable"
                      : ""}
                </option>
              ))}
            </select>
          </label>
          {!result.data.items.length && (
            <p>
              No eligible {name}s match. Try another search or check actual work
              permissions.
            </p>
          )}
          {result.data.nextCursor && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setCursor(result.data!.nextCursor!)}
            >
              Next {name}s
            </button>
          )}
          {cursor && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setCursor("")}
            >
              First {name}s
            </button>
          )}
        </>
      )}
      {result.error && (
        <button type="button" className="button secondary" onClick={result.refresh}>
          Retry {name} search
        </button>
      )}
    </div>
  );
}
function AvailabilityEditor({
  value,
  onChange,
}: {
  value: ResourceCalendar;
  onChange: (v: ResourceCalendar) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  function added(selector: string) {
    requestAnimationFrame(() => {
      const row = root.current?.querySelectorAll<HTMLElement>(selector);
      const target = row?.[row.length - 1];
      target?.scrollIntoView({ block: "nearest" });
      target?.querySelector<HTMLElement>("select,input")?.focus({ preventScroll: true });
    });
  }
  return (
    <div ref={root} className="resource-calendar">
      <p>Working periods in Nigeria time. Add separate periods around breaks.</p>
      {value.workingPeriods.map((p, i) => (
        <div className="resource-period" data-period key={i}>
          <label>
            Day
            <select
              value={p.weekday}
              onChange={(e) =>
                onChange({
                  ...value,
                  workingPeriods: value.workingPeriods.map((p, j) =>
                    j === i ? { ...p, weekday: Number(e.target.value) } : p,
                  ),
                })
              }
            >
              <option value={-1}>Choose day</option>
              {resourceDays.map((d, j) => (
                <option value={j} key={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="time"
              value={p.opensAt}
              onChange={(e) =>
                onChange({
                  ...value,
                  workingPeriods: value.workingPeriods.map((p, j) =>
                    j === i ? { ...p, opensAt: e.target.value } : p,
                  ),
                })
              }
            />
          </label>
          <label>
            Until
            <input
              type="time"
              value={p.closesAt}
              onChange={(e) =>
                onChange({
                  ...value,
                  workingPeriods: value.workingPeriods.map((p, j) =>
                    j === i ? { ...p, closesAt: e.target.value } : p,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className="button secondary"
            aria-label={`Remove working period ${i + 1}`}
            onClick={() =>
              onChange({
                ...value,
                workingPeriods: value.workingPeriods.filter((_, j) => j !== i),
              })
            }
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button secondary"
        disabled={value.workingPeriods.length >= 28}
        onClick={() => {
          onChange({
            ...value,
            workingPeriods: [
              ...value.workingPeriods,
              { weekday: -1, opensAt: "", closesAt: "" },
            ],
          });
          added("[data-period]");
        }}
      >
        Add working period
      </button>
      <details>
        <summary>Unavailable periods ({value.unavailablePeriods.length})</summary>
        {value.unavailablePeriods.map((p, i) => (
          <div className="resource-period" data-exception key={i}>
            <label>
              Unavailable from
              <input
                type="datetime-local"
                step="0.001"
                value={p.startsAt}
                onChange={(e) =>
                  onChange({
                    ...value,
                    unavailablePeriods: value.unavailablePeriods.map((p, j) =>
                      j === i ? { ...p, startsAt: e.target.value } : p,
                    ),
                  })
                }
              />
            </label>
            <label>
              Available again
              <input
                type="datetime-local"
                step="0.001"
                value={p.endsAt}
                onChange={(e) =>
                  onChange({
                    ...value,
                    unavailablePeriods: value.unavailablePeriods.map((p, j) =>
                      j === i ? { ...p, endsAt: e.target.value } : p,
                    ),
                  })
                }
              />
            </label>
            <label>
              Reason
              <input
                value={p.reason}
                maxLength={120}
                onChange={(e) =>
                  onChange({
                    ...value,
                    unavailablePeriods: value.unavailablePeriods.map((p, j) =>
                      j === i ? { ...p, reason: e.target.value } : p,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                onChange({
                  ...value,
                  unavailablePeriods: value.unavailablePeriods.filter((_, j) => j !== i),
                })
              }
            >
              Remove unavailable period {i + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button secondary"
          disabled={value.unavailablePeriods.length >= 100}
          onClick={() => {
            onChange({
              ...value,
              unavailablePeriods: [
                ...value.unavailablePeriods,
                { startsAt: "", endsAt: "", reason: "" },
              ],
            });
            added("[data-exception]");
          }}
        >
          Add unavailable period
        </button>
      </details>
    </div>
  );
}
export function ResourcePlanFields({
  draft,
  setDraft,
  branch,
  labels,
  onDenied,
}: {
  draft: ResourceDraft;
  setDraft: (v: ResourceDraft) => void;
  branch: string;
  labels: Record<string, ResourceOption>;
  onDenied: () => void;
}) {
  const root = useRef<HTMLDivElement>(null),
    name = (id: string) => labels[id]?.label ?? "Record name loading or unavailable";
  function scrollNew(section: string) {
    requestAnimationFrame(() => {
      const rows = root.current?.querySelectorAll<HTMLElement>(`[data-${section}]`);
      const row = rows?.[rows.length - 1];
      row?.scrollIntoView({ block: "nearest" });
      row?.querySelector<HTMLElement>("input,select")?.focus({ preventScroll: true });
    });
  }
  const addUnit = (kind: "EQUIPMENT" | "SPACE") => {
    setDraft({
      ...draft,
      resources: [
        ...draft.resources,
        {
          id: crypto.randomUUID(),
          name: "",
          kind,
          poolsText: "",
          status: "",
          workingPeriods: [],
          unavailablePeriods: [],
        },
      ],
    });
    scrollNew("unit");
  };
  return (
    <div ref={root}>
      <h3>Equipment and shared spaces</h3>
      <p>
        Record each physical unit once. Multiple category labels do not turn one unit into
        several machines.
      </p>
      {draft.resources.map((r, i) => (
        <fieldset className="resource-row" data-unit key={r.id}>
          <legend>
            Physical unit {i + 1} · {r.kind === "SPACE" ? "Shared space" : "Equipment"}
          </legend>
          <div className="resource-grid">
            <label>
              Unit name
              <input
                value={r.name}
                maxLength={120}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    resources: draft.resources.map((r, j) =>
                      j === i ? { ...r, name: e.target.value } : r,
                    ),
                  })
                }
              />
            </label>
            <label>
              Current condition
              <select
                value={r.status}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    resources: draft.resources.map((r, j) =>
                      j === i ? { ...r, status: e.target.value as typeof r.status } : r,
                    ),
                  })
                }
              >
                <option value="">Choose condition</option>
                <option value="AVAILABLE">Available</option>
                <option value="UNAVAILABLE">Unavailable</option>
              </select>
            </label>
            <label>
              Resource categories
              <input
                value={r.poolsText}
                maxLength={620}
                placeholder="e.g. alignment, lift"
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    resources: draft.resources.map((r, j) =>
                      j === i ? { ...r, poolsText: e.target.value } : r,
                    ),
                  })
                }
              />
            </label>
            <p>
              Separate categories with commas. Use lower-case names and hyphens, such as
              wheel-alignment.
            </p>
          </div>
          <AvailabilityEditor
            value={r}
            onChange={(v) =>
              setDraft({
                ...draft,
                resources: draft.resources.map((r, j) => (j === i ? { ...r, ...v } : r)),
              })
            }
          />
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setDraft({ ...draft, resources: draft.resources.filter((_, j) => j !== i) })
            }
          >
            Remove physical unit {i + 1} from plan
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="button secondary"
        disabled={draft.resources.length >= 100}
        onClick={() => addUnit("EQUIPMENT")}
      >
        Add equipment
      </button>
      <button
        type="button"
        className="button secondary"
        disabled={draft.resources.length >= 100}
        onClick={() => addUnit("SPACE")}
      >
        Add shared space
      </button>
      <h3>Services and requirements</h3>
      <ReferencePicker
        branch={branch}
        kind="SERVICE"
        selected={draft.services.map((s) => s.serviceId)}
        onDenied={onDenied}
        onPick={(r) => {
          if (draft.services.length < 100) {
            setDraft({
              ...draft,
              services: [
                ...draft.services,
                { serviceId: r.id, noResources: false, requirements: [] },
              ],
            });
            scrollNew("service");
          }
        }}
      />
      {draft.services.map((s, i) => (
        <fieldset className="resource-row" data-service key={s.serviceId}>
          <legend>{name(s.serviceId)}</legend>
          {labels[s.serviceId]?.eligible === false && (
            <p>This service is unavailable for a new approval.</p>
          )}
          <label className="resource-check">
            <input
              type="checkbox"
              checked={s.noResources}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  services: draft.services.map((s, j) =>
                    j === i
                      ? {
                          ...s,
                          noResources: e.target.checked,
                          requirements: e.target.checked ? [] : s.requirements,
                        }
                      : s,
                  ),
                })
              }
            />
            Assessed: no equipment or shared space required
          </label>
          {s.requirements.map((r, j) => (
            <div className="resource-period" key={j}>
              <label>
                Required category
                <select
                  value={r.pool}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      services: draft.services.map((s, k) =>
                        k === i
                          ? {
                              ...s,
                              requirements: s.requirements.map((r, k) =>
                                k === j ? { ...r, pool: e.target.value } : r,
                              ),
                            }
                          : s,
                      ),
                    })
                  }
                >
                  <option value="">Choose category</option>
                  {[
                    ...new Set(
                      draft.resources.flatMap((r) =>
                        r.poolsText.split(",").map((p) => p.trim()),
                      ),
                    ),
                  ]
                    .filter(Boolean)
                    .map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                </select>
              </label>
              <label>
                Units needed
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={r.quantity}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      services: draft.services.map((s, k) =>
                        k === i
                          ? {
                              ...s,
                              requirements: s.requirements.map((r, k) =>
                                k === j ? { ...r, quantity: Number(e.target.value) } : r,
                              ),
                            }
                          : s,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  setDraft({
                    ...draft,
                    services: draft.services.map((s, k) =>
                      k === i
                        ? { ...s, requirements: s.requirements.filter((_, k) => k !== j) }
                        : s,
                    ),
                  })
                }
              >
                Remove requirement {j + 1}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button secondary"
            disabled={s.noResources || s.requirements.length >= 10}
            onClick={() =>
              setDraft({
                ...draft,
                services: draft.services.map((s, j) =>
                  j === i
                    ? {
                        ...s,
                        requirements: [...s.requirements, { pool: "", quantity: 1 }],
                      }
                    : s,
                ),
              })
            }
          >
            Add requirement
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setDraft({
                ...draft,
                services: draft.services.filter((_, j) => j !== i),
                technicians: draft.technicians.map((t) => ({
                  ...t,
                  serviceIds: t.serviceIds.filter((id) => id !== s.serviceId),
                })),
              })
            }
          >
            Remove service from plan
          </button>
        </fieldset>
      ))}
      <h3>Qualified technicians</h3>
      <p>
        Select authorised staff, then record their actual qualifications and availability.
        This plan does not grant job permissions.
      </p>
      <ReferencePicker
        branch={branch}
        kind="TECHNICIAN"
        selected={draft.technicians.map((t) => t.staffId)}
        onDenied={onDenied}
        onPick={(r) => {
          if (draft.technicians.length < 100) {
            setDraft({
              ...draft,
              technicians: [
                ...draft.technicians,
                {
                  staffId: r.id,
                  serviceIds: [],
                  workingPeriods: [],
                  unavailablePeriods: [],
                },
              ],
            });
            scrollNew("technician");
          }
        }}
      />
      {draft.technicians.map((t, i) => (
        <fieldset className="resource-row" data-technician key={t.staffId}>
          <legend>{name(t.staffId)}</legend>
          {labels[t.staffId]?.eligible === false && (
            <p>
              Current job permissions do not allow this selection. Review actual duties
              separately or remove this technician from the plan.
            </p>
          )}
          <fieldset>
            <legend>Qualified services</legend>
            {draft.services.map((s) => (
              <label className="resource-check" key={s.serviceId}>
                <input
                  type="checkbox"
                  checked={t.serviceIds.includes(s.serviceId)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      technicians: draft.technicians.map((t, j) =>
                        j === i
                          ? {
                              ...t,
                              serviceIds: e.target.checked
                                ? [...t.serviceIds, s.serviceId]
                                : t.serviceIds.filter((id) => id !== s.serviceId),
                            }
                          : t,
                      ),
                    })
                  }
                />
                {name(s.serviceId)}
              </label>
            ))}
            {!draft.services.length && <p>Add services first.</p>}
          </fieldset>
          <AvailabilityEditor
            value={t}
            onChange={(v) =>
              setDraft({
                ...draft,
                technicians: draft.technicians.map((t, j) =>
                  j === i ? { ...t, ...v } : t,
                ),
              })
            }
          />
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setDraft({
                ...draft,
                technicians: draft.technicians.filter((_, j) => j !== i),
              })
            }
          >
            Remove technician from plan
          </button>
        </fieldset>
      ))}
    </div>
  );
}
