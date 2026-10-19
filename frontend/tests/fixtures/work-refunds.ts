import type { Page } from "@playwright/test";
import { workInvoiceFixture, id } from "./work-invoices";
import type { WorkRefund } from "@/lib/admin/work-refunds";
export { id };
/** Keep legacy browser fixtures aligned with the safe queue/current DTOs. */
export function refundFixtureDto(value: unknown, current = false): unknown {
  if (!value || typeof value !== "object" || !("refundNumber" in value)) return value;
  const record = value as Record<string, unknown>;
  const { cancelledAt, cancellationNote, ...queue } = record;
  return {
    ...queue,
    providerRefundId: record.providerRefundId ?? null,
    policyVersionId: record.policyVersionId ?? null,
    ...(current
      ? {
          cancelledAt:
            cancelledAt ?? (record.status === "CANCELLED" ? record.updatedAt : null),
          cancellationNote: cancellationNote ?? null,
        }
      : {}),
  };
}
export function refundRow(n = 0): WorkRefund {
  const status = (
    ["REQUESTED", "NEEDS_ATTENTION", "PROCESSING", "SUCCEEDED", "CANCELLED"] as const
  )[n % 5];
  const approved = !["REQUESTED", "CANCELLED"].includes(status);
  const transferred = ["PROCESSING", "SUCCEEDED"].includes(status);
  return {
    id: id(200000 + n),
    refundNumber: `REF-2026-${String(382 - n).padStart(6, "0")}`,
    paymentAttemptId: id(201000 + n),
    paymentAttempt: { provider: "MANUAL" },
    providerRefundId: null,
    policyVersionId: null,
    authorizationKind: "HUMAN",
    amountKobo: n % 5 === 3 ? "12500000" : "8500000",
    currency: "NGN",
    status,
    requestedByUserId: id(401),
    approvedByUserId: approved ? id(402) : null,
    requestedAt: new Date(
      Date.parse("2026-10-18T08:00:37.123Z") - n * 86400000,
    ).toISOString(),
    approvedAt: approved ? "2026-10-18T08:30:37.123Z" : null,
    updatedAt: "2026-10-18T09:00:37.123Z",
    processedAt: status === "SUCCEEDED" ? "2026-10-18T10:00:37.123Z" : null,
    failedAt: null,
    providerStatus: status === "NEEDS_ATTENTION" ? "OFFLINE_PROCESSING_REQUIRED" : null,
    failureCode: null,
    reason: "Returned genuine part after workshop inspection.",
    dueAt: approved ? "2026-10-20T08:30:37.123Z" : null,
    clockStatus: approved ? "RUNNING" : "NOT_STARTED",
    transferredByUserId: transferred ? id(403) : null,
    transferRecordedAt: transferred ? "2026-10-18T09:00:37.123Z" : null,
    bankTransferAt: transferred ? "2026-10-18T08:45:37.123Z" : null,
    checkedByUserId: status === "SUCCEEDED" ? id(404) : null,
    checkedAt: status === "SUCCEEDED" ? "2026-10-18T10:00:37.123Z" : null,
  };
}
export async function workRefundFixture(page: Page, role = "ADMIN") {
  const base = await workInvoiceFixture(page, role);
  const state = {
    base,
    profileMode: "normal",
    mode: "normal",
    detailMode: "normal",
    writeMode: "normal",
    evidenceMode: "normal",
    grants: ["REFUND_APPROVE", "REFUND_TRANSFER", "REFUND_CHECK"],
    records: Array.from({ length: 5 }, (_, n) => refundRow(n)),
    reads: [] as URL[],
    detailReads: [] as URL[],
    evidenceReads: [] as string[],
    storagePuts: 0,
    held: undefined as (() => void) | undefined,
    writes: [] as { path: string; body: unknown }[],
  };
  const extras = new Map<
    string,
    { cancelledAt: string | null; cancellationNote: string | null }
  >();
  const transfers = new Map<
    string,
    {
      bankReference: string;
      transferredAt: string;
      beneficiary: { bankName: string; accountName: string; accountNumber: string };
    }
  >();
  const fail = (status: number) => ({
    status,
    json: {
      success: false,
      error: {
        code:
          status === 403
            ? "FORBIDDEN"
            : status === 404
              ? "NOT_FOUND"
              : status === 409
                ? "CONFLICT"
                : "UNAVAILABLE",
      },
    },
  });
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic refund fixture",
      meta: { requestId: "refund-page-test" },
    },
  });
  await page.route("**/api/v1/staff/profile", (r) => {
    if (["error", "denied"].includes(state.profileMode))
      return r.fulfill({
        status: state.profileMode === "denied" ? 403 : 503,
        json: { success: false, error: { code: "UNAVAILABLE" } },
      });
    return r.fulfill(
      ok({
        id: id(state.profileMode === "mismatch" ? 999 : 302),
        email: "workshop@example.test",
        role,
        status: state.profileMode === "inactive" ? "SUSPENDED" : "ACTIVE",
        capabilities: state.grants,
        staffProfile: {
          id: id(601),
          firstName: "Ada",
          lastName: "Okoro",
          branchId: id(101),
        },
      }),
    );
  });
  for (const pattern of [
    "**/api/v1/admin/operations/payment-refunds**",
    "**/api/v1/staff/refunds**",
  ])
    await page.route(pattern, async (r) => {
      const u = new URL(r.request().url()),
        parts = u.pathname.split("/"),
        action = parts.at(-1)!;
      const index = state.records.findIndex((v) => parts.includes(v.id)),
        row = state.records[index];
      const facts = () => ({
        ...row,
        ...(extras.get(row.id) ?? {
          cancelledAt: row.status === "CANCELLED" ? row.updatedAt : null,
          cancellationNote: null,
        }),
      });
      if (r.request().method() !== "GET") {
        const body = r.request().postDataJSON();
        if (action === "evidence-access" || action === "evidence-upload") {
          state.evidenceReads.push(action);
          if (state.evidenceMode === "denied") return r.fulfill(fail(403));
          if (action === "evidence-upload")
            return r.fulfill(
              ok({
                evidenceToken: "synthetic-refund-evidence-ticket-".repeat(5),
                upload: {
                  method: "PUT",
                  url: "https://storage.invalid/refund-evidence-upload",
                  expiresAt: new Date(Date.now() + 600000).toISOString(),
                  headers: {
                    "content-type": body.mimeType,
                    "x-amz-checksum-sha256": Buffer.from(
                      body.checksumSha256,
                      "hex",
                    ).toString("base64"),
                    "x-amz-server-side-encryption": "AES256",
                  },
                },
              }),
            );
          const transfer = transfers.get(row.id) ?? {
            bankReference: "SYNTHETIC-TRANSFER",
            transferredAt: row.bankTransferAt!,
            beneficiary: {
              bankName: "Synthetic bank",
              accountName: "Synthetic private recipient",
              accountNumber: "0123456789",
            },
          };
          return r.fulfill(
            ok({
              id: state.evidenceMode === "mismatch" ? id(999) : row.id,
              url:
                state.evidenceMode === "unsafe-host"
                  ? "https://untrusted.invalid/evidence.pdf"
                  : "https://storage.invalid/refund-evidence.pdf",
              amountKobo: row.amountKobo,
              ...transfer,
            }),
          );
        }
        state.writes.push({ path: u.pathname, body });
        if (state.writeMode === "hold")
          await new Promise<void>((resolve) => {
            state.held = resolve;
          });
        if (["rate", "rejected", "denied"].includes(state.writeMode))
          return r.fulfill(
            fail(
              state.writeMode === "rate" ? 429 : state.writeMode === "denied" ? 403 : 409,
            ),
          );
        const now = new Date().toISOString();
        let result: unknown;
        if (action === "decision") {
          state.records[index] = {
            ...row,
            updatedAt: now,
            status: body.decision === "CANCELLED" ? "CANCELLED" : "NEEDS_ATTENTION",
            ...(body.decision === "APPROVED"
              ? {
                  approvedByUserId: id(302),
                  approvedAt: now,
                  providerStatus: "OFFLINE_PROCESSING_REQUIRED",
                }
              : {}),
          };
          extras.set(row.id, {
            cancelledAt: body.decision === "CANCELLED" ? now : null,
            cancellationNote: body.decision === "CANCELLED" ? (body.note ?? null) : null,
          });
          result = { ...state.records[index], ...extras.get(row.id) };
        } else {
          if (action === "transfer") {
            transfers.set(row.id, {
              bankReference: body.bankReference,
              transferredAt: body.transferredAt,
              beneficiary: body.beneficiary,
            });
            state.records[index] = {
              ...row,
              status: "PROCESSING",
              transferredByUserId: id(302),
              bankTransferAt: body.transferredAt,
              transferRecordedAt: now,
              updatedAt: now,
            };
          } else
            state.records[index] = {
              ...row,
              status: body.accepted ? "SUCCEEDED" : "NEEDS_ATTENTION",
              providerStatus: body.accepted
                ? "BANK_TRANSFER_CHECKED"
                : "BANK_TRANSFER_DISPUTED",
              checkedByUserId: id(302),
              checkedAt: now,
              processedAt: body.accepted ? now : null,
              updatedAt: now,
            };
          const updated = state.records[index],
            t = transfers.get(row.id);
          result = {
            id: row.id,
            amountKobo: row.amountKobo,
            status: updated.status,
            bankReference: t?.bankReference ?? "SYNTHETIC-TRANSFER",
            transferredAt: updated.bankTransferAt,
            transferredByUserId: updated.transferredByUserId,
            checkedAt: updated.checkedAt,
            checkedByUserId: updated.checkedByUserId,
          };
        }
        if (state.writeMode === "lost") return r.abort("failed");
        return r.fulfill(
          ok({
            ...(result as object),
            ...(state.writeMode === "wrong-id"
              ? { id: id(999) }
              : state.writeMode === "wrong-total"
                ? { amountKobo: "1" }
                : state.writeMode === "wrong-note"
                  ? { cancellationNote: "Different saved note" }
                  : {}),
          }),
        );
      }
      if (row) {
        state.detailReads.push(u);
        if (state.detailMode === "hold")
          await new Promise<void>((resolve) => {
            state.held = resolve;
          });
        if (["error", "denied", "missing"].includes(state.detailMode))
          return r.fulfill(
            fail(
              state.detailMode === "denied"
                ? 403
                : state.detailMode === "missing"
                  ? 404
                  : 503,
            ),
          );
        return r.fulfill(
          ok({
            ...facts(),
            ...(state.detailMode === "mismatch"
              ? { id: id(999) }
              : state.detailMode === "malformed"
                ? { amountKobo: "broken" }
                : {}),
          }),
        );
      }
      state.reads.push(u);
      if (/\/staff\/refunds\/[^/]+$/.test(u.pathname)) return r.fulfill(fail(404));
      if (["error", "denied"].includes(state.mode))
        return r.fulfill({
          status: state.mode === "denied" ? 403 : 503,
          json: { success: false, error: { code: "UNAVAILABLE" } },
        });
      let rows = state.records.filter(
        (v) => !u.searchParams.has("status") || v.status === u.searchParams.get("status"),
      );
      if (state.mode === "malformed") return r.fulfill(ok({ items: [{ id: null }] }));
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (state.mode === "empty") rows = [];
      if (role === "STAFF")
        rows = rows.filter(
          (v) =>
            (state.grants.includes("REFUND_APPROVE") &&
              (v.status === "REQUESTED" || v.approvedByUserId === id(302))) ||
            (state.grants.includes("REFUND_TRANSFER") &&
              v.paymentAttempt.provider === "MANUAL" &&
              v.authorizationKind === "HUMAN" &&
              !!v.approvedAt) ||
            (state.grants.includes("REFUND_CHECK") &&
              v.paymentAttempt.provider === "MANUAL" &&
              !!v.transferredByUserId),
        );
      const start = u.searchParams.has("cursor")
        ? rows.findIndex((v) => v.id === u.searchParams.get("cursor")) + 1
        : 0;
      const limit = Number(u.searchParams.get("limit") ?? 25),
        items = rows.slice(start, start + limit);
      return r.fulfill(
        ok({
          items,
          ...(start + limit < rows.length ? { nextCursor: items.at(-1)!.id } : {}),
        }),
      );
    });
  await page.route("https://storage.invalid/**", (r) => {
    if (r.request().method() === "PUT") state.storagePuts++;
    return r.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "PUT, GET, OPTIONS",
        "Access-Control-Allow-Headers":
          "content-type,x-amz-checksum-sha256,x-amz-server-side-encryption",
      },
      body: "Synthetic private storage transport",
    });
  });
  return state;
}
