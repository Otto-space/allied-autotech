"use client";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  parseAdminProduct,
  productFormSchema,
  productBody,
  type AdminProduct,
  type ProductFormValues,
} from "@/lib/admin/product-catalogue";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { koboToInput } from "@/lib/format/currency-input";
import { formatKobo } from "@/lib/format/money";
import { WorkProductCategory } from "./work-product-category";

export function WorkProductEditor({
  id,
  owner,
  blocked,
  onSaved,
  onClose,
  refreshKey,
}: {
  id?: string;
  owner: string;
  blocked: boolean;
  onSaved: () => void;
  onClose?: () => void;
  refreshKey?: number;
}) {
  const resource = useResource(
    id ? `/admin/catalog/products/${id}` : null,
    parseAdminProduct,
    undefined,
    { refreshKey },
  );
  const [snapshot, setSnapshot] = useState<AdminProduct | null>(null);
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
      id="product-editor"
      aria-labelledby="product-editor-title"
    >
      <h2 id="product-editor-title" tabIndex={-1}>
        Product details
      </h2>
      {id && snapshot && !mismatch && resource.data && (
        <p className="work-service-selected">
          {snapshot.name} · {snapshot.sku}
        </p>
      )}
      <p>
        Complete the details below, then review before saving. Fields marked optional can
        be left blank.
      </p>
      {resource.loading && <p role="status">Loading product…</p>}
      <Feedback
        message={
          mismatch
            ? "The returned product does not match your selection. Refresh before editing."
            : resource.error || resource.refreshError
        }
      />
      {snapshot && resource.data && resource.data.updatedAt !== snapshot.updatedAt && (
        <div className="notice" role="status">
          This product has changed. Your draft has been kept.{" "}
          <button
            type="button"
            className="text-link"
            disabled={unavailable}
            onClick={() => {
              try {
                sessionStorage.removeItem(`work-product-pending:${owner}:${id}`);
              } catch {
                /* The fresh version still protects a new review. */
              }
              document
                .getElementById("work-product-entry")
                ?.dispatchEvent(new Event("reset", { bubbles: true }));
              setSnapshot(resource.data!);
              setRevision((v) => v + 1);
            }}
          >
            Load latest product and replace this draft
          </button>
        </div>
      )}
      {(!id || (!!snapshot && !!resource.data && !mismatch)) && (
        <ProductForm
          key={revision}
          record={id ? snapshot : null}
          owner={owner}
          blocked={
            blocked ||
            unavailable ||
            (!!id && resource.data?.updatedAt !== snapshot?.updatedAt)
          }
          refresh={resource.refresh}
          reloadSaved={async () => {
            if (!id) return;
            const latest = parseAdminProduct(
              (await apiRequest(`/admin/catalog/products/${id}`)).data,
            );
            if (latest.id !== id) throw new Error("Unexpected product");
            document
              .getElementById("work-product-entry")
              ?.dispatchEvent(new Event("reset", { bubbles: true }));
            try {
              sessionStorage.removeItem(`work-product-pending:${owner}:${id}`);
            } catch {
              /* The fresh version still protects a new review. */
            }
            setSnapshot(latest);
            setRevision((v) => v + 1);
            resource.refresh();
          }}
          onSaved={onSaved}
          onClose={onClose}
        />
      )}
    </section>
  );
}

