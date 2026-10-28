import type { WorkforceAccess } from "../api/workforce-schemas";
import { workforceAccessKey } from "../workforce-registry";

export function sameWorkforceScope(current: WorkforceAccess, overview: WorkforceAccess) {
  return (
    current.managed &&
    overview.managed &&
    current.userId === overview.userId &&
    workforceAccessKey(current) === workforceAccessKey(overview)
  );
}
