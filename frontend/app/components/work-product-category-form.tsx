"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  categoryFormSchema,
  parseAdminProductCategory,
  productCategoryBody,
  type AdminProductCategory,
  type CategoryFormValues,
} from "@/lib/admin/product-categories";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { WorkProductCategory } from "./work-product-category";
import { MutationReview, type MutationProposal } from "./mutation-review";

const endpoint = "/admin/catalog/categories";
const fields = ["name", "slug", "description", "parentId", "isActive", "family"] as const;
const empty = {
  name: "",
  slug: "",
  description: "",
  parentId: "",
  isActive: true,
  family: "" as const,
};
export function WorkProductCategoryEditor({
  id,
  owner,
  refreshKey,
  blocked = false,
  onClose,
  onSaved,
}: {
  id?: string;
  owner: string;
  refreshKey: number;
  blocked?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const resource = useResource(
    id ? `${endpoint}/${id}` : null,
    parseAdminProductCategory,
    undefined,
    { refreshKey },
  );
  const [snapshot, setSnapshot] = useState<AdminProductCategory | null>(null),
    [epoch, setEpoch] = useState(0);
  const mismatch = !!id && !!resource.data && resource.data.id !== id;
  if (id && resource.data && !mismatch && !snapshot) setSnapshot(resource.data);
  const unavailable =
    blocked ||
    (!!id &&
      (resource.loading ||
        resource.refreshing ||
        !!resource.error ||
        !!resource.refreshError ||
        !resource.data ||
        mismatch));
  const changed =
    !!snapshot && !!resource.data && snapshot.updatedAt !== resource.data.updatedAt;
  function replace(record: AdminProductCategory) {
    document
      .getElementById("work-product-category-entry")
      ?.dispatchEvent(new Event("reset", { bubbles: true }));
    try {
      sessionStorage.removeItem(`work-product-category-pending:${owner}:${id}`);
    } catch {
      /* Keep revision protection without storage. */
    }
    setSnapshot(record);
    setEpoch((v) => v + 1);
  }
  return (
    <div className="product-category-editor-grid">
      <section
        className="work-service-form"
        aria-labelledby="product-category-editor-title"
      >
        <h2 id="product-category-editor-title" tabIndex={-1}>
          Category details
        </h2>
        {id && snapshot && resource.data && !mismatch && (
          <p className="work-service-selected">{snapshot.name}</p>
        )}
        <p>
          Complete the details below, then review before saving. Fields marked optional
          can be left blank.
        </p>
        {resource.loading && <p role="status">Loading category…</p>}
        <Feedback
          message={
            mismatch
              ? "The returned category does not match your selection. Refresh before editing."
              : resource.error || resource.refreshError
          }
        />
        {changed && !mismatch && (
          <div className="notice" role="status">
            This category has changed. Your draft has been kept.{" "}
            <button
              className="text-link"
              type="button"
              disabled={unavailable}
              onClick={() => replace(resource.data!)}
            >
              Load latest category and replace this draft
            </button>
          </div>
        )}
        {(!id || (snapshot && resource.data && !mismatch)) && (
          <CategoryForm
            key={epoch}
            record={id ? snapshot : null}
            owner={owner}
            blocked={unavailable || changed}
            refresh={resource.refresh}
            onClose={onClose}
            onSaved={onSaved}
            reloadSaved={async () => {
              if (!id) return;
              const current = parseAdminProductCategory(
                (await apiRequest(`${endpoint}/${id}`)).data,
              );
              if (current.id !== id) throw new Error("Unexpected category");
              replace(current);
              resource.refresh();
            }}
          />
        )}
      </section>
      <aside
        className="product-category-guidance"
        aria-labelledby="product-category-guidance-title"
      >
        <h2 id="product-category-guidance-title">Category visibility</h2>
        <p>
          Active products must be deactivated before their category can be deactivated.
        </p>
        <p>Changing a category does not delete its products.</p>
        {id && resource.data && !mismatch && (
          <>
            <Link
              className="button secondary"
              href={`/admin/products?categoryId=${id}`}
              prefetch={false}
            >
              View products
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <div className="product-category-updated">
              Last updated
              <time dateTime={resource.data.updatedAt}>
                {formatBusinessDate(resource.data.updatedAt)}
              </time>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function CategoryForm({
  record,
  owner,
  blocked,
  refresh,
  onClose,
  onSaved,
  reloadSaved,
}: {
  record: AdminProductCategory | null;
  owner: string;
  blocked: boolean;
  refresh: () => void;
  onClose: () => void;
  onSaved: () => void;
  reloadSaved: () => Promise<void>;
}) {
  const marker = `work-product-category-pending:${owner}:${record?.id ?? "create"}`;
  const [uncertain, setUncertain] = useState(() => {
    try {
      return (
        typeof window !== "undefined" && sessionStorage.getItem(marker) === "pending"
      );
    } catch {
      return false;
    }
  });
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [recovering, setRecovering] = useState(false),
    [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null),
    entry = useRef<HTMLFormElement>(null);
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: record
      ? {
          name: record.name,
          slug: record.slug,
          description: record.description || "",
          parentId: record.parentId || "",
          family: record.family || "",
          isActive: record.isActive,
        }
      : empty,
  });
  const parentId = useWatch({ control: form.control, name: "parentId" });
  const [parentBlocked, setParentBlocked] = useState(true);
  const [parentLabel, setParentLabel] = useState("");
  const errors = form.formState.errors,
    disabled = blocked || uncertain || !!proposal;
  function pending(value: boolean) {
    setUncertain(value);
    try {
      if (value) sessionStorage.setItem(marker, "pending");
      else sessionStorage.removeItem(marker);
    } catch {
      /* Preserve in-memory protection. */
    }
  }
  function review(values: CategoryFormValues) {
    if (disabled || (parentId && (parentBlocked || !parentLabel))) return;
    const body = productCategoryBody(values, record);
    setProposal({
      title: "Save this category?",
      description: "These changes affect the product catalogue.",
      retryAfterRejection: false,
      facts: [
        { label: "Name", value: body.name },
        { label: "URL name", value: body.slug },
        { label: "Description", value: body.description || "Not provided" },
        {
          label: "Parent category",
          value: body.parentId ? parentLabel : "None (top-level category)",
        },
        { label: "Active", value: body.isActive ? "Yes" : "No" },
        {
          label: "Product family",
          value:
            body.family === "ENGINE_OIL"
              ? "Engine oils"
              : body.family === "REPLACEMENT_PART"
                ? "Replacement parts"
                : "Shared / inherited",
        },
      ],
      onUncertain: () => pending(true),
      submit: async () => {
        if (record) {
          try {
            const current = parseAdminProductCategory(
              (await apiRequest(`${endpoint}/${record.id}`)).data,
            );
            if (current.id !== record.id || current.updatedAt !== record.updatedAt)
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
          const saved = parseAdminProductCategory(
            (
              await apiRequest(record ? `${endpoint}/${record.id}` : endpoint, {
                method: record ? "PATCH" : "POST",
                csrf: true,
                body,
              })
            ).data,
          );
          if (
            record &&
            (saved.id !== record.id ||
              Date.parse(saved.updatedAt) <= Date.parse(record.updatedAt))
          )
            throw new Error("Unexpected saved category");
          for (const key of fields)
            if ((saved[key] ?? null) !== body[key])
              throw new Error("Unexpected category details");
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
  function common(name: keyof CategoryFormValues) {
    return {
      id: `product-category-${name}`,
      "aria-invalid": !!errors[name],
      "aria-describedby": errors[name]
        ? `product-category-error-${name}`
        : name === "slug"
          ? "product-category-slug-hint"
          : name === "isActive"
            ? "product-category-active-hint"
            : undefined,
    };
  }
  function fieldError(name: keyof CategoryFormValues) {
    return (
      errors[name] && (
        <p className="field-error" id={`product-category-error-${name}`}>
          {errors[name]?.message}
        </p>
      )
    );
  }
  return (
    <>
      {uncertain && (
        <div className="product-category-recovery">
          <Feedback
            tone="info"
            message="The save could not be confirmed. Check the saved categories before making another change. This draft will not be resent."
          />
          {record ? (
            <button
              type="button"
              className="button secondary"
              disabled={blocked || !!proposal || recovering}
              onClick={async () => {
                setRecovering(true);
                setError("");
                try {
                  await reloadSaved();
                  pending(false);
                } catch {
                  setError(
                    "The saved category could not be loaded. Your draft remains locked.",
                  );
                } finally {
                  setRecovering(false);
                }
              }}
            >
              {recovering
                ? "Loading saved category…"
                : "Discard draft and reload saved category"}
            </button>
          ) : (
            <button
              type="button"
              className="button secondary"
              disabled={!!proposal}
              onClick={() => {
                entry.current?.dispatchEvent(new Event("reset", { bubbles: true }));
                form.reset(empty);
                pending(false);
              }}
            >
              I checked the categories; start a blank draft
            </button>
          )}
          <Feedback message={error} />
        </div>
      )}
      <form
        ref={entry}
        id="work-product-category-entry"
        data-draft-key={JSON.stringify([
          "admin-resource:1",
          endpoint,
          record?.id ?? "create",
        ])}
        noValidate
        onSubmit={form.handleSubmit(review, (validation) => {
          const first = fields.find((key) => validation[key]);
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
              <label htmlFor="product-category-name">Name</label>
              <input
                {...common("name")}
                {...form.register("name")}
                maxLength={120}
                autoComplete="off"
              />
              {fieldError("name")}
            </div>
            <div className="field product-field-wide">
              <label htmlFor="product-category-parentId">
                Parent category (optional)
              </label>
              <WorkProductCategory
                id="product-category-parentId"
                rootOnly
                excludeId={record?.id}
                value={parentId || ""}
                initialValue={record?.parentId || undefined}
                inputRef={form.register("parentId").ref}
                onAvailabilityChange={setParentBlocked}
                onLabelChange={setParentLabel}
                invalid={!!errors.parentId}
                describedBy="product-parent-hint"
                onChange={(value) =>
                  form.setValue("parentId", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              <span className="field-hint" id="product-parent-hint">
                Choose a top-level category to create a subcategory. Categories have at
                most two levels. Deactivate subcategories before their parent.
              </span>
              {fieldError("parentId")}
            </div>
            <div className="field">
              <label htmlFor="product-category-family">Product family (optional)</label>
              <select
                {...common("family")}
                {...form.register("family")}
                aria-describedby="category-family-hint"
              >
                <option value="">Shared / inherit parent family</option>
                <option value="REPLACEMENT_PART">Replacement parts</option>
                <option value="ENGINE_OIL">Engine oils</option>
              </select>
              <small id="category-family-hint">
                A typed parent also governs its subcategories. Existing products must
                match before a family change can be saved.
              </small>
              {fieldError("family")}
            </div>
            <div className="field">
              <label htmlFor="product-category-slug">URL name</label>
              <input
                {...common("slug")}
                {...form.register("slug")}
                maxLength={120}
                autoCapitalize="none"
                autoComplete="off"
              />
              <small id="product-category-slug-hint">
                Use lowercase words separated by hyphens.
              </small>
              {fieldError("slug")}
            </div>
          </div>
          <div className="field">
            <label htmlFor="product-category-description">Description (optional)</label>
            <textarea
              {...common("description")}
              {...form.register("description")}
              maxLength={2000}
              rows={5}
            />
            {fieldError("description")}
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              {...common("isActive")}
              {...form.register("isActive")}
            />
            Active
          </label>
          <p id="product-category-active-hint" className="product-category-active-hint">
            An active category can contain active products.
          </p>
          {fieldError("isActive")}
        </fieldset>
        <div className="product-form-actions">
          <button
            type="button"
            className="button secondary"
            disabled={!!proposal}
            onClick={onClose}
          >
            Close editing
          </button>
          <button
            ref={trigger}
            type="submit"
            className="button"
            disabled={disabled || (!!parentId && (parentBlocked || !parentLabel))}
          >
            Review changes
          </button>
        </div>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Confirm save"
          onClose={() => {
            setProposal(null);
            requestAnimationFrame(() => trigger.current?.focus());
          }}
          onSuccess={() => {
            entry.current?.dispatchEvent(new Event("reset", { bubbles: true }));
            onSaved();
          }}
        />
      )}
    </>
  );
}
