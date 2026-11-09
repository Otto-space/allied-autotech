// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FormDrafts } from "@/app/components/form-drafts";
import { setDraftIdentity } from "@/lib/forms/drafts";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { VehicleFeatureFields } from "@/app/components/vehicle-feature-fields";
import { VehicleEngineFields } from "@/app/components/vehicle-engine-fields";
import { VehicleFeatures } from "@/app/components/vehicle-features";
import {
  vehicleDefaults,
  vehicleRecordBody,
  recordSchema,
  type VehicleRecordValues,
} from "@/lib/forms/vehicle-record";
import { stockRecord } from "../fixtures/work-vehicle-stock";
import { vehicleLabel } from "@/lib/vehicle-discovery";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const description = "2.0L I-4 DI, DOHC, VVT, TURBO, PREMIUM, 252HP";
function Harness({
  saved,
  items = ["Audio, navigation"],
  engine = "",
}: {
  saved: (value: unknown) => void;
  items?: string[];
  engine?: string;
}) {
  const form = useForm<VehicleRecordValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      ...vehicleDefaults(stockRecord()),
      features: items.map((value) => ({ value })),
      engineDetails: engine,
    },
  });
  return (
    <form
      data-draft-key="vehicle-feature-recovery-test"
      onSubmit={form.handleSubmit((values) => saved(vehicleRecordBody(values)))}
    >
      <VehicleEngineFields form={form} />
      <VehicleFeatureFields form={form} />
      <button>Review</button>
    </form>
  );
}

it("keeps comma-bearing items and supplied engine text intact through open, review, save and reopen", async () => {
  const saved = vi.fn();
  const view = render(<Harness saved={saved} engine={description} />);
  fireEvent.click(screen.getByText("Review"));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const body = saved.mock.calls[0][0];
  expect(body).toMatchObject({
    features: ["Audio, navigation"],
    engineDetails: description,
  });
  view.unmount();
  render(<Harness saved={vi.fn()} items={body.features} engine={body.engineDetails} />);
  expect((screen.getByLabelText("Feature 1") as HTMLInputElement).value).toBe(
    "Audio, navigation",
  );
  expect(
    (screen.getByLabelText("Engine details (optional)") as HTMLTextAreaElement).value,
  ).toBe(description);
});

it("adds and edits individual items, flags duplicates beside that item, and preserves other input", async () => {
  const saved = vi.fn();
  render(<Harness saved={saved} engine={description} />);
  fireEvent.click(screen.getByText("Add feature"));
  fireEvent.change(screen.getByLabelText("Feature 2"), {
    target: { value: " audio, NAVIGATION " },
  });
  fireEvent.click(screen.getByText("Review"));
  expect(await screen.findByText("This feature is already in the list.")).toBeTruthy();
  expect(saved).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Feature 2"), {
    target: { value: "  Heated seats  " },
  });
  fireEvent.click(screen.getByText("Review"));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(saved.mock.calls[0][0]).toMatchObject({
    features: ["Audio, navigation", "Heated seats"],
    engineDetails: description,
  });
});

it("requires nonempty items, retains the limit and returns focus after removing an item", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
    callback();
    return 0;
  });
  const saved = vi.fn();
  render(
    <Harness
      saved={saved}
      items={Array.from({ length: 40 }, (_, i) => `Feature ${i + 1}`)}
    />,
  );
  expect((screen.getByText("Add feature") as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("Remove feature 40"));
  expect((screen.getByText("Add feature") as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByText("Add feature"));
  fireEvent.click(screen.getByText("Review"));
  expect(await screen.findByText("Enter a feature or remove this item.")).toBeTruthy();
  expect(saved).not.toHaveBeenCalled();
});

it("renders each genuine feature separately and omits an unsupplied list", () => {
  const { rerender } = render(
    <VehicleFeatures features={["Audio, navigation", "x".repeat(80)]} />,
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("Audio, navigation")).toBeTruthy();
  rerender(<VehicleFeatures features={[]} />);
  expect(screen.queryByRole("list")).toBeNull();
});

it("preserves precise capacity and combustion details when power changes to fully electric", async () => {
  const saved = vi.fn();
  render(<Harness saved={saved} engine={description} />);
  fireEvent.change(screen.getByLabelText("Engine capacity (optional, cc)"), {
    target: { value: "1998" },
  });
  fireEvent.change(screen.getByLabelText("Engine / Power type (optional)"), {
    target: { value: "BEV" },
  });
  fireEvent.click(screen.getByText("Review"));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(saved.mock.calls[0][0]).toMatchObject({
    engineCapacityCc: 1998,
    engineDetails: description,
    powertrain: "BEV",
  });
  expect(vehicleLabel("BEV")).toBe("Fully electric (EV)");
});

it("rejects overlong feature and engine values without truncating or splitting supplied data", () => {
  const values = vehicleDefaults(stockRecord());
  expect(
    recordSchema.safeParse({ ...values, features: [{ value: "x".repeat(81) }] }).success,
  ).toBe(false);
  expect(
    recordSchema.safeParse({ ...values, engineDetails: "x".repeat(501) }).success,
  ).toBe(false);
  expect(
    recordSchema.safeParse({
      ...values,
      features: Array.from({ length: 41 }, (_, i) => ({ value: String(i) })),
    }).success,
  ).toBe(false);
});

it("restores added and removed feature rows through the existing account-scoped draft system", async () => {
  setDraftIdentity("synthetic:ADMIN");
  const mount = () =>
    render(
      <>
        <FormDrafts />
        <Harness saved={vi.fn()} />
      </>,
    );
  const first = mount();
  fireEvent.change(screen.getByLabelText("Feature 1"), {
    target: { value: "Audio, navigation updated" },
  });
  fireEvent.click(screen.getByText("Add feature"));
  fireEvent.change(screen.getByLabelText("Feature 2"), {
    target: { value: "Rear camera" },
  });
  await waitFor(() =>
    expect(Object.values(sessionStorage).join(" ")).toContain("@rows:features"),
  );
  first.unmount();
  const second = mount();
  await waitFor(() =>
    expect((screen.getByLabelText("Feature 2") as HTMLInputElement).value).toBe(
      "Rear camera",
    ),
  );
  expect((screen.getByLabelText("Feature 1") as HTMLInputElement).value).toBe(
    "Audio, navigation updated",
  );
  fireEvent.click(screen.getByLabelText("Remove feature 1"));
  await waitFor(() =>
    expect(Object.values(sessionStorage).join(" ")).not.toContain(
      "Audio, navigation updated",
    ),
  );
  second.unmount();
  mount();
  await waitFor(() =>
    expect((screen.getByLabelText("Feature 1") as HTMLInputElement).value).toBe(
      "Rear camera",
    ),
  );
  expect(screen.queryByLabelText("Feature 2")).toBeNull();
});
