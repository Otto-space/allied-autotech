// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkforceEnquiryDetail } from "@/app/components/workforce-enquiry-detail";
import { WorkforceComplaintDetail } from "@/app/components/workforce-complaint-detail";
import { SupportChannelWorkspace } from "@/app/components/support-channel-workspace";
import { parseWorkforceEnquiry } from "@/lib/admin/workforce-enquiries";
import { parseWorkforceComplaint } from "@/lib/admin/workforce-complaints";
import type { WorkforceAccess } from "@/lib/api/workforce-schemas";

const harness = vi.hoisted(() => ({
  resource: {} as Record<string, unknown>,
  resources: {} as Record<string, Record<string, unknown>>,
  channel: {} as { onCaseChanged: () => void; onPublicUpdate: (id: string) => void },
  request: vi.fn(),
  revalidate: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("@/lib/api/use-resource", () => ({
  useResource: (path: string) => harness.resources[path] ?? harness.resource,
}));
vi.mock("@/lib/api/client", () => ({
  apiRequest: harness.request,
  SESSION_CHANGED: "test-session-changed",
  ApiError: class extends Error {},
}));
vi.mock("@/app/components/support-channel-panel", () => ({
  SupportChannelPanel: (props: typeof harness.channel) => {
    harness.channel = props;
    return <section aria-label="Case conversation controls" />;
  },
}));
vi.mock("@/app/components/notification-record-context", () => ({
  NotificationRecordContext: () => null,
}));
vi.mock("@/app/components/mutation-review", () => ({ MutationReview: () => null }));
const id = (n: number) => `f1700000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const stamp = "2026-10-28T12:00:00.000Z";
function access(): WorkforceAccess {
  return {
    managed: true,
    userId: id(1),
    staffId: id(2),
    position: "Customer service",
    department: "Care",
    version: 1,
    permissions: ["CUSTOMER_ENQUIRIES", "COMPLAINTS"],
    canManageAssignments: false,
    canInviteAdmins: false,
    serverTime: stamp,
    assignments: [
      {
        id: id(3),
        userId: id(1),
        branchId: id(4),
        template: "CUSTOMER_SERVICE",
        scope: "BRANCH",
        temporary: false,
        startsAt: stamp,
        expiresAt: null,
        reason: "Isolated component fixture",
        assignedByUserId: id(5),
        createdAt: stamp,
        revokedAt: null,
        revokedByUserId: null,
        revocationReason: null,
      },
    ],
  };
}
function data(own: WorkforceAccess) {
  return {
    id: id(10),
    assignedStaffId: null,
    assignedStaff: null,
    branchId: id(4),
    branch: { id: id(4), name: "Isolated branch" },
    contact: {
      name: "Synthetic customer",
      email: "care@example.test",
      phone: null,
      customerId: id(11),
    },
    subject: "Synthetic case",
    type: "GENERAL",
    status: "OPEN",
    priority: "HIGH",
    message: "Synthetic enquiry",
    description: "Synthetic complaint",
    version: 2,
    createdAt: stamp,
    updatedAt: stamp,
    generatedAt: stamp,
    access: own,
    latestMessageId: null,
    messages: { items: [] },
    acknowledgedAt: null,
    acknowledgementDueAt: null,
    escalatedAt: null,
    resolution: null,
    resolvedAt: null,
    closedAt: null,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  harness.resources = {};
});
afterEach(cleanup);

for (const kind of ["enquiries", "complaints"] as const) {
  function setup() {
    const own = access();
    const source = data(own);
    const row =
      kind === "enquiries"
        ? parseWorkforceEnquiry(source)
        : parseWorkforceComplaint(source);
    harness.resource = {
      data: row,
      loading: false,
      refreshing: false,
      refresh: vi.fn(),
      revalidate: harness.revalidate,
      denied: false,
    };
    const Detail =
      kind === "enquiries" ? WorkforceEnquiryDetail : WorkforceComplaintDetail;
    const element = () => (
      <Detail
        id={row.id}
        access={own}
        params={
          new URLSearchParams({
            selected: row.id,
            q: "brakes",
            messageCursor: id(20),
            _messageTrail: "start",
          })
        }
        navigate={harness.navigate}
        close={vi.fn()}
        refresh={vi.fn()}
        refreshKey={0}
        enabled
        denied={false}
      />
    );
    const mounted = render(element());
    return { mounted, element, row, own };
  }

  it(`${kind}: background channel reads preserve editing, require stale-draft review and keep URL filters`, async () => {
    const { mounted, element, row } = setup();
    const input = await screen.findByRole("textbox", { name: "Message", exact: true });
    await waitFor(() => expect(input).not.toHaveAttribute("readonly"));
    expect(
      screen.getByRole("region", { name: "Case conversation controls" }),
    ).toBeVisible();
    fireEvent.change(input, { target: { value: "Unsent private draft" } });
    input.focus();
    harness.channel.onCaseChanged();
    expect(harness.revalidate).toHaveBeenCalledOnce();
    harness.resource = { ...harness.resource, refreshing: true };
    mounted.rerender(element());
    expect(screen.getByRole("textbox", { name: "Message", exact: true })).toBe(input);
    expect(input).toHaveFocus();
    expect(input).not.toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Review reply" })).toBeDisabled();
    harness.resource = {
      ...harness.resource,
      refreshing: false,
      data: {
        ...row,
        version: 3,
        messages: {
          items: [
            {
              id: id(30),
              authorType: "CUSTOMER",
              visibility: "CUSTOMER",
              body: "New public update",
              createdAt: stamp,
              isOwn: false,
            },
          ],
        },
      },
    };
    mounted.rerender(element());
    expect(input).toHaveValue("Unsent private draft");
    expect(input).toHaveFocus();
    expect(screen.getByRole("button", { name: "Review reply" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Use retained draft with latest conversation" }),
    );
    expect(screen.getByRole("button", { name: "Review reply" })).toBeEnabled();
    // The update banner survives an already-loaded update until explicitly opened.
    await act(async () => harness.channel.onPublicUpdate(id(30)));
    fireEvent.click(screen.getByRole("button", { name: "View latest update" }));
    const target = harness.navigate.mock.calls.at(-1)![0] as URLSearchParams;
    expect(target.get("selected")).toBe(row.id);
    expect(target.get("q")).toBe("brakes");
    expect(target.get("messageId")).toBe(id(30));
    expect(target.has("messageCursor")).toBe(false);
    expect(target.has("_messageTrail")).toBe(false);
    expect(harness.request).not.toHaveBeenCalled();
  });

  it(`${kind}: denial removes the channel and composer immediately`, async () => {
    const { mounted, element } = setup();
    await screen.findByRole("textbox", { name: "Message", exact: true });
    harness.resource = {
      ...harness.resource,
      data: undefined,
      denied: true,
      error: "Access withdrawn",
    };
    mounted.rerender(element());
    expect(
      screen.queryByRole("region", { name: "Case conversation controls" }),
    ).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Message", exact: true })).toBeNull();
    expect(harness.request).not.toHaveBeenCalled();
  });

  it(`${kind}: cases without a linked customer keep the ordinary form`, async () => {
    const { mounted, element, row } = setup();
    harness.resource = {
      ...harness.resource,
      data: { ...row, contact: { ...row.contact, customerId: null } },
    };
    mounted.rerender(element());
    expect(
      screen.queryByRole("region", { name: "Case conversation controls" }),
    ).toBeNull();
    expect(
      await screen.findByRole("textbox", { name: "Message", exact: true }),
    ).toBeVisible();
  });

  it(`${kind}: a changed access projection removes private controls`, async () => {
    const { mounted, element, row } = setup();
    await screen.findByRole("textbox", { name: "Message", exact: true });
    harness.resource = {
      ...harness.resource,
      data: { ...row, access: { ...row.access, version: 99 } },
    };
    mounted.rerender(element());
    expect(
      screen.queryByRole("region", { name: "Case conversation controls" }),
    ).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Message", exact: true })).toBeNull();
  });
}

for (const managed of [true, false]) {
  for (const kind of ["enquiries", "complaints"] as const) {
    it(`${managed ? "managed" : "legacy"} ${kind}: queue links reach their existing case workspace`, async () => {
      harness.resource = {
        loading: false,
        refreshing: false,
        revalidate: vi.fn(),
        refresh: vi.fn(),
        data: {
          items: [
            {
              id: id(90),
              target: {
                id: id(10),
                kind: kind === "enquiries" ? "ENQUIRY" : "COMPLAINT",
              },
              state: "QUEUED",
              queuedSince: stamp,
              assignedToYou: false,
            },
          ],
        },
      };
      harness.resources["/staff/workforce/support-chat/presence"] = {
        loading: false,
        refreshing: false,
        revalidate: vi.fn(),
        refresh: vi.fn(),
        data: {
          enabled: false,
          version: 0,
          optedIn: false,
          expiresAt: null,
          capacity: 1,
          eligibleBranches: [],
          branchId: null,
        },
      };
      const { container } = render(
        <SupportChannelWorkspace kind={kind} managed={managed} />,
      );
      const disclosure = container.querySelector("details")!;
      disclosure.open = true;
      fireEvent(disclosure, new Event("toggle"));
      const link = await screen.findByRole("link", {
        name: new RegExp(kind === "enquiries" ? "Enquiry" : "Complaint"),
      });
      expect(link).toHaveAttribute(
        "href",
        managed
          ? `/admin/workforce/${kind}?selected=${id(10)}`
          : `/admin/support/${kind}/${id(10)}`,
      );
      expect(harness.request).not.toHaveBeenCalled();
    });
  }
}
