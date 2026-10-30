// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AllieConversationPanel } from "@/app/components/learning/allie-conversation";
import {
  AllieClientError,
  createConversationClient,
  validateConversation,
  type AllieConversation,
} from "@/lib/learning/conversation";
import { catalogueSchema, learningPage } from "@/lib/learning/contracts";

vi.mock("next/navigation", () => ({ usePathname: () => "/parts" }));
const operational = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("@/lib/api/client", () => operational);
const id = "b0000000-0000-4000-8000-000000000001";
const operationId = "b0000000-0000-4000-8000-000000000002";
const data = catalogueSchema.parse({
  accessKey: "a".repeat(64),
  audience: "public",
  contentVersion: 1,
  mode: "browse_enquiries",
  flags: { ai: true, guides: true, practice: true },
  articles: [
    {
      id: "parts-fitment",
      title: "Find compatible parts",
      summary: "Check evidence",
      prerequisites: "Choose a part",
      steps: ["Read compatibility evidence"],
      outcome: "No assumption",
      recovery: "Ask for help",
      keywords: "parts",
      page: "parts",
      href: "/parts",
      source: "Reviewed help",
      version: 2,
      status: "published",
      reviewedAt: "2026-10-26",
    },
  ],
  guides: [],
  scenarios: [],
});
const empty = (): AllieConversation => ({
  id,
  version: 1,
  audience: "public",
  expiresAt: new Date(Date.now() + 600000).toISOString(),
  messages: [],
  historyReset: false,
  pending: null,
});
const answered = (op = operationId): AllieConversation => ({
  ...empty(),
  version: 3,
  messages: [
    {
      operationId: op,
      question: "Find compatible parts",
      answer: {
        kind: "answer",
        answer: "A name match does not confirm compatibility.",
        steps: ["Read compatibility evidence."],
        caveat: "Ask the team when evidence is missing.",
        sourceIds: ["parts-fitment@v2"],
        actionIds: ["read:parts-fitment"],
        sources: [
          {
            id: "parts-fitment@v2",
            articleId: "parts-fitment",
            version: 2,
            title: "Find compatible parts",
            href: "/learn?article=parts-fitment",
          },
        ],
        actions: [
          {
            id: "read:parts-fitment",
            kind: "article",
            label: "Read compatibility help",
            href: "/learn?article=parts-fitment",
            sourceId: "parts-fitment@v2",
          },
        ],
      },
    },
  ],
});
const response = (value: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      success: status === 200,
      data: value,
      error: { code: "NOT_FOUND" },
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
let network: ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  network = vi.fn<typeof fetch>(async (url, init) => {
    const target = String(url);
    if (target.endsWith("/session"))
      return response({ csrfToken: "s".repeat(48), expiresAt: empty().expiresAt });
    if (target.endsWith("/conversations") && (!init?.method || init.method === "GET"))
      return response({ items: [] });
    if (target.endsWith("/conversations") && init?.method === "POST")
      return response({ replayed: false, conversation: empty() });
    if (target.endsWith("/cancel"))
      return response({ cancelled: true, status: "CANCELLED" });
    if (init?.method === "DELETE") return response({ cleared: true });
    if (target.endsWith("/turns"))
      return response({
        replayed: false,
        conversation: answered(JSON.parse(String(init?.body)).operationId),
      });
    return response(empty());
  });
  vi.stubGlobal("fetch", network);
  operational.apiRequest.mockReset();
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function start() {
  render(<AllieConversationPanel data={data} onNavigate={() => {}} />);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Start help conversation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Start help conversation" }));
  await screen.findByRole("textbox", { name: "Your help question" });
}
function ask() {
  fireEvent.change(screen.getByRole("textbox", { name: "Your help question" }), {
    target: { value: "Find compatible parts" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send question" }));
}

it("sends nothing to a model until explicit start/send, then renders plain sourced help without browser transcript storage", async () => {
  await start();
  expect(network.mock.calls.some(([url]) => String(url).endsWith("/turns"))).toBe(false);
  ask();
  await screen.findByText("A name match does not confirm compatibility.");
  expect(
    screen.getByRole("link", { name: "Find compatible parts · v2" }).getAttribute("href"),
  ).toBe("/learn?article=parts-fitment");
  expect(
    (screen.getByRole("textbox", { name: "Your help question" }) as HTMLTextAreaElement)
      .value,
  ).toBe("");
  const [url, options] = network.mock.calls.find(([url]) =>
    String(url).endsWith("/turns"),
  )!;
  expect(String(url)).toBe(`/api/v1/public/learning/assistant/conversations/${id}/turns`);
  expect(Object.keys(JSON.parse(String(options?.body))).sort()).toEqual([
    "expectedVersion",
    "operationId",
    "page",
    "question",
  ]);
  expect(options?.headers).toMatchObject({ "X-CSRF-Token": "s".repeat(48) });
  expect(localStorage.length + sessionStorage.length).toBe(0);
});
it("stops generation through shared cancellation and ignores an aborted late response", async () => {
  let finish: ((value: Response) => void) | undefined,
    sentOperation = "";
  const base = network.getMockImplementation()!;
  network.mockImplementation(async (...args) => {
    if (String(args[0]).endsWith("/turns")) {
      sentOperation = JSON.parse(String(args[1]?.body)).operationId;
      return new Promise((resolve) => {
        finish = resolve;
      });
    }
    return base(...args);
  });
  await start();
  ask();
  await screen.findByRole("button", { name: "Stop generation" });
  fireEvent.click(screen.getByRole("button", { name: "Stop generation" }));
  await screen.findByText(/Generation stopped or had already finished/);
  await act(async () =>
    finish!(response({ replayed: false, conversation: answered(sentOperation) })),
  );
  expect(screen.queryByText("A name match does not confirm compatibility.")).toBeNull();
  expect(
    network.mock.calls.filter(([url]) => String(url).endsWith("/turns")),
  ).toHaveLength(1);
  expect(network.mock.calls.some(([url]) => String(url).endsWith("/cancel"))).toBe(true);
});
it("checks an unknown turn outcome instead of resending, then reconciles its completed receipt", async () => {
  let sentOperation = "";
  const base = network.getMockImplementation()!;
  network.mockImplementation(async (...args) => {
    if (String(args[0]).endsWith("/turns")) {
      sentOperation = JSON.parse(String(args[1]?.body)).operationId;
      throw new TypeError("network lost");
    }
    if (String(args[0]).endsWith("/" + id)) return response(answered(sentOperation));
    return base(...args);
  });
  await start();
  ask();
  await screen.findByRole("alert");
  expect(
    (screen.getByRole("button", { name: "Send question" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Check conversation" }));
  await screen.findByText("A name match does not confirm compatibility.");
  expect(
    network.mock.calls.filter(([url]) => String(url).endsWith("/turns")),
  ).toHaveLength(1);
  expect(
    (screen.getByRole("textbox", { name: "Your help question" }) as HTMLTextAreaElement)
      .value,
  ).toBe("");
});
it("requires a review before clear and erases local question/history after confirmation", async () => {
  await start();
  ask();
  await screen.findByText("A name match does not confirm compatibility.");
  fireEvent.click(screen.getByRole("button", { name: "Clear conversation" }));
  expect(network.mock.calls.some(([, options]) => options?.method === "DELETE")).toBe(
    false,
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm clear" }));
  await screen.findByText("Active help history cleared.");
  expect(screen.queryByText("A name match does not confirm compatibility.")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});
it("discards an unavailable protected conversation instead of falling back to a public mutation", async () => {
  const accountData = { ...data, audience: "customer" as const };
  operational.apiRequest
    .mockResolvedValueOnce({ data: { items: [] } })
    .mockResolvedValueOnce({
      data: { replayed: false, conversation: { ...empty(), audience: "customer" } },
    })
    .mockRejectedValue(new AllieClientError(403));
  render(<AllieConversationPanel data={accountData} onNavigate={() => {}} />);
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Start help conversation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Start help conversation" }));
  await screen.findByRole("textbox");
  ask();
  await screen.findByText(/no longer available with your current access/);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(network).not.toHaveBeenCalled();
});
it("rechecks on focus and clears old guidance when the source/access context resets", async () => {
  await start();
  ask();
  await screen.findByText("A name match does not confirm compatibility.");
  const base = network.getMockImplementation()!;
  network.mockImplementation(async (...args) =>
    String(args[0]).endsWith("/" + id)
      ? response({ ...empty(), historyReset: true })
      : base(...args),
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Old private follow-up" },
  });
  act(() => window.dispatchEvent(new Event("focus")));
  await screen.findByText(/Earlier guidance was cleared/);
  expect(screen.queryByText("A name match does not confirm compatibility.")).toBeNull();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
});
it("aborts pending requests when the conversation boundary unmounts", async () => {
  let observed: AbortSignal | undefined;
  network.mockImplementation(async (_url, options) => {
    observed = options?.signal as AbortSignal;
    return new Promise(() => {});
  });
  const view = render(<AllieConversationPanel data={data} onNavigate={() => {}} />);
  await waitFor(() => expect(observed).toBeDefined());
  view.unmount();
  expect(observed!.aborted).toBe(true);
});
it.each([
  "/login",
  "/mfa",
  "/reset-password",
  "/verify-email",
  "/dashboard/security",
  "/admin/security",
  "/staff/security",
])("suppresses typed conversational context on %s", (path) =>
  expect(learningPage(path)).toBe("security"),
);
it.each([
  "https://evil.example/steal",
  "javascript:alert(1)",
  "/admin/security?token=secret",
])("rejects an unregistered source destination %s", (href) => {
  const value = answered();
  value.messages[0]!.answer.sources[0]!.href = href;
  expect(() => validateConversation(value, data)).toThrow();
});
it("rejects hidden/changed sources, forbidden practice and staff-to-public human actions", () => {
  const value = answered();
  expect(() => validateConversation(value, { ...data, articles: [] })).toThrow();
  value.messages[0]!.answer.sources[0]!.version = 1;
  expect(() => validateConversation(value, data)).toThrow();
  const human = answered();
  human.audience = "work";
  human.messages[0]!.answer.actionIds = ["human:care"];
  human.messages[0]!.answer.actions = [
    {
      id: "human:care",
      kind: "human",
      label: "Send staff help",
      href: "/contact",
      sourceId: null,
    },
  ];
  expect(() => validateConversation(human, { ...data, audience: "work" })).toThrow();
});
it("does not create public cookies or retry when an authenticated call fails", async () => {
  operational.apiRequest.mockRejectedValue(new AllieClientError(401));
  const client = createConversationClient({ ...data, audience: "work" });
  await expect(
    client.create(operationId, new AbortController().signal),
  ).rejects.toThrow();
  expect(network).not.toHaveBeenCalled();
  expect(operational.apiRequest).toHaveBeenCalledTimes(1);
});

it.each([
  ["service", "services"],
  ["product", "parts"],
  ["vehicle", "vehicles"],
])(
  "accepts server-owned %s citations and rejects substituted destinations",
  (kind, path) => {
    const value = answered();
    const answer = value.messages[0]!.answer;
    const articleId = `${kind}-${id}`;
    answer.sourceIds = [`${articleId}@v1`];
    answer.actionIds = [`open:${articleId}`];
    answer.sources = [
      {
        id: `${articleId}@v1`,
        articleId,
        version: 1,
        title: "Tyre fitting",
        href: `/${path}/${id}`,
      },
    ];
    answer.actions = [
      {
        id: `open:${articleId}`,
        kind: "navigate",
        label: "View tyre fitting",
        href: `/${path}/${id}`,
        sourceId: `${articleId}@v1`,
      },
    ];
    expect(validateConversation(value, data)).toEqual(value);
    for (const href of [
      "https://example.test",
      "/admin/customers",
      `/services/${operationId}`,
      `/services/${id}?redirect=bad`,
    ]) {
      const tampered = structuredClone(value);
      tampered.messages[0]!.answer.actions[0]!.href = href;
      expect(() => validateConversation(tampered, data)).toThrow(AllieClientError);
      tampered.messages[0]!.answer.sources[0]!.href = href;
      expect(() => validateConversation(tampered, data)).toThrow(AllieClientError);
    }
  },
);
