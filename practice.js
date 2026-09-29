/* PRACTICE tab: a season plan tied to the next game, a drill library, exercises and video references.
   Videos: the official "NFL Flag Football Drills" series by the New Orleans Saints youth football staff
   (each ID checked with YouTube oEmbed; 3-7 minutes, made for young players).
   SFX rules baked in: direct hand-offs only (no pitches / laterals), QB can't run past the line without a hand-off,
   drives start on your own 5 (3 downs to midfield, 3 to score), no-run zones, 7-second pass clock. */
const VIDEOS={
  warmup:['82WVFmw8R2I','Dynamic Warmup Drills','5:56'],
  flag1:['19BBhP3uRTE','Flag Pulling Essentials','3:56'],
  flag2:['0jfHNJUvu4E','Flag Pulling Drills','5:59'],
  angles:['l8BeqtyOj4c','Linebacker Drills, Pursuit Angles','4:47'],
  qb1:['ZxtBdqERcfc','Quarterback Drills','5:41'],
  qbread:['KuoqdqEy32U','Quarterback Drills, Reading Defenses','5:25'],
  wr1:['S0-lN7mA4Qk','Wide Receiver Drills','5:31'],
  wr2:['lTq8HsvOpqA','Wide Receiver Drills','4:26'],
  catch:['pfvAW9gPfsQ','Wide Receiver Drills, Catch & Score','6:39'],
  carry:['oDYmoCXraeE','Ball Carrying Drills','5:18'],
  rb1:['ugwBXIqM_jU','Running Back Drills','4:28'],
  rbfoot:['QJ1SN1bIOxE','Running Back Drills, Footwork','4:52'],
  rush:['DjFI4dO1G0c','Pass Rush Drills','4:26'],
  rushread:['Cws1QVXtysU','Defensive Rushing Drills, Reading Offenses','6:13'],
  db:['saXz9Gi5AVI','Defensive Back Drills','6:03'],
  zone:['_F_Ur7Gdu1s','Defensive Coverage Drills','4:29'],
  agility:['yAbzl95xOIk','Agility Drills','3:20'],
  seven:['DjKcZrBKTco','7-on-7 Drills','4:38'],
  demo:['XsNxFUsVP-w','Demo Flag Football Plays','3:51'],
};
const VIDEO_SERIES='https://www.youtube.com/playlist?list=PLImm55S4h6h71f0DH3llC9pMr9J7cprQs';

