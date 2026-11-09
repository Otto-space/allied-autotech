import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import pino from "pino";
import { sensitiveLogPaths } from "../../src/common/security/redaction.js";
import {
  createPickupSecret,
  pickupTokenHash,
  assertPickupEntitlement,
  planPickupHandover,
  remainingPickupQuantities,
  type PickupEntitlement,
} from "../../src/modules/orders/order-pickup.engine.js";

const now = new Date("2026-11-09T10:00:00Z"),
  expiry = new Date("2026-11-10T10:00:00Z");
const id = () => randomUUID();
function entitlement() {
  const orderId = id(),
    issued = createPickupSecret(orderId, now, expiry);
  const stored: PickupEntitlement = {
    orderId,
    tokenHash: issued.tokenHash,
    issuedAt: issued.issuedAt,
    expiresAt: issued.expiresAt,
    consumedAt: null,
    revokedAt: null,
  };
  return { orderId, issued, stored };
}
describe("order-specific private pickup authorisation primitives", () => {
  it("generates independent 256-bit base64url secrets and stores only a purpose/order-bound hash", () => {
    const f = entitlement(),
      second = createPickupSecret(f.orderId, now, expiry);
    expect(f.issued.pickupCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(f.issued.pickupCode, "base64url")).toHaveLength(32);
    expect(second.pickupCode).not.toBe(f.issued.pickupCode);
    expect(f.stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(f.stored)).not.toContain(f.issued.pickupCode);
    expect(pickupTokenHash(id(), f.issued.pickupCode)).not.toBe(f.stored.tokenHash);
    expect(() =>
      assertPickupEntitlement(f.stored, f.orderId, f.issued.pickupCode, now),
    ).not.toThrow();
  });
  it.each([
    "expired",
    "revoked",
    "consumed",
    "future",
    "wrong-order",
    "wrong-code",
    "bad-hash",
    "missing",
  ] as const)("refuses %s with the same safe public error", (variant) => {
    const f = entitlement();
    let stored: PickupEntitlement | null = { ...f.stored },
      orderId = f.orderId,
      code = f.issued.pickupCode;
    if (variant === "expired") stored.expiresAt = now;
    if (variant === "revoked") stored.revokedAt = now;
    if (variant === "consumed") stored.consumedAt = now;
    if (variant === "future") stored.issuedAt = new Date(now.getTime() + 1);
    if (variant === "wrong-order") orderId = id();
    if (variant === "wrong-code")
      code = createPickupSecret(orderId, now, expiry).pickupCode;
    if (variant === "bad-hash") stored.tokenHash = "not-a-hash";
    if (variant === "missing") stored = null;
    expect(() => assertPickupEntitlement(stored, orderId, code, now)).toThrow(
      "Pickup authorisation is invalid or unavailable",
    );
    try {
      assertPickupEntitlement(stored, orderId, code, now);
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(code);
    }
  });
  it.each(["ORD-123", "", "x".repeat(42), "x".repeat(44), "<private-secret>"])(
    "does not accept a public reference or malformed code %s",
    (code) => {
      const f = entitlement();
      expect(() => assertPickupEntitlement(f.stored, f.orderId, code, now)).toThrow(
        "invalid or unavailable",
      );
    },
  );
  it.each([now, new Date("invalid"), new Date(now.getTime() + 8 * 86400000)])(
    "requires an explicit bounded future expiry %s",
    (expiresAt) => {
      expect(() => createPickupSecret(id(), now, expiresAt)).toThrow(
        "explicit future expiry",
      );
    },
  );
  it("redacts pickup secrets through the actual structured logger paths", () => {
    const f = entitlement(),
      messages: string[] = [];
    const logger = pino(
      { redact: { paths: [...sensitiveLogPaths], censor: "[REDACTED]" } },
      {
        write: (message: string) => {
          messages.push(message);
        },
      },
    );
    logger.info({
      pickupCode: f.issued.pickupCode,
      data: { pickupCode: f.issued.pickupCode },
      req: { body: { pickupCode: f.issued.pickupCode } },
      request: { body: { pickupCode: f.issued.pickupCode } },
      response: { body: { data: { pickupCode: f.issued.pickupCode } } },
    });
    expect(messages.join("")).not.toContain(f.issued.pickupCode);
    expect(messages.join("")).toContain("[REDACTED]");
  });
});

describe("partial pickup quantity boundaries", () => {
  const a = id(),
    b = id(),
    original = [
      { orderItemId: a, quantity: 5 },
      { orderItemId: b, quantity: 1 },
    ];
  it("counts actual grouped handovers rather than payment or inventory allocation", () => {
    expect(remainingPickupQuantities(original, [])).toEqual(original);
    expect(
      remainingPickupQuantities(original, [{ orderItemId: a, quantity: 2 }]),
    ).toEqual([
      { orderItemId: a, quantity: 3 },
      { orderItemId: b, quantity: 1 },
    ]);
  });
  it("supports a partial handover, leaving a separate remainder for a new code", () => {
    const first = planPickupHandover(original, [], original, [
      { orderItemId: a, quantity: 2 },
    ]);
    expect(first.complete).toBe(false);
    expect(first.remainingAfter).toEqual([
      { orderItemId: a, quantity: 3 },
      { orderItemId: b, quantity: 1 },
    ]);
    const last = planPickupHandover(
      original,
      first.lines,
      first.remainingAfter,
      first.remainingAfter,
    );
    expect(last.complete).toBe(true);
    expect(last.remainingAfter).toEqual([]);
  });
  it("does not permit a second handover of already collected quantities", () => {
    expect(() => planPickupHandover(original, original, original, original)).toThrow(
      "remaining quantity",
    );
  });
  it.each([
    [{ orderItemId: a, quantity: 6 }],
    [{ orderItemId: id(), quantity: 1 }],
    [
      { orderItemId: a, quantity: 1 },
      { orderItemId: a, quantity: 1 },
    ],
    [{ orderItemId: a, quantity: 1.5 }],
  ])("fails closed for malformed or excessive collected totals %j", (collected) => {
    expect(() => remainingPickupQuantities(original, collected)).toThrow(
      "history needs authorised review",
    );
  });
  it.each([
    [],
    [{ orderItemId: a, quantity: 0 }],
    [{ orderItemId: a, quantity: 6 }],
    [
      { orderItemId: a, quantity: 1 },
      { orderItemId: a, quantity: 1 },
    ],
    [{ orderItemId: id(), quantity: 1 }],
  ])(
    "rejects missing, duplicated, unknown or excessive requested handovers %j",
    (requested) => {
      expect(() => planPickupHandover(original, [], original, requested)).toThrow();
    },
  );
  it("does not expand a code's selected item or quantity entitlement", () => {
    expect(() =>
      planPickupHandover(
        original,
        [],
        [{ orderItemId: a, quantity: 6 }],
        [{ orderItemId: a, quantity: 1 }],
      ),
    ).toThrow("does not match this order");
    expect(() =>
      planPickupHandover(
        original,
        [],
        [{ orderItemId: a, quantity: 1 }],
        [{ orderItemId: b, quantity: 1 }],
      ),
    ).toThrow("authorised or remaining quantity");
    expect(() =>
      planPickupHandover(
        original,
        [],
        [{ orderItemId: a, quantity: 1 }],
        [{ orderItemId: a, quantity: 2 }],
      ),
    ).toThrow("authorised or remaining quantity");
  });
});
