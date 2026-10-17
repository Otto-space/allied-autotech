"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import {
  clearInventoryCreation,
  inventoryCreationKey,
  parseWorkInventories,
  readInventoryCreation,
  saveInventoryCreation,
} from "@/lib/admin/work-inventory";
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
export function InventoryCreateForm({
  onSaved,
  owner,
  role,
}: {
  onSaved: () => void;
  owner: string;
  role: string;
}) {
  const router = useRouter();
  const pagination = useCursorPage();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const key = inventoryCreationKey(owner);
  const [pending, setPending] = useState(() => readInventoryCreation(key));
  const [checking, setChecking] = useState(false),
    [message, setMessage] = useState<string>(),
    [savedId, setSavedId] = useState<string>();
  const active = useRef(true),
    request = useRef<AbortController | null>(null),
    attempted = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
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
    if (proposal || pending || checking) return;
    attempted.current = false;
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
      onUncertain: () => {
        if (active.current) setPending(readInventoryCreation(key));
      },
      retryAfterRejection: false,
      submit: async () => {
        if (request.current || pending || !active.current)
          throw new Error("Creation is blocked");
        const controller = new AbortController();
        request.current = controller;
        let sent = false;
        try {
          const access = parseOwnStaffProfile(
            (await apiRequest("/staff/profile", { signal: controller.signal })).data,
          );
          if (
            access.id !== owner ||
            access.role !== role ||
            access.status !== "ACTIVE" ||
            !["ADMIN", "SUPER_ADMIN"].includes(access.role)
          )
            throw new Error("Current administrator access could not be confirmed");
          if (!active.current || controller.signal.aborted)
            throw new Error("Session changed");
          saveInventoryCreation(key, {
            branchId: body.branchId,
            productId: body.productId,
          });
          sent = true;
          attempted.current = true;
          const response = await apiRequest("/admin/inventory", {
            method: "POST",
            csrf: true,
            body,
            signal: controller.signal,
          });
          const inventory = parseInventory(response.data);
          if (
            inventory.branch.id !== body.branchId ||
            inventory.product.id !== body.productId ||
            inventory.quantity !== 0 ||
            inventory.reserved !== 0 ||
            inventory.available !== 0 ||
            inventory.reorderLevel !== body.reorderLevel
          )
            throw new Error("Unexpected inventory creation result");
          clearInventoryCreation(key);
          if (!active.current) return;
          setPending(undefined);
          onSaved();
          router.push(`/admin/inventory/${inventory.id}`);
        } catch (error) {
          if (sent && error instanceof ApiError && [408, 429].includes(error.status))
            throw new Error(
              "The creation response must be reconciled before another record",
            );
          if (
            sent &&
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![408, 429].includes(error.status)
          )
            clearInventoryCreation(key);
          throw error;
        } finally {
          if (active.current) request.current = null;
        }
      },
    });
  }
  async function reconcile() {
    if (checking || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    setMessage(undefined);
    setSavedId(undefined);
    try {
      const access = parseOwnStaffProfile(
        (await apiRequest("/staff/profile", { signal: controller.signal })).data,
      );
      if (
        access.id !== owner ||
        access.role !== role ||
        access.status !== "ACTIVE" ||
        !["ADMIN", "SUPER_ADMIN"].includes(access.role)
      )
        throw Error("Current administrator access could not be confirmed.");
      if (!pending || pending === "unknown")
        throw Error(
          "The pending branch and part could not be read. Check your inventory records before continuing; this form remains locked.",
        );
      const query = new URLSearchParams({
        limit: "25",
        branchId: pending.branchId,
        productId: pending.productId,
      });
      const rows = parseWorkInventories(
        (await apiRequest(`/staff/inventory?${query}`, { signal: controller.signal }))
          .data,
      );
      if (
        rows.items.length > 1 ||
        rows.nextCursor ||
        rows.items.some(
          (row) =>
            row.branch.id !== pending.branchId || row.product.id !== pending.productId,
        )
      )
        throw Error(
          "The saved inventory did not match this branch and part. The creation remains locked.",
        );
      if (!active.current || controller.signal.aborted) return;
      clearInventoryCreation(key);
      setPending(undefined);
      setSavedId(rows.items[0]?.id);
      setMessage(
        rows.items.length
          ? "An inventory record exists for this branch and part. Review its saved details. Nothing was resent."
          : "No inventory record is currently saved for this branch and part. The pending creation is cleared. Nothing was resent.",
      );
      onSaved();
    } catch (error) {
      if (active.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "The saved inventory could not be checked. The creation remains locked.",
        );
    } finally {
      if (active.current) {
        request.current = null;
        setChecking(false);
      }
    }
  }
  return (
    <section className="detail-section">
      <h2 id="inventory-create-title" tabIndex={-1}>
        Add a branch inventory record
      </h2>
      <p>Creation does not add physical stock.</p>
      <Feedback
        message={
          pending
            ? "The creation outcome is uncertain. Check the saved branch and part before creating another record. This form remains locked until that check succeeds."
            : undefined
        }
      />
      {pending && (
        <button
          className="button secondary"
          type="button"
          disabled={checking || !!proposal}
          onClick={() => void reconcile()}
        >
          Check saved branch inventory
        </button>
      )}
      <Feedback message={message} tone="info" />
      {savedId && (
        <p>
          <Link className="text-link" href={`/admin/inventory/${savedId}`}>
            Open saved inventory record
          </Link>
        </p>
      )}
      <form
        data-draft-key={JSON.stringify(["inventory-create-form:2", owner])}
        onSubmit={(event) => {
          void form.handleSubmit(
            (values) => review(values),
            (validation) => {
              const first = (["branchId", "productId", "reorderLevel"] as const).find(
                (name) => validation[name],
              );
              if (first) form.setFocus(first);
            },
          )(event);
        }}
        noValidate
      >
        <fieldset disabled={!!proposal || !!pending || checking}>
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
          <button id="inventory-create-review" className="button">
            Review inventory record
          </button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            if (attempted.current) {
              onSaved();
              document.getElementById("work-inventory-title")?.focus();
            } else
              requestAnimationFrame(() =>
                document.getElementById("inventory-create-review")?.focus(),
              );
          }}
          onSuccess={() => setPending(undefined)}
        />
      )}
    </section>
  );
}
