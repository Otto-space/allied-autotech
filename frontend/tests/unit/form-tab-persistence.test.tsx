// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { request, replace } = vi.hoisted(() => ({ request: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/vehicles/new",
  useRouter: () => router,
}));
const router = { replace };
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  apiRequest: request,
}));
vi.mock("@/app/components/dashboard-navigation", () => ({
  DashboardNavigation: () => null,
  DashboardPageSearch: () => null,
}));
vi.mock("@/app/components/feedback", () => ({
  Feedback: ({ message }: { message?: string }) => (message ? <p>{message}</p> : null),
}));
import { DashboardShell } from "@/app/components/dashboard-shell";
import { useResource } from "@/lib/api/use-resource";
import { ApiError, SESSION_CHANGED } from "@/lib/api/client";

const parse = (value: unknown) => String(value);
function Form() {
  const resource = useResource("/customers/form-record", parse);
  const [value, setValue] = useState("");
  if (resource.loading) return <p>Loading form</p>;
  if (resource.error) return <p>{resource.error}</p>;
  return (
    <form>
      <input
        aria-label="Draft"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <input aria-label="Attachment" type="file" />
      <select aria-label="Choice" defaultValue="one">
        <option>one</option>
        <option>two</option>
      </select>
      <input aria-label="Enabled" type="checkbox" />
      <output>{resource.data}</output>
    </form>
  );
}
function session(role = "ADMIN", id = "session-one") {
  return {
    data: {
      id,
      mfaRequired: false,
      user: { id: "user-one", email: "test@example.test", role },
    },
  };
}
function returnToTab() {
  document.dispatchEvent(new Event("visibilitychange"));
}
beforeEach(() => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  request.mockReset();
  replace.mockReset();
});

it.each(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"])(
  "keeps %s form values and files throughout tab and online revalidation",
  async (role) => {
    let background = false;
    let finishSession!: (value: unknown) => void;
    let finishRecord!: (value: unknown) => void;
    request.mockImplementation((path: string) => {
      if (path === "/auth/session")
        return background
          ? new Promise((resolve) => {
              finishSession = resolve;
            })
          : Promise.resolve(session(role));
      if (path === "/customers/form-record")
        return background
          ? new Promise((resolve) => {
              finishRecord = resolve;
            })
          : Promise.resolve({ data: "original" });
      return Promise.resolve({ data: {} });
    });
    render(
      <DashboardShell audience={role === "CUSTOMER" ? "customer" : "staff"}>
        <Form />
      </DashboardShell>,
    );
    const input = await screen.findByLabelText("Draft");
    const file = new File(["sample"], "attachment.txt", { type: "text/plain" });
    const upload = screen.getByLabelText("Attachment") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Unsaved work" } });
    fireEvent.change(upload, { target: { files: [file] } });
    fireEvent.change(screen.getByLabelText("Choice"), { target: { value: "two" } });
    fireEvent.click(screen.getByLabelText("Enabled"));
    background = true;
    for (const event of [returnToTab, () => window.dispatchEvent(new Event("online"))]) {
      await act(async () => {
        event();
      });
      expect(screen.getByLabelText("Draft")).toBe(input);
      expect(input).toHaveValue("Unsaved work");
      expect(screen.getByLabelText("Choice")).toHaveValue("two");
      expect(screen.getByLabelText("Enabled")).toBeChecked();
      expect(upload.files?.[0]).toBe(file);
      await act(async () => {
        finishSession(session(role));
        finishRecord({ data: "updated" });
      });
      expect(screen.getByLabelText("Draft")).toBe(input);
      expect(input).toHaveValue("Unsaved work");
      expect(upload.files?.[0]).toBe(file);
    }
    expect(replace).not.toHaveBeenCalled();
  },
);

it("keeps the draft after a temporary background outage and clears it on actual session change", async () => {
  request.mockImplementation((path: string) =>
    Promise.resolve(path === "/auth/session" ? session() : { data: "original" }),
  );
  render(
    <DashboardShell audience="staff">
      <Form />
    </DashboardShell>,
  );
  const input = await screen.findByLabelText("Draft");
  fireEvent.change(input, { target: { value: "Keep during outage" } });
  request.mockRejectedValue(
    new ApiError(503, { error: { code: "SERVICE_UNAVAILABLE" } }),
  );
  await act(async () => returnToTab());
  expect(screen.getByLabelText("Draft")).toBe(input);
  expect(input).toHaveValue("Keep during outage");
  await act(async () => window.dispatchEvent(new Event(SESSION_CHANGED)));
  expect(screen.queryByLabelText("Draft")).not.toBeInTheDocument();
});

it("discards the old draft when revalidation discovers a different session", async () => {
  request.mockImplementation((path: string) =>
    Promise.resolve(path === "/auth/session" ? session() : { data: "original" }),
  );
  render(
    <DashboardShell audience="staff">
      <Form />
    </DashboardShell>,
  );
  fireEvent.change(await screen.findByLabelText("Draft"), {
    target: { value: "Old session draft" },
  });
  request.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/auth/session" ? session("ADMIN", "session-two") : { data: "new record" },
    ),
  );
  await act(async () => returnToTab());
  await waitFor(() => expect(screen.getByLabelText("Draft")).toHaveValue(""));
});

it("removes the protected form when revalidation requires MFA", async () => {
  request.mockImplementation((path: string) =>
    Promise.resolve(path === "/auth/session" ? session() : { data: "original" }),
  );
  render(
    <DashboardShell audience="staff">
      <Form />
    </DashboardShell>,
  );
  await screen.findByLabelText("Draft");
  request.mockImplementation((path: string) =>
    path === "/auth/session"
      ? Promise.reject(new ApiError(403, { error: { code: "MFA_REQUIRED" } }))
      : Promise.resolve({ data: "original" }),
  );
  await act(async () => returnToTab());
  expect(replace).toHaveBeenCalledWith("/mfa");
  expect(screen.queryByLabelText("Draft")).not.toBeInTheDocument();
});
