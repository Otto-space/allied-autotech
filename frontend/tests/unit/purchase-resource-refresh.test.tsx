// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, it, expect, vi } from "vitest";
import { usePurchaseResource } from "../../lib/purchase/resource";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../lib/purchase/client", () => ({ purchaseRequest: request }));
const parse = (value: unknown) => String(value);
let root: Root | undefined, container: HTMLDivElement;
function Probe({ path, retain }: { path: string; retain: boolean }) {
  const resource = usePurchaseResource(path, parse, { retainWhileRefreshing: retain });
  return (
    <button disabled={resource.loading} data-failed={resource.failed}>
      {resource.data ?? "empty"}
    </button>
  );
}
async function mount(retain: boolean) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(<Probe path="/purchase/orders/one" retain={retain} />),
  );
}
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  container?.remove();
  request.mockReset();
  vi.unstubAllGlobals();
});
describe("owned guest record refresh", () => {
  it("retains a same-order view while disabled, then clears it on failed access", async () => {
    request.mockResolvedValueOnce({ data: "owned record" });
    await mount(true);
    expect(container.textContent).toBe("owned record");
    let resolve: ((value: unknown) => void) | undefined;
    request.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(container.textContent).toBe("owned record");
    expect(container.querySelector("button")!.disabled).toBe(true);
    await act(async () => resolve!({ data: "refreshed owned record" }));
    expect(container.textContent).toBe("refreshed owned record");
    request.mockRejectedValueOnce(new Error("access lost"));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(container.textContent).toBe("empty");
    expect(container.querySelector("button")!.dataset.failed).toBe("true");
  });
  it("keeps the default clearing behavior and never retains another path", async () => {
    request.mockResolvedValueOnce({ data: "first order" });
    await mount(false);
    request.mockImplementation(() => new Promise(() => {}));
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(container.textContent).toBe("empty");
    await act(async () =>
      root!.render(<Probe path="/purchase/orders/two" retain={true} />),
    );
    expect(container.textContent).toBe("empty");
    expect(container.querySelector("button")!.disabled).toBe(true);
  });
});
