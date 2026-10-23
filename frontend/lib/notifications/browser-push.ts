export async function clearBrowserPush() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const worker = registration.active ?? registration.waiting ?? registration.installing;
    if (!worker || new URL(worker.scriptURL).pathname !== "/push-sw.js") continue;
    const subscription = await registration.pushManager.getSubscription();
    await subscription?.unsubscribe();
    const notifications = await registration.getNotifications();
    for (const notification of notifications) notification.close();
  }
}
