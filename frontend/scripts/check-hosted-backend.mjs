import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// Read-only smoke test: a disposable local frontend contacts the hosted API.
// Build its rewrites with the same BACKEND_ORIGIN before running this check.
// No ports are published, no application records are written, and no keys print.
const image = process.env.AAT_FRONTEND_TEST_IMAGE;
const envFile = process.env.AAT_FRONTEND_TEST_ENV;
assert.ok(
  image && envFile && existsSync(envFile),
  "Supply an image and private env file.",
);
function docker(args, input) {
  return spawnSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
  });
}
const started = docker(["run", "--rm", "-d", "--env-file", envFile, image]);
assert.equal(started.status, 0, "The connected frontend must start.");
const id = started.stdout.trim();
assert.match(id, /^[a-f0-9]{64}$/);
try {
  const probe = `
import assert from 'node:assert/strict';
import {setTimeout} from 'node:timers/promises';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
assert.equal(process.env.PRIVATE_TESTING_ENABLED,'true');
assert.equal(process.env.SITE_INDEXING,'disabled');
const origin = new URL(process.env.BACKEND_ORIGIN);
assert.equal(origin.protocol,'https:');
assert.ok(origin.hostname.endsWith('.ondigitalocean.app'));
const password = process.env.PRIVATE_TESTING_PASSWORD;
assert.ok(/^[a-f0-9]{64}$/.test(password ?? ''),'Valid private password configuration');
const authorization = 'Basic '+Buffer.from('allied-test:'+password).toString('base64');
const base = 'http://127.0.0.1:3000';
const get = (url,authorized=false) => fetch(url,{
  headers:authorized?{authorization}:{},redirect:'manual',signal:AbortSignal.timeout(20000)
});
let ready=false;
for(let i=0;i<80;i++) {
  try {await get(base);ready=true;break;}catch{await setTimeout(250);}
}
assert.ok(ready,'Frontend startup');
for(const path of ['/','/admin','/api/v1/public/services']) {
  assert.equal((await get(base+path)).status,401,'Anonymous denial: '+path);
}
assert.equal((await fetch(base,{headers:{authorization:'Basic invalid'}})).status,401);
assert.equal((await get(origin.origin+'/api/v1/health/ready')).status,200);
assert.equal((await get(origin.origin+'/api/v1/public/services')).status,401);
const routed=await get(base+'/api/v1/public/services',true);
assert.equal(routed.status,200,'Real backend rewrite');
assert.equal((await routed.json()).success,true);
assert.equal((await get(base+'/api/v1/auth/session',true)).status,401,'Application login still required');
for(const path of ['/login','/services']) {
  const page=await get(base+path,true);
  assert.equal(page.status,200,'Page render: '+path);
  const html=await page.text();
  assert.match(page.headers.get('x-robots-tag'),/noindex/);
  assert.match(page.headers.get('cache-control'),/no-store/);
  for(const secret of [password,authorization,authorization.slice(6)]) {
    assert.ok(!html.includes(secret),'No credential in HTML');
    assert.ok(!JSON.stringify([...page.headers]).includes(secret),'No credential in headers');
  }
  if(path==='/services') assert.ok(!html.includes('Services are unavailable'),'Server-rendered catalogue loaded');
  for(const host of process.env.ASSET_STORAGE_HOSTS.split(',').filter(Boolean)) {
    assert.ok(page.headers.get('content-security-policy')?.includes('https://'+host),'Storage CSP allowlist');
  }
}
let checkedAssets=0;
function scan(dir) {
  for(const entry of readdirSync(dir,{withFileTypes:true})) {
    const path=join(dir,entry.name);
    if(entry.isDirectory())scan(path);
    else {const data=readFileSync(path);assert.ok(!data.includes(Buffer.from(password)),'No password in public assets');checkedAssets++;}
  }
}
scan('/app/.next/static');
console.log(JSON.stringify({anonymousDenied:true,wrongPasswordDenied:true,hostedReadiness:true,realApiRewrite:true,applicationLoginRequired:true,loginRendered:true,servicesServerRendered:true,storageCsp:true,secretsAbsent:true,checkedAssets,writesPerformed:0}));
`;
  const result = docker(["exec", "-i", id, "node", "--input-type=module"], probe);
  assert.equal(result.status, 0, `Connected frontend check failed: ${result.stderr}`);
  process.stdout.write(result.stdout);
} finally {
  assert.equal(
    docker(["rm", "--force", id]).status,
    0,
    "Remove only the test container.",
  );
}
