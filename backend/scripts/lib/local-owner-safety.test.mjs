// Node's built-in runner/TypeScript stripping: no installation or database needed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  localOwnerMode, localBackupCredentials, verifyLocalIdentity,
  verifyLocalBackupCompleteness,
  verifyLocalEmptySchema,
  verifyLocalMigratedOwnership,
} from './local-owner-safety.ts';

const environment = {
  NODE_ENV: 'test', LOCAL_DB_OWNER_MODE: 'true', DB_HOST: '127.0.0.1',
  DB_PORT: '5432', DB_NAME: 'aat_dev_rehearsal_a1234567_test', DB_USER: 'aat_dev_migrator',
};
const target = { ...environment, DB_PORT: 5432 };
const identity = {
  database: environment.DB_NAME, login: 'aat_dev_migrator', effective: 'aat_dev_owner',
  address: '127.0.0.1', port: 5432, owner: 'aat_dev_owner', login_enabled: true,
  privileged: false, owner_default: true, owner_switch: true, memberships: 1,
  restricted_owner: true,
};
const client = (row) => ({ query: async () => ({ rows: row ? [row] : [] }) });

test('ordinary hosted configuration remains outside local mode', () => {
  assert.equal(localOwnerMode({ NODE_ENV: 'production', DB_USER: 'hosted_migrator' }), false);
});
test('local migrator cannot silently omit owner mode', () => {
  assert.throws(() => localOwnerMode({ DB_USER: 'aat_dev_migrator' }));
});
test('accepts only explicit local targets and test suffixes', () => {
  assert.equal(localOwnerMode(environment), true);
  for (const override of [
    { DB_HOST: 'localhost' }, { DB_HOST: 'example.invalid' }, { DB_PORT: '5433' },
    { DB_NAME: 'allied_autotech_production' }, { DB_NAME: 'allied_autotech_dev' },
    { DB_NAME: 'arbitrary_test' }, { NODE_ENV: 'production' }, { DB_USER: 'aat_dev_app' },
    { LOCAL_DB_OWNER_MODE: 'yes' }, { PGOPTIONS: '-c role=postgres' },
    { PGSERVICE: 'unreviewed' }, { PGSERVICEFILE: 'unreviewed' },
  ]) assert.throws(() => localOwnerMode({ ...environment, ...override }));
});
test('development target permits read-only identity verification', () => {
  assert.equal(localOwnerMode({ ...environment, NODE_ENV: 'development', DB_NAME: 'allied_autotech_dev' }), true);
});
test('backup credentials must be separate and errors never include passwords', () => {
  for (const user of ['', 'postgres', 'aat_dev_owner', 'aat_dev_migrator', 'aat_dev_app', 'bad-name']) {
    assert.throws(() => localBackupCredentials({ ...environment, DB_BACKUP_USER: user, DB_BACKUP_PASSWORD: 'synthetic-secret' }),
      (error) => !error.message.includes('synthetic-secret'));
  }
  assert.deepEqual(localBackupCredentials({ ...environment, DB_BACKUP_USER: 'aat_dev_backup', DB_BACKUP_PASSWORD: 'synthetic-secret' }),
    { user: 'aat_dev_backup', password: 'synthetic-secret' });
});
test('accepts verified migrator login and distinct effective owner', async () => {
  await verifyLocalIdentity(client(identity), target, environment);
});
test('fails closed on every identity, target and membership mismatch', async () => {
  for (const override of [
    { login: 'postgres' }, { effective: 'aat_dev_migrator' }, { database: 'other' },
    { address: '192.0.2.1' }, { port: 5433 }, { owner: 'postgres' },
    { login_enabled: false }, { privileged: true }, { owner_default: false },
    { owner_switch: false }, { memberships: 2 }, { restricted_owner: false },
  ]) await assert.rejects(verifyLocalIdentity(client({ ...identity, ...override }), target, environment));
  await assert.rejects(verifyLocalIdentity(client(null), target, environment));
  await assert.rejects(verifyLocalIdentity(client(identity), { ...target, DB_NAME: 'other' }, environment));
});
test('backup must remain itself and have no memberships', async () => {
  const backup = { ...identity, login: 'aat_dev_backup', effective: 'aat_dev_backup', memberships: 0 };
  await verifyLocalIdentity(client(backup), target, environment, 'aat_dev_backup');
  await assert.rejects(verifyLocalIdentity(client({ ...backup, effective: 'aat_dev_owner' }), target, environment, 'aat_dev_backup'));
  await assert.rejects(verifyLocalIdentity(client({ ...backup, memberships: 1 }), target, environment, 'aat_dev_backup'));
});
test('backup completeness rejects unknown or restricted metadata', async () => {
  await verifyLocalBackupCompleteness(client({ complete: true }));
  await assert.rejects(verifyLocalBackupCompleteness(client({ complete: false })));
  await assert.rejects(verifyLocalBackupCompleteness(client(null)));
});
test('measurement/query failure prevents continuation', async () => {
  let continued = false;
  await assert.rejects(async () => {
    await verifyLocalIdentity({ query: async () => { throw new Error('unavailable'); } }, target, environment);
    continued = true;
  });
  assert.equal(continued, false);
});

test('initial replay rejects objects outside the visible table count', async () => {
  await verifyLocalEmptySchema(client({ empty: true }));
  await assert.rejects(verifyLocalEmptySchema(client({ empty: false })));
  await assert.rejects(verifyLocalEmptySchema(client(null)));
});

test('post-migration ownership and ledger access must both pass', async () => {
  const metadata = (owned, protectedLedger) => ({
    query: async (sql) => ({ rows: [sql.includes('AS owned') ? { owned } : { protected: protectedLedger }] }),
  });
  await verifyLocalMigratedOwnership(metadata(true, true));
  await assert.rejects(verifyLocalMigratedOwnership(metadata(false, true)));
  await assert.rejects(verifyLocalMigratedOwnership(metadata(true, false)));
});
