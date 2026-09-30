/* Packer Army - Independent Play Analyzer (analyze.js)
 *
 * Pure, dependency-free. Reads play objects in the app's existing schema
 * (players{K:[x,y]}, routes{K:{pts,delay,spd,motion,end}}, ball[{pass|give,v,alt}],
 * side:'D' for defense) and returns findings. Never mutates plays.
 *
 * Coordinates: x right, y downfield, LOS y=0 (same as pb.js).
 * Scale: YD_PER_UNIT = 3 for offense AND defense (one shared grid; confirmed by the
 * coach 2026-09-30, matches defense field.yd = 0.3333 units/yd).
 *
 * Rule refs are to the 2019 SFX rulebook in the project; rush line and speeds
 * are CONFIG, not facts - tune them to what you see on the field.
 *
 * Exposes: window.PAAnalyze (browser) / module.exports (Node).
 */
(function (root) {
  'use strict';

  var DEFAULTS = {
    YD_PER_UNIT: 3,        // shared offense/defense grid: 1 unit = 3 yd
    fmt: {
      '5v5': { players: 5, rushYd: 7, pickYd: 1, wr: 5.5, qb: 4.5, rush: 6.0, ball: 13, react: 0.2 },
      // 6v6 rush line/pick distance come from rules.js ("Senior rule"); NOT in the 2019 PDF. Verify.
      '6v6': { players: 6, rushYd: 9, pickYd: 2, wr: 7.0, qb: 6.0, rush: 7.5, ball: 20, react: 0.2 }
    },
    lineTol: 0.2,          // |y| <= this => on the line
    lineAmbig: 0.4,        // between lineTol and this => ambiguous
    minReleaseT: 0.6,      // earliest realistic throw after snap (s)
    anticipate: 0.2,       // QB may release this long before the receiver's break (s)
    hotMaxT: 1.8,          // a play tagged VS RUSH should release by this (s)
    forwardMinYd: 1.0,     // pass must gain >= this many yd forward to be clearly legal (X.1)
    meshMaxUnits: 0.6,     // QB-carrier distance allowed at hand-off
    congestUnits: 1.0,     // receiver endpoints closer than this = one defender covers both
    collideUnits: 0.33,     // players closer than this mid-play = collision / rub risk
    screenAheadUnits: 1.2, // teammate within this ahead of carrier...
    screenSideUnits: 0.8,  // ...and this laterally => screening risk
    screenMinT: 0.3,       // for at least this long (s)
    tellMeanUnits: 0.8,    // formations this similar are "the same look"...
    tellMaxUnits: 0.3,     // ...so any player off by more than this is a tell
    tellCapUnits: 2.0,     // beyond this it is a different formation, not a tell
    nameMaxWords: 6,
    shareMaxPct: 0.35,
    dt: 0.05
  };

  /* ---------- geometry ---------- */
  function d(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }
  function pathLen(p) { var s = 0; for (var i = 1; i < p.length; i++) s += d(p[i - 1], p[i]); return s; }
  function r2(n) { return Math.round(n * 100) / 100; }
  function yd(u, C) { return Math.round(u * C.YD_PER_UNIT * 10) / 10; }

  function norm(row) {
    // Accepts raw play, or DB row {fmt,n,data}
    var p = row && row.data ? row.data : row;
    return Object.assign({}, p, { format: p.format || row.fmt || '5v5', n: p.n != null ? p.n : row.n });
  }

  /* ---------- kinematics ---------- */
  // Build a timed track for one player. Pre-snap motion (route.motion=[a,b]) is removed:
  // at the snap the player is at pts[b] and continues from there.
  function track(p, key, F, C) {
    var r = (p.routes || {})[key];
    var start = (p.players || {})[key];
    var pts = r && r.pts && r.pts.length ? r.pts.slice() : [start];
    var snapIdx = 0;
    if (r && r.motion) snapIdx = r.motion[1];
    var post = pts.slice(snapIdx);
    var ydps = key === 'Q' ? F.qb : F.wr;
    var v = (ydps / C.YD_PER_UNIT) * (r && r.spd ? r.spd : 1);
    var delay = r && r.delay ? r.delay : 0;
    var cum = [0];
    for (var i = 1; i < post.length; i++) cum.push(cum[i - 1] + d(post[i - 1], post[i]));
    return {
      key: key, pts: pts, post: post, snapIdx: snapIdx, delay: delay, v: v, cum: cum,
      tAt: function (idx) { // time to reach pts[idx]
        var j = Math.max(0, idx - snapIdx);
        return delay + (cum[Math.min(j, cum.length - 1)] || 0) / v;
      },
      pos: function (t) {
        if (t <= delay || post.length === 1) return post[0];
        var s = (t - delay) * v;
        for (var k = 1; k < post.length; k++) {
          if (s <= cum[k]) {
            var f = (s - cum[k - 1]) / (cum[k] - cum[k - 1] || 1);
            return [post[k - 1][0] + f * (post[k][0] - post[k - 1][0]), post[k - 1][1] + f * (post[k][1] - post[k - 1][1])];
          }
        }
        return post[post.length - 1];
      },
      endT: delay + cum[cum.length - 1] / v
    };
  }

  function rusherArrival(target, F, C) {
    var rl = F.rushYd / C.YD_PER_UNIT;
    var start = [target[0], rl]; // best-case rusher lined up over the target
    return F.react + d(start, target) / (F.rush / C.YD_PER_UNIT);
  }

  /* ---------- ball plan walk ---------- */
  // Returns events: [{type:'give'|'pass', from, to, t, at, fromPos}]
  function ballEvents(p, T, F, C, entry) {
    var ev = [], holder = 'Q', tNow = 0;
    var list = entry ? [entry] : (p.ball || []);
    for (var i = 0; i < list.length; i++) {
      var b = list[i], to = b.give || b.pass, tr = T[to];
      if (!tr) continue;
      var idx = b.v != null ? b.v : tr.pts.length - 1;
      var at = tr.pts[Math.min(idx, tr.pts.length - 1)];
      var tArr = Math.max(tr.tAt(idx), tNow);
      if (b.give) {
        var best = { dd: 1e9, t: tArr };
        for (var tt = tNow; tt <= tArr + 0.6; tt += C.dt) {
          var dd = d(T[holder].pos(tt), tr.pos(tt));
          if (dd < best.dd) best = { dd: dd, t: tt };
        }
        ev.push({ type: 'give', from: holder, to: to, t: best.t, tDrawn: tArr, gap: best.dd, at: tr.pos(best.t), fromPos: T[holder].pos(best.t) });
        tArr = best.t;
      } else {
        // Release = later of (passer finished drawn path / fake) and (receiver at break - anticipation).
        var passer = T[holder];
        var ready = holder === 'Q' ? passer.endT : tNow + 0.3;
        var brk = b.v != null ? b.v : Math.max(1, tr.pts.length - 2);
        var tBreak = tr.pts.length > 2 || b.v != null ? tr.tAt(brk) - C.anticipate : tr.tAt(tr.pts.length - 1) * 0.5;
        var tRel = Math.max(ready, tBreak, tNow, C.minReleaseT);
        var fp = passer.pos(tRel);
        var tCatch = tRel + (d(fp, at) * C.YD_PER_UNIT) / F.ball;
        ev.push({ type: 'pass', from: holder, to: to, t: tRel, tCatch: tCatch, at: at, fromPos: fp });
      }
      holder = to; tNow = tArr;
    }
    return ev;
  }

  /* ---------- offense checks ---------- */
  function analyzeOffense(p, C, out) {
    var F = C.fmt[p.format] || C.fmt['5v5'];
    var keys = Object.keys(p.players || {});
    var T = {}; keys.forEach(function (k) { T[k] = track(p, k, F, C); });
    function add(sev, code, msg, fix) { out.push({ n: p.n, fmt: p.format, name: p.name, sev: sev, code: code, msg: msg, fix: fix || null }); }

    // Roster / formation
    if (keys.length !== F.players) add('rule', 'PLAYER_COUNT', keys.length + ' offensive players; ' + p.format + ' needs ' + F.players + '.');
    if (!p.players.C) add('rule', 'NO_CENTER', 'No C: someone must snap between the legs.');
    if (p.players.Q && p.players.Q[1] > -C.lineTol) add('rule', 'QB_ON_LINE', 'QB must line up off the line.');
    var on = [], amb = [];
    keys.forEach(function (k) {
      if (k === 'Q') return;
      var y = p.players[k][1];
      if (Math.abs(y) <= C.lineTol) on.push(k); else if (Math.abs(y) <= C.lineAmbig) amb.push(k);
    });
    if (on.length < 1 || on.length > 4) add('rule', 'LINE_COUNT', on.length + ' on the line (' + on.join(',') + '); legal is 1\u20134.');
    if (amb.length) add('risk', 'LINE_AMBIG', amb.join(',') + ' neither clearly on nor off the line (' + amb.map(function (k) { return yd(-p.players[k][1], C) + ' yd'; }).join(', ') + ' back). Referee decides.', 'Put them on the line or at least 1.5 yd off.');

    // Motion (XI.1)
    var movers = keys.filter(function (k) { return p.routes[k] && p.routes[k].motion; });
    if (movers.length > 1) add('rule', 'MULTI_MOTION', 'More than one player in motion: ' + movers.join(','));
    movers.forEach(function (k) {
      var r = p.routes[k], a = r.pts[r.motion[0]], b = r.pts[r.motion[1]];
      if (b[1] - a[1] > 0.02) add('rule', 'MOTION_FORWARD', k + ' motion moves ' + yd(b[1] - a[1], C) + ' yd toward the LOS. Must be parallel (XI.1).', 'Set the motion end point to the same y as the start.');
    });

    // Idle players
    keys.forEach(function (k) {
      var r = p.routes[k];
      if (!r || !r.pts || pathLen(r.pts) < 0.25) {
        if (k === 'Q') { add('info', 'STATIC_QB', 'QB barely moves (' + yd(r ? pathLen(r.pts) : 0, C) + ' yd). Static QB is easy to rush.', 'Give the QB a drop, drift or fake.'); return; }
        add('info', 'IDLE', k + ' has no assignment.', k === 'C' ? 'Give C a stationary pick on the rusher (XII.14: 1 yd, arms down), then release.' : 'Every player needs a job; add a decoy or pick.');
      }
    });

    // QB past LOS without a hand-off
    var ev = ballEvents(p, T, F, C);
    var qGives = ev.filter(function (e) { return e.type === 'give' && e.from === 'Q'; });
    var qr = p.routes.Q;
    if (qr && qr.pts.some(function (pt) { return pt[1] > 0; }) && !qGives.length)
      add('rule', 'QB_CROSSES', 'QB route crosses the LOS without handing off first.');

    // Ball events
    ev.forEach(function (e, i) {
      if (e.type === 'give') {
        var gap = e.gap;
        if (e.at[1] > 0) add('rule', 'GIVE_PAST_LOS', 'Hand-off to ' + e.to + ' happens past the LOS.');
        if (gap > C.meshMaxUnits) add('risk', 'MESH_GAP', e.from + ' and ' + e.to + ' never get closer than ' + yd(gap, C) + ' yd (closest at ~' + r2(e.t) + 's). The drawn hand-off cannot happen as diagrammed.', 'Move the QB path or the hand-off point (v) so they meet.');
        var ra = rusherArrival(e.at, F, C);
        if (i === 0 && ra < e.t) add('risk', 'RUSH_BEATS_GIVE', 'Rusher reaches the mesh at ~' + r2(ra) + 's; hand-off at ~' + r2(e.t) + 's.', 'Shorten the carrier path to the mesh or add a C pick.');
      } else {
        if (e.fromPos[1] >= 0) add('rule', 'PASS_PAST_LOS', e.from + ' throws from past the LOS (illegal forward pass).');
        var fwd = (e.at[1] - e.fromPos[1]) * C.YD_PER_UNIT;
        if (fwd <= 0) add('rule', 'BACKWARD_PASS', 'Pass to ' + e.to + ' travels ' + r2(fwd) + ' yd (backward). Laterals are illegal; sideways counts as backward (X.1).', 'Deepen the passer or move the catch point downfield.');
        else if (fwd < C.forwardMinYd) add('risk', 'SIDEWAYS_PASS', 'Pass to ' + e.to + ' is only ' + r2(fwd) + ' yd forward. Referee may call it sideways = backward (X.1).', 'Get at least ' + C.forwardMinYd + ' yd of forward travel.');
        if (e.from === 'Q' || i === 0) {
          var ra2 = rusherArrival(e.fromPos, F, C), m = ra2 - e.t;
          e.margin = m;
          if (m < 0) add('risk', 'RUSH_BEATS_THROW', 'Throw to ' + e.to + ' leaves at ~' + r2(e.t) + 's; rusher arrives ~' + r2(ra2) + 's (' + r2(m) + 's).', 'Shorten the route, throw earlier in the progression, or add a C pick.');
          else if (m < 0.4) add('info', 'RUSH_TIGHT', 'Throw to ' + e.to + ' beats the rusher by only ' + r2(m) + 's.');
          if (/RUSH/i.test(p.sub || '') && e.t > C.hotMaxT) add('risk', 'TAG_MISMATCH', 'Tagged "' + p.sub + '" but the first throw leaves at ~' + r2(e.t) + 's.', 'Retag, or build a hot option under ' + C.hotMaxT + 's.');
        }
      }
    });
    // Alternates: legality only
    (p.ball || []).forEach(function (b) {
      (b.alt || []).forEach(function (a) {
        var e = ballEvents(p, T, F, C, a)[0]; if (!e || e.type !== 'pass') return;
        var fwd = (e.at[1] - e.fromPos[1]) * C.YD_PER_UNIT;
        if (fwd <= 0) add('rule', 'BACKWARD_ALT', 'Alternate throw to ' + a.pass + ' goes ' + r2(fwd) + ' yd (backward/sideways, X.1).', 'Deepen the QB or end ' + a.pass + "'s route closer to the LOS.");
        else if (fwd < C.forwardMinYd) add('risk', 'SIDEWAYS_ALT', 'Alternate throw to ' + a.pass + ' only ' + r2(fwd) + ' yd forward (X.1 judgment).');
      });
    });

    // Timeline checks: collisions and screening
    var horizon = 3.5, lastT = ev.length ? ev[ev.length - 1].t : 0, dt = C.dt;
    var give = ev.filter(function (e) { return e.type === 'give'; }).pop();
    var carrier = give && !ev.some(function (e) { return e.type === 'pass' && e.t > give.t; }) ? give.to : null;
    var pairsHit = {}, screenT = {};
    for (var t = 0.4; t <= horizon; t += dt) {
      for (var i = 0; i < keys.length; i++) for (var j = i + 1; j < keys.length; j++) {
        var a = keys[i], b = keys[j];
        if (a === 'Q' || b === 'Q') continue; // QB mesh handled above
        var dist = d(T[a].pos(t), T[b].pos(t)), d0 = d(p.players[a], p.players[b]);
        if (dist < C.collideUnits && dist < d0 - 0.3 && !pairsHit[a + b]) pairsHit[a + b] = { a: a, b: b, t: t, dist: dist };
      }
      if (carrier && t > give.t) {
        var cp = T[carrier].pos(t), cp2 = T[carrier].pos(t + dt), vx = cp2[0] - cp[0], vy = cp2[1] - cp[1], vl = Math.sqrt(vx * vx + vy * vy);
        if (vl > 1e-6) keys.forEach(function (k) {
          if (k === carrier || k === 'Q') return;
          var q = T[k].pos(t), rx = q[0] - cp[0], ry = q[1] - cp[1];
          var ahead = (rx * vx + ry * vy) / vl, side = Math.abs(rx * vy - ry * vx) / vl;
          if (ahead > 0 && ahead < C.screenAheadUnits && side < C.screenSideUnits) screenT[k] = (screenT[k] || 0) + dt;
        });
      }
    }
    Object.keys(pairsHit).forEach(function (k) {
      var h = pairsHit[k];
      add('risk', 'COLLISION', h.a + ' and ' + h.b + ' come within ' + yd(h.dist, C) + ' yd at ~' + r2(h.t) + 's. Collision risk; if a defender is between them it can be called an illegal pick (OPI).', 'Separate the paths or stagger timing with delay.');
    });
    Object.keys(screenT).forEach(function (k) {
      if (screenT[k] >= C.screenMinT) add('rule', 'SCREENING', k + ' runs just ahead of ball carrier ' + carrier + ' for ~' + r2(screenT[k]) + 's. Screening/running with the carrier is a flag (5 yd, loss of down).', 'Send ' + k + ' away from the run lane (see the mirror play).');
    });

    // Endpoint congestion (pass plays)
    if (ev.some(function (e) { return e.type === 'pass'; })) {
      var rec = keys.filter(function (k) { return k !== 'Q' && p.routes[k] && p.routes[k].pts[p.routes[k].pts.length - 1][1] > 0; });
      for (var a1 = 0; a1 < rec.length; a1++) for (var b1 = a1 + 1; b1 < rec.length; b1++) {
        var ea = p.routes[rec[a1]].pts.slice(-1)[0], eb = p.routes[rec[b1]].pts.slice(-1)[0], dd = d(ea, eb);
        if (dd < C.congestUnits) add('risk', 'CONGESTION', rec[a1] + ' and ' + rec[b1] + ' finish ' + yd(dd, C) + ' yd apart. One defender covers both.', 'Spread the endpoints to 3+ yd, or change depth.');
      }
    }

    // 6v6: H usage
    if (p.format === '6v6' && p.players.H) {
      var hTouched = (p.ball || []).some(function (b) { return b.give === 'H' || b.pass === 'H' || (b.alt || []).some(function (a) { return a.pass === 'H'; }); });
      var hr = p.routes.H, hDeep = hr ? Math.max.apply(null, hr.pts.map(function (q) { return q[1]; })) : -9;
      if (!hTouched && hDeep < 0) add('risk', 'H_NONFACTOR', 'H never gets the ball and never crosses the LOS. The 6th player is wasted.', 'Make H an alternate target or a real carrier.');
      if (/pitch/i.test(p.note || '')) add('risk', 'PITCH_DECOY', 'Note relies on a pitch threat. Pitches and laterals are illegal, so a rules-aware defense ignores it.');
    }

    // Communication
    var words = (p.name || '').trim().split(/\s+/).length;
    if (words > C.nameMaxWords) add('info', 'LONG_NAME', 'Name is ' + words + ' words. Too long to call in the huddle.', 'Add a 1\u20132 word call name.');

    return { events: ev, T: T };
  }

  /* ---------- defense checks ---------- */
  function analyzeDefense(p, C, out) {
    var F = C.fmt[p.format] || C.fmt['5v5'];
    function add(sev, code, msg, fix) { out.push({ n: p.n, fmt: p.format, name: p.name, sev: sev, code: code, msg: msg, fix: fix || null }); }
    var rl = F.rushYd / C.YD_PER_UNIT;
    var defs = Object.keys(p.players || {}).filter(function (k) { return /^[RSF]\d/.test(k); });
    defs.forEach(function (k) {
      var st = p.players[k], r = p.routes[k];
      if (/^R/.test(k) && st[1] < rl - 0.05) add('rule', 'ILLEGAL_RUSH_START', k + ' starts ' + yd(st[1], C) + ' yd off the LOS; the rush line is ' + F.rushYd + ' yd.');
      if (r && pathLen(r.pts) * C.YD_PER_UNIT > 12 && r.pts.slice(-1)[0][1] < 2) {
        add('risk', 'DEF_TOO_FAR', k + ' travels ' + yd(pathLen(r.pts), C) + ' yd to a shallow spot. Too far to arrive in time.', 'Give that job to the defender on that side.');
      }
    });
    var txt = (p.cue || '') + ' ' + (p.note || '');
    if (/ON TOP|STAY DEEP|SAFETIES DEEP/i.test(txt)) {
      var deepS = defs.filter(function (k) { if (!/^S/.test(k)) return false; var r = p.routes[k]; var e = r ? r.pts.slice(-1)[0] : p.players[k]; return e[1] >= 4.0; });
      if (!deepS.length) add('risk', 'NO_DEEP', 'Cue says safeties stay deep, but no S finishes deeper than 12 yd.', 'Keep one safety deep or change the cue.');
    }
    if (/TIGHT/i.test(txt)) {
      defs.filter(function (k) { return /^F/.test(k); }).forEach(function (k) {
        if (p.players[k][1] > 0.67) add('info', 'NOT_TIGHT', k + ' is labeled tight but lines up ' + yd(p.players[k][1], C) + ' yd off.');
      });
    }
    if (p.rushLabel && p.rushLabel.indexOf(String(F.rushYd)) < 0) add('info', 'RUSH_LABEL', 'Diagram says "' + p.rushLabel + '"; config for ' + p.format + ' is ' + F.rushYd + ' yd.');
  }

  /* ---------- book-level checks ---------- */
  function sameLook(a, b) {
    var ka = Object.keys(a.players).sort().join(), kb = Object.keys(b.players).sort().join();
    if (ka !== kb) return null;
    var ks = Object.keys(a.players), sum = 0, mx = 0, worst = [];
    ks.forEach(function (k) { var dd = d(a.players[k], b.players[k]); sum += dd; if (dd > mx) mx = dd; worst.push([k, dd]); });
    worst.sort(function (x, y) { return y[1] - x[1]; });
    return { mean: sum / ks.length, max: mx, worst: worst };
  }

  // Plays in the same series should share a pre-snap look. Explicit p.series wins;
  // otherwise the first 3 name tokens (e.g. "SG Left Read", "UC Twins Right").
  function seriesKey(p) {
    if (p.series) return String(p.series);
    return (p.name || '').toUpperCase().split(/\s+/).slice(0, 3).join(' ');
  }

  function analyzeBook(plays, C, out) {
    var off = plays.filter(function (p) { return p.side !== 'D'; });
    // Formation tells
    for (var i = 0; i < off.length; i++) for (var j = i + 1; j < off.length; j++) {
      var a = off[i], b = off[j];
      if (a.format !== b.format || (a.form && b.form && a.form !== b.form)) continue;
      if (seriesKey(a) !== seriesKey(b)) continue;
      var s = sameLook(a, b); if (!s) continue;
      if (s.mean < C.tellMeanUnits && s.max > C.tellMaxUnits && s.max <= C.tellCapUnits) {
        var who = s.worst.filter(function (w) { return w[1] > C.tellMaxUnits; }).map(function (w) { return w[0] + ' ' + yd(w[1], C) + 'yd'; }).join(', ');
        out.push({ n: a.n + '/' + b.n, fmt: a.format, name: a.name + ' \u2194 ' + b.name, sev: 'tell', code: 'FORMATION_TELL', msg: 'Near-identical look with different alignment: ' + who + '. A scout reads it pre-snap.', fix: 'Copy one alignment to the other.' });
      }
    }
    // Ball distribution per format
    var byFmt = {};
    off.forEach(function (p) {
      var f = byFmt[p.format] = byFmt[p.format] || { total: 0, prim: {}, any: {} };
      f.total++;
      var b0 = (p.ball || [])[0]; if (!b0) return;
      var who = b0.give || b0.pass; f.prim[who] = (f.prim[who] || 0) + 1;
      (p.ball || []).forEach(function (b) { [b.give || b.pass].concat((b.alt || []).map(function (x) { return x.pass; })).forEach(function (w) { if (w) f.any[w] = (f.any[w] || 0) + 1; }); });
    });
    Object.keys(byFmt).forEach(function (fm) {
      var f = byFmt[fm];
      Object.keys(f.prim).forEach(function (k) {
        if (f.prim[k] / f.total > C.shareMaxPct) out.push({ n: '*', fmt: fm, name: 'Book', sev: 'info', code: 'TOUCH_SHARE', msg: k + ' is first option in ' + f.prim[k] + ' of ' + f.total + ' plays (' + Math.round(100 * f.prim[k] / f.total) + '%).', fix: 'Spread first options; parents count touches.' });
      });
      if (!f.any.Q) out.push({ n: '*', fmt: fm, name: 'Book', sev: 'info', code: 'NO_QB_THROWBACK', msg: 'QB never receives. After a hand-off the QB is eligible (XI.2).', fix: 'Add a QB throwback trick play.' });
      f.dist = f.prim;
    });
    return byFmt;
  }


  /* ---------- line-of-scrimmage read (shared by offense and defense) ---------- */
  // One convention for both sides: every *Yd value is signed yards from the LOS,
  // + = downfield (defense side), - = offensive backfield.
  var OFF_KEYS = { Q: 1, C: 1, X: 1, Y: 1, Z: 1, H: 1 };

  function strength(players) {
    var L = 0, R = 0, B = 0;
    Object.keys(players).forEach(function (k) {
      if (!OFF_KEYS[k] || k === 'Q' || k === 'C') return;
      var x = players[k][0], y = players[k][1];
      if (y < -0.4 && Math.abs(x) <= 1.5) B++;       // off the line and inside the tackle box = backfield
      else if (x < -0.5) L++; else if (x > 0.5) R++; else B++;
    });
    var label = L === R ? L + 'x' + R + ' BALANCED' : Math.max(L, R) + 'x' + Math.min(L, R) + (L > R ? ' LEFT' : ' RIGHT');
    return { left: L, right: R, backfield: B, label: label + (B ? ' +' + B + ' BACK' : '') };
  }

  function losRead(row, opts) {
    var C = Object.assign({}, DEFAULTS, opts || {});
    var p = norm(row), F = C.fmt[p.format] || C.fmt['5v5'], U = C.YD_PER_UNIT;
    var players = p.players || {}, r = {
      n: p.n, fmt: p.format, side: p.side === 'D' ? 'D' : 'O', ydPerUnit: U,
      rushLineYd: F.rushYd, rushLineUnits: F.rushYd / U, offense: {}, defense: {}
    };
    // Offense (also present as ghosts on defense diagrams)
    var on = [], off = [];
    Object.keys(players).forEach(function (k) {
      if (!OFF_KEYS[k]) return;
      var y = players[k][1], dep = Math.round(y * U * 10) / 10;
      var state = Math.abs(y) <= C.lineTol ? 'ON' : Math.abs(y) <= C.lineAmbig ? 'AMBIGUOUS' : 'OFF';
      (state === 'ON' ? on : off).push({ k: k, yd: dep, state: state, x: players[k][0] });
    });
    r.offense = {
      onLine: on.map(function (o) { return o.k; }),
      lineCount: on.length, lineLegal: on.length >= 1 && on.length <= 4,
      offLine: off.map(function (o) { return { k: o.k, yd: o.yd, state: o.state }; }),
      qbYd: players.Q ? Math.round(players.Q[1] * U * 10) / 10 : null,
      strength: strength(players)
    };
    // Rusher distance to the QB (straight line, rusher lined up over the QB)
    if (players.Q) {
      var q = players.Q, dist = (r.rushLineUnits - q[1]) * U;
      r.offense.rushToQbYd = Math.round(dist * 10) / 10;
      r.offense.rushToQbS = Math.round((F.react + dist / F.rush) * 100) / 100;
    }
    // Ball events relative to the LOS
    if (p.side !== 'D' && p.routes) {
      var T = {}; Object.keys(players).forEach(function (k) { T[k] = track(p, k, F, C); });
      r.offense.events = ballEvents(p, T, F, C).map(function (e) {
        return { type: e.type, to: e.to, t: r2(e.t), atX: r2(e.at[0]), atYd: Math.round(e.at[1] * U * 10) / 10, fromYd: Math.round(e.fromPos[1] * U * 10) / 10 };
      });
    }
    // Defense
    if (p.side === 'D') {
      var rushers = [], atLine = [], between = [], deep = [];
      Object.keys(players).forEach(function (k) {
        if (OFF_KEYS[k]) return;
        var y = players[k][1], o = { k: k, yd: Math.round(y * U * 10) / 10 };
        var rushes = /^R/.test(k);
        if (rushes) rushers.push(Object.assign(o, { legalStart: y >= r.rushLineUnits - 0.05 }));
        else if (y <= 1 / U) atLine.push(o);
        else if (y < r.rushLineUnits) between.push(o);
        else deep.push(o);
      });
      r.defense = { rushers: rushers, atLine: atLine, underneath: between, deep: deep, rushCount: rushers.length };
    }
    return r;
  }

  // Defense-only LOS rules (XII.3, XII.10, XII.11): non-rushers may sit on the LOS but may not
  // cross it before the pass or hand-off; rushers must start from the rush line.
  function analyzeDefenseLOS(p, C, out) {
    var F = C.fmt[p.format] || C.fmt['5v5'], U = C.YD_PER_UNIT, rl = F.rushYd / U;
    function add(sev, code, msg, fix) { out.push({ n: p.n, fmt: p.format, name: p.name, sev: sev, code: code, msg: msg, fix: fix || null }); }
    var keys = Object.keys(p.players || {}), T = {};
    keys.forEach(function (k) { T[k] = track(p, k, F, C); });
    var ev = [];
    try { ev = ballEvents(p, T, F, C); } catch (e) { ev = []; }
    var tBall = ev.length ? ev[0].t : Infinity;
    keys.forEach(function (k) {
      if (OFF_KEYS[k]) return;
      var st = p.players[k];
      if (st[1] < 0) add('rule', 'DEF_OFFSIDE', k + ' lines up ' + yd(-st[1], C) + ' yd on the offense side of the LOS (offside, XII.10).');
      if (/^R/.test(k)) return;
      if (st[1] < rl - 0.05 && T[k]) {
        for (var t = 0; t < Math.min(tBall, 4); t += C.dt) {
          if (T[k].pos(t)[1] < -0.05) {
            add('rule', 'NONRUSHER_CROSSES', k + ' starts ' + yd(st[1], C) + ' yd off the ball (inside the ' + F.rushYd + '-yd rush line) and crosses the LOS at ~' + r2(t) + 's, before the pass or hand-off (~' + r2(tBall) + 's). Illegal rush, 10 yd (XII.11).', 'Start ' + k + ' on the rush line, or hold until the ball is out.');
            break;
          }
        }
      }
    });
  }

  /* ---------- public ---------- */
  var ORDER = { rule: 0, risk: 1, tell: 2, info: 3 };

  function run(rows, opts) {
    var C = Object.assign({}, DEFAULTS, opts || {});
    if (opts && opts.fmt) C.fmt = Object.assign({}, DEFAULTS.fmt, opts.fmt);
    var plays = (rows || []).map(norm).filter(function (p) { return p && p.players; });
    var findings = [], perPlay = {}, los = {};
    plays.forEach(function (p) {
      try {
        los[p.format + '#' + p.n + (p.side === 'D' ? 'D' : '')] = losRead(p, C);
        if (p.side === 'D') { analyzeDefense(p, C, findings); analyzeDefenseLOS(p, C, findings); }
        else {
          var r = analyzeOffense(p, C, findings);
          var first = r.events[0];
          perPlay[p.format + '#' + p.n] = first ? { first: first.type, to: first.to, t: r2(first.t), margin: first.margin != null ? r2(first.margin) : null } : null;
        }
      } catch (e) {
        findings.push({ n: p.n, fmt: p.format, name: p.name, sev: 'info', code: 'ANALYZER_ERROR', msg: String(e && e.message || e) });
      }
    });
    var book = analyzeBook(plays, C, findings);
    findings.sort(function (a, b) { return (ORDER[a.sev] - ORDER[b.sev]) || String(a.fmt).localeCompare(String(b.fmt)) || (parseFloat(a.n) || 0) - (parseFloat(b.n) || 0); });
    var counts = { rule: 0, risk: 0, tell: 0, info: 0 };
    findings.forEach(function (f) { counts[f.sev]++; });
    return { generated: new Date().toISOString(), config: C, counts: counts, findings: findings, timing: perPlay, los: los, book: book, plays: plays.length };
  }

  function forPlay(report, fmt, n) {
    return report.findings.filter(function (f) { return f.fmt === fmt && (f.n === n || String(f.n).split('/').indexOf(String(n)) >= 0); });
  }

  function toMarkdown(rep) {
    var L = ['# Playbook analysis', '', rep.plays + ' plays \u00b7 ' + rep.counts.rule + ' rule \u00b7 ' + rep.counts.risk + ' risk \u00b7 ' + rep.counts.tell + ' tell \u00b7 ' + rep.counts.info + ' info', ''];
    rep.findings.forEach(function (f) {
      L.push('- **[' + f.sev.toUpperCase() + '] ' + f.fmt + ' #' + f.n + '** ' + f.name + ': ' + f.msg + (f.fix ? ' _Fix: ' + f.fix + '_' : ''));
    });
    return L.join('\n');
  }

  var API = { run: run, forPlay: forPlay, losRead: losRead, strength: strength, toMarkdown: toMarkdown, DEFAULTS: DEFAULTS, _track: track };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PAAnalyze = API;
})(typeof window !== 'undefined' ? window : this);
