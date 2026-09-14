"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { parseInventory } from "@/lib/api/inventory-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import { SlotCatalogPicker } from "./slot-catalog-picker";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
const schema = z.object({
  branchId: z.string().uuid("Choose an active branch."),
  productId: z.string().uuid("Choose a catalogue part."),
  reorderLevel: z
    .number({ error: "Enter a whole-number threshold." })
    .int()
    .min(0)
    .max(1000000),
});
type Values = z.infer<typeof schema>;
export function InventoryCreateForm({ onSaved }: { onSaved: () => void }) {
  const router = useRouter();
  const pagination = useCursorPage();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("Selected part");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    shouldFocusError: false,
    defaultValues: { branchId: "", productId: "", reorderLevel: 5 },
  });
  const productId = useWatch({ control: form.control, name: "productId" });
  const products = useResource(
    `/public/catalog/products?limit=25${query ? `&search=${encodeURIComponent(query)}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parseProducts,
  );
  const errors = form.formState.errors;
  function review(values: Values) {
    if (proposal || uncertain) return;
    const body: RequestBody<"/admin/inventory", "post"> = values;
    const branch =
      (document.getElementById("inventory-create-branch") as HTMLSelectElement | null)
        ?.selectedOptions[0]?.textContent ?? "Selected branch";
    setProposal({
      title: "Create this inventory record?",
      description:
        "This creates an empty stock record for the selected branch and part. Record received stock separately after checking the physical quantity.",
      facts: [
        { label: "Branch", value: branch },
        { label: "Part", value: selectedLabel },
        { label: "Reorder level", value: String(values.reorderLevel) },
      ],
      onUncertain: () => setUncertain(true),
      submit: async () => {
        const response = await apiRequest("/admin/inventory", {
          method: "POST",
          csrf: true,
          body,
        });
        const inventory = parseInventory(response.data);
        onSaved();
        router.push(`/admin/inventory/${inventory.id}`);
      },
    });
  }
  return (
    <section className="detail-section">
      <h2>Add a branch inventory record</h2>
      <Feedback
        message={
          uncertain
            ? "The creation outcome is uncertain. Refresh the inventory list and check this branch and part before creating another record. This form cannot be resubmitted."
            : undefined
        }
      />
      <form
        onSubmit={form.handleSubmit(review, (validation) => {
          const first = (["branchId", "productId", "reorderLevel"] as const).find(
            (name) => validation[name],
          );
          if (first) form.setFocus(first);
        })}
        noValidate
      >
        <fieldset disabled={!!proposal || uncertain}>
          <div className="field">
            <label htmlFor="inventory-create-branch">Inventory branch</label>
            <Controller
              control={form.control}
              name="branchId"
              render={({ field }) => (
                <SlotCatalogPicker
                  id="inventory-create-branch"
                  kind="branch"
                  value={field.value}
                  onChange={field.onChange}
                  inputRef={field.ref}
                  error={errors.branchId?.message}
                />
              )}
            />
          </div>
          <div className="field">
            <label htmlFor="inventory-product-search">Find catalogue parts</label>
            <input
              id="inventory-product-search"
              type="search"
              maxLength={100}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setQuery(search.trim());
                pagination.reset();
              }}
            >
              Search parts
            </button>
          </div>
          <div className="field">
            <label htmlFor="inventory-create-product">Inventory part</label>
            <select
              id="inventory-create-product"
              {...form.register("productId")}
              value={productId}
              onChange={(event) => {
                form.setValue("productId", event.target.value, {
                  shouldValidate: !!errors.productId,
                });
                setSelectedLabel(
                  event.target.selectedOptions[0]?.textContent ?? "Selected part",
                );
              }}
              aria-invalid={!!errors.productId}
              aria-describedby={errors.productId ? "inventory-product-error" : undefined}
            >
              <option value="">Choose a catalogue part</option>
              {productId &&
                !products.data?.items.some((product) => product.id === productId) && (
                  <option value={productId}>{selectedLabel}</option>
                )}
              {products.data?.items.map((product) => (
                <option value={product.id} key={product.id}>
                  {product.name} · {product.sku}
                </option>
              ))}
            </select>
            {errors.productId && (
              <p id="inventory-product-error" className="field-error" role="alert">
                {errors.productId.message}
              </p>
            )}
          </div>
          <Feedback message={products.error} />
          {products.error && (
            <button type="button" className="text-link" onClick={products.refresh}>
              Retry catalogue choices
            </button>
          )}
          {products.loading && <p role="status">Loading catalogue choices…</p>}
          {!products.loading && !products.error && products.data?.items.length === 0 && (
            <p>No parts match this search.</p>
          )}
          {(products.data?.nextCursor || pagination.page > 1) && (
            <CursorPagination
              pagination={pagination}
              nextCursor={products.data?.nextCursor}
              disabled={products.loading || !!products.error}
              label="Inventory part choices"
            />
          )}
          <div className="field">
            <label htmlFor="inventory-create-reorder">Initial reorder level</label>
            <input
              id="inventory-create-reorder"
              type="number"
              min={0}
              max={1000000}
              step={1}
              {...form.register("reorderLevel", { valueAsNumber: true })}
              aria-invalid={!!errors.reorderLevel}
              aria-describedby={
                errors.reorderLevel ? "inventory-create-reorder-error" : undefined
              }
            />
            {errors.reorderLevel && (
              <p id="inventory-create-reorder-error" className="field-error" role="alert">
                {errors.reorderLevel.message}
              </p>
            )}
          </div>
          <button className="button">Review inventory record</button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            onSaved();
          }}
          onSuccess={() => setUncertain(false)}
        />
      )}
    </section>
  );
}
