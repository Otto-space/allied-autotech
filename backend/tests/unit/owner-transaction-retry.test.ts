import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { withTransactionRetry } from "../../src/common/database/transaction-retry.js";
describe("financial transaction retry boundary", () => {
  it("retries only database-aborted conflicts and returns the committed result", async () => {
    const transaction = vi
      .fn()
      .mockRejectedValueOnce({ code: "P2034" })
      .mockRejectedValueOnce({
        meta: { driverAdapterError: { cause: { originalCode: "40P01" } } },
      })
      .mockResolvedValue("committed");
    expect(
      await withTransactionRetry(
        { $transaction: transaction } as unknown as PrismaClient,
        async () => "unused",
      ),
    ).toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(3);
  });
  it("never retries an unknown outcome or exceeds the conflict budget", async () => {
    const unknown = vi
      .fn()
      .mockRejectedValue(new Error("Connection closed with unknown outcome"));
    await expect(
      withTransactionRetry(
        { $transaction: unknown } as unknown as PrismaClient,
        async () => undefined,
      ),
    ).rejects.toThrow("unknown outcome");
    expect(unknown).toHaveBeenCalledTimes(1);
    const conflict = vi.fn().mockRejectedValue({ code: "P2034" });
    await expect(
      withTransactionRetry(
        { $transaction: conflict } as unknown as PrismaClient,
        async () => undefined,
      ),
    ).rejects.toMatchObject({ code: "P2034" });
    expect(conflict).toHaveBeenCalledTimes(3);
  });
});