/* drill library: name, minutes, who, setup, how it works, coaching points, videos */
const DRILLS={
  warmup:{name:'Dynamic warm-up + snaps',min:8,who:'Everyone',setup:'Two lines of cones 15 yards apart.',
    how:'Down and back: jog, high knees, butt kicks, side shuffle, carioca, skips, walking lunges, backpedal, then two build-up sprints at 75%. Centers and QBs finish with 10 snaps, every practice.',
    pts:['Moving stretches only before practice (hold-still stretches are for the end)','Coach counts, players call out the next move','Snaps every practice: a bad snap is the easiest way to lose a down'],vids:['warmup']},
  snap:{name:'Snap & set',min:6,who:'Centers + QBs',setup:'Center on a line, QB 4-5 yards back (shotgun) or under center. Then from your own 5-yard line with the QB only about 3 yards back.',
    how:'20 snaps each pair. QB catches, eyes go straight downfield, and says the first read out loud. Swap who snaps so there is always a backup center.',
    pts:['Every play starts here: a bad snap is a lost down','Center: one smooth motion, laces up','On your own 5, a dropped snap in the end zone is a safety: the QB sets up shallower there','QB: hands out as a target, catch it without looking down'],vids:[]},
  cadence:{name:'Line up, set, motion',min:6,who:'Offense',setup:'Full formation on a line.',
    how:'Break the huddle, line up, everyone set for a full second. Add one player in motion, moving sideways (parallel to the line), never toward it. Coach calls a false start on any flinch.',
    pts:['1 to 4 players on the line, QB off the line','Only ONE player in motion, and only sideways','A false start is 5 yards: set means frozen'],vids:[]},
  flag:{name:'Flag pull 1-on-1',min:8,who:'Everyone',setup:'Lanes 5 yards wide, 10 yards long, marked with cones.',
    how:'Ball carrier tries to get through the lane; defender breaks down and pulls. Five tries each, then swap. Make it a competition: count clean pulls.',
    pts:['Break down (short, choppy steps) 2 yards before the runner','Eyes on the belly button, not the head or the ball','Attack at an angle, then grab with both hands','No diving, no grabbing jerseys'],vids:['flag1','flag2']},
  guard:{name:'Flag-guard awareness',min:6,who:'Ball carriers',setup:'Runner vs one defender in a 5-yard lane.',
    how:'Carry the ball high and away from the hips. No hands near your flags, no swatting, no diving. The defender calls out any flag guard.',
    pts:['Flag guarding is a 10-yard penalty','Run through the defender\'s angle, don\'t swat','Ball in the arm away from the defender'],vids:['carry']},
  angles:{name:'Pursuit angles',min:6,who:'Defense',setup:'Runner starts at the middle, a cone at each sideline 15 yards away.',
    how:'Coach points left or right; runner sprints to that sideline cone; defender takes an angle to meet the runner before the cone, not behind.',
    pts:['Run to where the runner will be, not where they are','Stay one step inside so they cannot cut back','Keep the runner going sideways toward the sideline'],vids:['angles']},
  drop:{name:'Drop & throw rhythm',min:8,who:'QBs + receivers',setup:'Receivers at 5 and 10 yards, QB at the snap spot.',
    how:'QB takes the drop, sets the feet and throws on the count "one-two-three-throw". Then add a rusher at the rush line (7 yd in 5v5, 9 yd in 6v6) so the count becomes real.',
    pts:['Ball out in about 3 seconds','Step toward the target, finish with the thumb pointing down','Throw to the receiver\'s outside shoulder, away from the defender'],vids:['qb1']},
  read:{name:'Read one defender',min:8,who:'QBs + receivers + 1 defender',setup:'Two receivers on the SAME side, one high and one low, one defender between them.',
    how:'Defender picks one receiver; QB throws to the other. Then switch to one inside and one outside receiver. One look, one decision.',
    pts:['Look at the defender, not the receiver you want','Decide before the rusher arrives','If nothing is open, scramble BEHIND the line and throw it away (the QB can\'t run past the line without a hand-off)'],vids:['qbread']},
  routes:{name:'Routes on air',min:10,who:'Receivers + C + QB',setup:'Cones where the routes break on this week\'s plays.',
    how:'Run each receiver\'s route from this week\'s plays with the QB throwing, no defense. Then call the play name out loud and run it from the huddle.',
    pts:['Sell the start: run straight so the defender backs up','Break sharp: sink the hips, snap the head around','Heads up on crossing routes: know who crosses under you','Hands up late, right when the ball is coming'],vids:['wr1']},
  catch:{name:'Catch & score',min:6,who:'Everyone who catches',setup:'Two lines, QB or coach throwing.',
    how:'Catch, tuck, turn upfield and sprint 10 yards to score. Throw high, low and behind so hands learn every catch.',
    pts:['Above the chest: thumbs together (diamond); below: pinkies together','Watch the ball all the way into the hands','Tuck it before you turn and run'],vids:['catch']},
  sideline:{name:'Sideline catches & the 7-second clock',min:6,who:'Receivers + QB',setup:'Cones 1 yard inside the sideline.',
    how:'Out routes and corners caught with a foot in bounds (one foot is enough). Coach counts the 7-second pass clock out loud: the whistle comes at the start of second 7.',
    pts:['Toes in, then turn upfield','QB: the ball is gone by "six"'],vids:['wr2']},
  release:{name:'Beat the defender off the line',min:8,who:'Receivers vs DBs',setup:'Receiver on the line, defender 1-2 yards in front.',
    how:'Receiver uses a quick fake (jab one way, go the other) to get past the defender, then runs the route. No contact: in flag football, both sides keep hands to themselves.',
    pts:['Win the first 3 steps','Fake with the head and shoulders, not only the feet','Get back on your route line after the fake'],vids:['wr2']},
  hole:{name:'Sit in the open spot',min:8,who:'Receivers + QB vs 2 zone defenders',setup:'Grid 15 × 15 yards, two defenders guard areas, not people.',
    how:'Receiver finds the open grass between the two defenders, stops, faces the QB and shows the hands. QB throws as soon as they sit.',
    pts:['Against zones, stop in the gap; against man, keep running','Get small and still when you sit','Face the QB so the ball is easy'],vids:['zone']},
  pick:{name:'Legal picks',min:6,who:'Receivers + C',setup:'Two receivers stacked, one defender.',
    how:'One receiver sets a legal pick: standing still, arms down, at least 1 yard from the defender (2 yards near the line in 6v6 Senior), so the other gets open. The center may pick the rusher, then release.',
    pts:['Stand still, arms down: moving into a defender is illegal','Set it where the defender will run, not on them','After the pick, release into your own route'],vids:[]},
  mesh:{name:'Hand-off exchange & fakes',min:8,who:'QB + runners',setup:'QB at the snap spot, runners in their starting spots from this week\'s plays.',
    how:'Rep each hand-off and fake from this week\'s run and trick plays. Direct hand-offs only: no pitches or laterals in SFX flag, and every hand-off happens behind the line. Add the fake: the QB shows the ball, then pulls it back and keeps the eyes on the defense.',
    pts:['Runner: inside elbow up, make a pocket for the ball','QB: put the ball in the pocket, don\'t toss it','The fake must look exactly like the real hand-off'],vids:['carry','rb1']},
  cuts:{name:'Cone cuts & ball security',min:6,who:'Runners',setup:'Zig-zag of 5 cones, 5 yards apart.',
    how:'Carry the ball through the cones, plant and cut at each one, and switch the ball to the outside arm.',
    pts:['Plant on the outside foot and push off hard','Ball in the arm away from the defender','Run downhill after the last cut'],vids:['rbfoot','carry']},
  rusher:{name:'Rusher get-off',min:6,who:'Rushers',setup:'Rusher behind a cone at the rush line (7 yd in 5v5, 9 yd in 6v6), coach as the QB.',
    how:'Go on the snap, not before. Sprint to the QB, arms up to bother the throw, and never run past the QB\'s outside shoulder (contain).',
    pts:['Start only when the ball is snapped, from the rush line','Arms high to block the view; never touch the passer above the waist (10 yards + first down)','Stay in front: make the QB go where your help is'],vids:['rush','rushread']},
  mirror:{name:'Mirror & break on the ball',min:8,who:'Defensive backs',setup:'Box 5 × 5 yards for mirror; then a 10-yard lane.',
    how:'Defender mirrors the receiver side to side in the box. Then the receiver runs a route and the defender breaks on the throw.',
    pts:['Stay low with your eyes on the hips','Keep a cushion: never let them behind you','When the QB\'s arm comes forward, go for the ball'],vids:['db']},
  zonedrop:{name:'Zone drops & talking',min:8,who:'Defense',setup:'Cones marking each zone on this week\'s defense.',
    how:'Line up in this week\'s defense, drop to your spot on the snap, and call out what you see: "Ball!", "Cross!", "Run!". Coach moves around as the QB.',
    pts:['Everyone talks, every play','Eyes on the QB when you are in a zone','When the ball is thrown, everyone runs to it'],vids:['zone']},
  agility:{name:'Agility: 5-10-5 + ladders',min:6,who:'Everyone',setup:'Three cones 5 yards apart; a chalk or rope ladder.',
    how:'5-10-5 shuttle (touch each line), then quick-feet ladder patterns. Short work, full rest.',
    pts:['Quality over quantity: fast feet, then rest','Stay low when you change direction'],vids:['agility']},
  team:{name:'Team walk-through → full speed',min:20,who:'Offense vs defense',setup:'Full field width with cones for the rush line.',
    how:'Walk through each play of the week, then half speed, then full speed against the scout defense. Switch: defense runs this week\'s defenses against the offense.',
    pts:['Call the play by its wristband number, like in a game','Everyone knows their job on every play','Coach asks one player per rep: "What\'s your job?"'],vids:['seven']},
  goal:{name:'Goal line & extra points',min:8,who:'Offense vs defense',setup:'Ball at the 5 (1-point try) or the 12 (2-point try).',
    how:'Alternate goal-line downs and tries. From the 5 you are in the no-run zone: the play must end in a pass. On a try the defense can return an interception, so everyone chases a pick.',
    pts:['Short, quick throws beat a crowded end zone','Defense: stay in front of the goal line and talk'],vids:[]},
  game:{name:'Game-situation scrimmage',min:10,who:'Everyone',setup:'Start on your own 5, like a real SFX drive: 3 downs to cross midfield, then 3 downs to score.',
    how:'Play real downs with the wristband cards, including both no-run zones (pass only). Add a situation every series: 3rd and long, the try after a touchdown, last play of the half.',
    pts:['Huddle fast, line up fast','Celebrate good choices, not only touchdowns'],vids:[]},
  hurry:{name:'Hurry-up (no huddle)',min:8,who:'Offense',setup:'Coach holds up a card number, 25-second clock.',
    how:'Coach shows a number, offense lines up and runs it without a huddle. Five plays in a row, then rest.',
    pts:['Look at your wristband, not your teammates','Get set for 1 second before the snap'],vids:[]},
  cool:{name:'Cool-down & one thing',min:4,who:'Everyone',setup:'Circle up.',
    how:'Hold-still stretches: hamstrings, quads, hips, calves (20-30 seconds each). Each player says one thing they did well today.',
    pts:['Drink water','Coach ends with the plan for the next game'],vids:[]},
};

