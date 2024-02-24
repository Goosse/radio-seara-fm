//Somehow I need to get a build tag built into thise serviceworker file, because caches will only be updated if this file changes.

const buildTag = "2024223214418";
const precachedResources = ["/", "/algemas-quebradas/", "/recursos/capas/algemas-quebradas.webp", "/culto-ice-nova-russas/", "/recursos/capas/culto-ice-nova-russas.webp", "/familia-bencao-de-deus/", "/recursos/capas/familia-bencao-de-deus.webp", "/jornal-seara/", "/recursos/capas/jornal-seara.webp", "/ligado-na-verdade/", "/recursos/capas/ligado-na-verdade.webp", "/luz-da-vida/", "/recursos/capas/luz-da-vida.webp", "/minha-historia/", "/recursos/capas/minha-historia.webp", "/seara-esporte-clube/", "/recursos/capas/seara-esporte-clube.webp", "/a-esposa-por-tras/", "/parceiros/", "/baixar-minha-historia/", "/baixar-algemas-quebradas/", "/ao-vivo/", "/styles.css"];
const origin = new URL(location).origin;


async function precache() {
    const cache = await caches.open("local_resources_" + buildTag);
  //  var fullUrls = precachedResources.map(i => origin + i);
    return cache.addAll(precachedResources);
}

const putInCache = async (request, response) => {
    if (request.url.indexOf(origin) == 0 && request.url.indexOf('browser-sync') == -1){
        console.log("Caching local resource: " + request.url)
        const cache = await caches.open("local_resources_" + buildTag);
        await cache.put(request, response);
    }
//  const cache = await caches.open("v1");
//  await cache.put(request, response);
};

const cacheFirst = async (request) => {
  const responseFromCache = await caches.match(request);
  if (responseFromCache) {
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
//    if (event.request.url.indexOf('google') == -1 && event.request.url.indexOf('browser-sync') == -1) { //Don't cache analytics requests
        event.respondWith(cacheFirst(event.request));
 //   }
});
