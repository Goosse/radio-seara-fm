//Somehow I need to get a build tag built into thise serviceworker file, because caches will only be updated if this file changes.

const buildTag = "2026113173643";
const precachedResources = ["/", "/algemas-quebradas/", "/recursos/capas/semmarca/algemas-quebradas.webp", "/culto-ice-nova-russas/", "/recursos/capas/semmarca/culto-ice-nova-russas.webp", "/familia-bencao-de-deus/", "/recursos/capas/semmarca/familia-bencao-de-deus.webp", "/jornal-seara/", "/recursos/capas/semmarca/jornal-seara.webp", "/ligado-na-verdade/", "/recursos/capas/semmarca/ligado-na-verdade.webp", "/minha-historia/", "/recursos/capas/semmarca/minha-historia.webp", "/seara-esporte-clube/", "/recursos/capas/semmarca/seara-esporte-clube.webp", "/luz-da-vida/a-peleja-não-é-vossa-2-crônicas-20-1-4-12-22/", "/luz-da-vida/filipe-e-o-eunuco-no-caminho-da-redenção-atos-8-26-31/", "/luz-da-vida/josé-uma-história-de-superação-gênesis-41-50-52/", "/luz-da-vida/como-escolher-o-candidato-certo-deuteronômio-17-15/", "/luz-da-vida/o-cristão-e-o-carnaval-1-coríntios-2-12-16/", "/luz-da-vida/quero-trazer-à-memória-o-que-pode-dar-esperança-lamentações-3-21-25/", "/luz-da-vida/restauração-do-povo-de-deus-salmo-126-1-6/", "/luz-da-vida/vinde-a-mim-mateus-11-28/", "/luz-da-vida/viva-na-expectativa-da-volta-de-jesus-romanos-13-11-14/", "/baixar-algemas-quebradas/", "/luz-da-vida/o-grito-de-uma-mãe-aflita-mateus-15-21-28/", "/luz-da-vida/gratidão-x-ingratidão-lucas-17-11-17/", "/luz-da-vida/as-sete-palavras-da-cruz-lucas-23-33-34/", "/luz-da-vida/o-olhar-que-salva/", "/luz-da-vida/próximo-do-reino-de-deus-marcos-12-28-34/", "/luz-da-vida/só-existe-uma-alternativa-joão-6-68/", "/luz-da-vida/index/", "/a-esposa-por-tras/", "/luz-da-vida/até-aqui-nos-ajudou-o-senhor-1-samuel-7-12/", "/luz-da-vida/dois-toques-de-jesus-marcos-8-22-25/", "/luz-da-vida/parábola-do-rico-e-lázaro-lucas-16-19-31/", "/luz-da-vida/a-história-do-escravo-onésimo-filemon-1-10-13/", "/luz-da-vida/lições-que-o-coxo-aprendeu-na-porta-do-templo-atos-3-1-8/", "/luz-da-vida/esqueça-o-passado-gênesis-41-50-52/", "/luz-da-vida/zaqueu-e-o-encontro-da-salvação-lucas-19-1-10/", "/luz-da-vida/marcas-da-igreja-de-jerusalém-atos-2-42-47/", "/luz-da-vida/seis-marcas-de-uma-igreja-cheia-do-espirito-santo-at-2-42-47-1/", "/luz-da-vida/a-mensagem-de-joão-batista-mateus-3-1-8/", "/luz-da-vida/exemplo-de-gratidão-lucas-17-11-19-1/", "/luz-da-vida/a-vida-do-apóstolo-pedro-marcos-16-7/", "/luz-da-vida/arrependei-vos-mateus-3-1-10/", "/luz-da-vida/especial-dia-das-mães/", "/luz-da-vida/cinco-teses-da-reforma/", "/luz-da-vida/a-necessidade-de-estarmos-preparados-para-o-encontro-com-o-senhor/", "/luz-da-vida/evidências-de-uma-igreja-cheia-do-espírito-santo/", "/luz-da-vida/onésimo-o-escravo-de-filemom-carta-a-filemom/", "/luz-da-vida/que-buscais-joão-1-35-39/", "/luz-da-vida/jesus-o-bom-pastor-joão-10-11/", "/luz-da-vida/a-alma-farta-pisa-o-favo-de-mel-provérbios-27-7-1/", "/luz-da-vida/o-convite-que-jesus-fez-mt-11-28/", "/luz-da-vida/vinde-a-mim-mateus-11-28-30/", "/luz-da-vida/a-alegria-do-senhor-é-vossa-força-neemias-8-10/", "/luz-da-vida/até-aqui-nos-ajudou-o-senhor-1sm-7-12/", "/luz-da-vida/reações-das-pessoas-ao-nascimento-de-jesus-mateus-2-1-12/", "/luz-da-vida/três-cruzes-no-calvário-lucas-23-33-43/", "/luz-da-vida/o-vaso-do-oleiro-jeremias-18-1-6/", "/luz-da-vida/esperança-em-tempos-de-crise/", "/luz-da-vida/a-benção-da-salvação-atos-2-21/", "/luz-da-vida/o-espinho-na-carne/", "/luz-da-vida/o-que-fazer-quando-a-crise-chega-até-nós-gênesis-21-8-21/", "/luz-da-vida/a-conquista-de-calebe-josué-14-6-15/", "/luz-da-vida/a-igreja-de-éfeso-apocalipse-2-1-7/", "/luz-da-vida/o-triste-fim-de-jeroboão-1-reis-11-26-40/", "/luz-da-vida/deus-é-nosso-refúgio-no-perigo-salmo-46/", "/luz-da-vida/o-vale-de-ossos-secos-ezequiel-37-1-14/", "/luz-da-vida/vinde-a-mim-mateus-11-28-30-1/", "/luz-da-vida/ventos-contrários-mateus-14-22-33/", "/luz-da-vida/no-caminho-de-emaús-lucas-24-13-16/", "/luz-da-vida/manassés-e-efraim-gênesis-41-50-52/", "/luz-da-vida/melhor-idade-recebendo-vigor-isaías-40-29-31/", "/luz-da-vida/como-ser-feliz-em-2022-salmo-119-1-8/", "/luz-da-vida/não-ande-ansioso/", "/luz-da-vida/parábola-da-grande-ceia-lucas-14-15-24/", "/luz-da-vida/protegidos-na-tempestades-mt-14-22-33/", "/luz-da-vida/os-que-olham-para-o-chão-lucas-13-10-13/", "/luz-da-vida/deus-nos-dá-mais-uma-oportunidade/", "/luz-da-vida/aproveitando-bem-o-tempo/", "/luz-da-vida/anda-na-minha-presença-e-sê-perfeito-gn-17-1/", "/luz-da-vida/uma-nova-vida-em-cristo-2-co-5-17/", "/luz-da-vida/últimos-dias-1-tm-4-1-2/", "/luz-da-vida/transformando-pedras-em-pães-mateus-4-1-11/", "/luz-da-vida/debaixo-da-figueira/", "/baixar-minha-historia/", "/luz-da-vida/e-se-amanhã-não-der-tempo-lucas-16-19-31/", "/parceiros/", "/luz-da-vida/testemunho-de-conversão-do-ex-padre-nivaldo-lisboa-soares-de-governador-valadares-mg/", "/luz-da-vida/o-senhor-pelejará-por-nós-êxodo-14-14/", "/luz-da-vida/mulheres-aos-pés-de-jesus-lucas-10-38-42/", "/luz-da-vida/o-sono-e-a-queda-de-eutico/", "/luz-da-vida/incredulidade-e-fé/", "/luz-da-vida/o-caminho-de-deus-para-uma-família-feliz-joão-2-1-11/", "/luz-da-vida/o-cego-que-recebeu-a-visão-marcos-10-46-52/", "/luz-da-vida/veredas-antigas-jeremias-6-26/", "/luz-da-vida/éfeso-sem-amor-por-jesus/", "/luz-da-vida/propostas-de-faraó-ex-8-25/", "/luz-da-vida/a-necessidade-de-nascer-de-novo/", "/luz-da-vida/a-fé-do-cego-de-jericó-marcos-10-46-52/", "/luz-da-vida/duas-multidões-lucas-7-11-15/", "/luz-da-vida/aproveitando-bem-o-tempo-ef-5-15-17/", "/luz-da-vida/quando-perdemos-a-jesus-lucas-2-42-46/", "/luz-da-vida/dia-dos-pais-dia-de-reflexão-lucas-15-11-24/", "/luz-da-vida/exemplo-de-gratidão-lucas-17-11-19/", "/luz-da-vida/a-alma-farta-pisa-o-favo-de-mel-provérbios-27-7/", "/luz-da-vida/sete-promessas-de-deus-isaías-41-10/", "/luz-da-vida/os-dois-fundamentos/", "/styles.css"];
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