/* season plan: one theme per game week. plays/defs pick live plays by type so the plan follows Coach's edits.
   Goal-line + try reps every week from week 2 (every drive crosses two no-run zones and every TD has a try). */
const WEEKS=[
  {t:'Foundations',goal:'Clean snaps, lining up legally, sure flag pulls, and the first eight plays on the card.',
   plays:p=>p.n<=8, defs:d=>d.n===51||d.n===57,
   A:['warmup','snap','cadence','flag','routes','team','cool'], B:['warmup','catch','mesh','zonedrop','game','cool'],
   home:'50 catches against a wall. Watch the flag pulling and warm-up videos.'},
  {t:'Beat the rush',goal:'Ball out in about 3 seconds. Quick throws and runs that punish the rusher.',
   plays:p=>p.sub==='VS RUSH', defs:d=>d.sub==='3RD DOWN',
   A:['warmup','drop','routes','sideline','team','cool'], B:['warmup','rusher','guard','goal','game','cool'],
   home:'QBs: 30 short throws with a 3-count. Rushers: watch the pass-rush video.'},
  {t:'Beat man coverage',goal:'Win off the line and break sharp. Man-to-man loses to speed and good fakes.',
   plays:p=>p.sub==='VS MAN', defs:d=>d.n===56||d.n===51,
   A:['warmup','release','routes','catch','team','cool'], B:['warmup','mirror','flag','goal','game','cool'],
   home:'Practice one fake at the start of your route 20 times. Watch a wide receiver video.'},
  {t:'Beat zone coverage',goal:'Find the open grass and sit. QB reads one defender.',
   plays:p=>p.sub==='VS ZONE', defs:d=>d.sub==='VS SHORT PASSES'||d.n===52,
   A:['warmup','hole','read','pick','team','cool'], B:['warmup','zonedrop','angles','goal','game','cool'],
   home:'QBs: watch the reading-defenses video. Everyone: find each defense\'s zones in the DEFENSE tab.'},
  {t:'Run game & fakes',goal:'Hand-offs and fakes that look exactly the same. Direct hand-offs only (no pitches or laterals).',
   plays:p=>p.cat==='run'||(p.cat==='trick'&&/fake|reverse|counter/i.test(p.name)), defs:d=>d.sub==='VS RUNS'||d.sub==='VS FAKE HAND-OFFS'||d.n===55,
   A:['warmup','mesh','cuts','guard','team','cool'], B:['warmup','angles','rusher','goal','game','cool'],
   home:'Runners: cone cuts in the park. Watch the ball carrying video.'},
  {t:'Red zone & goal line',goal:'Score from inside the 10. Remember the no-run zone before the goal line.',
   plays:p=>p.cat==='redzone'||p.sub==='GOAL LINE'||p.sub==='SHORT YARDAGE', defs:d=>d.cat==='redzone'||d.n===54,
   A:['warmup','drop','hole','goal','team','cool'], B:['warmup','zonedrop','mirror','goal','game','cool'],
   home:'Learn every red play on your wristband by heart.'},
  {t:'Big plays & tricks',goal:'Take the shot when the defense cheats. Trick plays work when the basics are sharp.',
   plays:p=>p.cat==='trick'||p.sub==='OPEN FIELD', defs:d=>d.cat==='trick',
   A:['warmup','mesh','routes','pick','team','cool'], B:['warmup','angles','zonedrop','goal','game','cool'],
   home:'Watch the demo-plays video, then find the same idea on our cards.'},
  {t:'Game sharp',goal:'Fast huddles, no-huddle, and every situation: 3rd down, last play, extra points.',
   plays:p=>p.cat==='throw', defs:d=>d.sub==='3RD DOWN'||d.n===51,
   A:['warmup','hurry','read','goal','team','cool'], B:['warmup','agility','flag','hurry','game','cool'],
   home:'Quiz a teammate: Coach says a number, you say the play.'},
];
const PLAYOFF={t:'Playoffs: our best',goal:'Only what we do best. Coach picks the 8 plays and 3 defenses for the game; rep them until they are automatic.',
   plays:p=>p.cat==='redzone'||p.sub==='VS RUSH', defs:d=>d.n===51||d.n===58||d.n===54,
   A:['warmup','snap','flag','hurry','team','cool'], B:['warmup','goal','game','cool'], taper:true,
   home:'Rest, water, sleep. Review the 8 plays Coach picked.'};

