/* Push only: never intercept or cache account pages, API calls or credentials. */
self.addEventListener("push", (event) => {
  let data;
  try { data = event.data?.json(); } catch { return; }
  if (!data || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.notificationId) || !["customer", "staff"].includes(data.audience)) return;
  const base = data.audience === "customer" ? "/dashboard" : "/admin";
  event.waitUntil(self.registration.showNotification("Allied AutoTech", {
    body: "You have a new account update. Sign in to view it securely.",
    icon: "/brand/allied-favicon-v1.png", badge: "/brand/allied-favicon-v1.png",
    tag: `allied-${data.notificationId}`, renotify: false,
    data: { url: `${base}/notifications?notification=${data.notificationId}` },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url;
  if (typeof path !== "string" || !/^\/(dashboard|admin)\/notifications\?notification=[0-9a-f-]{36}$/i.test(path)) return;
  const url = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) { await existing.navigate(url); await existing.focus(); }
    else await self.clients.openWindow(url);
  })());
});
