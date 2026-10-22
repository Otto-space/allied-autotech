"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CarFront,
  ChevronRight,
  Image as ImageIcon,
  Tag,
} from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { useResource } from "@/lib/api/use-resource";
import { parseWorkVehicleStock } from "@/lib/admin/work-vehicle-stock";
import {
  clearStockCreation,
  confirmStockCreation,
  markStockCreation,
  parseCreatedStock,
  readStockCreation,
  stockCreationDraft,
  type StockCreationState,
  type StockCreationPending,
} from "@/lib/admin/vehicle-stock-creation";
import {
  recordSchema,
  vehicleDefaults,
  vehicleRecordBody,
  type VehicleRecordValues,
} from "@/lib/forms/vehicle-record";
import { draftIdentity, draftKey, forgetDraft, readDraft } from "@/lib/forms/drafts";
import { vehicleEnums } from "@/lib/api/staff-vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
const roles = ["STAFF", "ADMIN", "SUPER_ADMIN"];
export function WorkVehicleCreate() {
  const session = useAccountSession();
  if (!session) return null;
  return (
    <div className="work-vehicle-create">
      <nav className="vc-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight aria-hidden="true" />
        <Link href="/admin/vehicles">Vehicle stock</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">Add vehicle record</span>
      </nav>
      <header className="vc-header">
        <div>
          <h1>Add vehicle record</h1>
          <p>Record the vehicle first. Photos and sale listings follow.</p>
        </div>
        <Link className="vc-back" href="/admin/vehicles">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to vehicle stock
        </Link>
      </header>
      {session && roles.includes(session.user.role) ? (
        <CreationAccess
          key={`${session.user.id}:${session.user.role}`}
          owner={session.user.id}
          role={session.user.role}
        />
      ) : (
        <Feedback message="Staff access is required to create a vehicle record." />
      )}
    </div>
  );
}
function CreationAccess({ owner, role }: { owner: string; role: string }) {
  const profile = useOwnStaffPermissions(),
    row = profile.data;
  const invalid =
    !!row && (row.id !== owner || row.role !== role || row.status !== "ACTIVE");
  if (profile.error || profile.refreshError || invalid)
    return (
      <div className="vc-state">
        <Feedback
          message={
            profile.error ||
            profile.refreshError ||
            "Current vehicle creation access could not be confirmed."
          }
        />
        <button
          className="button secondary"
          disabled={profile.loading || profile.refreshing}
          onClick={profile.refresh}
        >
          Retry creation access
        </button>
      </div>
    );
  if (!row) return <p role="status">Checking vehicle creation access…</p>;
  if (role === "STAFF" && !row.staffProfile?.branchId)
    return (
      <div className="vc-state">
        <p>
          An active branch assignment is required to create a vehicle record. Contact your
          administrator.
        </p>
        <button className="button secondary" onClick={profile.refresh}>
          Refresh staff profile
        </button>
      </div>
    );
  return role === "STAFF" ? (
    <AssignedCreationBranch
      key={row.staffProfile!.branchId!}
      owner={owner}
      role={role}
      branchId={row.staffProfile!.branchId!}
    />
  ) : (
    <CreationWorkspace owner={owner} role={role} />
  );
}
function AssignedCreationBranch({
  owner,
  role,
  branchId,
}: {
  owner: string;
  role: string;
  branchId: string;
}) {
  const parse = useCallback(
    (v: unknown) => parseWorkVehicleStock(v, role, branchId),
    [role, branchId],
  );
  const scope = useResource("/staff/vehicles?limit=1", parse);
  if (scope.error || scope.refreshError || !scope.data)
    return (
      <div className="vc-state">
        {scope.loading ? (
          <p role="status">Checking assigned branch access…</p>
        ) : (
          <>
            <Feedback
              message={
                scope.error ||
                scope.refreshError ||
                "Assigned branch access could not be confirmed."
              }
            />
            <button className="button secondary" onClick={scope.refresh}>
              Retry assigned branch
            </button>
          </>
        )}
      </div>
    );
  return (
    <CreationWorkspace
      owner={owner}
      role={role}
      branchId={branchId}
      branchName={scope.data.items[0]?.branch.name}
    />
  );
}
const branchSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  isActive: z.literal(true),
});
function CreationWorkspace({
  owner,
  role,
  branchId,
  branchName,
}: {
  owner: string;
  role: string;
  branchId?: string;
  branchName?: string;
}) {
  const router = useRouter(),
    [recovery, setRecovery] = useState<StockCreationState | undefined>(() =>
      readStockCreation(owner, role),
    ),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [checking, setChecking] = useState(false),
    [message, setMessage] = useState<string>(),
    [acknowledged, setAcknowledged] = useState(false),
    [generation, setGeneration] = useState(0);
  const active = useRef(true),
    request = useRef<AbortController | null>(null);
  const includeCost = role !== "STAFF",
    draft = stockCreationDraft(branchId);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  function current(signal: AbortSignal) {
    if (!active.current || signal.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Vehicle account changed");
  }
  async function access(signal: AbortSignal, selectedBranch?: string) {
    const profile = parseOwnStaffProfile(
      (await apiRequest("/staff/profile", { signal })).data,
    );
    current(signal);
    if (
      profile.id !== owner ||
      profile.role !== role ||
      profile.status !== "ACTIVE" ||
      !roles.includes(profile.role)
    )
      throw Error("Current vehicle creation access could not be confirmed.");
    if (role === "STAFF") {
      if (!branchId || profile.staffProfile?.branchId !== branchId)
        throw Error(
          "Your branch assignment changed. Reload this page to start a draft for the current branch.",
        );
      const scope = parseWorkVehicleStock(
        (await apiRequest("/staff/vehicles?limit=1", { signal })).data,
        role,
        branchId,
      );
      current(signal);
      return scope.items[0]?.branch.name ?? "Assigned workshop branch";
    }
    if (selectedBranch) {
      const branch = branchSchema.parse(
        (await apiRequest(`/admin/branches/${selectedBranch}`, { signal })).data,
      );
      current(signal);
      if (branch.id !== selectedBranch)
        throw Error("The selected branch could not be confirmed.");
      return branch.name;
    }
    return "";
  }
  async function review(values: VehicleRecordValues) {
    if (proposal || recovery || request.current || !active.current) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setMessage(undefined);
    const body = {
      ...vehicleRecordBody(values, includeCost),
      branchId: branchId ?? values.branchId,
      stockNumber: values.stockNumber.toUpperCase(),
    };
    try {
      const name = await access(controller.signal, body.branchId);
      current(controller.signal);
      if (readStockCreation(owner, role) !== undefined) {
        setRecovery(readStockCreation(owner, role));
        throw Error("An earlier vehicle creation needs reconciliation.");
      }
      const human = (value: string | null | undefined) =>
        value
          ? value
              .replaceAll("_", " ")
              .toLowerCase()
              .replace(/^./, (c) => c.toUpperCase())
          : "Not recorded";
      const facts = [
        { label: "Workshop branch", value: name },
        { label: "Branch reference", value: body.branchId },
        { label: "Stock number", value: body.stockNumber },
        { label: "Make", value: body.make },
        { label: "Model", value: body.model },
        { label: "Model year", value: String(body.year) },
        { label: "Trim", value: body.trim ?? "Not recorded" },
        { label: "Condition", value: human(body.condition) },
        {
          label: "Mileage",
          value:
            body.mileageKm == null
              ? "Not recorded"
              : `${body.mileageKm.toLocaleString("en-NG")} km`,
        },
        { label: "Transmission", value: human(body.transmission) },
        { label: "Fuel type", value: human(body.fuelType) },
        { label: "Body type", value: human(body.bodyType) },
        { label: "Drive type", value: human(body.driveType) },
        { label: "Engine size", value: body.engineSize ?? "Not recorded" },
        { label: "Colour", value: body.color ?? "Not recorded" },
        { label: "Doors", value: body.doors?.toString() ?? "Not recorded" },
        { label: "Seats", value: body.seats?.toString() ?? "Not recorded" },
        { label: "VIN", value: body.vin ?? "Not recorded" },
        { label: "Chassis number", value: body.chassisNumber ?? "Not recorded" },
        {
          label: "Registration number",
          value: body.registrationNumber ?? "Not recorded",
        },
        ...(includeCost
          ? [
              {
                label: "Acquisition cost",
                value:
                  body.acquisitionCostKobo == null
                    ? "Not recorded"
                    : formatKobo(body.acquisitionCostKobo),
              },
            ]
          : []),
        {
          label: "Acquired at",
          value: body.acquiredAt ? formatBusinessDate(body.acquiredAt) : "Not recorded",
        },
      ];
      let sent = false,
        pending: StockCreationPending | undefined;
      setProposal({
        title: "Create this stock record?",
        description:
          "Review all permitted vehicle details. This creates a stock record only. It does not create or publish a sale listing. Photos are added after saving. Empty optional fields are recorded as not set.",
        facts,
        retryAfterRejection: false,
        onUncertain: () => {
          if (sent && active.current)
            setRecovery(readStockCreation(owner, role) ?? "unknown");
        },
        submit: async () => {
          if (request.current || !active.current)
            throw Error("Vehicle creation is blocked");
          const confirm = new AbortController();
          request.current = confirm;
          try {
            await access(confirm.signal, body.branchId);
            current(confirm.signal);
            pending = markStockCreation(owner, role, body.stockNumber, body.branchId);
            setRecovery(pending);
            sent = true;
            const response = await apiRequest("/staff/vehicles", {
              method: "POST",
              csrf: true,
              body,
              signal: confirm.signal,
            });
            const saved = parseCreatedStock(response.data, body, role);
            current(confirm.signal);
            const state = confirmStockCreation(owner, role, pending, saved.id);
            setRecovery(state);
            forgetDraft(draftKey(`${owner}:${role}`, "/admin/vehicles/new", draft));
            router.push(`/admin/vehicles/${saved.id}#vehicle-photos`);
          } catch (error) {
            if (sent && error instanceof ApiError && [408, 429].includes(error.status))
              throw Error("Vehicle creation needs reconciliation.");
            if (
              sent &&
              pending &&
              error instanceof ApiError &&
              error.status >= 400 &&
              error.status < 500
            ) {
              clearStockCreation(owner, role, pending.token);
              sent = false;
              if (active.current) setRecovery(undefined);
            }
            if (!sent && !(error instanceof ApiError)) {
              if (active.current) {
                setRecovery(readStockCreation(owner, role));
                setMessage(
                  "No vehicle request was sent. Check your current access, branch and browser recovery storage, then review again.",
                );
              }
              const rejected = new ApiError(400, { error: { code: "REQUEST_FAILED" } });
              rejected.message =
                "No vehicle request was sent. Check current access, branch and recovery storage before reviewing again.";
              throw rejected;
            }
            throw error;
          } finally {
            request.current = null;
          }
        },
      });
    } catch {
      if (active.current)
        setMessage(
          "The vehicle request was not sent. Check your current access and selected active branch. If your assignment changed, reload this page.",
        );
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  async function startNew() {
    if (
      request.current ||
      checking ||
      !active.current ||
      (!acknowledged && !(typeof recovery === "object" && recovery.kind === "confirmed"))
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setMessage(undefined);
    try {
      await access(controller.signal);
      current(controller.signal);
      clearStockCreation(owner, role);
      forgetDraft(draftKey(`${owner}:${role}`, "/admin/vehicles/new", draft));
      setRecovery(undefined);
      setAcknowledged(false);
      setGeneration((v) => v + 1);
    } catch {
      if (active.current)
        setMessage(
          "A new draft could not be opened. Check current access and browser storage; the previous request will not be resent.",
        );
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  const pending =
      recovery && !(typeof recovery === "object" && recovery.kind === "confirmed"),
    confirmed =
      typeof recovery === "object" && recovery.kind === "confirmed"
        ? recovery
        : undefined;
  return (
    <>
      <Feedback message={message} />
      {recovery ? (
        <section className="vc-state" aria-labelledby="vc-recovery-title">
          <h2 id="vc-recovery-title">
            {confirmed
              ? "Continue with the saved vehicle"
              : "Vehicle creation needs reconciliation"}
          </h2>
          <p>
            {confirmed
              ? "A confirmed creation response was received. Continue to the record to add photos and review its current details."
              : "The previous creation outcome is not confirmed. Check vehicle stock before starting another draft. Reloading or opening this page does not resend the request."}
          </p>
          {typeof recovery === "object" && recovery.kind === "pending" && (
            <p>
              Reviewed stock number: <strong>{recovery.stockNumber}</strong>
            </p>
          )}
          <div className="actions">
            {confirmed ? (
              <Link
                className="button"
                href={`/admin/vehicles/${confirmed.vehicleId}#vehicle-photos`}
              >
                Open vehicle photo editor
              </Link>
            ) : (
              <Link
                className="button secondary"
                href={`/admin/vehicles${typeof recovery === "object" && recovery.kind === "pending" ? `?search=${encodeURIComponent(recovery.stockNumber)}` : ""}`}
              >
                Check vehicle stock
              </Link>
            )}
          </div>
          {pending && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              I checked vehicle stock and understand that a new draft does not determine
              the previous request outcome.
            </label>
          )}
          <button
            className="button secondary"
            disabled={checking || !!proposal || (!!pending && !acknowledged)}
            onClick={() => void startNew()}
          >
            Start another vehicle draft
          </button>
        </section>
      ) : (
        <div className="vc-layout">
          <CreationForm
            key={generation}
            owner={owner}
            role={role}
            branchId={branchId}
            branchName={branchName}
            includeCost={includeCost}
            draft={draft}
            disabled={checking || !!proposal}
            onReview={review}
          />
          <aside className="vc-guidance" aria-labelledby="vc-guidance-title">
            <h2 id="vc-guidance-title">After you save</h2>
            <ol>
              <li>
                <CarFront aria-hidden="true" />
                <div>
                  <strong>Save stock record</strong>
                  <p>Keep the vehicle details on record in your workshop.</p>
                </div>
              </li>
              <li>
                <ImageIcon aria-hidden="true" />
                <div>
                  <strong>Add photos and choose a primary image</strong>
                  <p>The saved record opens in its photo editor.</p>
                </div>
              </li>
              <li>
                <Tag aria-hidden="true" />
                <div>
                  <strong>Create a sale listing</strong>
                  <p>Review listing details separately when the stock record is ready.</p>
                </div>
              </li>
            </ol>
            <p className="vc-note">
              Saving a stock record does not publish a sale listing.
            </p>
          </aside>
        </div>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => setProposal(null)}
        />
      )}
    </>
  );
}
type TextField =
  | "stockNumber"
  | "make"
  | "model"
  | "year"
  | "trim"
  | "mileageKm"
  | "engineSize"
  | "color"
  | "doors"
  | "seats"
  | "vin"
  | "chassisNumber"
  | "registrationNumber"
  | "acquisitionPrice"
  | "acquiredAt";
function CreationForm({
  owner,
  role,
  branchId,
  branchName,
  includeCost,
  draft,
  disabled,
  onReview,
}: {
  owner: string;
  role: string;
  branchId?: string;
  branchName?: string;
  includeCost: boolean;
  draft: string;
  disabled: boolean;
  onReview: (values: VehicleRecordValues) => Promise<void>;
}) {
  const savedDraft =
    draftIdentity() === `${owner}:${role}`
      ? readDraft(draftKey(`${owner}:${role}`, "/admin/vehicles/new", draft))
      : {};
  const savedBranch = savedDraft["vehicle-record-branch:0"];
  const initialBranch =
    branchId ??
    (typeof savedBranch === "string" && z.uuid().safeParse(savedBranch).success
      ? savedBranch
      : undefined);
  const form = useForm<VehicleRecordValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: vehicleDefaults(undefined, initialBranch),
    shouldFocusError: false,
  });
  const input = (name: TextField, label: string, max: number) => {
    const error = form.formState.errors[name];
    return (
      <div className="field" key={name}>
        <label htmlFor={`vehicle-record-${name}`}>{label}</label>
        <input
          id={`vehicle-record-${name}`}
          {...form.register(name)}
          type={name === "acquiredAt" ? "datetime-local" : "text"}
          maxLength={max}
          inputMode={
            name === "acquisitionPrice"
              ? "decimal"
              : ["year", "mileageKm", "doors", "seats"].includes(name)
                ? "numeric"
                : "text"
          }
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby={error ? `vehicle-record-${name}-error` : undefined}
        />
        {error && (
          <p className="field-error" role="alert" id={`vehicle-record-${name}-error`}>
            {error.message}
          </p>
        )}
      </div>
    );
  };
  const select = (name: keyof typeof vehicleEnums, label: string) => {
    const error = form.formState.errors[name];
    return (
      <div className="field" key={name}>
        <label htmlFor={`vehicle-record-${name}`}>
          {label}
          {name === "condition" ? "" : " (optional)"}
        </label>
        <select
          id={`vehicle-record-${name}`}
          {...form.register(name)}
          aria-invalid={!!error}
          aria-describedby={error ? `vehicle-record-${name}-error` : undefined}
        >
          {name !== "condition" && <option value="">Not set</option>}
          {vehicleEnums[name].map((value) => (
            <option key={value} value={value}>
              {value
                .replaceAll("_", " ")
                .toLowerCase()
                .replace(/^./, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
        {error && (
          <p className="field-error" role="alert" id={`vehicle-record-${name}-error`}>
            {error.message}
          </p>
        )}
      </div>
    );
  };
  const group = (number: number, title: string, children: React.ReactNode) => (
    <section className="vc-group" aria-labelledby={`vc-group-${number}`}>
      <h2 id={`vc-group-${number}`}>
        <span aria-hidden="true">{number}</span>
        {title}
      </h2>
      <div className="vc-fields">{children}</div>
    </section>
  );
  return (
    <form
      data-draft-key={draft}
      className="vc-editor"
      noValidate
      onSubmit={form.handleSubmit(onReview, (errors) => {
        const order: (keyof VehicleRecordValues)[] = [
          "branchId",
          "stockNumber",
          "make",
          "model",
          "year",
          "trim",
          "condition",
          "mileageKm",
          "transmission",
          "fuelType",
          "bodyType",
          "driveType",
          "engineSize",
          "color",
          "doors",
          "seats",
          "vin",
          "chassisNumber",
          "registrationNumber",
          "acquisitionPrice",
          "acquiredAt",
        ];
        const first = order.find((name) => errors[name]);
        if (first) form.setFocus(first);
      })}
    >
      <fieldset disabled={disabled}>
        <legend className="sr-only">New vehicle details</legend>
        {group(
          1,
          "Vehicle identity",
          <>
            {branchId ? (
              <div className="vc-assigned">
                <input type="hidden" {...form.register("branchId")} />
                <span>Workshop branch</span>
                <p>{branchName ?? "Your assigned workshop branch"}</p>
                <small>Your current assigned active branch will be used.</small>
              </div>
            ) : (
              <div className="field">
                <label htmlFor="vehicle-record-branch">Workshop branch</label>
                <Controller
                  name="branchId"
                  control={form.control}
                  render={({ field }) => (
                    <AdminBranchPicker
                      id="vehicle-record-branch"
                      value={field.value}
                      onChange={field.onChange}
                      inputRef={field.ref}
                      error={form.formState.errors.branchId?.message}
                    />
                  )}
                />
              </div>
            )}
            {input("stockNumber", "Stock number", 40)}
            <p className="vc-field-note">
              Stock numbers are unique. Complete the branch, stock number, make, model,
              year and condition.
            </p>
            {input("make", "Make", 80)}
            {input("model", "Model", 80)}
            {input("year", "Model year", 4)}
            {input("trim", "Trim (optional)", 80)}
            {select("condition", "Condition")}
          </>,
        )}
        {group(
          2,
          "Specifications",
          <>
            {input("mileageKm", "Mileage (optional, km)", 8)}
            {select("transmission", "Transmission")}
            {select("fuelType", "Fuel type")}
            {select("bodyType", "Body type")}
            {select("driveType", "Drive type")}
            {input("engineSize", "Engine size (optional)", 40)}
            {input("color", "Colour (optional)", 40)}
            {input("doors", "Doors (optional)", 2)}
            {input("seats", "Seats (optional)", 3)}
          </>,
        )}
        {group(
          3,
          "Identifiers",
          <>
            {input("vin", "VIN (optional)", 17)}
            {input("chassisNumber", "Chassis number (optional)", 80)}
            {input("registrationNumber", "Registration number (optional)", 80)}
          </>,
        )}
        {group(
          4,
          "Acquisition",
          <>
            {includeCost &&
              input("acquisitionPrice", "Acquisition cost (optional, NGN)", 17)}
            {input("acquiredAt", "Acquired at (optional, Lagos time)", 16)}
          </>,
        )}
        <div className="vc-footer">
          <Link className="vc-back" href="/admin/vehicles">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to vehicle stock
          </Link>
          <button className="button">
            Review new vehicle
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </fieldset>
    </form>
  );
}
