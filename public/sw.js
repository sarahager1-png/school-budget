// Minimal service worker — enables PWA install + light offline shell.
// Only handles same-origin GET; Supabase/API calls pass straight through.
//
// חשוב: index.html לעולם לא מוגש מהמטמון כשיש רשת. גרסה קודמת השאירה
// אצל חלק מהמשתמשות עמוד ישן שלא הציג עדכונים חדשים — לכן הניווט כאן
// הוא network-only, והמטמון משמש רק כשאין רשת בכלל (ר' אותו תיקון ב-budget-hub/sw.js).
const CACHE = 'mb-budget-v4';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).catch(() =>
        caches.match('/index.html').then((r) => r || Response.error())
      )
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((r) => r || caches.match('/index.html'))
      )
  );
});
