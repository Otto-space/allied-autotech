import { addPrismaTlsParameters, type DatabaseTlsConfiguration } from "./database-tls.js";

export interface DatabaseConnectionValues {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export function createPrismaDatabaseUrl(
  connection: DatabaseConnectionValues,
  tls: DatabaseTlsConfiguration,
): string {
  const databaseHost = connection.host.includes(":")
    ? `[${connection.host}]`
    : connection.host;
  const url = new URL(
    `postgresql://${encodeURIComponent(connection.user)}:` +
      `${encodeURIComponent(connection.password)}@${databaseHost}:` +
      `${String(connection.port)}/${encodeURIComponent(connection.database)}`,
  );
  addPrismaTlsParameters(url, tls);
  return url.toString();
}
