"use client";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  parseAdminService,
  serviceFormSchema,
  type AdminService,
  type ServiceFormValues,
} from "@/lib/admin/service-catalogue";
import { koboToInput, nairaToKobo } from "@/lib/format/currency-input";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { WorkServiceCategory } from "./work-service-category";
import { MutationReview, type MutationProposal } from "./mutation-review";

export function WorkServiceEditor({
  id,
  owner,
  blocked,
  onSaved,
  onCreate,
  onClose,
  refreshKey,
}: {
  id?: string;
  owner: string;
  blocked: boolean;
  onSaved: () => void;
  onCreate?: () => void;
  onClose?: () => void;
  refreshKey?: number;
}) {
  const resource = useResource(
    id ? `/admin/services/${id}` : null,
    parseAdminService,
    undefined,
    { refreshKey },
  );
  const [snapshot, setSnapshot] = useState<AdminService | null>(null);
  const [revision, setRevision] = useState(0);
  const mismatch = !!id && !!resource.data && resource.data.id !== id;
  if (id && resource.data && !mismatch && !snapshot) setSnapshot(resource.data);
  const unavailable =
    !!id &&
    (resource.loading ||
      resource.refreshing ||
      !!resource.error ||
      !!resource.refreshError ||
      !resource.data ||
      mismatch);
  return (
    <section
      className="work-service-form"
      id="service-editor"
      aria-labelledby="service-editor-title"
    >
      <h2 id="service-editor-title" tabIndex={-1}>
        {id ? "Edit service" : "Create service"}
      </h2>
      {id && snapshot && !mismatch && resource.data && (
        <p className="work-service-selected">{snapshot.name}</p>
      )}
      <p>
        Complete the details below, then review before saving. Fields marked optional can
        be left blank.
      </p>
      {id && (
        <div className="actions">
          <button
            type="button"
            className="button secondary"
            disabled={resource.loading || resource.refreshing}
            onClick={resource.refresh}
          >
            Refresh service
          </button>
          {onCreate && (
            <button type="button" className="button secondary" onClick={onCreate}>
              Create a new service
            </button>
          )}
          {onClose && (
            <button type="button" className="button secondary" onClick={onClose}>
              Close editing
            </button>
          )}
        </div>
      )}
      {resource.loading && <p role="status">Loading service…</p>}
      <Feedback
        message={
          mismatch
            ? "The returned service does not match your selection. Refresh before editing."
            : resource.error || resource.refreshError
        }
      />
      {snapshot && resource.data && resource.data.version !== snapshot.version && (
        <div className="notice" role="status">
          This service has changed. Your draft has been kept.{" "}
          <button
            type="button"
            className="text-link"
            disabled={unavailable}
            onClick={() => {
              try {
                sessionStorage.removeItem(`work-service-pending:${owner}:${id}`);
              } catch {
                /* The fresh version still protects a new review. */
              }
              document
                .getElementById("work-service-entry")
                ?.dispatchEvent(new Event("reset", { bubbles: true }));
              setSnapshot(resource.data!);
              setRevision((v) => v + 1);
            }}
          >
            Load latest service and replace this draft
          </button>
        </div>
      )}
      {(!id || (!!snapshot && !!resource.data && !mismatch)) && (
        <ServiceForm
          key={revision}
          record={id ? snapshot : null}
          owner={owner}
          blocked={blocked || unavailable}
          refresh={resource.refresh}
          reloadSaved={async () => {
            if (!id) return;
            const latest = parseAdminService(
              (await apiRequest(`/admin/services/${id}`)).data,
            );
            if (latest.id !== id) throw new Error("Unexpected service");
            document
              .getElementById("work-service-entry")
              ?.dispatchEvent(new Event("reset", { bubbles: true }));
            try {
              sessionStorage.removeItem(`work-service-pending:${owner}:${id}`);
            } catch {
              /* The fresh version still protects a new review. */
            }
            setSnapshot(latest);
            setRevision((v) => v + 1);
            resource.refresh();
          }}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}

function ServiceForm({
  record,
  owner,
  blocked,
  refresh,
  reloadSaved,
  onSaved,
}: {
  record: AdminService | null;
  owner: string;
  blocked: boolean;
  refresh: () => void;
  reloadSaved: () => Promise<void>;
  onSaved: () => void;
}) {
  const marker = `work-service-pending:${owner}:${record?.id ?? "create"}`;
  const [uncertain, setUncertain] = useState(() => {
    try {
      return (
        typeof window !== "undefined" && sessionStorage.getItem(marker) === "pending"
      );
    } catch {
      return false;
    }
  });
  function pending(value: boolean) {
    setUncertain(value);
    try {
      if (value) sessionStorage.setItem(marker, "pending");
      else sessionStorage.removeItem(marker);
    } catch {
      /* Keep the in-memory guard when storage is unavailable. */
    }
  }
  const [categoriesBlocked, setCategoriesBlocked] = useState(true);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const form = useForm<z.input<typeof serviceFormSchema>, unknown, ServiceFormValues>({
    resolver: zodResolver(serviceFormSchema),
    shouldFocusError: false,
    defaultValues: {
      name: record?.name ?? "",
      slug: record?.slug ?? "",
      categoryId: record?.categoryId ?? "",
      shortDescription: record?.shortDescription ?? "",
      description: record?.description ?? "",
      pricingType: record?.pricingType ?? "",
      price: record?.priceKobo != null ? koboToInput(record.priceKobo) : "",
      duration: record?.durationMinutes?.toString() ?? "",
      isActive: record?.isActive ?? true,
    },
  });
  const errors = form.formState.errors;
  const fieldOrder: (keyof ServiceFormValues)[] = [
    "name",
    "slug",
    "categoryId",
    "shortDescription",
    "description",
    "pricingType",
    "price",
    "duration",
    "isActive",
  ];
  const disabled = blocked || uncertain || !!proposal;
  function review(values: ServiceFormValues) {
    if (disabled || categoriesBlocked || !values.pricingType) return;
    const body = {
      name: values.name,
      slug: values.slug,
      ...(record && values.categoryId === (record.categoryId ?? "")
        ? {}
        : { categoryId: values.categoryId || null }),
      shortDescription: values.shortDescription || null,
      description: values.description || null,
      pricingType: values.pricingType,
      priceKobo: values.price ? nairaToKobo(values.price) : null,
      durationMinutes: Number(values.duration),
      isActive: values.isActive,
      ...(record ? { expectedVersion: record.version } : {}),
    };
    const categoryLabel =
      (document.getElementById("admin-categoryId") as HTMLSelectElement | null)
        ?.selectedOptions[0]?.textContent ?? "No category";
    setProposal({
      title: "Save this service?",
      description: "These changes affect the live catalogue or workshop information.",
      retryAfterRejection: false,
      facts: [
        { label: "Name", value: body.name },
        { label: "URL name", value: body.slug },
        { label: "Service category", value: categoryLabel },
        { label: "Short description", value: body.shortDescription || "Not provided" },
        { label: "Full description", value: body.description || "Not provided" },
        {
          label: "Pricing",
          value: body.pricingType === "FIXED" ? "Fixed price" : "Quote required",
        },
        {
          label: "Service price (NGN)",
          value: body.priceKobo !== null ? formatKobo(body.priceKobo) : "Not provided",
        },
        { label: "Duration", value: `${body.durationMinutes} minutes` },
        { label: "Active", value: body.isActive ? "Yes" : "No" },
      ],
      onUncertain: () => pending(true),
      submit: async () => {
        if (record) {
          try {
            const current = parseAdminService(
              (await apiRequest(`/admin/services/${record.id}`)).data,
            );
            if (current.id !== record.id || current.version !== record.version)
              throw new ApiError(409, { error: { code: "STALE_VERSION" } });
          } catch (error) {
            refresh();
            if (error instanceof ApiError && error.status >= 400 && error.status < 500)
              throw error;
            throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
          }
        }
        pending(true);
        try {
          const saved = z
            .object({ id: z.uuid() })
            .parse(
              (
                await apiRequest(
                  record ? `/admin/services/${record.id}` : "/admin/services",
                  { method: record ? "PATCH" : "POST", csrf: true, body },
                )
              ).data,
            );
          if (record && saved.id !== record.id)
            throw new Error("Unexpected saved service");
          pending(false);
        } catch (error) {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            pending(false);
            refresh();
          }
          throw error;
        }
      },
    });
  }
  const common = (name: keyof ServiceFormValues) => ({
    id: `admin-${name === "price" ? "priceKobo" : name === "duration" ? "durationMinutes" : name}`,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name]
      ? `service-error-${name}`
      : name === "slug"
        ? "service-slug-hint"
        : undefined,
  });
  function error(name: keyof ServiceFormValues) {
    return (
      errors[name] && (
        <p className="field-error" id={`service-error-${name}`}>
          {errors[name]?.message}
        </p>
      )
    );
  }
  return (
    <>
      {uncertain && (
        <>
          <Feedback
            tone="info"
            message="The save could not be confirmed. Refresh the records to check whether it was saved. This draft will not be resent."
          />
          {record && (
            <>
              <button
                type="button"
                className="button secondary"
                disabled={blocked || !!proposal || recovering}
                onClick={async () => {
                  setRecovering(true);
                  setRecoveryError("");
                  try {
                    await reloadSaved();
                  } catch {
                    setRecoveryError(
                      "The saved service could not be loaded. Your draft has been kept. Refresh the service before trying again.",
                    );
                    refresh();
                  } finally {
                    setRecovering(false);
                  }
                }}
              >
                {recovering
                  ? "Loading saved service…"
                  : "Discard draft and reload saved service"}
              </button>
              <Feedback message={recoveryError} />
            </>
          )}
          {!record && (
            <button
              type="button"
              className="button secondary"
              disabled={blocked || !!proposal}
              onClick={() => {
                document
                  .getElementById("work-service-entry")
                  ?.dispatchEvent(new Event("reset", { bubbles: true }));
                form.reset({
                  name: "",
                  slug: "",
                  categoryId: "",
                  shortDescription: "",
                  description: "",
                  pricingType: "",
                  price: "",
                  duration: "",
                  isActive: true,
                });
                pending(false);
              }}
            >
              I checked the catalogue; start a blank draft
            </button>
          )}
        </>
      )}
      <form
        id="work-service-entry"
        data-draft-key={JSON.stringify([
          "admin-resource:1",
          "/admin/services",
          record?.id ?? "create",
        ])}
        noValidate
        onSubmit={form.handleSubmit(review, (validation) => {
          const first = fieldOrder.find((key) => validation[key]);
          if (first) form.setFocus(first);
        })}
      >
        {Object.keys(errors).length > 0 && (
          <p className="notice error" role="alert">
            Check the highlighted fields before reviewing this service.
          </p>
        )}
        <fieldset disabled={disabled}>
          <div className="work-service-fields">
            <div className="field">
              <label htmlFor="admin-name">Name</label>
              <input
                {...form.register("name")}
                {...common("name")}
                maxLength={160}
                autoComplete="off"
              />
              {error("name")}
            </div>
            <div className="field">
              <label htmlFor="admin-slug">URL name</label>
              <input
                {...form.register("slug")}
                {...common("slug")}
                maxLength={120}
                autoComplete="off"
              />
              <span className="field-hint" id="service-slug-hint">
                Use lowercase words separated by hyphens.
              </span>
              {error("slug")}
            </div>
            <div className="field">
              <label htmlFor="admin-categoryId">Service category (optional)</label>
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <WorkServiceCategory
                    id="admin-categoryId"
                    value={field.value}
                    onChange={field.onChange}
                    inputRef={field.ref}
                    initialLabel={record?.category?.name}
                    activeOnly
                    onAvailabilityChange={setCategoriesBlocked}
                  />
                )}
              />
              {error("categoryId")}
            </div>
            <div className="field">
              <label htmlFor="admin-shortDescription">Short description (optional)</label>
              <input
                {...form.register("shortDescription")}
                {...common("shortDescription")}
                maxLength={500}
              />
              {error("shortDescription")}
            </div>
            <div className="field work-service-span">
              <label htmlFor="admin-description">Full description (optional)</label>
              <textarea
                {...form.register("description")}
                {...common("description")}
                maxLength={10000}
                rows={3}
              />
              {error("description")}
            </div>
            <div className="field">
              <label htmlFor="admin-pricingType">Pricing</label>
              <select {...form.register("pricingType")} {...common("pricingType")}>
                <option value="">Choose an option</option>
                <option value="FIXED">Fixed price</option>
                <option value="QUOTE_REQUIRED">Quote required</option>
              </select>
              {error("pricingType")}
            </div>
            <div className="field">
              <label htmlFor="admin-priceKobo">Service price (NGN) (optional)</label>
              <input
                {...form.register("price")}
                {...common("price")}
                inputMode="decimal"
                maxLength={20}
              />
              {error("price")}
            </div>
            <div className="field">
              <label htmlFor="admin-durationMinutes">Duration in minutes</label>
              <input
                {...form.register("duration")}
                {...common("duration")}
                inputMode="numeric"
                maxLength={4}
              />
              {error("duration")}
            </div>
          </div>
          <label className="check-label">
            <input type="checkbox" {...form.register("isActive")} /> Active
          </label>
          <div className="actions">
            <button className="button" disabled={categoriesBlocked}>
              Review changes
            </button>
          </div>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Confirm save"
          onClose={() => setProposal(null)}
          onSuccess={onSaved}
        />
      )}
    </>
  );
}
