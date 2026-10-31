/* Hall Pass Board - service worker.
   It keeps a copy of the board on the device so it still opens without internet,
   and quietly checks for a newer index.html each time the page is opened.
   Everything on other websites (weather, time servers, Google Sheets) goes straight to the network.
   The folder studyhall/ holds a second, separate page (the Study Hall board): this worker leaves it alone,
   so that address always shows that page and never the Hall Pass Board. */
const CACHE = "hallpass-v4";
const SCOPE = self.registration.scope;
const PAGE = new URL("index.html", SCOPE).href;
const STUDY = new URL("studyhall", SCOPE).pathname;                    // /hallpass/studyhall  (with or without the slash at the end)
const ASSETS = ["index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "fonts/patrick-hand-latin-400.woff2"]
  .map(p => new URL(p, SCOPE).href);

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.indexOf("hallpass-") === 0 && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;
  if(url.pathname === STUDY || url.pathname.indexOf(STUDY + "/") === 0) return;      // the Study Hall page: straight to the network
  const bare = url.origin + url.pathname;
  if(bare === PAGE && url.searchParams.has("fresh")){ e.respondWith(freshPage()); return; }   // the page asking "is there a newer version?"
  if(req.mode === "navigate" || bare === PAGE){ e.respondWith(pageResponse(e)); return; }
  if(ASSETS.indexOf(bare) >= 0){ e.respondWith(caches.match(bare).then(hit => hit || fetch(req))); return; }
  if(/\/sounds\/[^/]+\.(mp3|wav|ogg|m4a|aac)$/i.test(url.pathname) && !req.headers.has("range")){     // the school's sound files: kept after the first download, so they also play offline
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => { if(res.ok) c.put(req, res.clone()); return res; }))));
  }
});

// Show the saved page at once; fetch the newest one in the background for next time.
async function pageResponse(e){
  const cache = await caches.open(CACHE);
  const cached = await cache.match(PAGE);
  const refresh = fetch(PAGE, { cache: "no-cache" })
    .then(res => { if(res.ok){ const copy = res.clone(); return cache.put(PAGE, copy).then(() => res); } return null; })
    .catch(() => null);
  if(cached){ e.waitUntil(refresh); return cached; }
  const net = await refresh;
  return net || new Response("The board is not saved on this device yet. Open it once while online.", { status: 503, headers: { "content-type": "text/plain" } });
}

// Straight from the web server, and kept for the next start.
async function freshPage(){
  const res = await fetch(PAGE, { cache: "no-store" });
  if(res.ok){ const cache = await caches.open(CACHE); await cache.put(PAGE, res.clone()); }
  return res;
}
