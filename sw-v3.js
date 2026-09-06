const CACHE="aq-collage-pwa-v42";

const SHELL=[
  "./",
  "./index.html",
  "./app-pwa.css",
  "./styles-gas.css",
  "./stock-module.css",
  "./stock-planner.css",
  "./circuit-colors-v1.css",
  "./app-pwa-v2.js",
  "./config.js",
  "./sync-patch.js",
  "./access-bridge-v3.js",
  "./install-helper.js",
  "./geocode-cache-v1.js",
  "./stock-module-v3.js",
  "./stock-save-fix.js",
  "./stock-zero-filter.js",
  "./stock-planner-v4.js",
  "./stock-header-polish.js",
  "./quantity-estimate-v1.js",
  "./circuit-colors-v1.js",
  "./manifest.webmanifest",
  "./data/points.json",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET") return;

  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;

  const networkFirst = req.mode==="navigate" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/");

  if(networkFirst){
    event.respondWith(
      fetch(req,{cache:"no-store"})
        .then(res=>{
          if(res.ok){
            const copy=res.clone();
            caches.open(CACHE).then(cache=>cache.put(req,copy));
          }
          return res;
        })
        .catch(()=>caches.match(req).then(cached=>cached||caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached=>cached||fetch(req).then(res=>{
      if(res.ok){
        const copy=res.clone();
        caches.open(CACHE).then(cache=>cache.put(req,copy));
      }
      return res;
    }))
  );
});
