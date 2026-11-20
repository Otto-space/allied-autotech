import { execFileSync } from "node:child_process";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";

/** Verify the actual dedicated local target before creating synthetic fixtures. */
export async function assertIsolatedLoopbackDatabase() {
  if (
    env.NODE_ENV !== "test" ||
    process.env["RUN_DATABASE_TESTS"] !== "true" ||
    !["127.0.0.1", "localhost"].includes(env.DB_HOST) ||
    !/_(?:test|ci)$/.test(env.DB_NAME) ||
    process.env["TEST_DB_NAME"] !== env.DB_NAME ||
    process.env["CONFIRM_EMPTY_MIGRATION_DATABASE"] !== "true"
  )
    throw new Error(
      "Configure an explicitly confirmed isolated local _test/_ci target first.",
    );
  const [target] = await prisma.$queryRaw<
    { host: string; port: number; database: string }[]
  >`SELECT host(inet_server_addr()) AS host, inet_server_port() AS port, current_database() AS database`;
  if (
    !target ||
    !(await matchesIsolatedEndpoint(target)) ||
    target.database !== env.DB_NAME
  )
    throw new Error(
      "Actual database target differs from the isolated test configuration.",
    );
}

/** Docker NAT exposes a loopback host port but PostgreSQL reports its container
 * address. Accept only the exact task-owned tmpfs container proven by Docker,
 * never an arbitrary claimed hostname or a shared/persistent volume. */
async function matchesIsolatedEndpoint(target: { host: string; port: number }) {
  if (["127.0.0.1", "::1"].includes(target.host) && target.port === env.DB_PORT)
    return true;
  const id = process.env["TEST_DATABASE_CONTAINER_ID"];
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return false;
  const match = /^aat_(d03|d04|d06|d10)_([a-f0-9]{12})_test$/.exec(env.DB_NAME);
  if (!match) return false;
  const [, task, suffix] = match;
  const label =
    task === "d03"
      ? "d03-service-payments"
      : task === "d04"
        ? "d04-prepayment"
        : task === "d06"
          ? "d06-resources"
          : "d10-reschedule";
  const format =
    '{"id":{{json .Id}},"name":{{json .Name}},"labels":{{json .Config.Labels}},"ports":{{json .NetworkSettings.Ports}},"networks":{{json .NetworkSettings.Networks}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}';
  try {
    const proof = JSON.parse(
      execFileSync("docker", ["inspect", id, "--format", format], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 20000,
      }),
    );
    return (
      proof.id === id &&
      proof.name === `/aat-${task}-${suffix}` &&
      proof.labels?.["allied.task"] === label &&
      typeof proof.tmpfs?.["/var/lib/postgresql"] === "string" &&
      proof.mounts.every((mount: { Type: string }) => mount.Type === "tmpfs") &&
      proof.ports?.["5432/tcp"]?.some(
        (port: { HostIp: string; HostPort: string }) =>
          port.HostIp === "127.0.0.1" && Number(port.HostPort) === env.DB_PORT,
      ) &&
      target.port === 5432 &&
      Object.values(proof.networks).some(
        (network) => (network as { IPAddress?: string }).IPAddress === target.host,
      )
    );
  } catch {
    return false;
  }
}
