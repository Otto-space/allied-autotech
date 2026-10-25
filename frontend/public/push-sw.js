/* Push only: never intercept or cache account pages, API calls or credentials. */
// Store only bounded opaque event IDs, never message/account content. Read/write
// transactions serialize simultaneous pushes across tabs and worker restarts.
async function claimAlert(id) {
  try {
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open("aat-push-receipts-v1", 1);
      open.onupgradeneeded = () =>
        open.result
          .createObjectStore("receipts", { keyPath: "id" })
          .createIndex("at", "at");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("receipts", "readwrite"),
          store = tx.objectStore("receipts");
        let claimed = false;
        const get = store.get(id);
        get.onsuccess = () => {
          if (get.result) return;
          claimed = true;
          store.put({ id, at: Date.now() });
          const all = store.index("at").getAll();
          all.onsuccess = () => {
            const rows = all.result;
            for (let i = 0; i < rows.length; i++)
              if (i < rows.length - 256 || rows[i].at < Date.now() - 86400000)
                store.delete(rows[i].id);
          };
        };
        tx.oncomplete = () => resolve(claimed);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // Storage can be unavailable. The stable native tag still coalesces alerts;
    // persistent deduplication is best effort, not exactly-once delivery.
    return true;
  }
}
async function releaseFailedAlert(id) {
  // A failed native display must not suppress a later delivery retry.
  try {
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open("aat-push-receipts-v1", 1);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("receipts", "readwrite");
        tx.objectStore("receipts").delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    /* Storage recovery is best effort; preserve the display error. */
  }
}
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data?.json();
  } catch {
    return;
  }
  if (
    !data ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      data.notificationId,
    ) ||
    !["customer", "staff"].includes(data.audience)
  )
    return;
  const base = data.audience === "customer" ? "/dashboard" : "/admin";
  event.waitUntil(
    (async () => {
      const subscription = await self.registration.pushManager.getSubscription();
      if (!subscription) return;
      // Reject in-flight alerts for a previous account's retired endpoint. The
      // worker must be released before this client; old clients ignore this field.
      if (!/^[a-f0-9]{64}$/.test(data.endpointHash ?? "")) return;
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(subscription.endpoint),
      );
      const hash = [...new Uint8Array(bytes)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (hash !== data.endpointHash || !(await claimAlert(data.notificationId))) return;
      try {
        await self.registration.showNotification("Allied AutoTech", {
          body: "You have a new account update. Sign in to view it securely.",
          icon: "/brand/allied-favicon-v1.png",
          badge: "/brand/allied-favicon-v1.png",
          tag: `allied-${data.notificationId}`,
          renotify: false,
          data: { url: `${base}/notifications?notification=${data.notificationId}` },
        });
      } catch (error) {
        await releaseFailedAlert(data.notificationId);
        throw error;
      }
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url;
  if (
    typeof path !== "string" ||
    !/^\/(dashboard|admin)\/notifications\?notification=[0-9a-f-]{36}$/i.test(path)
  )
    return;
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.navigate(url);
        await existing.focus();
      } else await self.clients.openWindow(url);
    })(),
  );
});
