"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  parseAdminCategory,
  categoryFormSchema,
  type AdminCategory,
  type CategoryFormValues,
} from "@/lib/admin/category-catalogue";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

export function WorkCategoryEditor({
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
    id ? `/admin/service-categories/${id}` : null,
    parseAdminCategory,
    undefined,
    { refreshKey },
  );
  const [snapshot, setSnapshot] = useState<AdminCategory | null>(null);
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
      id="category-editor"
      aria-labelledby="category-editor-title"
    >
      <h2 id="category-editor-title" tabIndex={-1}>
        {id ? "Edit category" : "Create category"}
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
            Refresh category
          </button>
          {onCreate && (
            <button type="button" className="button secondary" onClick={onCreate}>
              Create a new category
            </button>
          )}
          {onClose && (
            <button type="button" className="button secondary" onClick={onClose}>
              Close editing
            </button>
          )}
        </div>
      )}
      {resource.loading && <p role="status">Loading category…</p>}
      <Feedback
        message={
          mismatch
            ? "The returned category does not match your selection. Refresh before editing."
            : resource.error || resource.refreshError
        }
      />
      {snapshot && resource.data && resource.data.version !== snapshot.version && (
        <div className="notice" role="status">
          This category has changed. Your draft has been kept.{" "}
          <button
            type="button"
            className="text-link"
            disabled={unavailable}
            onClick={() => {
              try {
                sessionStorage.removeItem(`work-category-pending:${owner}:${id}`);
              } catch {
                /* The fresh version still protects a new review. */
              }
              document
                .getElementById("work-category-entry")
                ?.dispatchEvent(new Event("reset", { bubbles: true }));
              setSnapshot(resource.data!);
              setRevision((v) => v + 1);
            }}
          >
            Load latest category and replace this draft
          </button>
        </div>
      )}
      {(!id || (!!snapshot && !!resource.data && !mismatch)) && (
        <CategoryForm
          key={revision}
          record={id ? snapshot : null}
          owner={owner}
          blocked={blocked || unavailable}
          refresh={resource.refresh}
          reloadSaved={async () => {
            if (!id) return;
            const latest = parseAdminCategory(
              (await apiRequest(`/admin/service-categories/${id}`)).data,
            );
            if (latest.id !== id) throw new Error("Unexpected category");
            document
              .getElementById("work-category-entry")
              ?.dispatchEvent(new Event("reset", { bubbles: true }));
            try {
              sessionStorage.removeItem(`work-category-pending:${owner}:${id}`);
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

function CategoryForm({
  record,
  owner,
  blocked,
  refresh,
  reloadSaved,
  onSaved,
}: {
  record: AdminCategory | null;
  owner: string;
  blocked: boolean;
  refresh: () => void;
  reloadSaved: () => Promise<void>;
  onSaved: () => void;
}) {
  const marker = `work-category-pending:${owner}:${record?.id ?? "create"}`;
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
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const form = useForm<z.input<typeof categoryFormSchema>, unknown, CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    shouldFocusError: false,
    defaultValues: {
      name: record?.name ?? "",
      slug: record?.slug ?? "",
      description: record?.description ?? "",
      isActive: record?.isActive ?? true,
    },
  });
  const errors = form.formState.errors;
  const fieldOrder: (keyof CategoryFormValues)[] = [
    "name",
    "slug",
    "description",
    "isActive",
  ];
  const disabled = blocked || uncertain || !!proposal;
  function review(values: CategoryFormValues) {
    if (disabled) return;
    const body = {
      name: values.name,
      slug: values.slug,
      description: values.description || null,
      isActive: values.isActive,
      ...(record ? { expectedVersion: record.version } : {}),
    };
    setProposal({
      title: "Save this category?",
      description:
        "These changes affect how services are grouped. Deactivating a category removes the grouping while its active services remain available.",
      retryAfterRejection: false,
      facts: [
        { label: "Name", value: body.name },
        { label: "URL name", value: body.slug },
        { label: "Description", value: body.description || "Not provided" },
        { label: "Active", value: body.isActive ? "Yes" : "No" },
      ],
      onUncertain: () => pending(true),
      submit: async () => {
        if (record) {
          try {
            const current = parseAdminCategory(
              (await apiRequest(`/admin/service-categories/${record.id}`)).data,
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
                  record
                    ? `/admin/service-categories/${record.id}`
                    : "/admin/service-categories",
                  { method: record ? "PATCH" : "POST", csrf: true, body },
                )
              ).data,
            );
          if (record && saved.id !== record.id)
            throw new Error("Unexpected saved category");
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
  const common = (name: keyof CategoryFormValues) => ({
    id: `admin-${name}`,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name]
      ? `category-error-${name}`
      : name === "slug"
        ? "category-slug-hint"
        : undefined,
  });
  function error(name: keyof CategoryFormValues) {
    return (
      errors[name] && (
        <p className="field-error" id={`category-error-${name}`}>
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
                      "The saved category could not be loaded. Your draft has been kept. Refresh the category before trying again.",
                    );
                    refresh();
                  } finally {
                    setRecovering(false);
                  }
                }}
              >
                {recovering
                  ? "Loading saved category…"
                  : "Discard draft and reload saved category"}
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
                  .getElementById("work-category-entry")
                  ?.dispatchEvent(new Event("reset", { bubbles: true }));
                form.reset({
                  name: "",
                  slug: "",
                  description: "",
                  isActive: true,
                });
                pending(false);
              }}
            >
              I checked the categories; start a blank draft
            </button>
          )}
        </>
      )}
      <form
        id="work-category-entry"
        data-draft-key={JSON.stringify([
          "admin-resource:1",
          "/admin/service-categories",
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
            Check the highlighted fields before reviewing this category.
          </p>
        )}
        <fieldset disabled={disabled}>
          <div className="work-service-fields">
            <div className="field">
              <label htmlFor="admin-name">Name</label>
              <input
                {...form.register("name")}
                {...common("name")}
                maxLength={120}
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
              <span className="field-hint" id="category-slug-hint">
                Use lowercase words separated by hyphens.
              </span>
              {error("slug")}
            </div>
            <div className="field">
              <label htmlFor="admin-description">Description (optional)</label>
              <textarea
                {...form.register("description")}
                {...common("description")}
                maxLength={2000}
                rows={3}
              />
              {error("description")}
            </div>
          </div>
          <label className="check-label">
            <input type="checkbox" {...form.register("isActive")} /> Active
          </label>
          <div className="actions">
            <button className="button">Review changes</button>
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
