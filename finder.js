/* Practice time finder (Doodle-style). Pure logic + grid HTML; index.html wires it to the data.
   Week: Mon-Fri 3:00-7:30 pm, Sat-Sun 9:00 am-7:00 pm, half-hour slots. Slot key 'd-HHMM' (d 1 = Mon .. 7 = Sun).
   A game blocks 45 min before kickoff to 30 min after the 1-hour game (2 h 15 min); a set practice blocks its own time.
   Families mark the slots that WORK: a typical week, plus changes for a given week. */
(function(){
  const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], LEN=3;   // practice = 3 half-hour slots (1.5 h)
  const pad=n=>String(n).padStart(2,'0'), hhmm=m=>pad(Math.floor(m/60))+pad(m%60);
  const range=(a,b)=>{ const o=[]; for(let m=a;m<b;m+=30) o.push(m); return o; };
  const DAYSLOTS=d=>d<=5?range(15*60,19*60+30):range(9*60,19*60);           // start minutes of each slot
  const ROWS=range(9*60,19*60+30);                                          // every row shown (weekday rows before 3 pm are empty)
  const key=(d,m)=>`${d}-${hhmm(m)}`, valid=new Set([].concat(...[1,2,3,4,5,6,7].map(d=>DAYSLOTS(d).map(m=>key(d,m)))));
  const label=m=>{ const h=Math.floor(m/60), mm=m%60; return `${h%12||12}${mm?':'+pad(mm):''}${h<12?'a':'p'}`; };
  const longLabel=m=>{ const h=Math.floor(m/60), mm=m%60; return `${h%12||12}:${pad(mm)} ${h<12?'AM':'PM'}`; };
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const dOf=s=>{ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); };
  function monday(d){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
  const weekOf=(offset=0)=>{ const m=monday(new Date()); m.setDate(m.getDate()+7*offset); return iso(m); };
  const dayDate=(week,d)=>{ const x=dOf(week); x.setDate(x.getDate()+d-1); return x; };
  function parseTime(t){ const m=String(t||'').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp])?/); if(!m) return null;
    let h=+m[1]%12; if((m[3]||'').toLowerCase()==='p') h+=12; else if(!m[3]&&h<8) h+=12; return h*60+(+m[2]||0); }   // "3:00" with no AM/PM = afternoon
  // slots taken in this week by games (either team) and set practices
  function blocks(events,week){ const out={}, start=dOf(week), end=new Date(start); end.setDate(end.getDate()+7);
    for(const g of events){ if(!g.gdate||g.postponed) continue; const gd=dOf(g.gdate); if(gd<start||gd>=end) continue;
      const t=parseTime(g.gtime); if(t==null) continue; const d=(gd.getDay()+6)%7+1, prac=g.stage==='practice';
      const a=prac?t:t-45, b=prac?t+(g.minutes||90):t+90, what=prac?`${g.fmt.toUpperCase()} PRACTICE`:`${g.fmt.toUpperCase()} GAME ${longLabel(t)}`;
      for(const m of DAYSLOTS(d)) if(m<b&&m+30>a) (out[key(d,m)]=out[key(d,m)]||[]).push({what,g}); }
    return out; }
  const works=(av,week)=>!av?null:new Set(av.weeks&&av.weeks[week]?av.weeks[week]:(av.typical||[]));
  // heat: per slot, who can come (players who answered); best = 1.5 h windows ranked by the fewest missing
  function analyze(players,week,blocked,busy,opts={}){
    const answered=players.filter(p=>p.typical||p.weeks), sets=answered.map(p=>[p,works(p,week)]), heat={};
    for(const k of valid) heat[k]=sets.filter(([,s])=>s.has(k)).map(([p])=>p);
    const now=new Date(), past=k=>{ const [d,t]=k.split('-'); const x=dayDate(week,+d); x.setHours(+t.slice(0,2),+t.slice(2)); return x<now; };
    const free=k=>valid.has(k)&&!blocked[k]&&!(busy&&busy.has(k))&&!past(k);
    const wins=[];
    for(let d=1;d<=7;d++){ const sl=DAYSLOTS(d);
      for(let i=0;i+LEN<=sl.length;i++){ const ks=sl.slice(i,i+LEN).map(m=>key(d,m)); if(!ks.every(free)) continue;
        const can=answered.filter(p=>ks.every(k=>works(p,week).has(k))), next=key(d,sl[i]+LEN*30);
        const before=(blocked[next]||[]).find(b=>b.g.stage!=='practice'&&b.g.fmt===opts.fmt);   // ends right when the team's pre-game starts
        wins.push({d,m:sl[i],keys:ks,can,miss:answered.filter(p=>!can.includes(p)),pregame:before?before.what:''}); } }
    wins.sort((a,b)=>b.can.length-a.can.length||(b.pregame?1:0)-(a.pregame?1:0)||a.d-b.d||a.m-b.m);
    return {heat,answered,noreply:players.filter(p=>!p.typical&&!p.weeks),wins,free}; }
  // both teams back to back: 3 h, one team then the other, each team's players free in its half
  function backToBack(A,B,week){ const out=[];
    for(let d=1;d<=7;d++){ const sl=DAYSLOTS(d);
      for(let i=0;i+2*LEN<=sl.length;i++){ const ks=sl.slice(i,i+2*LEN).map(m=>key(d,m)); if(!ks.every(A.free)) continue;
        for(const [first,second,fa,fb] of [[A,B,'5V5','6V6'],[B,A,'6V6','5V5']]){
          const w1=first.wins.find(w=>w.d===d&&w.m===sl[i]), w2=second.wins.find(w=>w.d===d&&w.m===sl[i+LEN]); if(!w1||!w2) continue;
          out.push({d,m:sl[i],first:fa,second:fb,w1,w2,score:Math.min(w1.can.length/Math.max(1,first.answered.length),w2.can.length/Math.max(1,second.answered.length))}); } } }
    out.sort((a,b)=>b.score-a.score||a.d-b.d||a.m-b.m); return out; }
  // grid HTML: two compact tables (weekdays after school · weekend). mode 'edit': ws = Set of working slots; mode 'heat': counts out of n
  function gridHTML(o){ const {mode,week,ws,blocked={},busy,heat,n,editBusy}=o;
    const cellHTML=(d,m)=>{ const k=key(d,m);
      const bl=blocked[k]; if(bl){ const first=!blocked[key(d,m-30)]||blocked[key(d,m-30)][0].what!==bl[0].what; return `<td class=bl title="${bl[0].what}"><span>${first?bl[0].what.replace(/ \d.*$/,'').replace(/^(\dV\d) /,'$1 '):''}</span></td>`; }
      if(mode==='heat'){ const c=(heat[k]||[]).length, cb=busy&&busy.has(k);
        if(editBusy) return `<td class="fs ${cb?'busy':''}" data-k="${k}">${cb?'✕':''}</td>`;
        if(cb) return '<td class="bl cb"><span></span></td>';
        const lv=n?Math.round(4*c/n):0; return `<td class="ht h${lv}" data-k="${k}">${c||''}</td>`; }
      return `<td class="fs ${ws.has(k)?'on':''}" data-k="${k}"></td>`; };
    const table=(days,title)=>{ const sl=DAYSLOTS(days[0]);
      return `<div class=ftable><div class=ftitle>${title}</div><table><thead><tr><th class=ft></th>${days.map(d=>`<th ${mode==='edit'?`data-day="${d}" class=dayh`:''}>${DAYS[d-1]}${week?`<small>${dayDate(week,d).getDate()}</small>`:''}</th>`).join('')}</tr></thead><tbody>${sl.map(m=>`<tr><th class="ft ${m%60?'half':''}">${label(m)}</th>${days.map(d=>cellHTML(d,m)).join('')}</tr>`).join('')}</tbody></table></div>`; };
    return `<div class=fgrid>${table([1,2,3,4,5],'Weekdays · after school')}${table([6,7],'Weekend')}</div>`; }
  // one-tap presets for families
  const PRESETS=[['wk4','Weekdays 4–7:30pm',[1,2,3,4,5],16*60,19*60+30],['wk5','Weekdays 5–7:30pm',[1,2,3,4,5],17*60,19*60+30],['satam','Sat 9am–noon',[6],9*60,12*60],['satpm','Sat noon–7pm',[6],12*60,19*60],['sunam','Sun 9am–noon',[7],9*60,12*60],['sunpm','Sun noon–7pm',[7],12*60,19*60]];
  const presetKeys=id=>{ const p=PRESETS.find(x=>x[0]===id); return [].concat(...p[2].map(d=>DAYSLOTS(d).filter(m=>m>=p[3]&&m<p[4]).map(m=>key(d,m)))); };
  const dayKeys=d=>DAYSLOTS(d).map(m=>key(d,m));
  // drag-to-paint on a grid: first touched cell decides on/off
  function paint(root,onChange){ let mode=null, seen=null;
    const cell=e=>{ const t=e.touches?document.elementFromPoint(e.touches[0].clientX,e.touches[0].clientY):e.target; return t&&t.closest&&t.closest('td.fs[data-k]'); };
    const set=td=>{ if(!td||seen.has(td)) return; seen.add(td); const on=mode==='on', be=td.closest('.busyedit')!=null; td.classList.toggle('on',on&&!be); td.classList.toggle('busy',on&&be); td.textContent=on&&be?'✕':''; };
    const down=e=>{ const td=cell(e); if(!td) return; e.preventDefault(); seen=new Set(); mode=td.classList.contains('on')||td.classList.contains('busy')?'off':'on'; set(td); };
    const move=e=>{ if(!mode) return; e.preventDefault(); set(cell(e)); };
    const up=()=>{ if(!mode) return; mode=null; onChange([...root.querySelectorAll('td.fs.on,td.fs.busy')].map(t=>t.dataset.k)); };
    root.addEventListener('mousedown',down); root.addEventListener('mouseover',e=>{ if(e.buttons) move(e); }); window.addEventListener('mouseup',up);
    root.addEventListener('touchstart',down,{passive:false}); root.addEventListener('touchmove',move,{passive:false}); root.addEventListener('touchend',up); }
  const winLabel=(week,w)=>{ const x=dayDate(week,w.d); return `${DAYS[w.d-1]} ${x.getMonth()+1}/${x.getDate()} · ${longLabel(w.m)}–${longLabel(w.m+LEN*30)}`; };
  window.PAFinder={PRESETS,presetKeys,dayKeys,DAYS,LEN,DAYSLOTS,key,valid,label,longLabel,iso,dOf,weekOf,dayDate,parseTime,blocks,works,analyze,backToBack,gridHTML,paint,winLabel};
})();