const EXERCISES=[
  ['Before every practice','Dynamic warm-up (8 min): high knees, butt kicks, side shuffle, carioca, skips, lunges, backpedal, build-up sprints.'],
  ['Speed','10 × 20-yard sprints with a walk back. Starts from a football stance.'],
  ['Change of direction','5-10-5 shuttle × 4, zig-zag cone runs × 4, ladder quick feet (chalk lines work).'],
  ['Strength (body weight only)','Squats 2 × 12, lunges 2 × 8 each leg, push-ups 2 × 8-10, plank 3 × 30 s, side plank 2 × 20 s each side.'],
  ['Hands (at home)','50 wall catches a day with both hands; tennis-ball catches for quick hands.'],
  ['After every practice','Hold-still stretches 20-30 s: hamstrings, quads, hips, calves. Drink water.'],
];
const SAFETY=['Water break every 15-20 minutes, more on hot days.','Mouthpiece: required in SFX games, so wear it at practice too.','Plastic, non-removable cleats (no metal); no jewelry.','Heads up on crossing routes and around the QB: collisions are the real injury risk in flag.','Soreness is normal; sharp pain is not: stop and tell Coach.','No max lifts at this age: body weight builds speed and strength safely.','Non-contact: no blocking, no diving, no stiff arms; rushers never touch the passer above the waist.'];

