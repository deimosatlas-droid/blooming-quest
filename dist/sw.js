/* Optional offline browser play; source and assets remain ordinary static files. */
'use strict';
importScripts('./offline-files.js');
const files=self.BLOOM_OFFLINE_FILES||[],scope=new URL(self.registration.scope);
const PREFIX='blooming-quest-offline:'+encodeURIComponent(scope.pathname)+':',CACHE=PREFIX+self.BLOOM_RELEASE;
function keyFor(url){const key=new URL(url);key.search='';key.hash='';if(key.pathname.endsWith('/'))key.pathname+='index.html';return key.href;}
async function gameWindows(){return(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(client=>client.url.startsWith(scope.href));}
function reply(event,data){event.ports?.[0]?.postMessage(data);}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{
    // A new cache is never activated until every local file has downloaded.
    // A failed update leaves the previous playable version intact.
    const entries=await Promise.all(files.map(async path=>{
      const url=new URL(path,scope),response=await fetch(new Request(url.href,{cache:'reload',credentials:'same-origin'}));
      if(!response.ok||response.type==='opaque'||response.redirected&&new URL(response.url).origin!==scope.origin)throw Error('Offline download failed: '+path);
      return[url.href,response];
    }));
    for(const[url,response]of entries)await cache.put(url,response);
    for(const client of await gameWindows())client.postMessage({type:'BLOOM_OFFLINE_READY',version:self.BLOOM_RELEASE});
  }catch(error){await caches.delete(CACHE);throw error;}
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  // Updates only activate on the user's request with other game tabs closed.
  for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='BLOOM_CAN_UPDATE')event.waitUntil((async()=>reply(event,{allowed:(await gameWindows()).length<=1}))());
  if(event.data?.type==='BLOOM_APPLY_UPDATE')event.waitUntil((async()=>{
    if((await gameWindows()).length>1){reply(event,{accepted:false,reason:'other-tabs'});return;}
    reply(event,{accepted:true});await self.skipWaiting();
  })());
  if(event.data?.type==='BLOOM_OFFLINE_STATUS')reply(event,{ready:true,version:self.BLOOM_RELEASE});
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==scope.origin||!url.href.startsWith(scope.href)||url.pathname.endsWith('/sw.js')||url.pathname.endsWith('/offline-files.js'))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE),cached=await cache.match(keyFor(url));
    if(cached)return cached;
    try{return await fetch(request);}
    catch(error){if(request.mode==='navigate'){const fallback=await cache.match(new URL('offline.html',scope).href);if(fallback)return fallback;}throw error;}
  })());
});
