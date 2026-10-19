import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

// Real built Next.js/Proxy/rewrite verification. The fake API runs inside this
// disposable network-isolated container; no application database is contacted.
const image =
  process.env.AAT_FRONTEND_TEST_IMAGE || "allied-autotech-frontend:private-testing";
const password = randomBytes(32).toString("hex");
function docker(args, input) {
  return spawnSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
    env: { ...process.env, PRIVATE_TESTING_PASSWORD: password },
  });
}
const started = docker([
  "run",
  "--rm",
  "-d",
  "--network",
  "none",
  "-e",
  "PRIVATE_TESTING_ENABLED=true",
  "-e",
  "PRIVATE_TESTING_PASSWORD",
  "-e",
  "SITE_INDEXING=disabled",
  image,
]);
assert.equal(started.status, 0, "The isolated built frontend must start.");
const id = started.stdout.trim();
assert.match(id, /^[a-f0-9]{64}$/);
try {
  const probe = `
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {setTimeout} from 'node:timers/promises';
const password = process.env.PRIVATE_TESTING_PASSWORD;
const authorization = 'Basic ' + Buffer.from('allied-test:' + password).toString('base64');
let serverReadAuthorized = false;
const serviceId = '11111111-1111-4111-8111-111111111111';
const api = createServer((req,res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/v1/public/services/' + serviceId) {
    serverReadAuthorized = req.headers.authorization === authorization;
    res.statusCode=404;
    res.end(JSON.stringify({success:false,error:{code:'NOT_FOUND',message:'Synthetic fixture'}}));
    return;
  }
  res.end(JSON.stringify({success:true,data:{authorized:req.headers.authorization===authorization}}));
});
await new Promise(resolve => api.listen(5000, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:3000';
try {
  let ready = false;
  for (let attempt=0; attempt<80; attempt++) {
    try { await fetch(base); ready=true; break; } catch { await setTimeout(250); }
  }
  assert.ok(ready, 'Next.js must become reachable');
  for (const path of ['/', '/admin', '/api/v1/public/private-probe', '/robots.txt', '/_next/static/unknown.js']) {
    const response = await fetch(base+path);
    assert.equal(response.status,401, 'Uncredentialed path must be gated: '+path);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
  const prefetch = await fetch(base+'/admin', {headers:{purpose:'prefetch','next-router-prefetch':'1'}});
  assert.equal(prefetch.status,401);
  const invalid = await fetch(base+'/', {headers:{authorization:'Basic incorrect'}});
  assert.equal(invalid.status,401);
  const routed = await fetch(base+'/api/v1/public/private-probe', {headers:{authorization}});
  assert.equal(routed.status,200);
  assert.deepEqual(await routed.json(), {success:true,data:{authorized:true}});
  const page = await fetch(base+'/login', {headers:{authorization}});
  assert.equal(page.status,200,'The real login page should render behind private access');
  const html = await page.text();
  for (const secret of [password, authorization, authorization.slice(6)]) {
    assert.ok(!html.includes(secret), 'No private credential in HTML');
    assert.ok(!JSON.stringify([...page.headers]).includes(secret), 'No private credential in response headers');
  }
  assert.match(page.headers.get('x-robots-tag'), /noindex/);
  const imagePath = '/_next/image?url=%2Fimages%2Fallied-autotech%2Fworkshop-editorial.webp&w=640&q=75';
  const optimized = await fetch(base+imagePath,{headers:{authorization}});
  assert.equal(optimized.status,200,'Authenticated optimized image should load: ' + (optimized.ok ? '' : await optimized.text()));
  assert.equal((await fetch(base+imagePath)).status,401,'Warm image cache must not bypass private gate');
  const detail = await fetch(base+'/services/'+serviceId,{headers:{authorization}});
  await detail.text();
  assert.ok([200,404].includes(detail.status), 'Next may stream its not-found page with a 200 status');
  assert.equal(serverReadAuthorized,true,'Server-rendered API reads must carry the server-side credential');
  console.log(JSON.stringify({privatePaths:5,prefetchDenied:true,wrongCredentialDenied:true,authenticatedRewrite:true,serverReadAuthorized:true,optimizedImage:true,warmCacheDenied:true,realLoginRendered:true,secretsAbsent:true}));
} finally { await new Promise(resolve=>api.close(resolve)); }
`;
  const result = docker(["exec", "-i", id, "node", "--input-type=module"], probe);
  // Output contains only test assertions and booleans, never the generated credential.
  assert.equal(result.status, 0, `Built private-testing check failed: ${result.stderr}`);
  process.stdout.write(result.stdout);
  const metadata = JSON.parse(docker(["image", "inspect", image]).stdout)[0];
  const health = metadata.Config.Healthcheck.Test;
  assert.equal(health[0], "CMD");
  assert.equal(
    docker(["exec", id, ...health.slice(1)]).status,
    0,
    "The built health check must authenticate in private mode.",
  );
  console.log("Private-mode container health check passed.");
} finally {
  assert.equal(
    docker(["rm", "--force", id]).status,
    0,
    "Remove only this test's container.",
  );
}
