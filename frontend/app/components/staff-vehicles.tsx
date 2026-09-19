"use client";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import { listingStatuses, parseStaffVehicles } from "@/lib/api/staff-vehicle-schemas";
import { Feedback } from "./feedback";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { SlotCatalogPicker } from "./slot-catalog-picker";
import { useAccountSession } from "./dashboard-shell";
const filtersSchema = z.object({
  search: z.string().trim().max(100),
  make: z.string().trim().max(80),
  model: z.string().trim().max(80),
  year: z.union([
    z.literal(""),
    z
      .string()
      .regex(/^\d{4}$/)
      .refine(
        (value) => Number(value) >= 1886 && Number(value) <= 2200,
        "Enter a year from 1886 to 2200.",
      ),
  ]),
  status: z.enum(["", ...listingStatuses]),
  branchId: z.union([z.literal(""), z.string().uuid()]),
});
const emptyFilters = {
  search: "",
  make: "",
  model: "",
  year: "",
  status: "",
  branchId: "",
} as const;
export function StaffVehicles() {
  const session = useAccountSession();
  const pagination = useCursorPage();
  const [filters, setFilters] = useState<z.infer<typeof filtersSchema>>(emptyFilters);
  const form = useForm<z.infer<typeof filtersSchema>>({
    resolver: zodResolver(filtersSchema),
    defaultValues: emptyFilters,
  });
  const query = new URLSearchParams({ limit: "25" });
  for (const [name, value] of Object.entries(filters))
    if (value && (name !== "branchId" || session?.user.role !== "STAFF"))
      query.set(name, value);
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const vehicles = useResource(`/staff/vehicles?${query}`, parseStaffVehicles);
  const filtered = Object.values(filters).some(Boolean);
  return (
    <>
      <h1>Vehicle stock</h1>
      <p className="lead">
        Manage vehicle records and their sale listings within your permitted branches.
      </p>
      <Link className="button" href="/admin/vehicles/new">
        Add vehicle record
      </Link>
      <form
        className="catalogue-filters"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          setFilters(values);
          pagination.reset();
        })}
      >
        {(
          [
            ["search", "Search stock records", 100],
            ["make", "Exact make", 80],
            ["model", "Exact model", 80],
            ["year", "Model year filter", 4],
          ] as const
        ).map(([name, label, maxLength]) => (
          <div className="field" key={name}>
            <label htmlFor={`stock-filter-${name}`}>{label}</label>
            <input
              id={`stock-filter-${name}`}
              {...form.register(name)}
              maxLength={maxLength}
              inputMode={name === "year" ? "numeric" : "text"}
              aria-invalid={!!form.formState.errors[name]}
            />
            {form.formState.errors[name] && (
              <p className="field-error" role="alert">
                {form.formState.errors[name]?.message}
              </p>
            )}
          </div>
        ))}
        <div className="field">
          <label htmlFor="stock-filter-status">Listing status filter</label>
          <select id="stock-filter-status" {...form.register("status")}>
            <option value="">All records, including unlisted</option>
            {listingStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>
        {session?.user.role !== "STAFF" && (
          <div className="field">
            <label htmlFor="stock-filter-branch">Active branch filter</label>
            <Controller
              name="branchId"
              control={form.control}
              render={({ field }) => (
                <SlotCatalogPicker
                  id="stock-filter-branch"
                  kind="branch"
                  value={field.value}
                  onChange={field.onChange}
                  inputRef={field.ref}
                />
              )}
            />
          </div>
        )}
        <div className="actions">
          <button className="button secondary">Apply stock filters</button>
          {filtered && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                form.reset(emptyFilters);
                setFilters(emptyFilters);
                pagination.reset();
              }}
            >
              Clear stock filters
            </button>
          )}
        </div>
      </form>
      <Feedback message={vehicles.error} />
      <button
        className="button secondary"
        disabled={vehicles.loading}
        onClick={vehicles.refresh}
      >
        Refresh vehicle stock
      </button>
      {vehicles.loading && <p role="status">Checking vehicle stock…</p>}
      <div
        className="table-region"
        role="region"
        aria-label="Vehicle stock records"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Stock number</th>
              <th>Vehicle</th>
              <th>Branch</th>
              <th>Listings</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.data?.items.map((vehicle) => (
              <tr key={vehicle.id}>
                <td>
                  <Link className="text-link" href={`/admin/vehicles/${vehicle.id}`}>
                    {vehicle.stockNumber}
                  </Link>
                </td>
                <td>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </td>
                <td>{vehicle.branch.name}</td>
                <td>
                  {vehicle.listings.length
                    ? vehicle.listings.map((listing) => (
                        <p key={listing.id}>
                          {listing.title} · {listing.status}
                        </p>
                      ))
                    : "Not listed"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!vehicles.loading && !vehicles.error && vehicles.data?.items.length === 0 && (
        <div className="empty">
          <h2>
            {filtered
              ? "No vehicles match these filters"
              : "No stock records on this page"}
          </h2>
        </div>
      )}
      <CursorPagination
        pagination={pagination}
        nextCursor={vehicles.data?.nextCursor}
        disabled={vehicles.loading || !!vehicles.error}
        label="Vehicle stock"
      />
    </>
  );
}
