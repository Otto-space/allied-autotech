/** Opt-in local tooling only. No credentials or database writes in this module. */
type Environment = Record<string, string | undefined>;
export interface LocalTarget {
  DB_HOST: string;
  DB_PORT: number;
  DB_NAME: string;
  DB_USER: string;
}
export interface MetadataClient {
  query(sql: string): Promise<{ rows: Record<string, unknown>[] }>;
}

export function localOwnerMode(environment: Environment): boolean {
  const mode = environment["LOCAL_DB_OWNER_MODE"];
  if (mode !== undefined && mode !== "true" && mode !== "false")
    throw new Error("LOCAL_DB_OWNER_MODE must be true or false.");
  if (mode !== "true") {
    if (environment["DB_USER"] === "aat_dev_migrator")
      throw new Error("The local migrator requires LOCAL_DB_OWNER_MODE=true.");
    return false;
  }
  const database = environment["DB_NAME"] ?? "";
  const isolated = /^aat_dev_(rehearsal|guarded|restore)_[a-f0-9]{8,32}_(test|ci)$/.test(database);
  if (
    environment["DB_HOST"] !== "127.0.0.1" ||
    environment["DB_PORT"] !== "5432" ||
    environment["DB_USER"] !== "aat_dev_migrator" ||
    !["development", "test"].includes(environment["NODE_ENV"] ?? "") ||
    !(database === "allied_autotech_dev" || isolated) ||
    (environment["NODE_ENV"] === "test" && !isolated)
  ) throw new Error("Local owner mode requires the approved loopback target and migrator.");
  if (["PGOPTIONS", "PGSERVICE", "PGSERVICEFILE"].some((name) => environment[name]))
    throw new Error("Remove PostgreSQL session/service overrides for local owner tooling.");
  return true;
}

export function localBackupCredentials(environment: Environment) {
  if (!localOwnerMode(environment)) return undefined;
  const user = environment["DB_BACKUP_USER"] ?? "";
  const password = environment["DB_BACKUP_PASSWORD"] ?? "";
  if (
    !/^[a-z_][a-z0-9_]{0,62}$/.test(user) || !password ||
    ["postgres", "aat_dev_owner", "aat_dev_migrator", "aat_dev_app"].includes(user)
  ) throw new Error("Separate restricted local backup credentials are required.");
  return { user, password };
}

export async function verifyLocalIdentity(
  client: MetadataClient,
  target: LocalTarget,
  environment: Environment,
  backupUser?: string,
): Promise<void> {
  if (!localOwnerMode(environment)) return;
  // Validate the actual connection settings too, not just process environment.
  if (target.DB_HOST !== environment["DB_HOST"] ||
      String(target.DB_PORT) !== environment["DB_PORT"] ||
      target.DB_NAME !== environment["DB_NAME"] ||
      target.DB_USER !== environment["DB_USER"])
    throw new Error("Local connection settings differ from the verified environment.");
  const result = await client.query(`
    SELECT current_database() AS database, session_user AS login,
      current_user AS effective, inet_server_addr()::text AS address,
      inet_server_port() AS port,
      pg_get_userbyid(d.datdba) AS owner,
      r.rolcanlogin AS login_enabled,
      (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR
       r.rolreplication OR r.rolbypassrls) AS privileged,
      EXISTS (SELECT 1 FROM pg_db_role_setting s
        WHERE s.setdatabase=d.oid AND s.setrole=r.oid
          AND 'role=aat_dev_owner'=ANY(s.setconfig)) AS owner_default,
      EXISTS (SELECT 1 FROM pg_auth_members m
        JOIN pg_roles o ON o.oid=m.roleid
        WHERE m.member=r.oid AND o.rolname='aat_dev_owner'
          AND m.set_option AND NOT m.inherit_option AND NOT m.admin_option) AS owner_switch,
      (SELECT count(*)::int FROM pg_auth_members m WHERE m.member=r.oid) AS memberships,
      EXISTS (SELECT 1 FROM pg_roles o WHERE o.rolname='aat_dev_owner'
        AND NOT (o.rolcanlogin OR o.rolsuper OR o.rolcreatedb OR o.rolcreaterole
                 OR o.rolreplication OR o.rolbypassrls)) AS restricted_owner
    FROM pg_database d JOIN pg_roles r ON r.rolname=session_user
    WHERE d.datname=current_database()
  `);
  const row = result.rows[0];
  const expectedLogin = backupUser ?? "aat_dev_migrator";
  const expectedEffective = backupUser ?? "aat_dev_owner";
  if (!row || row["database"] !== target.DB_NAME || row["address"] !== "127.0.0.1" ||
      row["port"] !== 5432 || row["owner"] !== "aat_dev_owner" ||
      row["login"] !== expectedLogin || row["effective"] !== expectedEffective ||
      row["login_enabled"] !== true || row["privileged"] !== false ||
      row["restricted_owner"] !== true ||
      (backupUser ? row["memberships"] !== 0 :
        (row["owner_default"] !== true || row["owner_switch"] !== true || row["memberships"] !== 1)))
    throw new Error("Local database identity/ownership guard failed; no repair was attempted.");
}

