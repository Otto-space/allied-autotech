import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  query: vi.fn(),
  inspect: vi.fn(),
  env: {
    NODE_ENV: "test",
    DB_HOST: "127.0.0.1",
    DB_PORT: 15432,
    DB_NAME: "aat_d06_123456789abc_test",
  },
}));
vi.mock("../../src/config/database.js", () => ({ prisma: { $queryRaw: m.query } }));
vi.mock("../../src/config/env.js", () => ({ env: m.env }));
vi.mock("node:child_process", () => ({ execFileSync: m.inspect }));
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
const id = "a".repeat(64);
const proof = () => ({
  id,
  name: "/aat-d06-123456789abc",
  labels: { "allied.task": "d06-resources" },
  tmpfs: { "/var/lib/postgresql": "rw,size=768m" },
  mounts: [{ Type: "tmpfs" }],
  ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "15432" }] },
  networks: { isolated: { IPAddress: "172.30.0.2" } },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RUN_DATABASE_TESTS", "true");
  vi.stubEnv("TEST_DB_NAME", m.env.DB_NAME);
  vi.stubEnv("CONFIRM_EMPTY_MIGRATION_DATABASE", "true");
  vi.stubEnv("TEST_DATABASE_CONTAINER_ID", id);
  m.query.mockResolvedValue([
    { host: "172.30.0.2", port: 5432, database: m.env.DB_NAME },
  ]);
  m.inspect.mockImplementation(() => JSON.stringify(proof()));
});
afterEach(() => vi.unstubAllEnvs());
it("preserves native loopback validation without invoking Docker", async () => {
  m.query.mockResolvedValue([
    { host: "127.0.0.1", port: 15432, database: m.env.DB_NAME },
  ]);
  await expect(assertIsolatedLoopbackDatabase()).resolves.toBeUndefined();
  expect(m.inspect).not.toHaveBeenCalled();
});
it("accepts only an exact owned tmpfs NAT target with the expected loopback binding", async () => {
  // Docker records --tmpfs in HostConfig.Tmpfs; Mounts may legitimately be empty.
  m.inspect.mockReturnValue(JSON.stringify({ ...proof(), mounts: [] }));
  await expect(assertIsolatedLoopbackDatabase()).resolves.toBeUndefined();
  expect(m.inspect.mock.calls[0]?.[0]).toBe("docker");
});
it("rejects wrong identity, public bindings, persistent storage and another server address", async () => {
  const changes = [
    { id: "b".repeat(64) },
    { name: "/another-task" },
    { labels: { "allied.task": "unrelated" } },
    { tmpfs: {} },
    { mounts: [{ Type: "volume" }] },
    { ports: { "5432/tcp": [{ HostIp: "0.0.0.0", HostPort: "15432" }] } },
    { ports: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "15433" }] } },
    { networks: { isolated: { IPAddress: "172.30.0.3" } } },
  ];
  for (const change of changes) {
    m.inspect.mockReturnValue(JSON.stringify({ ...proof(), ...change }));
    await expect(assertIsolatedLoopbackDatabase()).rejects.toThrow();
  }
});
it("does not accept an unavailable Docker proof or a different actual database", async () => {
  m.inspect.mockImplementation(() => {
    throw Error("No Docker access");
  });
  await expect(assertIsolatedLoopbackDatabase()).rejects.toThrow();
  m.inspect.mockReturnValue(JSON.stringify(proof()));
  m.query.mockResolvedValue([
    { host: "172.30.0.2", port: 5432, database: "another_test" },
  ]);
  await expect(assertIsolatedLoopbackDatabase()).rejects.toThrow();
});
it("rejects a missing explicit test confirmation before any target query", async () => {
  vi.stubEnv("CONFIRM_EMPTY_MIGRATION_DATABASE", "false");
  await expect(assertIsolatedLoopbackDatabase()).rejects.toThrow();
  expect(m.query).not.toHaveBeenCalled();
});
