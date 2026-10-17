/* Robotics AI Prep service worker: works offline, picks up new versions when online */
const CACHE = "rap-shell-v2";
const FONTS = "rap-fonts-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function withTimeout(p, ms){ return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]); }

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const u = new URL(req.url);
  if(u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com"){
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req); if(hit) return hit;
      try{ const r = await fetch(req); c.put(req, r.clone()); return r; }catch(err){ return new Response("", {status:504}); }
    }));
    return;
  }
  if(u.origin !== location.origin) return;
  // Network first (so updates arrive), cache fallback (so it works offline)
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try{
      const r = await withTimeout(fetch(req, {cache:"no-store"}), 4000);
      if(r && r.ok && !r.redirected && new URL(r.url).origin === location.origin) c.put(req, r.clone()); // never cache a login redirect
      return r;
    }catch(err){
      const hit = await c.match(req, {ignoreSearch:true});
      if(hit) return hit;
      if(req.mode === "navigate") return c.match("./index.html");
      return new Response("Offline", {status:503});
    }
  })());
});
