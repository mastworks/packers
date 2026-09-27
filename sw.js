const V='pa-2e80b45d5b',SHELL=['./','index.html','coach.html','print.html','edit.html','idea.html','data.js','editor.js','rules.js','theme.css','pb.js','config.js','manifest.webmanifest','icons/icon-180.png','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});   // 'reload': never install stale copies from the browser's HTTP cache
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{ if(e.request.method!=='GET')return; const u=new URL(e.request.url); if(u.origin!==location.origin)return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request))); });
