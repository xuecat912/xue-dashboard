/* 雪 OS · 离线缓存 */
const CACHE = "xue-os-v5";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icons/calendar.png",
  "./icons/clock.png",
  "./icons/weather.png",
  "./icons/maps.png",
  "./icons/photos.png",
  "./icons/notes.png",
  "./icons/wechat.png",
  "./icons/bili.png",
  "./icons/netease.png",
  "./icons/starrail.png",
  "./icons/minis.png",
  "./icons/widgets.png",
  "./icons/music.png",
  "./icons/podcasts.png",
  "./icons/health.png",
  "./icons/files.png",
  "./icons/phone.png",
  "./icons/sms.png"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 逐个加，单个失败不影响整体
    await Promise.all(SHELL.map(u => c.add(new Request(u, {cache: "reload"})).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 天气等外部接口：先走网络，失败就用上一次的缓存
  if (url.origin !== location.origin) {
    e.respondWith((async () => {
      try {
        return await fetch(req);
      } catch (err) {
        const c = await caches.open(CACHE);
        const hit = await c.match(req);
        return hit || new Response(JSON.stringify({offline: true}), {
          headers: {"Content-Type": "application/json"}
        });
      }
    })());
    return;
  }

  // 页面导航：先走网络（保证拿到最新版），断网回退缓存
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200) c.put("./index.html", fresh.clone());
        return fresh;
      } catch (err) {
        return (await c.match("./index.html")) || (await c.match(req)) ||
          new Response("离线且无缓存", {status: 503, headers: {"Content-Type": "text/plain; charset=utf-8"}});
      }
    })());
    return;
  }

  // 站内资源：先给缓存，后台顺便更新
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, {ignoreSearch: true});
    const net = fetch(req).then(r => {
      if (r && r.status === 200) c.put(req, r.clone());
      return r;
    }).catch(() => null);
    return hit || (await net) || c.match("./index.html");
  })());
});
