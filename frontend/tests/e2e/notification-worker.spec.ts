import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { notificationsFixture } from "../fixtures/customer-notifications";
const source = readFileSync(path.resolve("public/push-sw.js"), "utf8");
const endpoint = "https://fcm.googleapis.com/fcm/send/isolated-worker-fixture";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const id = (n: number) => `b3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Harness = {
  endpoint: string | null;
  alerts: { title: string; options: { body: string; tag: string; data: { url: string } } }[];
  navigations: string[];
  push: (payload: unknown) => Promise<void>;
  click: (url: string) => Promise<void>;
  restart: () => void;
};
declare global { interface Window { notificationWorkerFixture: Harness } }

test("actual push handler uses persistent browser storage to deduplicate and isolate retired account endpoints", async ({ page }) => {
  await notificationsFixture(page);
  await page.addInitScript({ content: `(() => {
    const listeners = new Map();
    let task = Promise.resolve();
    const fixture = window.notificationWorkerFixture = {
      endpoint: ${JSON.stringify(endpoint)}, alerts: [], navigations: [],
      push: async (payload) => { task = Promise.resolve(); listeners.get('push')({data:{json:()=>payload},waitUntil:(p)=>{task=p}}); await task; },
      click: async (url) => { task=Promise.resolve(); listeners.get('notificationclick')({notification:{data:{url},close:()=>{}},waitUntil:(p)=>{task=p}}); await task; }
    };
    const scope = { location, addEventListener:(type, handler)=>listeners.set(type,handler),
      registration:{pushManager:{getSubscription:async()=>fixture.endpoint?{endpoint:fixture.endpoint}:null},
      showNotification:async(title,options)=>{fixture.alerts.push({title,options})}},
      clients:{matchAll:async()=>[{url:location.origin+'/dashboard/notifications',navigate:async(url)=>fixture.navigations.push(url),focus:async()=>{}}],openWindow:async(url)=>fixture.navigations.push(url)}
    };
    fixture.restart=()=>{ ((self)=>{ ${source} })(scope); };
    fixture.restart();
  })();` });
  await page.goto("/dashboard/notifications");
  const event = { notificationId: id(1), endpointHash: hash(endpoint), audience: "customer" };
  await page.evaluate(async (event) => {
    await Promise.all([window.notificationWorkerFixture.push(event), window.notificationWorkerFixture.push(event)]);
    window.notificationWorkerFixture.restart();
    await window.notificationWorkerFixture.push(event);
  }, event);
  const alerts = await page.evaluate(() => window.notificationWorkerFixture.alerts);
  expect(alerts).toHaveLength(1);
  expect(alerts[0].options.body).toBe("You have a new account update. Sign in to view it securely.");
  expect(alerts[0].options.tag).toBe(`allied-${id(1)}`);
  await page.evaluate(async (event) => {
    window.notificationWorkerFixture.endpoint = null;
    await window.notificationWorkerFixture.push(event);
    window.notificationWorkerFixture.endpoint = "https://fcm.googleapis.com/fcm/send/different-account";
    await window.notificationWorkerFixture.push(event);
  }, { ...event, notificationId: id(2) });
  expect(await page.evaluate(() => window.notificationWorkerFixture.alerts.length)).toBe(1);
  await page.evaluate(async (event) => { await window.notificationWorkerFixture.push(event); }, { ...event, notificationId: id(3), endpointHash: hash("https://fcm.googleapis.com/fcm/send/different-account") });
  expect(await page.evaluate(() => window.notificationWorkerFixture.alerts.length)).toBe(2);
});

test("notification click only focuses a safe inbox URL and cannot invoke a business action", async ({ page }) => {
  await notificationsFixture(page);
  await page.addInitScript({ content: `(() => {
    const listeners=new Map(); let task=Promise.resolve();
    const fixture=window.notificationWorkerFixture={navigations:[],click:async(url)=>{task=Promise.resolve();listeners.get('notificationclick')({notification:{data:{url},close:()=>{}},waitUntil:(p)=>{task=p}});await task;}};
    const self={location,addEventListener:(t,h)=>listeners.set(t,h),clients:{matchAll:async()=>[{url:location.origin+'/dashboard',navigate:async(url)=>fixture.navigations.push(url),focus:async()=>{}}],openWindow:async(url)=>fixture.navigations.push(url)}};
    ${source}
  })();` });
  await page.goto("/dashboard/notifications");
  await page.evaluate(async () => { for (const url of ["https://outside.invalid", "//outside.invalid", "javascript:alert(1)", "/admin/refunds/approve"]) await window.notificationWorkerFixture.click(url); });
  expect(await page.evaluate(() => window.notificationWorkerFixture.navigations)).toEqual([]);
  const safe = `/dashboard/notifications?notification=${id(8)}`;
  await page.evaluate(async (url) => { await window.notificationWorkerFixture.click(url); }, safe);
  expect(await page.evaluate(() => window.notificationWorkerFixture.navigations)).toEqual([`${new URL(page.url()).origin}${safe}`]);
});
