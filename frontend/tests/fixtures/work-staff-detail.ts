import type { Page } from "@playwright/test";
import { workStaffDirectoryFixture, directoryRow, id } from "./work-staff-directory";
import {
  workforceTemplateLabels,
  type WorkforceAccount,
} from "@/lib/api/workforce-schemas";
// Controlled catalogue metadata is loaded by the Node test runner only; never by product code.
import { workforceTemplates } from "../../../backend/src/modules/organization/workforce-catalogue";
export { id };
export function staffWorkforceRecord(): WorkforceAccount {
  return {
    userId: directoryRow().id,
    accountLabel: "Ada Okoro",
    access: null,
    assignments: [],
    activeAssignmentIds: [],
    branches: [
      { id: id(101), name: "Stadium Road workshop", code: "STD", isActive: true },
      { id: id(102), name: "GRA workshop", code: "GRA", isActive: true },
    ],
    management: {
      canEnroll: true,
      canAssign: false,
      canRevoke: false,
      canDelegate: false,
      templates: Object.keys(
        workforceTemplateLabels,
      ) as (keyof typeof workforceTemplateLabels)[],
      branchIds: null,
    },
    templatesVersion: 1,
    templates: Object.fromEntries(
      Object.entries(workforceTemplates).map(([key, definition]) => [
        key,
        { ...definition, actions: [...definition.actions] },
      ]),
    ),
  };
}
export async function workStaffDetailFixture(page: Page, role = "ADMIN") {
  const directory = await workStaffDirectoryFixture(page, role);
  const state = {
    directory,
    member: directoryRow(),
    mode: "normal",
    reads: 0,
    writes: [] as string[],
    workforce: staffWorkforceRecord(),
  };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      message: "Synthetic account QA",
      data,
      meta: { requestId: "staff-detail-test" },
    },
  });
  await page.route("**/api/v1/admin/staff/*", (r) => {
    if (r.request().method() !== "GET") {
      state.writes.push(r.request().method());
      return r.fulfill({ status: 405 });
    }
    state.reads++;
    if (state.mode === "error" || state.mode === "denied")
      return r.fulfill({
        status: state.mode === "denied" ? 403 : 503,
        json: {
          success: false,
          error: { code: state.mode === "denied" ? "FORBIDDEN" : "DATABASE_UNAVAILABLE" },
        },
      });
    return r.fulfill(
      ok(state.mode === "mismatch" ? { ...state.member, id: id(9999) } : state.member),
    );
  });
  await page.route("**/api/v1/admin/capabilities?**", (r) => r.fulfill(ok([])));
  await page.route("**/api/v1/admin/workforce/accounts/*", (r) =>
    r.fulfill(ok(state.workforce)),
  );
  return state;
}
