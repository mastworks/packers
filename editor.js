/* Drag editor shared by the player app, the coach page and the idea page.
   const ed=PlayEditor(rootEl,{onChange}); ed.load(play,key); ed.get(); ed.undo(); ed.canUndo()
   Modes: Move   — drag a player; their whole route comes along
          Routes — drag route dots; drag a segment's middle handle to bend/stretch it; curve or kink any dot;
                   turn / lengthen the whole route; arrow, dotted (ball carried), motion, timing, draw / clear
          Ball   — the ball plan (pass / hand-off, who, where, backup receivers); drag a football onto any route */
function PlayEditor(root,opt){
  opt=opt||{};
  const ASP=1.3, SNAP=0.1, clone=o=>JSON.parse(JSON.stringify(o)), round=v=>Math.round(v*100)/100, snap=v=>round(Math.round(v/SNAP)*SNAP);
  const DELAYS=[0,0.3,0.6,1], SPEEDS=[['slow',0.8],['normal',1],['fast',1.2]];
  root.classList.add('ed');
  root.innerHTML=`
  <div class=ed-stage></div>
  <div class=ed-hint></div>
  <div class=ed-modes><button class=btn data-m=move>Move</button><button class=btn data-m=route>Routes</button><button class=btn data-m=ball>Ball</button><button class=btn data-a=anim>▶ Play</button></div>
  <div class="ed-tools" data-for=route>
    <div class=ed-chips></div>
    <div class=ed-row><button class=btn data-a=add>+ Point</button><button class=btn data-a=del>− Point</button><button class=btn data-a=curve>Curve</button></div>
    <div class=ed-row><button class=btn data-a=rotl>↺ Turn</button><button class=btn data-a=rotr>↻ Turn</button><button class=btn data-a=shorter>Shorter</button><button class=btn data-a=longer>Longer</button></div>
    <div class=ed-row><button class=btn data-a=arrow>Arrow</button><button class=btn data-a=dot>Dotted from dot</button><button class=btn data-a=motion>Motion to dot</button><button class=btn data-a=clear>Clear</button></div>
    <div class="ed-row ed-time"><label>STARTS</label><select class=f data-r=delay></select><label>SPEED</label><select class=f data-r=spd></select></div>
  </div>
  <div class="ed-tools" data-for=ball><div class=ed-plan></div><button class="btn ghost" data-a=addev>+ Add another pass / hand-off</button></div>
  <fieldset>
    <label>PLAY NAME</label><input data-f=name autocomplete=off maxlength=80>
    <div class=ed-2col><div><label>TYPE (CARD COLOR)</label><select class=f data-f=cat></select></div><div><label>BEST USED</label><select class=f data-f=sub></select></div></div>
    <label>CARD NOTES (the 2 short lines on the card)</label><input data-f=cue autocomplete=off maxlength=60>
    <label>STAR (FIRST BALL OPTION)</label><select class=f data-f=star></select>
    <label>MORE NOTES (shown in full screen)</label><textarea data-f=note maxlength=400></textarea>
  </fieldset>`;
  const $=s=>root.querySelector(s), stage=$('.ed-stage');
  let play=null, key='', mode='move', selK=null, selPt=null, selEv=0, drag=null, vbLock=null, curVB=null, stopA=null;
  const stacks={};                                         // undo history per play key
  const stack=()=>stacks[key]||(stacks[key]=[]);
  const push=()=>{ const s=stack(); s.push(JSON.stringify(play)); if(s.length>80) s.shift(); };
  const changed=()=>{ render(); ui(); opt.onChange&&opt.onChange(play); };
  const toast=m=>(window.PA&&PA.toast)?PA.toast(m):alert(m);
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

  /* ---------- ball helpers: an event is {pass|give: player, v?: route dot, alt?: [{pass, v?}]} ---------- */
  const evTo=e=>e.give||e.pass;
  const holderBefore=i=>{ let h='Q'; for(let j=0;j<i;j++) h=evTo(play.ball[j]); return h; };
  const ptsOf=k=>(play.routes[k]&&play.routes[k].pts)||[play.players[k]];
  const catchPt=e=>{ const p=ptsOf(evTo(e)); const i=(e.v==null||e.v>=p.length)?p.length-1:e.v; return p[i]; };
  const balls=()=>{ const out=[]; (play.ball||[]).forEach((e,i)=>{ out.push({ev:i,alt:-1,x:e,pos:catchPt(e)}); (e.alt||[]).forEach((a,j)=>out.push({ev:i,alt:j,x:a,pos:catchPt(a)})); }); return out; };
  // the star marks the first ball option: if it pointed at the old first receiver, move it with the ball
  function followStar(e,to){ if(play.ball[0]===e && play.star && play.star===evTo(e)) play.star=to; }

  /* ---------- drawing ---------- */
  function overlay(vb){
    const sc=vb.h/8, R=(x,y,r,st,dash,fill)=>`<circle cx="${x}" cy="${-y}" r="${r*sc}" fill="${fill||'none'}" stroke="${st}" stroke-width="${0.07*sc}" ${dash?`stroke-dasharray="${0.12*sc} ${0.1*sc}"`:''}/>`;
    let s='';
    if(mode==='move') for(const k in play.players){ const [x,y]=play.players[k]; s+=R(x,y,0.7,'#FFB612',true); }
    if(mode==='route' && selK && play.players[selK]){
      const [x,y]=play.players[selK]; s+=R(x,y,0.72,'#FFB612');
      const r=play.routes[selK];
      if(r){ const sh=PB.shape(r), sm=new Set(r.smooth||[]), col=PB.COL[selK];
        for(let i=0;i<r.pts.length-1;i++){ const q=sh.pts[Math.round((sh.map[i]+sh.map[i+1])/2)]||r.pts[i];   // middle of each segment: bend handle
          const m=sh.map[i+1]-sh.map[i]>1?q:[(r.pts[i][0]+r.pts[i+1][0])/2,(r.pts[i][1]+r.pts[i+1][1])/2], d=0.17*sc;
          s+=`<path d="M${m[0]} ${-m[1]-d}L${m[0]+d} ${-m[1]}L${m[0]} ${-m[1]+d}L${m[0]-d} ${-m[1]}Z" fill="${col}" fill-opacity=".35" stroke="#fff" stroke-width="${0.04*sc}"/>`; }
        r.pts.forEach((q,i)=>{ if(!i) return; const on=i===selPt, rr=(on?0.3:0.22)*sc;
          s+= sm.has(i) ? `<circle cx="${q[0]}" cy="${-q[1]}" r="${rr}" fill="${on?'#FFB612':'#fff'}" stroke="${col}" stroke-width="${0.08*sc}"/>`
                        : `<rect x="${q[0]-rr}" y="${-q[1]-rr}" width="${2*rr}" height="${2*rr}" rx="${0.04*sc}" fill="${on?'#FFB612':'#fff'}" stroke="${col}" stroke-width="${0.08*sc}"/>`; }); }
    }
    if(mode==='ball'){
      for(const k in play.routes) play.routes[k].pts.forEach((q,i)=>{ if(i) s+=`<circle cx="${q[0]}" cy="${-q[1]}" r="${0.13*sc}" fill="#fff" stroke="${PB.COL[k]}" stroke-width="${0.05*sc}"/>`; });
      for(const b of balls()) if(b.pos) s+=R(b.pos[0],b.pos[1],b.ev===selEv&&b.alt<0?0.55:0.42,'#FFB612',b.alt>=0);
      if(drag&&drag.kind==='ball'&&drag.at) s+=`<ellipse cx="${drag.at[0]}" cy="${-drag.at[1]}" rx="${0.42*sc}" ry="${0.27*sc}" fill="#8B4A2B" stroke="#FFB612" stroke-width="${0.06*sc}"/>`;
    }
    return s;
  }
  function render(){ if(!play) return; const vb=vbLock||PB.viewBox(play,ASP); curVB=vb;
    stage.innerHTML=PB.staticSVG(play,{aspect:ASP,vb}).replace(/<\/svg>$/,overlay(vb)+'</svg>'); }
  function ui(){
    root.querySelectorAll('.ed-modes [data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===mode));
    root.querySelectorAll('.ed-tools').forEach(t=>t.classList.toggle('show',t.dataset.for===mode));
    const ks=Object.keys(play.players);
    $('.ed-chips').innerHTML=ks.map(k=>`<button class="chip ${k===selK?'on':''}" data-k="${k}" style="background:${PB.COL[k]}">${k}</button>`).join('');
    const r=selK&&play.routes[selK], B=a=>$(`[data-a=${a}]`), mid=r&&selPt>=1&&selPt<r.pts.length-1;
    B('add').disabled=!selK; B('add').textContent=r?'+ Point':'Draw route';
    B('del').disabled=!(r&&selPt>=1&&r.pts.length>2);
    ['arrow','clear','rotl','rotr','shorter','longer','curve'].forEach(a=>B(a).disabled=!r);
    if(r){ const sm=new Set(r.smooth||[]), inner=r.pts.map((_,i)=>i).slice(1,-1);
      B('arrow').textContent=r.end==='none'?'Arrow: off':'Arrow: on';
      B('curve').textContent=mid?(sm.has(selPt)?'⌐ Kink dot':'〰 Curve dot'):(inner.length&&inner.every(i=>sm.has(i))?'⌐ Kink all':'〰 Curve all');
      B('curve').disabled=!inner.length; }
    B('dot').disabled=B('motion').disabled=!(r&&selPt>=1);
    if(r&&selPt>=1){ B('dot').textContent=r.dotFrom===selPt?'Dotted: off':'Dotted from dot'; B('motion').textContent=(r.motion&&r.motion[1]===selPt)?'Motion: off':'Motion to dot'; }
    // timing
    const dl=$('[data-r=delay]'), sp=$('[data-r=spd]'); dl.disabled=sp.disabled=!r;
    const d=r?(r.delay||0):0, base=selK==='Q'?2.3:2.9, f=r&&r.spd?r.spd/base:1;
    dl.innerHTML=(DELAYS.includes(d)?'':`<option value="${d}" selected>+${d}s</option>`)+DELAYS.map(v=>`<option value="${v}" ${v===d?'selected':''}>${v?'+'+v+'s':'at snap'}</option>`).join('');
    const nearest=SPEEDS.reduce((a,b)=>Math.abs(b[1]-f)<Math.abs(a[1]-f)?b:a);
    sp.innerHTML=SPEEDS.map(([l,v])=>`<option value="${v}" ${v===nearest[1]?'selected':''}>${l}</option>`).join('');
    // ball plan
    const plan=play.ball||[];
    $('.ed-plan').innerHTML=plan.length?plan.map((e,i)=>{ const to=evTo(e), from=holderBefore(i), pts=ptsOf(to);
      const opts=ks.filter(k=>k!==from).map(k=>`<option ${k===to?'selected':''}>${k}</option>`).join('');
      const at=`<option value="">end of route</option>`+pts.slice(1,-1).map((_,j)=>`<option value="${j+1}" ${e.v===j+1?'selected':''}>dot ${j+1}</option>`).join('');
      const alts=e.pass?`<div class=ed-alts>Also open: ${ks.filter(k=>k!==to&&k!==from).map(k=>`<button class="chip sm ${(e.alt||[]).some(a=>a.pass===k)?'on':''}" data-alt="${k}" data-i="${i}" style="background:${PB.COL[k]}">${k}</button>`).join('')}</div>`:'';
      return `<div class="ed-ev ${i===selEv?'on':''}" data-i="${i}"><b>${i+1}</b> <span>${from} →</span>
        <select class=f data-ev=type data-i="${i}"><option value=pass ${e.pass?'selected':''}>pass</option><option value=give ${e.give?'selected':''}>hand-off</option></select>
        <span>to</span><select class=f data-ev=to data-i="${i}">${opts}</select>
        <span>at</span><select class=f data-ev=at data-i="${i}">${at}</select><button class="btn x" data-ev=del data-i="${i}" aria-label="remove">×</button>${alts}</div>`; }).join('')
      :'<div class=ed-empty>No ball plan yet. Add a pass or hand-off, or tap a player.</div>';
    $('.ed-hint').textContent = mode==='move' ? 'Drag any player. Their whole route moves with them.'
      : mode==='route' ? (!selK ? 'Tap a player (or a colored button) to edit their route.'
          : r ? `Drag ${selK}'s dots to reshape (■ kink, ● curve). Drag a ◆ to bend that part of the line. Tap a dot to select it.` : `${selK} has no route. Tap "Draw route".`)
      : 'Drag a football onto any route to move the catch or hand-off spot, or tap a player / dot. Pick the step in the ball plan first.';
    const fl=n=>root.querySelector(`[data-f=${n}]`);
    if(document.activeElement!==fl('name')) fl('name').value=play.name||'';
    if(document.activeElement!==fl('note')) fl('note').value=play.note||'';
    if(document.activeElement!==fl('cue')) fl('cue').value=play.cue||'';
    fl('cat').innerHTML=PA.catsFor(play).map(([v,l])=>`<option value="${v}" ${play.cat===v?'selected':''}>${l}</option>`).join('');
    fl('sub').innerHTML='<option value="">—</option>'+PA.subsFor(play).map(v=>`<option ${play.sub===v?'selected':''}>${v}</option>`).join('');
    fl('star').innerHTML='<option value="">— none —</option>'+ks.map(k=>`<option ${play.star===k?'selected':''}>${k}</option>`).join('');
  }

  /* ---------- index bookkeeping when route dots are added/removed (ball spots, dotted line, motion, curves) ---------- */
  function shiftIdx(k,at,delta){
    const r=play.routes[k]; const fix=v=>v==null?v:(delta>0?(v>=at?v+1:v):(v>at?v-1:Math.min(v,r.pts.length-1)));
    if(r.dotFrom!=null) r.dotFrom=Math.min(fix(r.dotFrom),r.pts.length-1);
    if(r.motion){ r.motion=r.motion.map(fix); if(r.motion[0]>=r.motion[1]) delete r.motion; }
    if(r.smooth){ r.smooth=[...new Set(r.smooth.filter(i=>delta>0||i!==at).map(fix))].filter(i=>i>0&&i<r.pts.length-1).sort((a,b)=>a-b); if(!r.smooth.length) delete r.smooth; }
    for(const e of play.ball||[]) for(const x of [e,...(e.alt||[])]) if(evTo(x)===k&&x.v!=null) x.v=fix(x.v);
  }
  function insertPt(k,i,p){   // new dot after dot i; it curves if a neighbour curves
    const r=play.routes[k], sm=new Set(r.smooth||[]); r.pts.splice(i+1,0,p); shiftIdx(k,i+1,+1);
    if(sm.has(i)||sm.has(i+1)){ r.smooth=[...(r.smooth||[]),i+1].sort((a,b)=>a-b); }
    return i+1;
  }
  // nearest spot on any route (for dropping the football): {k, i: dot index, near: existing dot?, p}
  function nearestOnRoutes(pt){
    let best=null;
    for(const k in play.routes){ const r=play.routes[k], sh=PB.shape(r);
      for(let j=0;j<sh.pts.length-1;j++){ const a=sh.pts[j], b=sh.pts[j+1], dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy||1;
        const t=Math.max(0,Math.min(1,((pt[0]-a[0])*dx+(pt[1]-a[1])*dy)/L)), p=[a[0]+t*dx,a[1]+t*dy], d=dist(p,pt);
        if(!best||d<best.d){ let seg=0; while(seg<r.pts.length-2&&sh.map[seg+1]<=j) seg++; best={k,seg,p,d}; } } }
    return best;
  }

  /* ---------- pointer ---------- */
  function toField(e){ const svg=stage.querySelector('svg'); const pt=svg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
    const q=pt.matrixTransform(svg.getScreenCTM().inverse()); return [q.x,-q.y]; }
  function hit(pt){
    const sc=curVB.h/8; let best=null; const take=(o,d,lim)=>{ if(d<lim*sc&&(!best||d<best.dist)) best={...o,dist:d}; };
    if(mode==='ball') for(const b of balls()) if(b.pos) take({kind:'ball',ev:b.ev,alt:b.alt},dist(b.pos,pt),0.55);
    if(best) return best;
    if(mode==='route'&&selK&&play.routes[selK]){ const r=play.routes[selK], sh=PB.shape(r);
      r.pts.forEach((q,i)=>{ if(i) take({kind:'pt',k:selK,i},dist(q,pt),0.55); });
      for(let i=0;i<r.pts.length-1;i++){ const m=sh.map[i+1]-sh.map[i]>1?sh.pts[Math.round((sh.map[i]+sh.map[i+1])/2)]:[(r.pts[i][0]+r.pts[i+1][0])/2,(r.pts[i][1]+r.pts[i+1][1])/2];
        take({kind:'mid',k:selK,i,at:m},dist(m,pt),0.45); } }
    if(mode==='ball') for(const k in play.routes) play.routes[k].pts.forEach((q,i)=>{ if(i) take({kind:'pt',k,i},dist(q,pt),0.5); });
    if(best) return best;
    for(const k in play.players) take({kind:'player',k},dist(play.players[k],pt),0.85);
    return best;
  }
  stage.addEventListener('pointerdown',e=>{
    if(!play) return; if(stopA){ stopA(); stopA=null; animBtn(); }
    const pt=toField(e), h=hit(pt); if(!h) return; e.preventDefault();
    stage.setPointerCapture(e.pointerId);
    if(mode==='ball'){
      if(h.kind==='ball'){ selEv=h.ev; drag={kind:'ball',ev:h.ev,alt:h.alt,start:pt,moved:false}; vbLock=curVB; render(); ui(); }
      else setTarget(h);
      return; }
    if(mode==='route'){
      if(h.kind==='player'){ if(selK!==h.k){ selK=h.k; selPt=null; } }
      else if(h.kind==='mid'){ push(); selPt=insertPt(h.k,h.i,[snap(h.at[0]),snap(h.at[1])]);   // grab the middle of a segment = new dot
        drag={kind:'pt',k:h.k,i:selPt,start:pt,orig:clone(play),moved:false,pushed:true}; vbLock=curVB; render(); ui(); return; }
      else selPt=h.i; }
    drag={...h,start:pt,orig:clone(play),moved:false}; vbLock=curVB; render(); ui();
  });
  stage.addEventListener('pointermove',e=>{
    if(!drag) return; e.preventDefault();
    const pt=toField(e), dx=pt[0]-drag.start[0], dy=pt[1]-drag.start[1];
    if(!drag.moved){ if(Math.hypot(dx,dy)<0.08) return; if(drag.kind!=='ball'&&!drag.pushed) stack().push(JSON.stringify(drag.orig)); drag.moved=true; }
    if(drag.kind==='ball'){ drag.at=pt; render(); return; }
    const o=drag.orig, k=drag.k, mv=q=>[snap(q[0]+dx),snap(q[1]+dy)];
    if(drag.kind==='player'&&mode==='move'){ play.players[k]=mv(o.players[k]); if(o.routes[k]) play.routes[k].pts=o.routes[k].pts.map(mv); }
    else if(drag.kind==='player'){ play.players[k]=mv(o.players[k]); if(play.routes[k]) play.routes[k].pts[0]=play.players[k].slice(); }
    else play.routes[k].pts[drag.i]=mv(o.routes[k].pts[drag.i]);
    render();
  });
  const end=e=>{ if(!drag) return; const d=drag; drag=null; vbLock=null;
    if(d.kind==='ball'){ if(d.moved) dropBall(d, e&&e.clientX!=null?toField(e):d.at); else { render(); ui(); } return; }
    if(!d.moved&&d.pushed){ const s=stack(); const prev=JSON.parse(s.pop()); for(const k in play) delete play[k]; Object.assign(play,prev); selPt=null; }   // tap on ◆ without dragging: no new dot
    if(d.moved||d.pushed) changed(); else render(); };
  stage.addEventListener('pointerup',end); stage.addEventListener('pointercancel',()=>end());

  function dropBall(d,pt){
    const sc=curVB.h/8, before=JSON.stringify(play), ev=play.ball[d.ev];
    const undo=m=>{ const o=JSON.parse(before); for(const k in play) delete play[k]; Object.assign(play,o); toast(m); render(); ui(); };
    let k=null, v; const n=pt&&nearestOnRoutes(pt);
    if(n&&n.d<0.6*sc){ const r=play.routes[n.k], near=[n.seg,n.seg+1].find(i=>dist(r.pts[i],n.p)<0.35*sc);
      k=n.k; v=near!=null?near:insertPt(k,n.seg,[round(n.p[0]),round(n.p[1])]); }
    else for(const pk in play.players) if(pt&&dist(play.players[pk],pt)<0.8*sc&&!play.routes[pk]) k=pk;
    if(!k) return undo('Drop the ball on a route (or on a player)');
    if(k===holderBefore(d.ev)||(d.alt>=0&&k===evTo(ev))) return undo(`${k} can't catch this one`);
    stack().push(before);
    const x=d.alt<0?ev:ev.alt[d.alt];
    if(d.alt<0){ followStar(ev,k); const t=ev.give?'give':'pass'; delete ev.give; delete ev.pass; ev[t]=k; if(ev.alt){ ev.alt=ev.alt.filter(a=>a.pass!==k); if(!ev.alt.length) delete ev.alt; } }
    else x.pass=k;
    const last=ptsOf(k).length-1; if(v==null||v>=last) delete x.v; else x.v=v;
    changed();
  }
  function setTarget(h){
    play.ball=play.ball||[]; if(!play.ball.length){ push(); play.ball.push({pass:h.k}); selEv=0; }
    const e=play.ball[selEv]; if(!e) return;
    if(holderBefore(selEv)===h.k) return toast(`${h.k} already has the ball at this step`);
    push(); const type=e.give?'give':'pass'; const last=ptsOf(h.k).length-1; followStar(e,h.k);
    for(const k of ['give','pass']) delete e[k]; e[type]=h.k;
    if(h.kind==='pt'&&h.i<last) e.v=h.i; else delete e.v;
    if(e.alt) e.alt=e.alt.filter(a=>a.pass!==h.k);
    changed();
  }
  // turn / resize the route around the player's starting spot (dot 0 stays put)
  function transform(r,ang,scale){ const [ox,oy]=r.pts[0], c=Math.cos(ang), s=Math.sin(ang);
    r.pts=r.pts.map((p,i)=>{ if(!i) return p; const x=(p[0]-ox)*scale, y=(p[1]-oy)*scale; return [round(ox+x*c-y*s),round(oy+x*s+y*c)]; }); }

  /* ---------- buttons ---------- */
  root.addEventListener('click',e=>{
    const b=e.target.closest('button'); if(!b||!play) return;
    if(b.dataset.m){ if(stopA){stopA();stopA=null;animBtn();} mode=b.dataset.m; if(mode!=='route') selPt=null; render(); ui(); return; }
    if(b.dataset.k){ selK=b.dataset.k; selPt=null; render(); ui(); return; }
    if(b.dataset.alt!=null){ const ev=play.ball[+b.dataset.i]; push(); ev.alt=ev.alt||[]; const k=b.dataset.alt;
      const i=ev.alt.findIndex(a=>a.pass===k); if(i>=0) ev.alt.splice(i,1); else ev.alt.push({pass:k}); if(!ev.alt.length) delete ev.alt; changed(); return; }
    if(b.dataset.ev==='del'){ push(); play.ball.splice(+b.dataset.i,1); selEv=Math.max(0,Math.min(selEv,play.ball.length-1)); changed(); return; }
    const r=selK&&play.routes[selK];
    switch(b.dataset.a){
      case 'anim': if(stopA){ stopA(); stopA=null; } else stopA=PA.animate(stage,play,{done:()=>{ stopA=null; animBtn(); render(); }}); animBtn(); break;
      case 'add': push();
        if(!r){ const [x,y]=play.players[selK]; play.routes[selK]={pts:[[x,y],[snap(x),snap(y+1.5)]],end:'arrow'}; selPt=1; }
        else { const i=selPt>=1?selPt:r.pts.length-1, a=r.pts[i], nx=r.pts[i+1], pv=r.pts[i-1]||a;
          const np=nx?[snap((a[0]+nx[0])/2),snap((a[1]+nx[1])/2)]:[snap(a[0]+(a[0]-pv[0])*0.5||a[0]),snap(a[1]+((a[1]-pv[1])*0.5||1))];
          selPt=insertPt(selK,i,np); }
        changed(); break;
      case 'del': if(!(r&&selPt>=1&&r.pts.length>2)) break; push(); r.pts.splice(selPt,1); shiftIdx(selK,selPt,-1); selPt=Math.min(selPt,r.pts.length-1); changed(); break;
      case 'curve': { push(); const sm=new Set(r.smooth||[]), inner=r.pts.map((_,i)=>i).slice(1,-1);
        if(selPt>=1&&selPt<r.pts.length-1){ sm.has(selPt)?sm.delete(selPt):sm.add(selPt); }
        else if(inner.every(i=>sm.has(i))) sm.clear(); else inner.forEach(i=>sm.add(i));
        if(sm.size) r.smooth=[...sm].sort((a,b)=>a-b); else delete r.smooth; changed(); break; }
      case 'rotl': push(); transform(r,Math.PI/12,1); changed(); break;
      case 'rotr': push(); transform(r,-Math.PI/12,1); changed(); break;
      case 'longer': push(); transform(r,0,1.1); changed(); break;
      case 'shorter': push(); transform(r,0,1/1.1); changed(); break;
      case 'arrow': push(); r.end=r.end==='none'?'arrow':'none'; changed(); break;
      case 'dot': push(); if(r.dotFrom===selPt) delete r.dotFrom; else r.dotFrom=selPt; changed(); break;
      case 'motion': push(); if(r.motion&&r.motion[1]===selPt) delete r.motion; else r.motion=[0,selPt]; changed(); break;
      case 'clear': if(!confirm(`Remove ${selK}'s route?`)) break; push(); delete play.routes[selK];
        for(const ev of play.ball||[]) for(const x of [ev,...(ev.alt||[])]) if(evTo(x)===selK) delete x.v;
        selPt=null; changed(); break;
      case 'addev': { push(); play.ball=play.ball||[]; const from=play.ball.length?evTo(play.ball[play.ball.length-1]):'Q';
        const to=Object.keys(play.players).find(k=>k!==from&&k!=='C')||'C'; play.ball.push({pass:to}); selEv=play.ball.length-1; changed(); break; }
    }
  });
  root.addEventListener('change',e=>{
    const s=e.target; if(!play) return;
    if(s.dataset.ev){ const ev=play.ball[+s.dataset.i]; push();
      if(s.dataset.ev==='type'){ const to=evTo(ev); delete ev.give; delete ev.pass; ev[s.value]=to; if(s.value==='give') delete ev.alt; }
      if(s.dataset.ev==='to'){ const t=ev.give?'give':'pass'; followStar(ev,s.value); ev[t]=s.value; delete ev.v; if(ev.alt) ev.alt=ev.alt.filter(a=>a.pass!==s.value); }
      if(s.dataset.ev==='at'){ if(s.value==='') delete ev.v; else ev.v=+s.value; }
      selEv=+s.dataset.i; changed(); return; }
    if(s.dataset.r&&selK&&play.routes[selK]){ const r=play.routes[selK], v=+s.value; push();
      if(s.dataset.r==='delay'){ if(v) r.delay=v; else delete r.delay; }
      else { const base=selK==='Q'?2.3:2.9; if(v===1) delete r.spd; else r.spd=round(base*v); }
      changed(); return; }
    if(s.dataset.f==='star'){ push(); play.star=s.value||null; changed(); }
    if(s.dataset.f==='cat'||s.dataset.f==='sub'){ push(); play[s.dataset.f]=s.value; changed(); }
  });
  root.addEventListener('click',e=>{ const row=e.target.closest('.ed-ev'); if(row&&!e.target.closest('select,button')){ selEv=+row.dataset.i; render(); ui(); } });
  let typing=false;
  root.addEventListener('focusin',e=>{ if(e.target.dataset.f) typing=false; });
  root.addEventListener('input',e=>{ const f=e.target.dataset.f; if(f!=='name'&&f!=='note'&&f!=='cue') return; if(!typing){ push(); typing=true; }
    play[f]=e.target.value||(f==='note'?null:''); opt.onChange&&opt.onChange(play); });
  root.addEventListener('focusout',e=>{ if(e.target.dataset.f) ui(); });
  function animBtn(){ $('[data-a=anim]').textContent=stopA?'■ Stop':'▶ Play'; }

  return {
    load(p,k){ if(stopA){stopA();stopA=null;animBtn();} play=p; key=k||''; selK=null; selPt=null; selEv=0; render(); ui(); },
    get:()=>play,
    canUndo:()=>stack().length>0,
    undo(){ const s=stack(); if(!s.length) return false; const prev=JSON.parse(s.pop()); for(const k in play) delete play[k]; Object.assign(play,prev); changed(); return true; },
    refresh(){ render(); ui(); }
  };
}