function ProductForm({
  record,
  owner,
  blocked,
  refresh,
  reloadSaved,
  onSaved,
  onClose,
}: {
  record: AdminProduct | null;
  owner: string;
  blocked: boolean;
  refresh: () => void;
  reloadSaved: () => Promise<void>;
  onSaved: () => void;
  onClose?: () => void;
}) {
  const marker = `work-product-pending:${owner}:${record?.id ?? "create"}`;
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
  const reviewTrigger = useRef<HTMLButtonElement>(null);
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [choicesBlocked, setChoicesBlocked] = useState(true);
  const [categoryLabel, setCategoryLabel] = useState(record?.category.name ?? "");
  const form = useForm<z.input<typeof productFormSchema>, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    shouldFocusError: false,
    defaultValues: {
      name: record?.name ?? "",
      slug: record?.slug ?? "",
      sku: record?.sku ?? "",
      categoryId: record?.category.id ?? "",
      brand: record?.brand ?? "",
      manufacturerPartNumber: record?.manufacturerPartNumber ?? "",
      description: record?.description ?? "",
      priceKobo: record ? koboToInput(record.priceKobo) : "",
      compareAtPriceKobo: record?.compareAtPriceKobo
        ? koboToInput(record.compareAtPriceKobo)
        : "",
      featured: record?.featured ?? false,
      isActive: record?.isActive ?? true,
    },
  });
  const errors = form.formState.errors;
  const selectedCategory = useWatch({ control: form.control, name: "categoryId" });
  const fieldOrder: (keyof ProductFormValues)[] = [
    "name",
    "slug",
    "sku",
    "categoryId",
    "brand",
    "manufacturerPartNumber",
    "description",
    "priceKobo",
    "compareAtPriceKobo",
    "featured",
    "isActive",
  ];
  const disabled = blocked || uncertain || !!proposal;
  function review(values: ProductFormValues) {
    if (disabled || choicesBlocked || !categoryLabel) return;
    const body = productBody(values, record);
    setProposal({
      title: "Save this product?",
      description: "These changes affect the live catalogue.",
      retryAfterRejection: false,
      facts: [
        { label: "Name", value: body.name },
        { label: "URL name", value: body.slug },
        { label: "SKU", value: body.sku },
        {
          label: "Category",
          value: categoryLabel,
        },
        { label: "Brand", value: body.brand || "Not provided" },
        {
          label: "Manufacturer part number",
          value: body.manufacturerPartNumber || "Not provided",
        },
        { label: "Description", value: body.description || "Not provided" },
        { label: "Selling price", value: formatKobo(body.priceKobo) },
        {
          label: "Comparison price",
          value: body.compareAtPriceKobo
            ? formatKobo(body.compareAtPriceKobo)
            : "Not provided",
        },
        { label: "Featured", value: body.featured ? "Yes" : "No" },
        { label: "Active", value: body.isActive ? "Yes" : "No" },
      ],
      onUncertain: () => pending(true),
      submit: async () => {
        if (record) {
          try {
            const current = parseAdminProduct(
              (await apiRequest(`/admin/catalog/products/${record.id}`)).data,
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
          const saved = parseAdminProduct(
            (
              await apiRequest(
                record
                  ? `/admin/catalog/products/${record.id}`
                  : "/admin/catalog/products",
                { method: record ? "PATCH" : "POST", csrf: true, body },
              )
            ).data,
          );
          if (record && saved.id !== record.id)
            throw new Error("Unexpected saved product");
          for (const key of Object.keys(body) as (keyof typeof body)[]) {
            if (key === "expectedUpdatedAt") continue;
            const actual = key === "categoryId" ? saved.category.id : saved[key];
            if (actual !== body[key]) throw new Error("Unexpected saved product details");
          }
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
  const common = (name: keyof ProductFormValues) => ({
    id: `admin-${name}`,
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name]
      ? `product-error-${name}`
      : name === "slug"
        ? "product-slug-hint"
        : undefined,
  });
  function error(name: keyof ProductFormValues) {
    return (
      errors[name] && (
        <p className="field-error" id={`product-error-${name}`}>
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
                      "The saved product could not be loaded. Your draft has been kept. Refresh the product before trying again.",
                    );
                    refresh();
                  } finally {
                    setRecovering(false);
                  }
                }}
              >
                {recovering
                  ? "Loading saved product…"
                  : "Discard draft and reload saved product"}
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
                  .getElementById("work-product-entry")
                  ?.dispatchEvent(new Event("reset", { bubbles: true }));
                form.reset({
                  name: "",
                  slug: "",
                  sku: "",
                  categoryId: "",
                  brand: "",
                  manufacturerPartNumber: "",
                  priceKobo: "",
                  compareAtPriceKobo: "",
                  featured: false,
                  description: "",
                  isActive: true,
                });
                pending(false);
              }}
            >
              I checked the products; start a blank draft
            </button>
          )}
        </>
      )}
      <form
        id="work-product-entry"
        data-draft-key={JSON.stringify([
          "admin-resource:1",
          "/admin/catalog/products",
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
            Check the highlighted fields before reviewing this product.
          </p>
        )}
        <fieldset disabled={disabled}>
          <div className="work-service-fields">
            <div className="field product-field-wide">
              <label htmlFor="admin-name">Name</label>
              <input
                {...form.register("name")}
                {...common("name")}
                maxLength={180}
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
              <span className="field-hint" id="product-slug-hint">
                Use lowercase words separated by hyphens.
              </span>
              {error("slug")}
            </div>
            <div className="field">
              <label htmlFor="admin-sku">SKU</label>
              <input
                {...form.register("sku")}
                {...common("sku")}
                maxLength={80}
                autoComplete="off"
              />
              {error("sku")}
            </div>
            <div className="field product-field-wide">
              <label htmlFor="admin-categoryId">Category</label>
              <WorkProductCategory
                id="admin-categoryId"
                value={selectedCategory}
                initialLabel={record?.category.name}
                initialValue={record?.category.id}
                onLabelChange={setCategoryLabel}
                inputRef={form.register("categoryId").ref}
                onAvailabilityChange={setChoicesBlocked}
                invalid={!!errors.categoryId}
                describedBy={errors.categoryId ? "product-error-categoryId" : undefined}
                onChange={(value, label) => {
                  form.setValue("categoryId", value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setCategoryLabel(label);
                }}
              />
              {error("categoryId")}
            </div>
            <div className="field">
              <label htmlFor="admin-brand">Brand (optional)</label>
              <input {...form.register("brand")} {...common("brand")} maxLength={100} />
              {error("brand")}
            </div>
            <div className="field">
              <label htmlFor="admin-manufacturerPartNumber">
                Manufacturer part number (optional)
              </label>
              <input
                {...form.register("manufacturerPartNumber")}
                {...common("manufacturerPartNumber")}
                maxLength={120}
              />
              {error("manufacturerPartNumber")}
            </div>
            <div className="field product-field-wide">
              <label htmlFor="admin-description">Description (optional)</label>
              <textarea
                {...form.register("description")}
                {...common("description")}
                maxLength={10000}
                rows={3}
              />
              {error("description")}
            </div>
          </div>
          <section className="product-form-group" aria-labelledby="product-pricing-title">
            <h3 id="product-pricing-title">Pricing</h3>
            <div className="work-service-fields">
              <div className="field">
                <label htmlFor="admin-priceKobo">Selling price (NGN)</label>
                <input
                  {...form.register("priceKobo")}
                  {...common("priceKobo")}
                  inputMode="decimal"
                  maxLength={20}
                />
                {error("priceKobo")}
              </div>
              <div className="field">
                <label htmlFor="admin-compareAtPriceKobo">
                  Comparison price (NGN, optional)
                </label>
                <input
                  {...form.register("compareAtPriceKobo")}
                  {...common("compareAtPriceKobo")}
                  inputMode="decimal"
                  maxLength={20}
                />
                {error("compareAtPriceKobo")}
              </div>
            </div>
          </section>
          <section
            className="product-form-group"
            aria-labelledby="product-visibility-title"
          >
            <h3 id="product-visibility-title">Visibility</h3>
            <div className="work-service-fields">
              <label className="check-label">
                <input type="checkbox" {...form.register("featured")} /> Featured
              </label>
              <label className="check-label">
                <input type="checkbox" {...form.register("isActive")} /> Active
              </label>
            </div>
          </section>
        </fieldset>
        <div className="actions product-form-actions">
          <button
            ref={reviewTrigger}
            className="button"
            disabled={
              disabled || choicesBlocked || (!!selectedCategory && !categoryLabel)
            }
          >
            Review changes
          </button>
          {onClose && (
            <button
              type="button"
              className="button secondary product-close"
              disabled={!!proposal}
              onClick={onClose}
            >
              Close editing
            </button>
          )}
        </div>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Confirm save"
          onClose={() => {
            setProposal(null);
            requestAnimationFrame(() => reviewTrigger.current?.focus());
          }}
          onSuccess={onSaved}
        />
      )}
    </>
  );
}
