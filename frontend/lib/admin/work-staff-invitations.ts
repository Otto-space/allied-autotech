import { staffDirectoryQuery } from "./work-staff-directory";
export { inspectionPageParams as invitationPageParams } from "./work-inspections";

export function invitationQuery(input: URLSearchParams) {
  const status = input.get("status");
  const source = new URLSearchParams(input);
  source.delete("status");
  const base = staffDirectoryQuery(source);
  const invalid =
    base.invalid ||
    [...input.keys()].some(
      (key) =>
        !["status", "cursor", "_trail"].includes(key) || input.getAll(key).length !== 1,
    ) ||
    (status !== null && !["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"].includes(status));
  const params = base.params;
  if (status) params.set("status", status);
  const api = new URLSearchParams(params);
  api.delete("_trail");
  api.set("limit", "25");
  return { params, invalid, path: invalid ? null : `/admin/staff/invitations?${api}` };
}
