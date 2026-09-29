/* Opening animation, once a day: four silver championship trophies (2023, 2024, 2024, 2025) flicker in,
   a hard-faced Packer Army player smashes through the middle, the trophies are knocked aside and
   "LET'S GO PACKERS" lights up under him. Tap to skip. Original drawing in team colors (green #203731,
   gold #FFB612); no league or team logos. */
(function(){
  const KEY='pa_intro_day', day=new Date().toDateString();
  let seen=null; try{ seen=localStorage.getItem(KEY); }catch(e){}
  if(seen===day||/[?&]nointro\b/.test(location.search)||navigator.webdriver&&!/[?&]intro\b/.test(location.search)) return;
  try{ localStorage.setItem(KEY,day); }catch(e){}
  const G='#203731', GOLD='#FFB612', S1='#f7f9fb', S2='#aab3bb', S3='#5b646c', SKIN='#e0ac7e';
  // Lombardi-style: a football standing in kicking position on a tall, three-sided tapering stand
  const trophy=(x,year,i,side)=>`<g transform="translate(${x} 0)"><g class="tro ${side}" style="animation-delay:${(0.1+i*0.22).toFixed(2)}s,1.72s">
    <rect x="-24" y="143" width="48" height="19" rx="2.5" fill="url(#sv)" stroke="${S3}" stroke-width="1"/>
    <text y="157.5" text-anchor="middle" font-size="12.5" font-weight="800" fill="#2b3237" letter-spacing=".5">${year}</text>
    <path d="M-12 143 L12 143 L4.5 78 L-4.5 78Z" fill="url(#sv)"/>
    <path d="M-1.2 143 L1.2 143 L0.6 78 L-0.6 78Z" fill="${S1}" opacity=".7"/>
    <path d="M-4.5 78 L4.5 78 L3 72 L-3 72Z" fill="${S2}"/>
    <g transform="translate(0 50) rotate(-12)"><ellipse rx="12.5" ry="23" fill="url(#sv)" stroke="${S3}" stroke-width=".8"/>
      <path d="M-7 -14 Q0 -24 7 -14" stroke="${S3}" stroke-width=".8" fill="none"/><path d="M-7 14 Q0 24 7 14" stroke="${S3}" stroke-width=".8" fill="none"/>
      <path d="M0 -9 V9 M-3 -5 h6 M-3 -1 h6 M-3 3 h6 M-3 7 h6" stroke="${S3}" stroke-width="1.1"/>
      <ellipse cx="-4.5" cy="-6" rx="2.2" ry="9" fill="#fff" opacity=".55"/></g>
    </g></g>`;
  // the player: charging straight at you, shoulders square, ball tucked, eye black and a scowl
  const player=`<g class=kid>
    <path class=legA d="M-9 66 L-15 96" stroke="${GOLD}" stroke-width="12" stroke-linecap="round"/><path class=legB d="M9 66 L16 92" stroke="${GOLD}" stroke-width="12" stroke-linecap="round"/>
    <ellipse cx="-15" cy="100" rx="8" ry="5" fill="#111"/><ellipse cx="16" cy="96" rx="8" ry="5" fill="#111"/>
    <rect x="-20" y="58" width="40" height="10" rx="3" fill="#fff"/><rect x="-23" y="62" width="7" height="16" rx="2" fill="${G}"/><rect x="16" y="62" width="7" height="16" rx="2" fill="${G}"/>
    <path d="M-30 20 Q0 8 30 20 L24 62 H-24Z" fill="${G}"/>
    <path d="M-30 20 Q-37 24 -36 34 L-26 34Z M30 20 Q37 24 36 34 L26 34Z" fill="${G}"/>
    <path d="M-35 30 h8 M27 30 h8" stroke="${GOLD}" stroke-width="3"/><path d="M-35 34 h8 M27 34 h8" stroke="#fff" stroke-width="1.6"/>
    <path d="M-32 28 Q-44 44 -34 58" stroke="${G}" stroke-width="11" fill="none" stroke-linecap="round"/><circle cx="-34" cy="60" r="6.5" fill="${SKIN}"/>
    <g><path d="M32 28 Q42 40 30 50" stroke="${G}" stroke-width="11" fill="none" stroke-linecap="round"/>
      <ellipse cx="22" cy="48" rx="12" ry="8" fill="#7a4a22" transform="rotate(-18 22 48)"/><path d="M16 47 h12" stroke="#fff" stroke-width="1.5" transform="rotate(-18 22 48)"/><circle cx="29" cy="51" r="6" fill="${SKIN}"/></g>
    <circle cx="0" cy="-6" r="25" fill="${GOLD}"/>
    <path d="M-3 -31 L-3 -12 M3 -31 L3 -12" stroke="${G}" stroke-width="3.2"/><path d="M0 -31 V-12" stroke="#fff" stroke-width="2"/>
    <path d="M-16 -10 Q0 -14 16 -10 L15 12 Q0 20 -15 12Z" fill="${SKIN}"/>
    <path d="M-13 -9 L-3 -5 M13 -9 L3 -5" stroke="#111" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M-11 -3 h6 M5 -3 h6" stroke="#111" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M-12 1 h8 M4 1 h8" stroke="#111" stroke-width="2.2" opacity=".85"/>
    <path d="M-6 10 Q0 7 6 10" stroke="#111" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M-18 -4 H18 M-17 5 H17 M-15 14 H15 M-12 -4 V16 M12 -4 V16" stroke="#8d969d" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <circle cx="-22" cy="-4" r="3.5" fill="${S3}"/><circle cx="22" cy="-4" r="3.5" fill="${S3}"/></g>`;
  const css=`#paIntro{position:fixed;inset:0;z-index:100;background:radial-gradient(circle at 50% 42%,#2c4d44 0,${G} 55%,#0f1d19 100%);display:flex;align-items:center;justify-content:center;flex-direction:column;animation:paOut .45s ease-in 3.6s forwards;cursor:pointer;-webkit-tap-highlight-color:transparent;overflow:hidden}
  #paIntro svg{width:min(96vw,600px);height:auto;overflow:visible}
  #paIntro .tro{opacity:0;animation-name:paFlick,paKnockL;animation-duration:.9s,.55s;animation-timing-function:steps(1,end),cubic-bezier(.2,.7,.3,1);animation-fill-mode:forwards,forwards;transform-box:fill-box;transform-origin:50% 100%}
  #paIntro .tro.r{animation-name:paFlick,paKnockR}
  #paIntro .flash{opacity:0;animation:paFlash .55s ease-out 1.66s forwards}
  #paIntro .burst{opacity:0;animation:paBurst .6s ease-out 1.68s forwards;transform-box:fill-box;transform-origin:50% 50%}
  #paIntro .runner{opacity:0;animation:paRush .75s cubic-bezier(.55,0,.8,.5) 1.05s forwards,paSettle .5s ease-out 1.8s forwards}
  #paIntro .kid{animation:paBob .18s ease-in-out 1.05s 12 alternate}
  #paIntro .legA{animation:paLegA .18s linear 1.05s 12 alternate;transform-origin:-9px 66px}
  #paIntro .legB{animation:paLegB .18s linear 1.05s 12 alternate;transform-origin:9px 66px}
  #paIntro .word{opacity:0;animation:paWord .5s ease-out 1.85s forwards,paGlow 1.1s ease-in-out 2.35s 2 alternate}
  #paIntro .skip{position:absolute;bottom:calc(18px + env(safe-area-inset-bottom));color:#b9cbc4;font:600 11px/1 inherit;letter-spacing:.2em}
  @keyframes paFlick{0%{opacity:0}12%{opacity:1}22%{opacity:.15}34%{opacity:1}44%{opacity:.35}56%,100%{opacity:1}}
  @keyframes paKnockL{from{opacity:1}to{opacity:1;transform:translate(-22px,4px) rotate(-14deg)}}
  @keyframes paKnockR{from{opacity:1}to{opacity:1;transform:translate(22px,4px) rotate(14deg)}}
  @keyframes paFlash{0%{opacity:0}30%{opacity:1}100%{opacity:0}}
  @keyframes paBurst{0%{opacity:0;transform:scale(.3)}25%{opacity:1}100%{opacity:0;transform:scale(1.6)}}
  @keyframes paRush{0%{opacity:0;transform:translateY(-40px) scale(.2)}20%{opacity:1}100%{opacity:1;transform:translateY(0) scale(1.75)}}
  @keyframes paSettle{from{opacity:1;transform:translateY(0) scale(1.75)}to{opacity:1;transform:translateY(-4px) scale(1.6)}}
  @keyframes paBob{to{transform:translateY(-4px)}}
  @keyframes paLegA{to{transform:rotate(22deg)}}@keyframes paLegB{to{transform:rotate(-22deg)}}
  @keyframes paWord{0%{opacity:0;transform:scale(.8)}60%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
  @keyframes paGlow{from{opacity:1;filter:drop-shadow(0 0 2px ${GOLD})}to{opacity:1;filter:drop-shadow(0 0 12px ${GOLD}) drop-shadow(0 0 22px ${GOLD})}}
  @keyframes paOut{to{opacity:0;visibility:hidden}}
  @media (prefers-reduced-motion:reduce){#paIntro,#paIntro *{animation-duration:.01s!important;animation-delay:0s!important;animation-iteration-count:1!important}#paIntro{animation:paOut .3s ease-in 1.5s forwards!important}}`;
  const el=document.createElement('div'); el.id='paIntro'; el.setAttribute('role','img'); el.setAttribute('aria-label',"Four championship trophies, 2023, 2024, 2024 and 2025. A Packer Army player smashes through them. Let's go Packers!");
  el.innerHTML=`<style>${css}</style><svg viewBox="-300 -40 600 380">
    <defs><linearGradient id=sv x1=0 x2=1><stop offset="0" stop-color="${S3}"/><stop offset=".42" stop-color="${S1}"/><stop offset=".62" stop-color="${S2}"/><stop offset="1" stop-color="${S3}"/></linearGradient>
      <radialGradient id=fl><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${GOLD}" stop-opacity=".85"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs>
    <g transform="translate(0 10) scale(1.15)">${[['2023',-187,'l'],['2024',-104,'l'],['2024',104,'r'],['2025',187,'r']].map(([y,x,sd],i)=>trophy(x,y,i,sd)).join('')}</g>
    <circle class=flash cx="0" cy="110" r="200" fill="url(#fl)"/>
    <g class=burst stroke="${GOLD}" stroke-width="5" stroke-linecap="round"><path d="M0 40 v-30 M49 61 l21 -21 M-49 61 l-21 -21 M70 110 h30 M-70 110 h-30 M49 159 l21 21 M-49 159 l-21 21"/></g>
    <g transform="translate(0 75)"><g class=runner style="transform-box:fill-box;transform-origin:50% 100%">${player}</g></g>
    <text class=word x="0" y="318" text-anchor="middle" font-size="36" font-weight="900" letter-spacing="4" fill="${GOLD}" style="transform-box:fill-box;transform-origin:50% 50%">LET'S GO <tspan fill="#fff">PACKERS</tspan></text></svg>
    <div class=skip>TAP TO SKIP</div>`;
  let fin; window.PA_INTRO=new Promise(r=>fin=r);   // setup dialogs wait for this (a modal dialog would cover the animation)
  const done=()=>{ if(el.parentNode) el.remove(); fin(); };
  el.addEventListener('click',done); el.addEventListener('animationend',e=>{ if(e.animationName==='paOut') done(); });
  setTimeout(done,4800);   // safety net
  const add=()=>document.body.appendChild(el);
  if(document.body) add(); else document.addEventListener('DOMContentLoaded',add);
})();