export async function verifyLocalBackupCompleteness(client: MetadataClient): Promise<void> {
  const result = await client.query(`
    SELECT NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname NOT IN ('pg_catalog','information_schema')
        AND n.nspname !~ '^pg_(toast|temp)'
        AND c.relkind IN ('r','p','S','m','f')
        AND (c.relrowsecurity OR c.relforcerowsecurity OR c.relkind='f'
          OR NOT CASE WHEN c.relkind='S' THEN has_sequence_privilege(c.oid,'SELECT')
                      ELSE has_table_privilege(c.oid,'SELECT') END)
    ) AND NOT EXISTS (SELECT 1 FROM pg_largeobject_metadata)
    AND NOT has_database_privilege(current_database(),'CREATE')
    AND NOT has_database_privilege(current_database(),'TEMPORARY')
    AND NOT has_schema_privilege('public','CREATE')
    AND has_schema_privilege('public','USAGE')
    AND NOT EXISTS (SELECT 1 FROM pg_database WHERE datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user))
    AND NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner=(SELECT oid FROM pg_roles WHERE rolname=current_user))
    AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS complete
  `);
  if (result.rows[0]?.["complete"] !== true)
    throw new Error("Backup completeness needs review: RLS, foreign tables, large objects or missing SELECT.");
}

/** Catalog ownership is independent evidence of the identity used by Prisma DDL.
 * It supplements session probes; it does not claim to observe every CLI session. */
export async function verifyLocalMigratedOwnership(client: MetadataClient): Promise<void> {
  const result = await client.query(`
    SELECT to_regclass('public._prisma_migrations') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
        AND pg_get_userbyid(c.relowner)<>'aat_dev_owner'
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass
          AND d.objid=c.oid AND d.deptype='e')
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND
        (p.prosecdef OR pg_get_userbyid(p.proowner)<>'aat_dev_owner')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass
          AND d.objid=p.oid AND d.deptype='e')
    ) AS owned
  `);
  if (result.rows[0]?.["owned"] !== true)
    throw new Error("Prisma object ownership or SECURITY DEFINER review failed.");
  const ledger = await client.query(`
    SELECT NOT has_table_privilege('aat_dev_app','public._prisma_migrations',
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') AS protected
  `);
  if (ledger.rows[0]?.["protected"] !== true)
    throw new Error("Runtime has effective privileges on the migration ledger.");
}

export async function verifyLocalEmptySchema(client: MetadataClient): Promise<void> {
  const result = await client.query(`
    SELECT NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public')
    AND NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      WHERE n.nspname='public')
    AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public')
    AND NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname <> 'plpgsql')
    AND NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('public','information_schema')
      AND nspname !~ '^pg_') AS empty
  `);
  if (result.rows[0]?.["empty"] !== true)
    throw new Error("Local initial replay requires a genuinely empty schema; inspect existing objects.");
}
