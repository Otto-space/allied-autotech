// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AllieHandoff,
  type HandoffMemory,
} from "@/app/components/learning/allie-handoff";
import { catalogueSchema } from "@/lib/learning/contracts";
import { handoffBody, type HandoffDraft } from "@/lib/learning/handoff";
import { newHandoffKey, saveHandoffPending } from "@/lib/learning/handoff-pending";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/api/client", () => api);
vi.mock("@/app/components/learning/handoff-destination", () => ({
  HandoffDestination: () => <p>Destination choices are separately browser tested.</p>,
}));
const data = catalogueSchema.parse({
  accessKey: "a".repeat(64),
  audience: "customer",
  contentVersion: 1,
  mode: "browse_enquiries",
  flags: { ai: false, guides: true, practice: true },
  articles: [],
  guides: [],
  scenarios: [],
});
const id = (n: number) => `c2000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const callbacks = { onReturn: vi.fn(), onNavigate: vi.fn(), onSaved: vi.fn() };
const input = (): HandoffDraft => ({
  target: { kind: "NEW_ENQUIRY", subject: "My vehicle question" },
  summary: "Editable manual summary",
});
const preview = (draft: HandoffDraft) => ({
  target: {
    kind: draft.target.kind,
    id: null,
    branchId: id(1),
    branchName: "Synthetic branch",
    subject: draft.target.kind === "NEW_ENQUIRY" ? draft.target.subject : "Selected case",
    version: null,
  },
  body: handoffBody(draft, null),
  audience: "CUSTOMER_CARE",
  mode: "QUEUED",
  excerptCount: 0,
  review: {
    token: "a".repeat(64),
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  },
  recoveryExpiresAt: new Date(Date.now() + 900000).toISOString(),
});
const saved = () => ({
  state: "SAVED",
  mode: "QUEUED",
  replayed: false,
  reference: {
    kind: "ENQUIRY",
    id: id(2),
    branchId: id(1),
    messageId: null,
    createdNew: true,
  },
});
function Harness({ initial = null }: { initial?: HandoffMemory }) {
  const [memory, setMemory] = useState(initial);
  return (
    <AllieHandoff
      data={data}
      conversation={null}
      memory={memory}
      onMemoryChange={setMemory}
      {...callbacks}
    />
  );
}
async function ready() {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Review message" })).toBeEnabled(),
  );
}
function fill() {
  fireEvent.change(screen.getByRole("textbox", { name: "Subject", exact: true }), {
    target: { value: input().target.kind === "NEW_ENQUIRY" ? "My vehicle question" : "" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /Your issue summary/ }), {
    target: { value: input().summary },
  });
}
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  api.apiRequest.mockImplementation(async (path, options) => {
    if (path.endsWith("/preview")) return { data: preview(options.body) };
    if (options?.method === "DELETE")
      return { data: { state: "CANCELLED", cancelled: true } };
    if (options?.method === "POST") return { data: saved() };
    throw Error("Unexpected request");
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

it("works with AI off and sends only after the exact audience/message review", async () => {
  render(<Harness />);
  await ready();
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Review message" }));
  await screen.findByRole("heading", { name: "Review your message" });
  expect(screen.getByText("Customer Care · Synthetic branch")).toBeVisible();
  expect(screen.getByLabelText("Exact message to Customer Care").textContent).toBe(
    handoffBody(input(), null),
  );
  expect(api.apiRequest).toHaveBeenCalledTimes(1);
  const [path, options] = api.apiRequest.mock.calls[0];
  expect(path).toBe("/customers/support/handoff/preview");
  expect(options.body.excerpts).toBeUndefined();
  expect(JSON.stringify(sessionStorage)).not.toContain(input().summary);
  fireEvent.click(screen.getByRole("button", { name: "Send message to Customer Care" }));
  await screen.findByRole("heading", { name: "Your message is saved" });
  expect(api.apiRequest.mock.calls[1][1].idempotencyKey).toBe(options.idempotencyKey);
  expect(api.apiRequest.mock.calls[1][1].body.consent).toBe(true);
  expect(
    screen.getByRole("link", { name: "Open your Customer Care conversation" }),
  ).toHaveAttribute("href", `/dashboard/support/enquiries/${id(2)}`);
  expect(sessionStorage.length).toBe(0);
});
it("cancels the immutable old review before editing, preserving the summary", async () => {
  render(<Harness />);
  await ready();
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Review message" }));
  fireEvent.click(await screen.findByRole("button", { name: "Go back and edit" }));
  await ready();
  expect(api.apiRequest.mock.calls[1][1].method).toBe("DELETE");
  expect(screen.getByRole("textbox", { name: /Your issue summary/ })).toHaveValue(
    input().summary,
  );
  expect(sessionStorage.length).toBe(0);
  expect(
    api.apiRequest.mock.calls.filter(
      ([, options]) => options?.method === "POST" && !options.body?.target,
    ),
  ).toHaveLength(0);
});
it("locks a lost acknowledgement and recovers the saved reference after remount without resending", async () => {
  let sent = false;
  api.apiRequest.mockImplementation(async (path, options) => {
    if (path.endsWith("/preview")) return { data: preview(options.body) };
    if (options?.method === "POST") {
      sent = true;
      throw Error("Lost acknowledgement");
    }
    if (path.includes("/drafts/") && sent) return { data: saved() };
    throw Error("Unexpected request");
  });
  const first = render(<Harness />);
  await ready();
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Review message" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Send message to Customer Care" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.getByRole("button", { name: "Retry the same reviewed message" }),
  ).toBeEnabled();
  first.unmount();
  render(<Harness />);
  await screen.findByRole("heading", { name: "Your message is saved" });
  expect(
    api.apiRequest.mock.calls.filter(
      ([path, options]) =>
        path === "/customers/support/handoff" && options?.method === "POST",
    ),
  ).toHaveLength(1);
});
it("recovers an unsent exact review without sending it", async () => {
  const operationKey = newHandoffKey();
  saveHandoffPending(data.accessKey, operationKey);
  api.apiRequest.mockResolvedValue({
    data: {
      state: "REVIEW",
      draft: input(),
      preview: preview(input()),
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    },
  });
  render(<Harness />);
  await screen.findByRole("heading", { name: "Review your message" });
  expect(api.apiRequest).toHaveBeenCalledTimes(1);
  expect(api.apiRequest.mock.calls[0][0]).toContain(operationKey);
  expect(api.apiRequest.mock.calls[0][1].method).toBeUndefined();
  expect(screen.getByText(/Nothing is sent until you confirm/)).toBeVisible();
});
it("does not trust a preview that silently adds unselected content", async () => {
  api.apiRequest.mockImplementation(async (_path, options) => ({
    data: { ...preview(options.body), body: "Unselected private transcript" },
  }));
  render(<Harness />);
  await ready();
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Review message" }));
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("button", { name: "Send message to Customer Care" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Review message" })).toBeDisabled();
  expect(screen.getByRole("textbox", { name: /Your issue summary/ })).toHaveValue(
    input().summary,
  );
});
it("blocks an unreadable recovery marker rather than overwriting an uncertain operation", async () => {
  sessionStorage.setItem("aat:handoff:v1:" + data.accessKey, "invalid-json");
  render(<Harness />);
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Review message" })).toBeDisabled();
  expect(
    screen.getByRole("link", { name: "Check your Customer Care history" }),
  ).toHaveAttribute("href", "/dashboard/support");
  expect(api.apiRequest).not.toHaveBeenCalled();
});
it("makes no request if the browser cannot retain a non-sensitive operation ID", async () => {
  render(<Harness />);
  await ready();
  fill();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("Storage unavailable");
  });
  fireEvent.click(screen.getByRole("button", { name: "Review message" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Your summary has not been sent");
  expect(api.apiRequest).not.toHaveBeenCalled();
});
it("ignores a late send response after the handoff is unmounted", async () => {
  let finish!: (value: unknown) => void;
  api.apiRequest.mockImplementation(async (path, options) =>
    path.endsWith("/preview")
      ? { data: preview(options.body) }
      : new Promise((resolve) => {
          finish = resolve;
        }),
  );
  const view = render(<Harness />);
  await ready();
  fill();
  fireEvent.click(screen.getByRole("button", { name: "Review message" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Send message to Customer Care" }),
  );
  view.unmount();
  await act(async () => {
    finish({ data: saved() });
  });
  expect(callbacks.onSaved).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(1);
});
