"use client";
import { ServicePhoto } from "./service-photo";
import Link from "next/link";
import {
  Wrench,
  ArrowUpRight,
  CircleDot,
  ScanLine,
  Cpu,
  Settings,
  Cog,
  Snowflake,
  Paintbrush,
  Armchair,
} from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseServiceCategories } from "@/lib/api/public-schemas";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
const groupIcons: Record<string, typeof Wrench> = {
  "Tyre & Wheel Maintenance": CircleDot,
  "Vehicle Diagnostics & Inspections": ScanLine,
  "ECU Programming & Vehicle Electronics": Cpu,
  "Suspension Repairs": Settings,
  "Engine & Drive System Maintenance": Cog,
  "Vehicle AC Maintenance": Snowflake,
  "Bodywork & Painting": Paintbrush,
  "Interior Repairs": Armchair,
};
export function ServiceGroupIcon({ name }: { name: string }) {
  const Icon = groupIcons[name] ?? Wrench;
  return <Icon size={24} aria-hidden="true" />;
}
export function ServiceGroups() {
  const pagination = useCursorPage();
  const query = new URLSearchParams({ limit: "20" });
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const groups = useResource(
    "/public/services/categories?" + query,
    parseServiceCategories,
  );
  return (
    <section
      className="public-wrap service-groups"
      aria-labelledby="service-groups-title"
    >
      <header>
        <h2 id="service-groups-title">Our maintenance and repair services</h2>
        <p>Choose an area of work, or tell us what you have noticed.</p>
      </header>
      {groups.loading && !groups.data ? (
        <p role="status">Loading service groups…</p>
      ) : groups.error || groups.refreshError ? (
        <div role="status">
          <p>Service groups could not be loaded.</p>
          <button type="button" className="button secondary" onClick={groups.refresh}>
            Retry service groups
          </button>
        </div>
      ) : groups.data?.items.length ? (
        <div className="service-group-grid">
          {groups.data.items.map((group) => (
            <Link
              className="service-group-card"
              key={group.id}
              href={"/services?categoryId=" + group.id + "#service-catalogue"}
            >
              {group.image ? (
                <ServicePhoto
                  key={group.image.id}
                  url={group.image.url}
                  alt={group.image.altText || group.name}
                  width={group.image.width}
                  height={group.image.height}
                />
              ) : (
                <ServiceGroupIcon name={group.name} />
              )}
              <h3>{group.name}</h3>
              {group.description && <p>{group.description}</p>}
              <span>
                View details <ArrowUpRight size={16} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p>
          Tell the workshop about the work your vehicle needs.{" "}
          <Link href="/contact#enquiry">Ask our team</Link>.
        </p>
      )}
      {(groups.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={groups.data?.nextCursor}
          disabled={groups.loading || groups.refreshing}
          label="Service groups"
        />
      )}
    </section>
  );
}
