/* RULES tab: a plain-language quick reference to the SFX Flag Football Rules (updated Aug 2025), written for players and parents.
   It is a summary, not the rulebook: the official PDF governs. Section numbers point into the official rules.
   Division differences are keyed by format: 5v5 = AFC North, 6v6 = Senior Division. */
const RULES={
  pdf:'https://sfxyouthsports.com/wp-content/uploads/2025/08/2025-Rulebook.pdf',
  division:{
    '5v5':{name:'5V5 · AFC NORTH',players:'5 players on the field (a team needs at least 5 to play).',rush:'7 yards',pick:'A pick on the rusher must be stationary with arms down, set at least 1 yard away.',coach:'Coaches stay in the coaches area; to come onto the field a coach must call a timeout (only the NFC Division may have a coach on the field before the snap).'},
    '6v6':{name:'6V6 · SENIOR DIVISION',players:'6 players on the field. A team that only has 5 at the start may still play with 5.',rush:'9 yards',pick:'A pick on the rusher at or near the line must be set at least 2 yards away (Senior rule).',coach:'Coaches stay in the coaches area; to come onto the field a coach must call a timeout.'},
  },
  sections:[
    ['THE GAME & THE FIELD','I, V',[
      'Field is 30 × 70 yards with two 10-yard end zones and a first-down line at midfield.',
      'Every drive starts on your own 5-yard line (interceptions are the only exception).',
      '3 plays to cross midfield for a first down, then 3 plays to score. No score → the other team starts on its 5.',
      'No-run zones: the 5 yards before midfield and the 5 yards before the goal line are pass only (hand-offs are fine, but the play must end in a pass).',
      'Home team wears dark jerseys, visitors light.']],
    ['TIME & OVERTIME','VI',[
      'Two 20-minute halves (running clock for the first 18 minutes of each half); halftime is 5 minutes.',
      'Two-minute warning: the clock stops on incompletions, out of bounds and changes of possession.',
      '30 seconds to snap once the ball is spotted. Each team gets two 60-second timeouts per half.',
      'Tied after 40 minutes: 10-minute sudden-death overtime, one timeout each; first score wins, otherwise a tie.',
      'Mercy rule: a 30-point lead with 5 minutes or less left ends the game.']],
    ['SCORING','VI.14',[
      'Touchdown 6. Then choose: 1-point try from the 5 or 2-point try from the 12 (you must declare it).',
      'An interception on a try can be returned for the points being tried.',
      'Safety 2: the ball carrier is downed in their own end zone (or a sack there).']],
    ['OFFENSE: SNAP, MOTION, PASSING','XI, XII, XV',[
      'The center snaps between the legs; the QB lines up off the line. 1 to 4 players on the line.',
      'Only one player in motion, moving parallel to the line; everyone else set for 1 second.',
      '7-second pass clock: throw or hand off before the whistle on 7.',
      'Passes must be forward and from behind the line; shovel passes are OK; throwing it away is OK.',
      'Everyone is eligible to catch (the QB too, after a hand-off). One foot in bounds for a catch.']],
    ['OFFENSE: RUNNING','X',[
      'The QB cannot run past the line unless they first hand the ball off.',
      'Only direct hand-offs behind the line; several hand-offs in one play are OK.',
      'NO laterals or pitches of any kind.',
      'No blocking or screening, and no running alongside the ball carrier. Stationary "basketball" picks are legal (arms down, set 1 yard away).',
      'No flag guarding (stiff arms, dropping the head or shoulder, covering flags with the ball). No diving or hurdling.']],
    ['DEFENSE: RUSHING & FLAGS','XIII, XIV',[
      'Rushers must start from the rush line (see your division below). Any number may rush from there.',
      'Players not rushing may line up at the line of scrimmage but cannot cross it before a pass or hand-off.',
      'Once the ball is handed off, anyone on defense may cross the line.',
      'No contact with the passer above the waist; a rusher may try to block the pass.',
      'Pull flags only from the ball carrier. No holding, tackling or stripping the ball.']],
    ['WHEN THE PLAY IS DEAD','IX',[
      'The ball hits the ground (there are no fumbles: the ball is spotted where it was released).',
      'Exception: a dropped snap is spotted where it lands (in your own end zone it is a safety).',
      'A flag is pulled or falls off, the ball carrier steps out, or a knee or arm touches the ground.',
      'The 7-second pass clock runs out.']],
    ['PENALTIES AT A GLANCE','XVII',[
      '5 yards: offside, false start or illegal motion, illegal forward pass, illegal pick or pushing off, screening or blocking, delay of game, defensive holding.',
      '10 yards: roughing the passer, flag guarding, stripping, unnecessary roughness, taunting, unsportsmanlike conduct, illegal rush (starting inside the rush line), pulling a flag before the catch.',
      'Defensive pass interference: spot foul and first down.',
      'Unsportsmanlike or roughness penalties also sit the player for the rest of that possession; 3 in a game is an ejection.']],
    ['PLAYERS, GEAR & CONDUCT','III, IV, VIII, XVI',[
      'Every player plays at least every other possession.',
      'Mouthpieces are mandatory. Jerseys tucked in, pockets taped, only plastic non-removable cleats, no jewelry.',
      'Coaches may challenge a ruling (2 per game; a 3rd if both succeed). Two unsportsmanlike penalties eject a coach.',
      'Fans cheer for everyone; spectators stay at least 9 yards behind the sidelines. Zero tolerance for foul play.']],
    ['PLAYOFFS','VII',[
      'Every team makes the playoffs (single elimination, right after the regular season).',
      'Seeding by winning percentage; ties broken by head-to-head, then point differential.']],
  ]
};
function rulesHTML(fmt){
  const d=RULES.division[fmt]||RULES.division['5v5'], E=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  return `<div class=rules>
    <div class=rdiv><b>${d.name}</b>
      <div><span>PLAYERS</span>${E(d.players)}</div>
      <div><span>RUSH LINE</span>${d.rush} from the line of scrimmage. Start your rush from there.</div>
      <div><span>PICKS</span>${E(d.pick)}</div>
      <div><span>COACHES</span>${E(d.coach)}</div></div>
    ${RULES.sections.map(([t,sec,items])=>`<details class=rsec><summary><b>${t}</b><small>§ ${sec}</small></summary><ul>${items.map(i=>`<li>${E(i)}</li>`).join('')}</ul></details>`).join('')}
    <p class=rnote>This is a quick summary of the <b>SFX Flag Football Rules (updated August 2025)</b> for players and parents. The official rulebook and the referees on the field always govern.</p>
    <a class="btn gold" href="${RULES.pdf}" target=_blank rel=noopener>OPEN THE OFFICIAL SFX RULEBOOK (PDF)</a>
  </div>`;
}
