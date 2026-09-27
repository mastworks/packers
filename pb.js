/* Packer Army play renderer — shared by phone viewer, print sheets, GIF export.
   Coordinates: x right, y downfield, LOS y=0, 1 unit ~ one player spacing. */
(function(root){
const COL = {Q:'#1F2F6B', C:'#0B8A8A', X:'#C8102E', Y:'#2F9E44', Z:'#DB8B00', H:'#E0567F'};
const INK = {Q:'#fff', C:'#fff', X:'#fff', Y:'#fff', Z:'#1b1b1b', H:'#fff'};
const BALL = '#8B4A2B';
const VIEW = {h:8.0, ymin:-3.6};            // fixed vertical window; width set by aspect
const R_P = 0.5;                           // player radius
const SW = 0.12;                            // route stroke
let S=1;
const f = n => (Math.round(n*1000)/1000);

function seglen(a,b){return Math.hypot(b[0]-a[0],b[1]-a[1]);}
function cum(pts){const c=[0];for(let i=1;i<pts.length;i++)c.push(c[i-1]+seglen(pts[i-1],pts[i]));return c;}
function posAt(pts,c,s){ if(s<=0)return pts[0].slice(); const L=c[c.length-1]; if(s>=L)return pts[pts.length-1].slice();
  let i=1; while(c[i]<s)i++; const t=(s-c[i-1])/(c[i]-c[i-1]||1); return [pts[i-1][0]+(pts[i][0]-pts[i-1][0])*t, pts[i-1][1]+(pts[i][1]-pts[i-1][1])*t]; }
function subPts(pts,c,s){ const out=[pts[0].slice()]; const L=c[c.length-1]; if(s<=0)return out; if(s>=L)return pts.map(p=>p.slice());
  let i=1; while(c[i]<=s){out.push(pts[i].slice());i++;} out.push(posAt(pts,c,s)); return out; }

/* ------------ route shape ------------
   r.pts are the control points the coach drags; r.smooth lists the ones that curve (the rest are kinks).
   shape() returns the drawn polyline plus map[i] = index of control point i in it. Segments between two kinks
   stay a single straight segment, so plays without curves draw exactly as before. */
function shape(r){
  const P=r.pts, sm=new Set(r.smooth||[]);
  if(!sm.size) return {pts:P.map(p=>p.slice()),map:P.map((_,i)=>i)};
  const tan=(i,a,b)=>(sm.has(i)&&i>0&&i<P.length-1)?[(P[i+1][0]-P[i-1][0])*0.5,(P[i+1][1]-P[i-1][1])*0.5]:[b[0]-a[0],b[1]-a[1]];
  const out=[P[0].slice()], map=[0];
  for(let i=0;i<P.length-1;i++){ const a=P[i], b=P[i+1];
    if(!sm.has(i)&&!sm.has(i+1)){ out.push(b.slice()); map.push(out.length-1); continue; }
    const m0=tan(i,a,b), m1=tan(i+1,a,b), N=12;                       // cubic Hermite (Catmull-Rom at curve points)
    for(let j=1;j<=N;j++){ const t=j/N,t2=t*t,t3=t2*t,h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
      out.push([h00*a[0]+h10*m0[0]+h01*b[0]+h11*m1[0],h00*a[1]+h10*m0[1]+h01*b[1]+h11*m1[1]]); }
    map.push(out.length-1); }
  return {pts:out,map};
}

/* ------------ timeline ------------ */
const SNAP=0.4, SPD=2.9, QSPD=2.3, HOLD=0.9;
function timeline(play){
  const T={play,routes:{},ball:[],dur:0,events:[]};
  for(const k in play.players){
    const r=play.routes[k]; const st=play.players[k];
    if(!r){T.routes[k]={pts:[st],c:[0],t0:0,spd:1,tend:0,map:[0]};continue;}
    const sh=shape(r), pts=sh.pts, c=cum(pts), spd=r.spd|| (k==='Q'?QSPD:SPD), t0=SNAP+(r.delay||0);
    T.routes[k]={pts,c,t0,spd,tend:t0+c[c.length-1]/spd,r,map:sh.map};
  }
  const P=(k,t)=>{const R=T.routes[k]; return posAt(R.pts,R.c,(t-R.t0)*R.spd);};
  T.pos=P;
  const tv=(k,v)=>{const R=T.routes[k]; const i=(v==null||v>=R.map.length)?R.pts.length-1:R.map[v]; return R.t0+R.c[i]/R.spd;};  // v = control point; clamp: edited routes may shrink
  T.tv=tv;
  // ball timeline as list of segments {t0,t1,kind,from,to,holder}
  let holder='C', tcur=0; const segs=[];
  if(play.players.Q && play.players.C){ segs.push({t0:0.05,t1:0.35,kind:'snap',fromK:'C',toK:'Q',hold:false}); holder='Q'; tcur=0.35; }
  const evs=(play.ball||[]);
  for(const e of evs){
    if(e.give){
      const tg=Math.max(tv(e.give,e.v), tcur+0.2);
      segs.push({t0:tg-0.2,t1:tg,kind:'give',fromK:holder,toK:e.give});
      holder=e.give; tcur=tg;
    } else if(e.pass){
      const p0=holder; const ta0=tv(e.pass,e.v);
      const qEnd=(p0==='Q'&&play.routes.Q)?T.routes.Q.tend-0.1:0;
      let d=Math.max(0.35,Math.min(0.9,seglen(P(p0,ta0-0.5),P(e.pass,ta0))/8));
      const tt=Math.max(ta0-d,tcur+0.05,0.55,qEnd);
      segs.push({t0:tt,t1:tt+d,kind:'pass',fromK:p0,toK:e.pass,arc:true});
      holder=e.pass; tcur=tt+d;
    }
  }
  T.segs=segs; T.finalHolder=holder;
  let dur=0; for(const k in T.routes) dur=Math.max(dur,T.routes[k].tend); dur=Math.max(dur,tcur); T.dur=dur+HOLD;
  return T;
}
function ballAt(T,t){
  const segs=T.segs; let holder='C', pos=T.play.players.C?T.play.players.C.slice():[0,0], flying=false, arc=0;
  const hp=(k,tt)=>T.pos(k,tt);
  // before first seg: with C
  let cur=null;
  for(const s of segs){
    if(t<s.t0) break;
    if(t>=s.t1){cur={done:true,s};continue;}
    const u=(t-s.t0)/(s.t1-s.t0); const a=hp(s.fromK,s.t0), b=hp(s.toK,s.t1);
    const e=u*u*(3-2*u);
    pos=[a[0]+(b[0]-a[0])*e, a[1]+(b[1]-a[1])*e]; arc=s.arc?Math.sin(Math.PI*u)*0.9:0.25*Math.sin(Math.PI*u);
    return {pos:[pos[0],pos[1]+arc],flying:true,ang:Math.atan2(b[1]-a[1],b[0]-a[0])};
  }
  if(cur && cur.done){ const p=hp(cur.s.toK,t); return {pos:[p[0]+0.05,p[1]+0.32],flying:false,ang:0.6}; }
  const p=hp('C',t); return {pos:[p[0]+0.05,p[1]+0.32],flying:false,ang:0.6};
}

/* ------------ svg primitives ------------ */
function zigzag(pts,i0,i1){
  const out=[]; const amp=0.13*S, wl=0.34*S;
  for(let i=i0;i<i1;i++){
    const a=pts[i],b=pts[i+1]; const L=seglen(a,b); const ux=(b[0]-a[0])/L, uy=(b[1]-a[1])/L; const nx=-uy, ny=ux;
    const n=Math.max(2,Math.round(L/wl*2));
    for(let j=0;j<=n;j++){ const s=L*j/n; const o=(j%2?1:-1)*amp*(j==0||j==n?0:1); out.push([a[0]+ux*s+nx*o, a[1]+uy*s+ny*o]); }
  }
  return out;
}
function pathD(pts){return pts.map((p,i)=>(i?'L':'M')+f(p[0])+' '+f(-p[1])).join('');}
function arrow(pts,col,size){
  const n=pts.length; const b=pts[n-1]; let a=pts[n-2]; let i=n-2; while(i>0&&seglen(a,b)<0.25){i--;a=pts[i];}
  const ang=Math.atan2(-(b[1]-a[1]),b[0]-a[0]); const s=(size||0.5)*S;
  const p1=[b[0]+Math.cos(ang)*0.02*S,-b[1]+Math.sin(ang)*0.02*S];
  const l=[p1[0]-Math.cos(ang-0.42)*s,p1[1]-Math.sin(ang-0.42)*s], r=[p1[0]-Math.cos(ang+0.42)*s,p1[1]-Math.sin(ang+0.42)*s];
  return `<path d="M${f(p1[0])} ${f(p1[1])}L${f(l[0])} ${f(l[1])}L${f(r[0])} ${f(r[1])}Z" fill="${col}"/>`;
}
function football(x,y,ang,sc){
  sc=(sc||1)*S; const deg=-(ang||0.6)*180/Math.PI;
  return `<g transform="translate(${f(x)} ${f(-y)}) rotate(${f(deg)}) scale(${sc})"><ellipse rx="0.4" ry="0.25" fill="${BALL}" stroke="#4a2410" stroke-width="0.04"/><path d="M-0.16 0H0.16M-0.08 -0.07V0.07M0 -0.07V0.07M0.08 -0.07V0.07" stroke="#fff" stroke-width="0.04" fill="none"/></g>`;
}
function starPath(cx,cy,R){ const r=R*0.48; let d=''; for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5; const rr=i%2?r:R; d+=(i?'L':'M')+f(cx+Math.cos(a)*rr)+' '+f(cy+Math.sin(a)*rr);} return d+'Z'; }
function playerG(k,x,y,isStar,opacity){
  const c=COL[k], ink=INK[k]; const cx=f(x), cy=f(-y); let shape;
  const lab=`<text x="${cx}" y="${f(-y+0.24*S)}" text-anchor="middle" font-family="Avenir Next Condensed,Roboto Condensed,Arial Narrow,Helvetica,Arial,sans-serif" font-weight="700" font-size="${f(0.72*S)}" fill="${ink}">${k}</text>`;
  if(isStar) shape=`<path d="${starPath(cx,cy-0.02*S,0.98*S)}" fill="${c}" stroke="#fff" stroke-width="${f(0.05*S)}" stroke-linejoin="round"/>`;
  else if(k==='C') shape=`<rect x="${f(cx-0.46*S)}" y="${f(cy-0.46*S)}" width="${f(0.92*S)}" height="${f(0.92*S)}" rx="${f(0.1*S)}" fill="${c}"/>`;
  else shape=`<circle cx="${cx}" cy="${cy}" r="${f(R_P*S)}" fill="${c}"/>`;
  return `<g opacity="${opacity==null?1:opacity}">${shape}${lab}</g>`;
}

/* ------------ static ------------ */
function extents(play){
  let x0=1e9,x1=-1e9;
  for(const k in play.players){const p=play.players[k];x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);}
  for(const k in play.routes){for(const p of shape(play.routes[k]).pts){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);}}
  return [x0,x1];
}
function viewBox(play,aspect){
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  const add=(p)=>{x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);};
  for(const k in play.players)add(play.players[k]);
  for(const k in play.routes)for(const p of shape(play.routes[k]).pts)add(p);
  y0=Math.min(y0,-0.4); y1=Math.max(y1,0.4);
  const padx=0.95, pady=0.85; x0-=padx;x1+=padx;y0-=pady;y1+=pady;
  let h=Math.max(y1-y0,(x1-x0)/aspect,5.0); const w=h*aspect;
  const cx=(x0+x1)/2, cy=(y0+y1)/2;
  S=h/8.0;
  return {x:cx-w/2,y:-(cy+h/2),w:w,h:h};
}
function routeEls(k,r,opts){
  const col=COL[k]; let out='';
  const sh=shape(r), pts=sh.pts, at=i=>sh.map[Math.min(i,sh.map.length-1)];   // control index → drawn index
  const dotFrom=(r.dotFrom==null)?null:at(r.dotFrom);
  const solidTo=(dotFrom==null)?pts.length-1:dotFrom;
  const draw=(seg,dashed,motionRange)=>{
    if(seg.length<2)return '';
    let use=seg;
    if(motionRange){ /* zigzag on motion range only */ }
    return `<path d="${pathD(use)}" fill="none" stroke="${col}" stroke-width="${f((dashed?SW*0.95:SW)*S)}" stroke-linecap="round" stroke-linejoin="round" ${dashed?`stroke-dasharray="${f(0.02*S)} ${f(0.24*S)}"`:''} ${opts&&opts.ghost?`opacity="${opts.ghost}"`:''}/>`;
  };
  let base=pts;
  if(r.motion){ // build point list with zigzag substituted
    const [m0,m1]=r.motion.map(at); const zz=zigzag(pts,m0,m1);
    base=pts.slice(0,m0).concat(zz).concat(pts.slice(m1+1)); 
    // map dotFrom index shift
    if(dotFrom!=null){ const shift=zz.length-(m1-m0)-1; var dotIdx=dotFrom+shift+ (dotFrom>m1?0:0); }
  }
  const sp = r.motion? base : pts;
  if(dotFrom==null){ out+=draw(sp,false); }
  else { const di = r.motion? (sp.length-(pts.length-dotFrom)) : dotFrom; out+=draw(sp.slice(0,di+1),false)+draw(sp.slice(di),true); }
  if(r.end!=='none' && !(opts&&opts.noArrow)) out+=arrow(pts,col,0.5);
  else if(r.end==='none' && dotFrom==null){ /* plain end */ }
  return out;
}
function staticSVG(play,opt){
  opt=opt||{}; const aspect=opt.aspect||1.476; const vb=opt.vb?(S=opt.vb.h/8.0,opt.vb):viewBox(play,aspect);  // opt.vb pins the view (coach drag)
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}" preserveAspectRatio="xMidYMid meet" ${opt.attrs||''}>`;
  s+=`<line x1="${f(vb.x)}" x2="${f(vb.x+vb.w)}" y1="0" y2="0" stroke="#b8b8b8" stroke-width="${f(0.06*S)}"/>`;
  const order=['H','Y','X','Z','C','Q'];
  for(const k of order){ if(play.routes[k]) s+=routeEls(k,play.routes[k],opt); }
  // ball paths (dotted) for passes not already drawn as dotted route
  const Q=play.routes.Q; const qrel=(Q?Q.pts[Q.pts.length-1]:play.players.Q);
  const drawPass=(e,alt)=>{
    const R=play.routes[e.pass]||{pts:[play.players[e.pass]]}; if(!R.pts[0])return '';   // receiver without a route: catch at their spot
    const i=(e.v==null||e.v>=R.pts.length)?R.pts.length-1:e.v; const cp=R.pts[i];
    let o='';
    const viaRoute=(R.dotFrom!=null && R.dotFrom<=i);
    if(!viaRoute){ const col=COL[e.pass]; o+=`<path d="M${f(qrel[0])} ${f(-qrel[1])}L${f(cp[0])} ${f(-cp[1])}" stroke="${col}" stroke-width="${f(SW*0.95*S)}" stroke-dasharray="${f(0.02*S)} ${f(0.24*S)}" stroke-linecap="round" fill="none" ${alt?'opacity="0.85"':''}/>`; }
    const prev=R.pts[Math.max(0,i-1)]; const ang=Math.atan2(cp[1]-prev[1],cp[0]-prev[0]);
    o+=football(cp[0],cp[1],ang,1);
    return o;
  };
  for(const e of (play.ball||[])){
    if(e.pass){ s+=drawPass(e,false); for(const a of (e.alt||[])) s+=drawPass(a,true); }
    if(e.give){ const R=play.routes[e.give]||{pts:[play.players[e.give]]}; const p=R.pts[(e.v==null||e.v>=R.pts.length)?R.pts.length-1:e.v]; if(p) s+=football(p[0]+0.05,p[1]+0.05,0.5,1); }
  }
  for(const k in play.players){ const p=play.players[k]; s+=playerG(k,p[0],p[1],play.star===k); }
  
  return s+'</svg>';
}

