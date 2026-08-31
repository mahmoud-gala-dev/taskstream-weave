const CACHE = "work-os-shell-v1";
const STORE_DB = "work-os-reminders";
const STORE = "schedule";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STORE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeSchedule(rows) {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  store.clear();
  rows.forEach((row) => store.put(row));
}

async function checkSchedule() {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const rows = await new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  });
  const now = Date.now();
  await Promise.all(rows.filter((row) => !row.sent && row.at <= now).map(async (row) => {
    row.sent = true;
    store.put(row);
    await self.registration.showNotification(row.title, {
      body: row.body,
      tag: row.id,
      icon: "/app-icon-192.png",
      badge: "/app-icon-192.png",
      data: { url: "/" },
    });
  }));
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "WORK_OS_SCHEDULE") {
    event.waitUntil(writeSchedule(event.data.rows || []).then(checkSchedule));
  }
  if (event.data?.type === "WORK_OS_NOTIFY") {
    event.waitUntil(self.registration.showNotification(event.data.title, event.data.options));
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "work-os-reminders") event.waitUntil(checkSchedule());
});
self.addEventListener("sync", (event) => {
  if (event.tag === "work-os-reminders") event.waitUntil(checkSchedule());
});
self.addEventListener("push", (event) => {
  const data = event.data?.json?.() || {};
  event.waitUntil(self.registration.showNotification(data.title || "Work OS", {
    body: data.body || "You have work due today.",
    tag: data.tag || "work-os-push",
    icon: "/app-icon-192.png",
    data: { url: data.url || "/" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients[0];
    if (existing) return existing.focus();
    return self.clients.openWindow(event.notification.data?.url || "/");
  }));
});