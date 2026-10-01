/* GAME DAY tab (coach only): 3-play setups + IF/THEN board. The plan itself is never in the app files:
   it comes from pa_coach_gameplan (coach sign-in) and is cached on the coach's device for the field. */
(function(){
  const E=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const GROUPS=[['green','GREEN · GET THE 1ST DOWN','Own half. 3 plays to cross midfield.'],['gold','GOLD · SCORE','Past midfield. 3 plays to the end zone.'],['point','POINT · EXTRA POINT','1 from the 5 (pass only) or 2 from the 12.']];
  const chip=(n,cat)=>`<button class="gnum cat-${cat||'throw'}" data-gplay="${n}" aria-label="open play ${n}">${n}</button>`;
  // GDF = filter: all | green | gold | point | board
  function gamedayHTML(plan,o){
    if(!plan) return `<div class=gday><div class=gcard><b>GAME DAY</b><p>${E(o.err||'Loading the game plan…')}</p></div></div>`;
    const cat=n=>{ const p=(o.band||[]).find(x=>x.n===n); return p?o.catOf(p):'throw'; }, f=o.filter||'all';
    const seg=`<div class="seg gseg">${[['all','ALL'],['green','GREEN'],['gold','GOLD'],['point','POINT'],['board','IF / THEN']].map(([k,t])=>`<button class="${k===f?'on':''}" data-gf="${k}">${t}</button>`).join('')}</div>`;
    const drive=`<div class=gdrive>${plan.drive.map((d,i)=>`<span class="gstep s${i}">${E(d)}</span>`).join('<i>›</i>')}</div>`;
    const card=s=>`<div class="gcard g-${s.group}"><div class=ghead><span class=gcall>${E(s.call)}</span><span class=gtitle>${E(s.title)}</span></div>
      <div class=ghuddle>${s.nums.map(n=>chip(n,cat(n))).join('<i>·</i>')}</div>
      <p class=gdwhen><b>WHEN</b> ${E(s.when)}</p><p class=gwhy>${E(s.why)}</p>
      <ol class=gplays>${s.plays.map((p,i)=>`<li>${chip(p.n,cat(p.n))}<div><b>${s.group==='point'?['1 PT','1 PT BACKUP','2 PT'][i]:['1ST','2ND','3RD'][i]} · ${E(p.name)}</b>
        <span>${E(p.job)}</span><small>${p.run?'RUN':'PASS'} · SIM ${E(p.sim)}${p.twin?` · NO-RUN ZONE → ${p.twin}`:''}</small></div></li>`).join('')}</ol>
      <ul class=gif>${s.ifthen.map(t=>`<li>${E(t).replace(/^(IF|1 PT:|2 PT[^:]*:)/,'<b>$1</b>').replace(/ → /,' <b>→</b> ')}</li>`).join('')}</ul></div>`;
    const board=`<div class=gboard>${plan.board.map((b,i)=>`<details class="gcard gsec" ${f==='board'||i<2?'open':''}><summary>${E(b.title)}</summary>
      <table>${b.rows.map(r=>`<tr><td><b>IF</b> ${E(r.i)}</td><td><b>THEN</b> ${E(r.t)}${r.nums?`<div class=gnums>${r.nums.map(n=>chip(n,cat(n))).join('')}</div>`:''}</td></tr>`).join('')}</table></details>`).join('')}</div>`;
    let body='';
    if(f!=='board') body+=GROUPS.filter(([g])=>f==='all'||f===g).map(([g,h,sub])=>`<h3 class="gh g-${g}">${h}<small>${sub}</small></h3><div class=ggrid>${plan.setups.filter(s=>s.group===g).map(card).join('')}</div>`).join('');
    if(f==='all'||f==='board') body+=`<h3 class=gh>IF / THEN<small>Read the defense, the down and the clock.</small></h3>`+board;
    if(f==='all') body+=`<details class="gcard gsec"><summary>RULES THAT SHAPE THE CALLS</summary><ul class=gif>${plan.rules.map(r=>`<li>${E(r)}</li>`).join('')}</ul></details>
      <details class="gcard gsec"><summary>LEFT OUT OF THE SETUPS</summary><ul class=gif>${plan.left_out.map(x=>`<li><b>#${x.n}</b> ${E(x.why)}</li>`).join('')}</ul></details>
      <p class=gnote>${E(plan.note)} · Updated ${E(plan.updated)}</p>`;
    return `<div class=gday><div class=gtop><div><b>GAME DAY · ${E(o.fmt.toUpperCase())}</b><span>COACH ONLY · tap a number to see the play</span></div>${seg}</div>${drive}${body}</div>`;
  }
  window.gamedayHTML=gamedayHTML;
})();
