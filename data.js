/* Shared data layer: Supabase calls, team code + nickname, coach sign-in, offline cache, small UI helpers.
   Players call team-code-protected pa_* functions; the coach calls coach-only pa_* functions with a sign-in token. */
/* App updates reach every phone by themselves: check for a new version whenever the app comes back on screen
   (and every 30 min), then refresh into it as soon as nobody is mid-edit. Drafts are saved on the phone, so nothing is lost. */
(()=>{
  if(!('serviceWorker' in navigator)) return;
  const had=!!navigator.serviceWorker.controller;                  // first visit: no refresh needed
  const busy=()=>!!document.querySelector('dialog[open]')||!!document.querySelector('#ov.editing')||
                 (document.activeElement&&/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
  let pending=false;
  const refresh=()=>{ if(busy()){ pending=true; return; } try{ sessionStorage.setItem('pa_updated','1'); }catch(e){} location.reload(); };
  navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(had&&!pending) refresh(); });
  setInterval(()=>{ if(pending&&!busy()){ pending=false; refresh(); } },3000);
  navigator.serviceWorker.register('sw.js').then(reg=>{
    const check=()=>reg.update().catch(()=>{});
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') check(); });
    setInterval(check,30*60*1000);
  }).catch(()=>{});
  addEventListener('load',()=>{ try{ if(sessionStorage.getItem('pa_updated')){ sessionStorage.removeItem('pa_updated'); setTimeout(()=>PA.toast('Updated to the latest version',3000),400); } }catch(e){} });
})();

