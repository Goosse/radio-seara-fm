//Somehow I need to get a build tag built into thise serviceworker file, because caches will only be updated if this file changes.

const buildTag = "202662819628";
const precachedResources = ["/", "/algemas-quebradas/", "/recursos/capas/semmarca/algemas-quebradas.webp", "/culto-ice-nova-russas/", "/recursos/capas/semmarca/culto-ice-nova-russas.webp", "/familia-bencao-de-deus/", "/recursos/capas/semmarca/familia-bencao-de-deus.webp", "/jornal-seara/", "/recursos/capas/semmarca/jornal-seara.webp", "/ligado-na-verdade/", "/recursos/capas/semmarca/ligado-na-verdade.webp", "/minha-historia/", "/recursos/capas/semmarca/minha-historia.webp", "/seara-esporte-clube/", "/recursos/capas/semmarca/seara-esporte-clube.webp", "/parceiros/", "/baixar-minha-historia/", "/baixar-algemas-quebradas/", "/a-esposa-por-tras/", "/styles.css"];
const origin = new URL(location).origin;

// Live streams should never be cached - they're real-time and constantly changing
const isLiveStream = (url) => {
    return url.indexOf('/stream102') !== -1 ||
           url.indexOf('/stream104') !== -1 ||
           url.indexOf('.m3u8') !== -1; // HLS playlist files
};

async function precache() {
    const cache = await caches.open("local_resources_" + buildTag);
  //  var fullUrls = precachedResources.map(i => origin + i);
    return cache.addAll(precachedResources);
}

const isRedirectResponse = (response) => {
    // Don't cache redirect responses (301, 302, 303, 307, 308)
    // Browsers don't allow service workers to return cached redirects
    const redirectStatusCodes = [301, 302, 303, 307, 308];
    return redirectStatusCodes.includes(response.status);
};

const putInCache = async (request, response) => {
    // Never cache live streams - they must always be fetched fresh
    if (isLiveStream(request.url)) {
        return; // Don't cache live streams
    }
    // Never cache redirect responses - they cause "Response served by service worker has redirections" errors
    if (isRedirectResponse(response)) {
        console.log("Not caching redirect response for: " + request.url);
        return;
    }
    if (request.url.indexOf(origin) == 0 && request.url.indexOf('browser-sync') == -1){
        console.log("Caching local resource: " + request.url)
        const cache = await caches.open("local_resources_" + buildTag);
        await cache.put(request, response);
    }
//  const cache = await caches.open("v1");
//  await cache.put(request, response);
};

const cacheFirst = async (request) => {
  // Live streams must always bypass cache and go straight to network
  if (isLiveStream(request.url)) {
      return fetch(request);
  }
  
  const responseFromCache = await caches.match(request);
  if (responseFromCache) {
      // Check if cached response is a redirect - if so, delete it and fetch fresh
      if (isRedirectResponse(responseFromCache)) {
          console.log("Cached redirect found for: " + request.url + " - deleting and fetching fresh");
          const cache = await caches.open("local_resources_" + buildTag);
          await cache.delete(request);
          const responseFromNetwork = await fetch(request);
          putInCache(request, responseFromNetwork.clone());
          return responseFromNetwork;
      }
      console.log("cache hit: " + request.url);
      return responseFromCache;
  }
  const responseFromNetwork = await fetch(request);
  putInCache(request, responseFromNetwork.clone());

  return responseFromNetwork;
};

self.addEventListener("install", (event) => {
  // The promise that skipWaiting() returns can be safely ignored.
  self.skipWaiting();
    
    const cacheAllowlist = ["local_resources_" + buildTag];

    event.waitUntil(
                    caches.keys().then(function(names) {
                        for (let name of names){
                            if (!cacheAllowlist.includes(name)) {
                                console.log("deleting cache named: " + name)
                              caches.delete(name);
                            }
                        }
      }),
    );
    
    event.waitUntil(precache());
    
   // console.log("resourceTag: " + resourceTag);
//    caches.keys().then(function(names) {
//        for (let name of names)
//            console.log("Delete cache named: " + name + "?");
//        if (name.indexOf('local_resources') == 0 && name.indexOf(buildTag) == -1){
//            caches.delete(name);
//            console.log("yes");
//        }
//        else{
//            console.log("no");
//        }
//        //caches.delete(name);//Uncomment to delete all caches.
//    });
  // Perform any other actions required for your
  // service worker to install, potentially inside
  // of event.waitUntil();
});

self.addEventListener('activate', function(event) {
  console.log('Claiming control');
  
  // Clean cache of any redirect responses from old versions
  event.waitUntil(
    caches.open("local_resources_" + buildTag).then(async function(cache) {
      const requests = await cache.keys();
      for (const request of requests) {
        const response = await cache.match(request);
        if (response && isRedirectResponse(response)) {
          console.log("Cleaning redirect from cache: " + request.url);
          await cache.delete(request);
        }
      }
    })
  );
  
  return self.clients.claim();
});

//
//self.addEventListener("activate", (event) => {
//    console.log("sync event fired")
//  const cacheAllowlist = ["local_resources_" + buildTag];
//
//  event.waitUntil(
//                  caches.keys().then(function(names) {
//                      for (let name of names){
//                          if (!cacheAllowlist.includes(name)) {
//                              console.log("deleting cache named: " + name)
//                            caches.delete(name);
//                          }
//                      }
//    }),
//  );
//});

self.addEventListener("fetch", (event) => {
    console.log("fetch: " + event.request.url)
    
    // For navigation requests (HTML pages), use network first to avoid redirect issues
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }
    
//    if (event.request.url.indexOf('google') == -1 && event.request.url.indexOf('browser-sync') == -1) { //Don't cache analytics requests
        event.respondWith(cacheFirst(event.request));
 //   }
});
