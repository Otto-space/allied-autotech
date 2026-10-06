// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { FormDrafts } from "@/app/components/form-drafts";
import {
  beginDraftSubmission,
  captureDraftSubmission,
  clearAccountDrafts,
  completeDraftSubmission,
  draftKey,
  readDraft,
  setDraftIdentity,
  writeDraft,
} from "@/lib/forms/drafts";

function Example({
  record = "new",
  onSave = vi.fn(),
}: {
  record?: string;
  onSave?: (data: unknown) => void;
}) {
  const form = useForm({
    defaultValues: { name: "", password: "", code: "", amount: "", accepted: false },
  });
  const [choice, setChoice] = useState("one");
  return (
    <>
      <FormDrafts />
      <form data-draft-key={record} onSubmit={form.handleSubmit(onSave)}>
        <input aria-label="Name" {...form.register("name")} />
        <input aria-label="Amount" type="number" {...form.register("amount")} />
        <input aria-label="Password" type="password" {...form.register("password")} />
        <input aria-label="Security code" {...form.register("code")} />
        <input aria-label="Accepted" type="checkbox" {...form.register("accepted")} />
        <select
          aria-label="Choice"
          name="choice"
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
        >
          <option>one</option>
          <option>two</option>
        </select>
        <textarea aria-label="Notes" name="notes" />
        <input aria-label="File" type="file" />
        <button>Save</button>
        <button type="reset">Reset</button>
        <output>{choice}</output>
      </form>
    </>
  );
}
beforeEach(() => {
  sessionStorage.clear();
  clearAccountDrafts();
  history.replaceState(null, "", "/admin/example");
  setDraftIdentity("admin-one");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  clearAccountDrafts();
});

it("restores entered controls into React and React Hook Form state after remount, excluding credentials and files", async () => {
  const save = vi.fn();
  const { unmount } = render(<Example />);
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Work in progress" },
  });
  fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "420" } });
  fireEvent.change(screen.getByLabelText("Notes"), {
    target: { value: "Unfinished notes" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "not-persisted" },
  });
  fireEvent.change(screen.getByLabelText("Security code"), {
    target: { value: "123456" },
  });
  fireEvent.change(screen.getByLabelText("Choice"), { target: { value: "two" } });
  fireEvent.click(screen.getByLabelText("Accepted"));
  fireEvent.change(screen.getByLabelText("File"), {
    target: { files: [new File(["test"], "test.txt")] },
  });
  unmount();
  render(<Example onSave={save} />);
  await waitFor(() =>
    expect(screen.getByLabelText("Name")).toHaveValue("Work in progress"),
  );
  expect(screen.getByLabelText("Notes")).toHaveValue("Unfinished notes");
  expect(screen.getByLabelText("Amount")).toHaveValue(420);
  expect(screen.getByLabelText("Choice")).toHaveValue("two");
  expect(screen.getByLabelText("Accepted")).toBeChecked();
  expect(screen.getByLabelText("Password")).toHaveValue("");
  expect(screen.getByLabelText("Security code")).toHaveValue("");
  expect(screen.getByLabelText("File")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Save", exact: true }));
  await waitFor(() => expect(save).toHaveBeenCalled());
  expect(save.mock.calls[0][0]).toMatchObject({
    name: "Work in progress",
    amount: "420",
    accepted: true,
    password: "",
    code: "",
  });
  expect(JSON.stringify(sessionStorage)).not.toContain("not-persisted");
  expect(JSON.stringify(sessionStorage)).not.toContain("123456");
});

it("waits for account verification and isolates different users, paths and records", async () => {
  const key = draftKey("admin-one", "/admin/example", "one");
  writeDraft(key, { "name:0": "Private draft" });
  setDraftIdentity(null);
  const { rerender } = render(<Example record="one" />);
  expect(screen.getByLabelText("Name")).toHaveValue("");
  await act(async () => setDraftIdentity("admin-two"));
  expect(screen.getByLabelText("Name")).toHaveValue("");
  await act(async () => setDraftIdentity("admin-one"));
  expect(screen.getByLabelText("Name")).toHaveValue("Private draft");
  rerender(<Example key="two" record="two" />);
  expect(screen.getByLabelText("Name")).toHaveValue("");
  history.replaceState(null, "", "/admin/another-record");
  rerender(<Example key="other-route" record="one" />);
  expect(screen.getByLabelText("Name")).toHaveValue("");
});

