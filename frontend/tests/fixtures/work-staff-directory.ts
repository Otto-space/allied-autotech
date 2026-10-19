import type { Page } from "@playwright/test";
import { workInvoiceFixture, id } from "./work-invoices";
import type { StaffMember } from "@/lib/api/staff-admin-schemas";
export { id };
const stamp = "2026-10-18T08:00:00.000Z";
export function directoryRow(n = 0): StaffMember {
  return {
    id: id(240000 + n),
    email: `team.${String(n + 1).padStart(2, "0")}@example.test`,
    role: n === 2 ? "SUPER_ADMIN" : n === 1 ? "ADMIN" : "STAFF",
    status: n === 3 ? "SUSPENDED" : n === 4 ? "DEACTIVATED" : "ACTIVE",
    emailVerifiedAt: n === 5 ? null : stamp,
    createdAt: stamp,
    updatedAt: stamp,
    staffProfile:
      n === 6
        ? null
        : {
            id: id(250000 + n),
            firstName: ["Ada", "Tunde", "Chika", "Ife", "Emeka", "Amina"][n % 6],
            lastName: ["Okoro", "Bello", "Eze", "Adeyemi", "Nwosu", "Lawal"][n % 6],
            phone: null,
            jobTitle:
              n % 3 === 0
                ? "Service technician"
                : n % 3 === 1
                  ? "Workshop manager"
                  : null,
            branchId: n === 5 ? null : id(n % 2 ? 102 : 101),
            createdAt: stamp,
            updatedAt: stamp,
            branch:
              n === 5
                ? null
                : {
                    id: id(n % 2 ? 102 : 101),
                    code: n % 2 ? "GRA" : "STD",
                    name: n % 2 ? "GRA workshop" : "Stadium Road workshop",
                    isActive: n % 2 === 0,
                  },
          },
  };
}
export async function workStaffDirectoryFixture(page: Page, role = "ADMIN") {
  const base = await workInvoiceFixture(page, role),
    state = {
      base,
      mode: "normal",
      rows: Array.from({ length: 28 }, (_, n) => directoryRow(n)),
      reads: [] as URL[],
      writes: [] as string[],
    };
  await page.route("**/api/v1/admin/staff?**", async (r) => {
    const url = new URL(r.request().url());
    state.reads.push(url);
    if (r.request().method() !== "GET") {
      state.writes.push(r.request().method());
      return r.fulfill({ status: 405 });
    }
    if (["error", "denied"].includes(state.mode))
      return r.fulfill({
        status: state.mode === "denied" ? 403 : 503,
        json: { success: false, error: { code: "DATABASE_UNAVAILABLE" } },
      });
    let rows =
      state.mode === "empty"
        ? []
        : state.rows.filter(
            (v) =>
              ["role", "status"].every(
                (k) =>
                  !url.searchParams.has(k) ||
                  v[k as "role" | "status"] === url.searchParams.get(k),
              ) &&
              (!url.searchParams.has("branchId") ||
                v.staffProfile?.branchId === url.searchParams.get("branchId")),
          );
    const q = url.searchParams.get("q")?.toLowerCase();
    if (q)
      rows = rows.filter((v) =>
        [v.email, v.staffProfile?.firstName ?? "", v.staffProfile?.lastName ?? ""].some(
          (x) => x.toLowerCase().includes(q),
        ),
      );
    const cursor = url.searchParams.get("cursor");
    if (cursor) rows = rows.filter((v) => v.id > cursor);
    const items = rows.slice(0, 25);
    return r.fulfill({
      json: {
        success: true,
        message: "Synthetic staff directory",
        data: { items, ...(rows.length > 25 ? { nextCursor: items.at(-1)!.id } : {}) },
        meta: { requestId: "directory-qa" },
      },
    });
  });
  return state;
}