function practiceWeek(idx,isPlayoff){ return isPlayoff?PLAYOFF:WEEKS[Math.max(0,Math.min(WEEKS.length-1,idx))]; }

/* html: game = the game we're getting ready for (or null), idx = its place in the regular season, plays / defs = live lists,
   picked = a week chosen from the season plan (shows a button back to the next game) */
function practiceHTML(o){
  const E=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const w=practiceWeek(o.idx,o.playoff), vid=k=>{ const v=VIDEOS[k]; return `<a class=pvid href="https://www.youtube.com/watch?v=${v[0]}" target=_blank rel=noopener>▶ ${E(v[1])} <small>${v[2]}</small></a>`; };
  const body=d=>`<p><b>SET UP</b> ${E(d.setup)}</p><p><b>HOW</b> ${E(d.how)}</p><ul>${d.pts.map(x=>`<li>${E(x)}</li>`).join('')}</ul>${d.vids.map(vid).join('')}`;
  const pl=o.plays.filter(w.plays).slice(0,8), df=o.defs.filter(w.defs).slice(0,3);
  const chip=p=>`<button class=pplay data-open="${p.n}"><b>${p.n}</b> ${E(p.name)}</button>`;
  const session=(k,label)=>{ const ids=w[k], tot=ids.reduce((a,d)=>a+DRILLS[d].min,0);
    return `<div class=psess><h4>${label} <small>${tot} min of drills + water breaks${w.taper&&k==='B'?' · light taper':''}</small></h4>
      <ol>${ids.map(d=>`<li><details class=pdrill><summary>${E(DRILLS[d].name)} <small>${DRILLS[d].min} min</small></summary>${body(DRILLS[d])}</details></li>`).join('')}</ol></div>`; };
  const head=o.game?`<div class=pnext><b>${o.picked?'SEASON PLAN · WEEK VIEW':'GETTING READY FOR'}</b><h3>${E(o.game.title)}</h3><span>${E(o.game.when)}</span>${o.picked?'<button class=pback data-wk=next>↩ BACK TO THE NEXT GAME</button>':''}</div>`
                   :`<div class=pnext><b>NO GAME ON THE SCHEDULE</b><h3>Pick any week below</h3>${o.picked?'<button class=pback data-wk=next>↩ BACK TO THE NEXT GAME</button>':''}</div>`;
  const weeksNav=[...WEEKS.map((x,i)=>[i,x.t,false]),[-1,PLAYOFF.t,true]].map(([i,t,po])=>`<button class="pwk ${((po&&o.playoff)||(!po&&!o.playoff&&i===o.idx))?'on':''}" data-wk="${po?'po':i}">${po?'PO':'WK '+(i+1)} · ${E(t)}</button>`).join('');
  return `<div class=prac>${head}
    <div class=ptheme><b>THIS WEEK: ${E(w.t.toUpperCase())}</b><p>${E(w.goal)}</p>
      <p class=pnote>1-2 practices before the game (about 60 minutes each with water breaks). If you only get one, run Practice A. Short on time? Cut the team period in half, never the warm-up. Tap a drill to see how to run it.</p></div>
    <div class=psessions>${session('A','PRACTICE A · OFFENSE FIRST')}${session('B','PRACTICE B · DEFENSE + SCRIMMAGE')}</div>
    <div class=pblock><h4>PLAYS TO REP THIS WEEK</h4><div class=pchips>${pl.map(chip).join('')||'<small>Coach picks.</small>'}</div>
      <h4>DEFENSES TO REP</h4><div class=pchips>${df.map(chip).join('')}</div></div>
    <div class=pblock><h4>AT HOME</h4><p>${E(w.home)}</p></div>
    <details class=pdet><summary><b>SEASON PLAN</b><span>tap a week</span></summary><div class=pweeks>${weeksNav}</div></details>
    <details class=pdet id=pDrills><summary><b>DRILL LIBRARY</b><span>${Object.keys(DRILLS).length} drills</span></summary><div class=pdrills>${Object.entries(DRILLS).map(([k,d])=>`<details class=pdrill id="drill-${k}"><summary>${E(d.name)} <small>${d.min} min · ${E(d.who)}</small></summary>${body(d)}</details>`).join('')}</div></details>
    <details class=pdet><summary><b>EXERCISES & SAFETY</b><span>ages 12-15</span></summary><div class=pdrills>${EXERCISES.map(([a,b])=>`<p><b>${E(a.toUpperCase())}</b> ${E(b)}</p>`).join('')}<h4>SAFETY</h4><ul>${SAFETY.map(x=>`<li>${E(x)}</li>`).join('')}</ul></div></details>
    <details class=pdet><summary><b>VIDEOS TO WATCH</b><span>official NFL FLAG series</span></summary><div class=pdrills>
      <p class=pnote>Short videos (3-7 min) from the NFL FLAG drill series, taught by the New Orleans Saints youth football coaches.</p>
      ${Object.keys(VIDEOS).map(vid).join('')}<a class=pvid href="${VIDEO_SERIES}" target=_blank rel=noopener>▶ The whole series on YouTube</a></div></details>
  </div>`;
}
