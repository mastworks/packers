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
  const ideas=async()=>(await rpc('pa_proposals',{code:code(),mine:mine(),me:(player()||{}).id||''})).map(x=>(norm(x.play),x));
  async function propose(fmt,kind,target_n,play,message){
    const me=player(fmt); if(!me) throw new Error('Only players on the roster can send ideas');
    const id=await rpc('pa_propose',{code:code(),member:me.id,token:me.token,fmt,kind,target_n,play,message});
    store.set('pa_mine',[...mine(),id].slice(-100)); return id;
  }
  // schedule: games for both teams, cached for offline
  async function games(){
    try{ const g=await rpc('pa_games',{code:code()}); store.set('pa_games_cache',g); return g; }
    catch(e){ const g=store.get('pa_games_cache'); if(g&&!badCode(e)) return g; throw e; } }
  const isUs=name=>/^packers\b/i.test(name||'');                           // our team is listed as "Packers Barber"
  const comments=pid=>rpc('pa_comments',{code:code(),pid});
  const comment=(pid,body)=>{ const me=player(); if(!me) return Promise.reject(new Error('Only players can comment')); return rpc('pa_comment',{code:code(),member:me.id,token:me.token,pid,body}); };
  const vote=(pid,v)=>{ const me=player(); if(!me) return Promise.reject(new Error('Only players can vote')); return rpc('pa_vote',{code:code(),member:me.id,token:me.token,pid,vote:v}); };

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
  /* ---- roles: PLAYER phones hold roster spots {id, token, name, fmt}; PARENT phones hold links to a child {member_id, token, child, fmt};
         COACH = the coach account (sign-in), never on the roster; FAN = view only ---- */
  const COACH_EMAIL='andrewbarbernyc@gmail.com';
  const members=()=>store.get('pa_members',[]), links=()=>store.get('pa_links',[]);
  const role=()=>store.get('pa_role', members().length?'player':(links().length||store.get('pa_roster_skip')?'parent':'')), isParent=()=>role()==='parent'||role()==='fan';
  const player=fmt=>members().find(m=>!fmt||m.fmt===fmt)||members()[0];
  async function joinRoster(fmt,name){
    const m=await rpc('pa_join',{code:code(),fmt,name});
    store.set('pa_members',[...members().filter(x=>x.id!==m.id),m]); store.set('pa_role','player'); if(!nick()) store.set('pa_nick',m.name); return m;
  }
  async function linkChild(memberId,email){
    const g=await rpc('pa_guardian_join',{code:code(),member:memberId,email:email||null});
    store.set('pa_links',[...links().filter(x=>x.member_id!==g.member_id),{...g,email:email||''}]); store.set('pa_role','parent'); return g;
  }
  const tokenFor=memberId=>{ const m=members().find(x=>x.id===memberId), g=links().find(x=>x.member_id===memberId); return (m&&m.token)||(g&&g.token)||null; };
  const roster=()=>rpc('pa_roster',{code:code()});
  const attendance=()=>rpc('pa_attendance',{code:code()});
  const canAnswer=memberId=>!!tokenFor(memberId);
  function setAtt(memberId,gameId,status,note){
    const tok=tokenFor(memberId);
    return tok ? rpc('pa_set_attendance',{code:code(),member:memberId,token:tok,game:gameId,status,note:note||null})
               : coachRpc('pa_coach_set_attendance',{member:memberId,game:gameId,status});
  }
  const myNotes=memberId=>rpc('pa_my_notes',{code:code(),member:memberId,token:tokenFor(memberId)});
  const announcements=()=>rpc('pa_announcements',{code:code()});
  // private thread with Coach (player's phone or a linked parent's phone)
  const threadIds=()=>[...new Set([...members().map(m=>m.id),...links().map(l=>l.member_id)])];
  const threadName=id=>{ const m=members().find(x=>x.id===id); if(m) return m.name; const l=links().find(x=>x.member_id===id); return l?l.child:''; };
  const thread=memberId=>rpc('pa_thread',{code:code(),member:memberId,token:tokenFor(memberId)});
  const send=(memberId,body)=>rpc('pa_send',{code:code(),member:memberId,token:tokenFor(memberId),body});
  const setMyEmail=(memberId,email)=>rpc('pa_guardian_email',{code:code(),member:memberId,token:tokenFor(memberId),email:email||null})
    .then(()=>store.set('pa_links',links().map(l=>l.member_id===memberId?{...l,email:email||''}:l)));
  const practiceData=()=>rpc('pa_practice',{code:code()});
  /* in-app dialogs: the browser's own alert / confirm / prompt boxes show the web address as their title, so the app never uses them */
  function dlg(msg,{input=null,cancel=false,ok='OK'}={}){
    return new Promise(res=>{
      const d=document.createElement('dialog'); d.id='paDlg'; d.className='padlg';
      d.innerHTML=`<p>${esc(msg).replace(/\n/g,'<br>')}</p>${input!==null?`<input id=paDlgIn autocomplete=off value="${esc(input)}">`:''}<div class=row>${cancel?'<button class="btn ghost" id=paDlgCancel>Cancel</button>':''}<button class="btn gold" id=paDlgOk>${ok}</button></div>`;
      document.body.appendChild(d); d.showModal(); const inp=d.querySelector('#paDlgIn'); if(inp){ inp.focus(); inp.select(); }
      const done=v=>{ d.close(); d.remove(); res(v); };
      d.querySelector('#paDlgOk').onclick=()=>done(input!==null?inp.value:true);
      const c=d.querySelector('#paDlgCancel'); if(c) c.onclick=()=>done(input!==null?null:false);
      if(inp) inp.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); done(inp.value); } };
      d.addEventListener('cancel',e=>{ e.preventDefault(); if(cancel) done(input!==null?null:false); });
    });
  }
  const say=msg=>dlg(msg), ask=msg=>dlg(msg,{cancel:true,ok:'Yes'}), input=(msg,def)=>dlg(msg,{input:def==null?'':String(def),cancel:true});
  const okEmail=e=>!!e&&e.length<=254&&/^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e);   // same rule as the database
  // Coach's emails always open in Gmail as the team address (a mailto: link would use whatever Mail account the phone has)
  const gmail=(bcc,subject,body)=>'https://mail.google.com/mail/?authuser='+encodeURIComponent(COACH_EMAIL)+'&view=cm&fs=1&tf=1'
    +(bcc&&bcc.length?'&bcc='+encodeURIComponent(bcc.join(',')):'')+'&su='+encodeURIComponent(subject||'')+'&body='+encodeURIComponent(body||'');

  // first-time setup: PLAYER (name + team → roster spot) · PARENT / FAN (view; optional link to a child + optional email) · COACH (sign-in)
  function setupDialog(withCode,fmtDefault,startRole){
    return new Promise(res=>{
      const d=document.createElement('dialog'); d.className='join'; document.body.appendChild(d);
      let fmt=fmtDefault==='6v6'?'6v6':'5v5', who=startRole||'';
      const m=()=>d.querySelector('#jm'), done=v=>{ d.close(); d.remove(); res(v); };
      const teamSeg=()=>`<label>TEAM</label><div class=seg id=jt style="background:#e9eeec"><button type=button data-f=5v5 class="${fmt==='5v5'?'on':''}">5V5</button><button type=button data-f=6v6 class="${fmt==='6v6'?'on':''}">6V6 SENIOR</button></div>`;
      const codeField=()=>withCode?`<label>TEAM CODE</label><input id=jc autocapitalize=characters autocomplete=off value="${esc(code())}" placeholder="ask your coach">`:'';
      const msg='<div id=jm style="color:var(--warn);font-size:13px;min-height:18px;margin-top:8px"></div>';
      function paint(){
        if(!who){ d.innerHTML=`<h2>Welcome to Packer Army</h2><p>Who is using this phone?</p>
          <div class=row style="flex-direction:column"><button class="btn gold" data-who=player>I'M A PLAYER</button><button class="btn" data-who=parent>I'M A PARENT / FAN</button><button class="btn ghost" data-who=coach>I'M THE COACH</button></div>`; return; }
        if(who==='player') d.innerHTML=`<h2>Player setup</h2><p>Your name goes on the team roster so you can say if you're coming to each game and message Coach.</p>${codeField()}
          <label>YOUR NAME</label><input id=jn maxlength=24 autocomplete=off placeholder="first name (add a last initial if needed)">${teamSeg()}${msg}
          <div class=row><button class="btn ghost" id=jback>Back</button><button class="btn gold" id=jgo>Join</button></div>`;
        else if(who==='coach') d.innerHTML=`<h2>Coach</h2><p>Enter the team code, then sign in with the coach account. Coaches are not added to the player roster.</p>${codeField()}${msg}
          <div class=row><button class="btn ghost" id=jback>Back</button><button class="btn gold" id=jgo>Next: sign in</button></div>`;
        else d.innerHTML=`<h2>Parent / fan</h2><p>You can view everything. Link your child to answer attendance and message Coach.</p>${codeField()}
          ${teamSeg()}<label>YOUR CHILD <span style="font-weight:400">(optional; they must have joined first)</span></label><select class=f id=jchild><option value="">— just watching —</option></select>
          <label>YOUR EMAIL <span style="font-weight:400">(optional; for emails from Coach, only Coach sees it)</span></label><input type=email id=je autocomplete=email autocapitalize=off>${msg}
          <div class=row><button class="btn ghost" id=jback>Back</button><button class="btn gold" id=jgo>Done</button></div>`;
      }
      async function fillChildren(){ const sel=d.querySelector('#jchild'); if(!sel||!code()) return;
        try{ const r=await roster(), keep=sel.value; sel.innerHTML='<option value="">— just watching —</option>'+r.filter(x=>x.fmt===fmt&&x.kind==='player').map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
          if(keep&&[...sel.options].some(o=>o.value===keep)) sel.value=keep; }catch(e){} }   // a refresh never undoes the parent's pick
      async function checkCode(){ if(!withCode) return true; const c=d.querySelector('#jc').value.trim();
        try{ await rpc('pa_plays',{code:c}); store.set('pa_code',c); return true; }catch(e){ m().style.color='var(--warn)'; m().textContent=badCode(e)?'That team code is not right.':e.message; return false; } }
      d.onclick=async e=>{
        const w=e.target.closest('[data-who]'); if(w){ who=w.dataset.who; if(who==='coach'&&!withCode){ store.set('pa_role','coach'); return done('coach'); } paint(); if(who==='parent'&&code()) fillChildren(); return; }
        const f=e.target.closest('#jt [data-f]'); if(f){ fmt=f.dataset.f; d.querySelectorAll('#jt button').forEach(b=>b.classList.toggle('on',b.dataset.f===fmt)); if(who==='parent') fillChildren(); return; }
        if(e.target.id==='jback'){ who=''; paint(); return; }
        if(e.target.id!=='jgo') return;
        m().style.color='var(--g)'; m().textContent='Checking…'; if(!await checkCode()) return;
        try{
          if(who==='player'){ const n=d.querySelector('#jn').value.trim(); if(!n) throw new Error('Enter your name');
            const mem=await joinRoster(fmt,n); store.set('pa_nick',mem.name); done(mem); }
          else if(who==='coach'){ store.set('pa_role','coach'); done('coach'); }
          else { const child=d.querySelector('#jchild').value, em=(d.querySelector('#je').value||'').trim();
            if(em&&!okEmail(em)) throw new Error('That email does not look right (or leave it empty)');
            store.set('pa_role',child?'parent':'fan'); if(child) await linkChild(child,em); done('parent'); }
        }catch(err){ m().style.color='var(--warn)'; m().textContent=err.message; }
      };
      let tmr=null;   // parent: fill the child list as soon as the typed code is right (no need to leave the field)
      d.addEventListener('input',e=>{ if(e.target.id!=='jc'||who!=='parent') return; clearTimeout(tmr); const c=e.target.value.trim(); if(c.length<4) return;
        tmr=setTimeout(async()=>{ try{ await rpc('pa_plays',{code:c}); store.set('pa_code',c); m().textContent=''; fillChildren(); }catch(err){} },450); });
      d.addEventListener('change',async e=>{ if(e.target.id==='jc'&&who==='parent'){ if(await checkCode()) fillChildren(); } });
      paint(); d.showModal(); d.addEventListener('cancel',e=>e.preventDefault());
    });
  }
  function codeOnlyDialog(){   // already set up (e.g. after Coach changes the team code): ask only for the code
    return new Promise(res=>{
      const d=document.createElement('dialog'); d.className='join';
      d.innerHTML=`<h2>New team code</h2><p>Coach changed the team code. Ask Coach and enter it once.</p><label>TEAM CODE</label><input id=jc autocapitalize=characters autocomplete=off>
        <div id=jm style="color:var(--warn);font-size:13px;min-height:18px;margin-top:8px"></div><div class=row><button class="btn gold" id=jgo>OK</button></div>`;
      document.body.appendChild(d); d.showModal(); d.addEventListener('cancel',e=>e.preventDefault());
      d.querySelector('#jgo').onclick=async()=>{ const c=d.querySelector('#jc').value.trim();
        try{ await rpc('pa_plays',{code:c}); store.set('pa_code',c); d.close(); d.remove(); res(true); }catch(e){ d.querySelector('#jm').textContent=badCode(e)?'That team code is not right.':e.message; } };
    });
  }
  let setupResult=null;
  async function join(needPlayer){
    if(window.PA_INTRO) await window.PA_INTRO;
    if(!code()){ if(role()) await codeOnlyDialog(); else setupResult=await setupDialog(true,store.get('pa_fmt')); }
    if(needPlayer&&!members().length){ say(isParent()||role()==='coach'?'Only players can send ideas, vote or comment.':'Join the roster as a player first (Schedule → + ADD A PLAYER ON THIS PHONE).'); return false; }
    return true;
  }
  const lastSetup=()=>{ const r=setupResult; setupResult=null; return r; };
  const addPlayer=(fmt)=>setupDialog(false,fmt,'player');
  const addChildLink=(fmt)=>setupDialog(false,fmt,'parent');
  const setup=(fmt)=>setupDialog(false,fmt);
  const CATS=[['throw','THROW'],['run','RUN'],['redzone','RED ZONE'],['trick','TRICK']];
  const SUBS=['VS MAN','VS ZONE','VS RUSH','SHORT YARDAGE','OPEN FIELD','GOAL LINE'];
  const DCATS=[['throw','VS PASS'],['run','VS RUN'],['redzone','RED ZONE'],['trick','TRICK / DISGUISE']];   // defense: color = what it stops
  const DSUBS=['VS LONG THROWS','VS SHORT PASSES','VS RUNS','VS FAKE HAND-OFFS','RED ZONE','3RD DOWN'];
  const catsFor=p=>p&&p.side==='D'?DCATS:CATS, subsFor=p=>p&&p.side==='D'?DSUBS:SUBS;
  const catOf=p=>CATS.some(c=>c[0]===p.cat)?p.cat:'throw';
  const legend=(d)=>(d?DCATS:CATS).map(([v,l])=>`<span><i class="cat-${v}"></i>${l}</span>`).join('')+(d?'<span>S1 S2 SAFETIES · F1 F2 FLATS · R1 RUSHER · 6V6: R2 / F3 / S3 (BY JOB)</span>':'');
  // shrink a one-line label until it fits (min size), then ellipsis
  function fit(el,max,min){ let s=max; el.style.fontSize=s+'px'; while(el.scrollWidth>el.clientWidth+0.5&&s>min){ s-=0.5; el.style.fontSize=s+'px'; } }
  return {say,ask,input,lastSetup,tokenFor,myNotes,threadIds,threadName,thread,send,setMyEmail,practiceData,gmail,COACH_EMAIL,links,role,isParent,player,canAnswer,linkChild,announcements,addChildLink,setup,okEmail,members,joinRoster,roster,attendance,setAtt,addPlayer,defense,DCATS,DSUBS,catsFor,subsFor,games,isUs,badCode,norm,CATS,SUBS,catOf,legend,fit,configured,store,code,nick,mine,rpc,coachRpc,login,logout,coachEmail,loadPlays,coachPlays,ideas,propose,comments,comment,vote,band,recent,esc,toast,ago,animate,join};
})();
