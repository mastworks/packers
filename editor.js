/* Drag editor shared by the coach page and the player idea page.
   const ed=PlayEditor(rootEl,{onChange}); ed.load(play,key); ed.get(); ed.undo(); ed.canUndo()
   Modes: Move (player + whole route), Routes (reshape points, draw/clear routes, dotted/motion/arrow), Ball (who gets it, where, other options). */
function PlayEditor(root,opt){
  opt=opt||{};
  const ASP=1.3, SNAP=0.1, clone=o=>JSON.parse(JSON.stringify(o)), round=v=>Math.round(v*100)/100, snap=v=>round(Math.round(v/SNAP)*SNAP);
  root.classList.add('ed');
  root.innerHTML=`
  <div class=ed-stage></div>
  <div class=ed-hint></div>
  <div class=ed-modes><button class=btn data-m=move>Move</button><button class=btn data-m=route>Routes</button><button class=btn data-m=ball>Ball</button><button class=btn data-a=anim>▶ Play</button></div>
  <div class="ed-tools" data-for=route>
    <div class=ed-chips></div>
    <div class=ed-row><button class=btn data-a=add>+ Point</button><button class=btn data-a=del>− Point</button><button class=btn data-a=arrow>Arrow</button></div>
    <div class=ed-row><button class=btn data-a=dot>Dotted from dot</button><button class=btn data-a=motion>Motion to dot</button><button class=btn data-a=clear>Clear route</button></div>
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

  /* ---------- ball helpers ---------- */
  const evTo=e=>e.give||e.pass;
  const holderBefore=i=>{ let h='Q'; for(let j=0;j<i;j++) h=evTo(play.ball[j]); return h; };
  const ptsOf=k=>(play.routes[k]&&play.routes[k].pts)||[play.players[k]];
  const catchPt=e=>{ const p=ptsOf(evTo(e)); const i=(e.v==null||e.v>=p.length)?p.length-1:e.v; return p[i]; };

  /* ---------- drawing ---------- */
  function overlay(vb){
    const sc=vb.h/8, R=(x,y,r,st,dash,fill)=>`<circle cx="${x}" cy="${-y}" r="${r*sc}" fill="${fill||'none'}" stroke="${st}" stroke-width="${0.07*sc}" ${dash?`stroke-dasharray="${0.12*sc} ${0.1*sc}"`:''}/>`;
    let s='';
    if(mode==='move') for(const k in play.players){ const [x,y]=play.players[k]; s+=R(x,y,0.7,'#FFB612',true); }
    if(mode==='route' && selK && play.players[selK]){
      const [x,y]=play.players[selK]; s+=R(x,y,0.72,'#FFB612');
      const r=play.routes[selK]; if(r) r.pts.forEach((q,i)=>{ if(i) s+=`<circle cx="${q[0]}" cy="${-q[1]}" r="${(i===selPt?0.3:0.22)*sc}" fill="${i===selPt?'#FFB612':'#fff'}" stroke="${PB.COL[selK]}" stroke-width="${0.08*sc}"/>`; });
    }
    if(mode==='ball'){
      for(const k in play.routes) play.routes[k].pts.forEach((q,i)=>{ if(i) s+=`<circle cx="${q[0]}" cy="${-q[1]}" r="${0.15*sc}" fill="#fff" stroke="${PB.COL[k]}" stroke-width="${0.06*sc}"/>`; });
      const e=(play.ball||[])[selEv]; if(e){ const c=catchPt(e); if(c) s+=R(c[0],c[1],0.55,'#FFB612',false); }
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
    const r=selK&&play.routes[selK], hasSel=!!selK;
    const B=a=>$(`[data-a=${a}]`);
    B('add').disabled=!hasSel; B('add').textContent=r?'+ Point':'Draw route';
    B('del').disabled=!(r&&selPt>=1&&r.pts.length>2);
    B('arrow').disabled=B('clear').disabled=!r; if(r) B('arrow').textContent=r.end==='none'?'Arrow: off':'Arrow: on';
    B('dot').disabled=B('motion').disabled=!(r&&selPt>=1);
    if(r&&selPt>=1){ B('dot').textContent=r.dotFrom===selPt?'Dotted: off':'Dotted from dot'; B('motion').textContent=(r.motion&&r.motion[1]===selPt)?'Motion: off':'Motion to dot'; }
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
      :'<div class=ed-empty>No ball plan yet. Add a pass or hand-off.</div>';
    $('.ed-hint').textContent = mode==='move' ? 'Drag any player. Their whole route moves with them.'
      : mode==='route' ? (!selK ? 'Tap a player (or a colored button) to edit their route.'
          : r ? `Drag ${selK}'s white dots to reshape. Drag ${selK} to move only the starting spot. Tap a dot to select it.` : `${selK} has no route. Tap "Draw route".`)
      : 'Pick a step in the ball plan, then tap a player or a route dot on the field to send the ball there.';
    const f=n=>root.querySelector(`[data-f=${n}]`);
    if(document.activeElement!==f('name')) f('name').value=play.name||'';
    if(document.activeElement!==f('note')) f('note').value=play.note||'';
    if(document.activeElement!==f('cue')) f('cue').value=play.cue||'';
    f('cat').innerHTML=PA.CATS.map(([v,l])=>`<option value="${v}" ${play.cat===v?'selected':''}>${l}</option>`).join('');
    f('sub').innerHTML='<option value="">—</option>'+PA.SUBS.map(v=>`<option ${play.sub===v?'selected':''}>${v}</option>`).join('');
    f('star').innerHTML='<option value="">— none —</option>'+ks.map(k=>`<option ${play.star===k?'selected':''}>${k}</option>`).join('');
  }

  /* ---------- index bookkeeping when route points are added/removed ---------- */
  function shiftIdx(k,at,delta){
    const r=play.routes[k]; const fix=v=>v==null?v:(delta>0?(v>=at?v+1:v):(v>at?v-1:Math.min(v,r.pts.length-1)));
    if(r.dotFrom!=null){ r.dotFrom=fix(r.dotFrom); if(r.dotFrom>=r.pts.length-1&&r.pts.length>1&&delta<0&&r.dotFrom>r.pts.length-1) r.dotFrom=r.pts.length-1; }
    if(r.motion){ r.motion=r.motion.map(fix); if(r.motion[0]>=r.motion[1]) delete r.motion; }
    for(const e of play.ball||[]) for(const x of [e,...(e.alt||[])]) if(evTo(x)===k&&x.v!=null) x.v=fix(x.v);
  }

  /* ---------- pointer: drag players / points, or pick ball target ---------- */
  function toField(e){ const svg=stage.querySelector('svg'); const pt=svg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
    const q=pt.matrixTransform(svg.getScreenCTM().inverse()); return [q.x,-q.y]; }
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  function hit(pt){
    const sc=curVB.h/8; let best=null; const take=(o,d,lim)=>{ if(d<lim*sc&&(!best||d<best.dist)) best={...o,dist:d}; };
    if(mode==='route'&&selK&&play.routes[selK]) play.routes[selK].pts.forEach((q,i)=>{ if(i) take({kind:'pt',k:selK,i},dist(q,pt),0.6); });
    if(mode==='ball') for(const k in play.routes) play.routes[k].pts.forEach((q,i)=>{ if(i) take({kind:'pt',k,i},dist(q,pt),0.5); });
    if(best) return best;
    for(const k in play.players) take({kind:'player',k},dist(play.players[k],pt),0.85);
    return best;
  }
  stage.addEventListener('pointerdown',e=>{
    if(!play) return; if(stopA){ stopA(); stopA=null; animBtn(); }
    const pt=toField(e), h=hit(pt); if(!h) return; e.preventDefault();
    if(mode==='ball'){ setTarget(h); return; }
    stage.setPointerCapture(e.pointerId);
    if(mode==='route'){ if(h.kind==='player'){ if(selK!==h.k){ selK=h.k; selPt=null; } } else selPt=h.i; }
    drag={...h,start:pt,orig:clone(play),moved:false}; vbLock=curVB; render(); ui();
  });
  stage.addEventListener('pointermove',e=>{
    if(!drag) return; e.preventDefault();
    const pt=toField(e), dx=pt[0]-drag.start[0], dy=pt[1]-drag.start[1];
    if(!drag.moved){ if(Math.hypot(dx,dy)<0.08) return; stack().push(JSON.stringify(drag.orig)); drag.moved=true; }
    const o=drag.orig, k=drag.k, mv=q=>[snap(q[0]+dx),snap(q[1]+dy)];
    if(drag.kind==='player'&&mode==='move'){ play.players[k]=mv(o.players[k]); if(o.routes[k]) play.routes[k].pts=o.routes[k].pts.map(mv); }
    else if(drag.kind==='player'){ play.players[k]=mv(o.players[k]); if(play.routes[k]) play.routes[k].pts[0]=play.players[k].slice(); }
    else play.routes[k].pts[drag.i]=mv(o.routes[k].pts[drag.i]);
    render();
  });
  const end=()=>{ if(!drag) return; const m=drag.moved; drag=null; vbLock=null; if(m) changed(); else render(); };
  stage.addEventListener('pointerup',end); stage.addEventListener('pointercancel',end);

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
  // the star marks the first ball option: if it pointed at the old first receiver, move it with the ball
  function followStar(e,to){ if(play.ball[0]===e && play.star && play.star===evTo(e)) play.star=to; }
  function toast(m){ (window.PA&&PA.toast)?PA.toast(m):alert(m); }

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
          r.pts.splice(i+1,0,np); shiftIdx(selK,i+1,+1); selPt=i+1; }
        changed(); break;
      case 'del': if(!(r&&selPt>=1&&r.pts.length>2)) break; push(); r.pts.splice(selPt,1); shiftIdx(selK,selPt,-1); selPt=Math.min(selPt,r.pts.length-1); changed(); break;
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
