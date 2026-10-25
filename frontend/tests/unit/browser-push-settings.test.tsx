// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { BrowserPushSettings } from "@/app/components/browser-push-settings";
import { apiRequest } from "@/lib/api/client";
import { createHash, webcrypto } from "node:crypto";
const endpoint = "https://fcm.googleapis.com/fcm/send/fixture";
const fingerprint = createHash("sha256").update(endpoint).digest("hex");
vi.mock("@/lib/api/client", () => ({
  apiRequest: vi.fn(),
  ApiError: class extends Error {},
  SESSION_CHANGED: "fixture-session-changed",
}));
const response = (data: unknown) => ({
  success: true as const,
  message: "Fixture",
  meta: { requestId: "fixture" },
  data,
});
let subscribed: boolean;
let stored: boolean;
let permission: NotificationPermission;
let prompt: ReturnType<typeof vi.fn>;
let register: ReturnType<typeof vi.fn>;
let unsubscribe: ReturnType<typeof vi.fn>;
let failWrite: boolean;
let storedFingerprint: string;
beforeEach(() => {
  subscribed = false;
  stored = false;
  permission = "default";
  failWrite = false;
  storedFingerprint = fingerprint;
  vi.stubGlobal("crypto", webcrypto);
  prompt = vi.fn(async () => {
    permission = "granted";
    return permission;
  });
  unsubscribe = vi.fn(async () => {
    subscribed = false;
    return true;
  });
  const sub = {
    endpoint,
    unsubscribe,
    toJSON: () => ({
      endpoint,
      keys: { auth: "fixture", p256dh: "fixture" },
    }),
  };
  const registration = {
    active: { scriptURL: "https://allied.invalid/push-sw.js" },
    pushManager: {
      getSubscription: async () => (subscribed ? sub : null),
      subscribe: async () => {
        subscribed = true;
        return sub;
      },
    },
    getNotifications: async () => [],
  };
  register = vi.fn(async () => registration);
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("PushManager", function () {});
  vi.stubGlobal("Notification", {
    get permission() {
      return permission;
    },
    requestPermission: prompt,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: async () => registration,
      getRegistrations: async () => [registration],
      ready: Promise.resolve(registration),
      register,
    },
  });
  vi.mocked(apiRequest)
    .mockReset()
    .mockImplementation(async (path, options) => {
      if (path === "/auth/session")
        return response({ user: { id: "fixture-user", role: "CUSTOMER" } });
      if (options?.method === "PUT") {
        if (failWrite) throw Error("registration failed");
        stored = true;
        return response({ enabled: true });
      }
      if (options?.method === "DELETE") {
        stored = false;
        return response({ enabled: false });
      }
      return response({
        available: true,
        publicKey: "B" + "A".repeat(86),
        enabled: stored,
        endpointHashes: stored ? [storedFingerprint] : [],
      });
    });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (navigator as unknown as Record<string, unknown>).serviceWorker;
});
describe("honest current-browser push state", () => {
  it("does not claim enabled for a saved binding to an older native endpoint", async () => {
    stored = true;
    subscribed = true;
    permission = "granted";
    storedFingerprint = "b".repeat(64);
    const digest = vi.spyOn(crypto.subtle, "digest");
    render(<BrowserPushSettings role="CUSTOMER" userId="fixture-user" />);
    await waitFor(() => expect(digest).toHaveBeenCalled());
    await act(async () => {
      await Promise.all(digest.mock.results.map((result) => result.value));
    });
    expect(await screen.findByText(/subscription changed/)).toBeTruthy();
    expect(screen.queryByText("On for this signed-in browser.")).toBeNull();
    expect(screen.getByRole("button", { name: "Enable on this device" })).toBeTruthy();
    expect(prompt).not.toHaveBeenCalled();
  });
  it("never prompts on mount and confirms both subscription and server persistence before claiming enabled", async () => {
    render(<BrowserPushSettings role="CUSTOMER" userId="fixture-user" />);
    const enable = await screen.findByRole("button", { name: "Enable on this device" });
    expect(prompt).not.toHaveBeenCalled();
    fireEvent.click(enable);
    await screen.findByText("Browser notifications are on for this signed-in device.");
    expect(stored && subscribed).toBe(true);
    fireEvent.click(
      await screen.findByRole("button", { name: "Turn off on this device" }),
    );
    expect(await screen.findByText(/site permission is unchanged/)).toBeTruthy();
    expect(permission).toBe("granted");
    expect(stored || subscribed).toBe(false);
  });
  it("does not confuse a saved binding with a missing local subscription", async () => {
    stored = true;
    permission = "granted";
    render(<BrowserPushSettings role="CUSTOMER" userId="fixture-user" />);
    expect(await screen.findByText(/subscription changed/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Turn off on this device" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Turn off saved device binding" }),
    ).toBeTruthy();
  });
  it("does not prompt repeatedly when permission is blocked", async () => {
    permission = "denied";
    render(<BrowserPushSettings role="CUSTOMER" userId="fixture-user" />);
    await screen.findByText(/Blocked in this browser/);
    expect(
      (screen.getByRole("button", { name: "Enable on this device" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
  });
  it("removes a tentative subscription if server registration fails", async () => {
    permission = "granted";
    failWrite = true;
    render(<BrowserPushSettings role="CUSTOMER" userId="fixture-user" />);
    fireEvent.click(await screen.findByRole("button", { name: "Enable on this device" }));
    await waitFor(() => expect(unsubscribe).toHaveBeenCalled());
    expect(await screen.findByText(/couldn’t enable browser notifications/)).toBeTruthy();
    expect(stored || subscribed).toBe(false);
    expect(prompt).not.toHaveBeenCalled();
  });
  it("explains unconfigured background push without requesting permission", async () => {
    vi.mocked(apiRequest).mockResolvedValue(
      response({ available: false, publicKey: null, enabled: false }),
    );
    render(<BrowserPushSettings role="CUSTOMER" userId="fixture-user" />);
    expect(await screen.findByText(/Background push is not configured/)).toBeTruthy();
    expect(prompt).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
  });
});