/* ------------ animated frame ------------ */
function animSVG(play,T,t,opt){
  opt=opt||{}; const aspect=opt.aspect||1.3; const vb=opt.vb?(S=opt.vb.h/8.0,opt.vb):viewBox(play,aspect);
  let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(vb.x)} ${f(vb.y)} ${f(vb.w)} ${f(vb.h)}" preserveAspectRatio="xMidYMid meet" ${opt.attrs||''}>`;
  s+=`<line x1="${f(vb.x)}" x2="${f(vb.x+vb.w)}" y1="0" y2="0" stroke="#b8b8b8" stroke-width="${f(0.06*S)}"/>`;
  const order=['H','Y','X','Z','C','Q'];
  // ghost routes
  for(const k of order){ const r=play.routes[k]; if(r) s+=routeEls(k,r,{ghost:0.22,noArrow:true}); }
  // trails
  for(const k of order){ const R=T.routes[k]; if(!play.routes[k])continue; const sdist=Math.max(0,(t-R.t0)*R.spd); if(sdist<=0)continue;
    const sp=subPts(R.pts,R.c,sdist); if(sp.length>1){ const done=sdist>=R.c[R.c.length-1]-1e-6;
      s+=`<path d="${pathD(sp)}" fill="none" stroke="${COL[k]}" stroke-width="${f(SW*1.25*S)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if(done && play.routes[k].end!=='none') s+=arrow(R.pts,COL[k],0.5); } }
  // static football markers (ghost) at catch points
  // players
  for(const k in play.players){ const p=T.pos(k,t); s+=playerG(k,p[0],p[1],play.star===k && t<SNAP+0.05); }
  // star ring for star player after start
  const b=ballAt(T,t); s+=football(b.pos[0],b.pos[1],b.ang,1.25);
  return s+'</svg>';
}

root.PB={COL,shape,timeline,ballAt,staticSVG,animSVG,extents,viewBox,SNAP};
})(typeof window!=='undefined'?window:globalThis);