it("clears only the submitted snapshot after success, keeping newer changes and other drafts", () => {
  const key = draftKey("admin-one", "/admin/example", "one");
  const other = draftKey("admin-one", "/admin/example", "two");
  writeDraft(key, { name: "submitted" });
  writeDraft(other, { name: "another form" });
  beginDraftSubmission(key);
  const request = captureDraftSubmission("/staff/vehicles", "POST");
  expect(captureDraftSubmission("/auth/csrf", "POST")).toBeNull();
  expect(captureDraftSubmission("/staff/vehicles/uploads", "POST")).toBeNull();
  expect(captureDraftSubmission("/staff/vehicles", "GET")).toBeNull();
  writeDraft(key, { name: "newer edits" });
  completeDraftSubmission(request);
  expect(readDraft(key)).toEqual({ name: "newer edits" });
  beginDraftSubmission(key);
  completeDraftSubmission(captureDraftSubmission("/staff/vehicles", "POST"));
  expect(readDraft(key)).toEqual({});
  expect(readDraft(other)).toEqual({ name: "another form" });
});

it("clears drafts on reset and sign-out", async () => {
  render(<Example />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Draft" } });
  expect(sessionStorage.length).toBe(1);
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  expect(sessionStorage.length).toBe(0);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Another draft" } });
  await act(async () => clearAccountDrafts());
  expect(sessionStorage.length).toBe(0);
});

it("handles unavailable storage and malformed drafts without breaking form entry", () => {
  sessionStorage.setItem(draftKey("admin-one", "/admin/example", "new"), "{broken");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Full", "QuotaExceededError");
  });
  render(<Example />);
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Still editable" },
  });
  expect(screen.getByLabelText("Name")).toHaveValue("Still editable");
});

function Rows() {
  const form = useForm({ defaultValues: { items: [{ description: "" }] } });
  const rows = useFieldArray({ control: form.control, name: "items" });
  return (
    <>
      <FormDrafts />
      <form data-draft-key="rows">
        {rows.fields.map((field, index) => (
          <div key={field.id} data-draft-row="items">
            <input
              aria-label={`Line ${index + 1}`}
              {...form.register(`items.${index}.description`)}
            />
            <button
              type="button"
              data-draft-remove="items"
              onClick={() => rows.remove(index)}
            >
              Remove {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          data-draft-add="items"
          onClick={() => rows.append({ description: "" })}
        >
          Add item
        </button>
      </form>
    </>
  );
}
it("recovers repeatable line items and preserves their order after adding and removing rows", async () => {
  const initial = render(<Rows />);
  fireEvent.change(screen.getByLabelText("Line 1"), { target: { value: "First" } });
  fireEvent.click(screen.getByRole("button", { name: "Add item" }));
  await act(async () => {});
  fireEvent.change(screen.getByLabelText("Line 2"), { target: { value: "Second" } });
  initial.unmount();
  const restored = render(<Rows />);
  await waitFor(() => expect(screen.getByLabelText("Line 2")).toHaveValue("Second"));
  expect(screen.getByLabelText("Line 1")).toHaveValue("First");
  fireEvent.click(screen.getByRole("button", { name: "Remove 1" }));
  await act(async () => {});
  restored.unmount();
  render(<Rows />);
  await waitFor(() => expect(screen.getByLabelText("Line 1")).toHaveValue("Second"));
  expect(screen.queryByLabelText("Line 2")).not.toBeInTheDocument();
});

it("waits for asynchronous select options before restoring their controlled value", async () => {
  const key = draftKey("admin-one", "/admin/example", "async");
  writeDraft(key, { "branch:0": "branch-two" });
  function Choice({ loaded }: { loaded: boolean }) {
    const [value, setValue] = useState("");
    return (
      <>
        <FormDrafts />
        <form data-draft-key="async">
          <select
            aria-label="Branch"
            name="branch"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          >
            <option value="">Choose</option>
            {loaded && <option value="branch-two">Second branch</option>}
          </select>
          <output>{value}</output>
        </form>
      </>
    );
  }
  const { rerender } = render(<Choice loaded={false} />);
  expect(screen.getByLabelText("Branch")).toHaveValue("");
  rerender(<Choice loaded />);
  await waitFor(() => expect(screen.getByLabelText("Branch")).toHaveValue("branch-two"));
});

it("restores the latest radio choice when the user changes their selection twice", async () => {
  function Radios() {
    const [choice, setChoice] = useState("first");
    return (
      <>
        <FormDrafts />
        <form data-draft-key="radios">
          {["first", "second"].map((value) => (
            <label key={value}>
              {value}
              <input
                type="radio"
                name="choice"
                value={value}
                checked={choice === value}
                onChange={() => setChoice(value)}
              />
            </label>
          ))}
          <output>{choice}</output>
        </form>
      </>
    );
  }
  const { unmount } = render(<Radios />);
  fireEvent.click(screen.getByLabelText("second"));
  fireEvent.click(screen.getByLabelText("first"));
  unmount();
  render(<Radios />);
  await waitFor(() => expect(screen.getByLabelText("first")).toBeChecked());
  expect(screen.getByLabelText("second")).not.toBeChecked();
  expect(screen.getByRole("status")).toHaveTextContent("first");
});