const PA=(()=>{
  const C=window.PA_CONFIG||{};
  const configured=!!(C.supabaseUrl&&C.supabaseAnonKey&&!/YOUR-/.test(C.supabaseUrl+C.supabaseAnonKey));
  const store={
    get(k,d){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
    set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} },
    del(k){ try{ localStorage.removeItem(k); }catch(e){} }
  };
  const code=()=>store.get('pa_code',''), nick=()=>store.get('pa_nick','');
  const mine=()=>store.get('pa_mine',[]);                                  // ids of ideas this device submitted

  async function call(path,body,token){
    if(!configured) throw new Error('App not connected yet: fill in config.js (see COACH_SETUP.md).');
    const r=await fetch(C.supabaseUrl.replace(/\/$/,'')+path,{method:'POST',cache:'no-store',
      headers:{apikey:C.supabaseAnonKey,Authorization:'Bearer '+(token||C.supabaseAnonKey),'Content-Type':'application/json'},body:JSON.stringify(body||{})});
    const t=await r.text(); let j=null; try{ j=t?JSON.parse(t):null; }catch(e){}
    if(!r.ok){ const e=new Error((j&&(j.message||j.error_description||j.msg))||('Server error '+r.status)); e.status=r.status; e.code=j&&j.code; throw e; }
    return j;
  }
  const rpc=(fn,args)=>call('/rest/v1/rpc/'+fn,args);
  // Postgres error 28000 = access refused (wrong team code / coach sign-in needed); Supabase returns it as HTTP 403
  const badCode=e=>!!e&&e.code==='28000'&&/team code/i.test(e.message);
  const coachRpc=async(fn,args)=>call('/rest/v1/rpc/'+fn,args,await coachToken());

  /* ---- coach sign-in (Supabase Auth, email + password) ---- */
  async function login(email,password){
    const s=await call('/auth/v1/token?grant_type=password',{email,password});
    store.set('pa_session',{access:s.access_token,refresh:s.refresh_token,exp:Date.now()+s.expires_in*1000,email:(s.user&&s.user.email)||email}); return s;
  }
  async function coachToken(){
    const s=store.get('pa_session'); if(!s) { const e=new Error('Coach sign-in required'); e.status=401; throw e; }
    if(Date.now()<s.exp-60000) return s.access;
    const n=await call('/auth/v1/token?grant_type=refresh_token',{refresh_token:s.refresh});
    store.set('pa_session',{...s,access:n.access_token,refresh:n.refresh_token,exp:Date.now()+n.expires_in*1000}); return n.access_token;
  }
  const logout=()=>store.del('pa_session'), coachEmail=()=>(store.get('pa_session')||{}).email;

  /* ---- plays: {fmt:[play,...]} sorted by number; cached for offline ---- */
  // every play drawn in the app goes through norm(): tolerate plays saved without routes / ball
  const norm=p=>{ if(p&&typeof p==='object'){ p.players=p.players||{}; p.routes=p.routes||{}; p.ball=Array.isArray(p.ball)?p.ball:[]; } return p; };
  const group=rows=>{ const by={}; for(const r of rows){ (by[r.fmt]=by[r.fmt]||[]).push(norm(r.data)); } for(const k in by) by[k].sort((a,b)=>a.n-b.n); return by; };
  async function loadPlays(){
    try{ const by=group(await rpc('pa_plays',{code:code()})); store.set('pa_cache',by); return {by,fresh:true}; }
    catch(e){ const by=store.get('pa_cache'); if(by && !badCode(e)) return {by,fresh:false,error:e}; throw e; }
  }
  async function coachPlays(){ return group(await coachRpc('pa_coach_plays')); }

  /* ---- ideas ---- */
  const ideas=async()=>(await rpc('pa_proposals',{code:code(),mine:mine(),me:nick()})).map(x=>(norm(x.play),x));
  async function propose(fmt,kind,target_n,play,message){
    const id=await rpc('pa_propose',{code:code(),author:nick(),fmt,kind,target_n,play,message});
    store.set('pa_mine',[...mine(),id].slice(-100)); return id;
  }
  // schedule: games for both teams, cached for offline
  async function games(){
    try{ const g=await rpc('pa_games',{code:code()}); store.set('pa_games_cache',g); return g; }
    catch(e){ const g=store.get('pa_games_cache'); if(g&&!badCode(e)) return g; throw e; } }
  const isUs=name=>/^packers\b/i.test(name||'');                           // our team is listed as "Packers Barber"
  const comments=pid=>rpc('pa_comments',{code:code(),pid});
  const comment=(pid,body)=>rpc('pa_comment',{code:code(),pid,author:nick(),body});
  const vote=(pid,v)=>rpc('pa_vote',{code:code(),pid,voter:nick(),vote:v});

  /* ---- helpers ---- */
  const band=plays=>plays.filter(p=>p.status!=='spare'&&p.side!=='D');   // the 24 offensive wristband plays
  const defense=plays=>plays.filter(p=>p.side==='D');                    // the 8 defenses (plays 51-58)
  const recent=(p,days)=>p.updated && (Date.now()-Date.parse(p.updated))<days*864e5;
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function toast(msg,ms){ const t=document.createElement('div'); t.className='toast'; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),ms||2600); }
  const ago=iso=>{ const s=(Date.now()-Date.parse(iso))/1000; return s<90?'just now':s<5400?Math.round(s/60)+' min ago':s<129600?Math.round(s/3600)+' h ago':Math.round(s/86400)+' days ago'; };
  // animate a play inside el (pinned view); returns a stop() function
  function animate(el,play,opt){ opt=opt||{}; const T=PB.timeline(play), vb=PB.viewBox(play,1.3), t0=performance.now(); let raf=0, dead=false;
    const step=now=>{ if(dead) return; const t=(now-t0)/1000*(opt.speed||1); el.innerHTML=PB.animSVG(play,T,Math.min(t,T.dur),{aspect:1.3,vb});
      if(t<T.dur) raf=requestAnimationFrame(step); else setTimeout(()=>{ if(!dead){ el.innerHTML=PB.staticSVG(play,{aspect:1.3}); opt.done&&opt.done(); } },700); };
    raf=requestAnimationFrame(step); return ()=>{ dead=true; cancelAnimationFrame(raf); el.innerHTML=PB.staticSVG(play,{aspect:1.3}); }; }
  // player-facing flow: make sure we have a working team code (and nickname when needed)
  async function join(needNick){
    if(code() && (!needNick||nick())) return true;
    return new Promise(res=>{
      const d=document.createElement('dialog'); d.className='join';
      d.innerHTML=`<h2>Join the team</h2><p>Ask your coach for the team code.</p>
        <label>TEAM CODE</label><input id=jc autocapitalize=characters autocomplete=off value="${esc(code())}">
        <label>YOUR NICKNAME ${needNick?'':'<span style="font-weight:400">(for ideas and votes)</span>'}</label><input id=jn maxlength=24 autocomplete=off value="${esc(nick())}" placeholder="first name or jersey #">
        <div id=jm style="color:var(--warn);font:700 13px sans-serif;min-height:18px;margin-top:8px"></div>
        <div class=row><button class="btn gold" id=jgo>Join</button></div>`;
      document.body.appendChild(d); d.showModal(); d.addEventListener('cancel',e=>e.preventDefault());
      d.querySelector('#jgo').onclick=async()=>{ const c=d.querySelector('#jc').value.trim(), n=d.querySelector('#jn').value.trim(), m=d.querySelector('#jm');
        if(needNick&&!n){ m.textContent='Add a nickname'; return; }
        m.style.color='var(--g)'; m.textContent='Checking…';
        try{ await rpc('pa_plays',{code:c}); store.set('pa_code',c); if(n) store.set('pa_nick',n); d.close(); d.remove(); res(true); }
        catch(e){ m.style.color='var(--warn)'; m.textContent=badCode(e)?'That team code is not right.':e.message; } };
    });
  }
  const CATS=[['throw','THROW'],['run','RUN'],['redzone','RED ZONE'],['trick','TRICK']];
  const SUBS=['VS MAN','VS ZONE','VS RUSH','SHORT YARDAGE','OPEN FIELD','GOAL LINE'];
  const DCATS=[['throw','VS PASS'],['run','VS RUN'],['redzone','RED ZONE'],['trick','TRICK / DISGUISE']];   // defense: color = what it stops
  const DSUBS=['VS LONG THROWS','VS SHORT PASSES','VS RUNS','VS FAKE HAND-OFFS','RED ZONE','3RD DOWN'];
  const catsFor=p=>p&&p.side==='D'?DCATS:CATS, subsFor=p=>p&&p.side==='D'?DSUBS:SUBS;
  const catOf=p=>CATS.some(c=>c[0]===p.cat)?p.cat:'throw';
  const legend=(d)=>(d?DCATS:CATS).map(([v,l])=>`<span><i class="cat-${v}"></i>${l}</span>`).join('')+(d?'<span>P PUNCH · S / F SAFETY · M MIDDLE · B BACKER · L / K CORNERS</span>':'');
  // shrink a one-line label until it fits (min size), then ellipsis
  function fit(el,max,min){ let s=max; el.style.fontSize=s+'px'; while(el.scrollWidth>el.clientWidth+0.5&&s>min){ s-=0.5; el.style.fontSize=s+'px'; } }
  return {defense,DCATS,DSUBS,catsFor,subsFor,games,isUs,badCode,norm,CATS,SUBS,catOf,legend,fit,configured,store,code,nick,mine,rpc,coachRpc,login,logout,coachEmail,loadPlays,coachPlays,ideas,propose,comments,comment,vote,band,recent,esc,toast,ago,animate,join};
})();
