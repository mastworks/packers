/* Packer Army - Line-of-scrimmage overlay (los-overlay.js)
 * Depends on analyze.js (PAAnalyze.losRead). Draws the same LOS read on offense
 * and defense diagrams, on the shared grid (1 unit = 3 yd).
 *
 *   var prims = PALOS.build(play, { halfW: 5, yMin: -2.8, yMax: 5.4, events: true });
 *   svgEl.insertAdjacentHTML('afterbegin', PALOS.toSVG(prims, view));  // SVG renderers
 *   PALOS.drawCanvas(ctx, prims, view);                               // canvas renderers
 *
 * view = { toPx: function (x, y) { return [px, py]; }, scale: pxPerUnit }
 * Primitives are in play units, so pb.js keeps its own transform.
 */
(function (root) {
  'use strict';
  var A = root.PAAnalyze || (typeof require !== 'undefined' ? require('./analyze.js') : null);

  var STYLE = {
    los: '#9aa5a1', losW: 1.4,
    tick: '#b3bdb9', tickW: 0.8,
    rush: '#FFB612', rushW: 1.1, rushDash: [5, 4],
    band: 'rgba(255,182,18,0.07)',
    onLine: '#203731', ambig: '#e5484d', barW: 2,
    chipBg: 'rgba(32,55,49,0.9)', chipFg: '#FFFFFF',
    label: '#6b7a75', event: '#203731'
  };

  function fmtYd(v) { return (v > 0 ? '+' : v < 0 ? '\u2212' : '') + Math.abs(v); }

  function build(play, opts) {
    opts = opts || {};
    var rd = A.losRead(play, opts.analyze), U = rd.ydPerUnit;
    var p = play.data || play, pl = p.players || {};
    var xs = Object.keys(pl).map(function (k) { return Math.abs(pl[k][0]); });
    var halfW = opts.halfW || Math.max(4.5, Math.max.apply(null, xs.concat([0])) + 0.7);
    var yMin = opts.yMin != null ? opts.yMin : -8 / U, yMax = opts.yMax != null ? opts.yMax : 16 / U;
    var P = [];

    // No-rush zone band (defense) and rush line (both sides)
    var rl = rd.rushLineUnits;
    if (rd.side === 'D') P.push({ t: 'rect', x0: -halfW, y0: 0, x1: halfW, y1: rl, fill: STYLE.band });
    if (rl <= yMax) {
      P.push({ t: 'line', a: [-halfW, rl], b: [halfW, rl], stroke: STYLE.rush, w: STYLE.rushW, dash: STYLE.rushDash });
      P.push({ t: 'text', at: [halfW - 0.05, rl + 0.08], s: 'RUSH ' + rd.rushLineYd + (rd.side === 'D' ? '' : ' \u00b7 ' + rd.offense.rushToQbYd + ' TO QB'), anchor: 'end', color: '#b07d00', size: 0.9, weight: 700 });
    }

    // LOS
    P.push({ t: 'line', a: [-halfW, 0], b: [halfW, 0], stroke: STYLE.los, w: STYLE.losW });
    P.push({ t: 'text', at: [-halfW + 0.05, 0.08], s: 'LOS', anchor: 'start', color: STYLE.label, size: 0.9, weight: 700 });

    // Yard ticks on both edges, every yard; long + labeled every 5
    var ydMin = Math.ceil(yMin * U), ydMax = Math.floor(yMax * U);
    for (var y = ydMin; y <= ydMax; y++) {
      if (y === 0) continue;
      var yu = y / U, big = y % 5 === 0, len = big ? 0.28 : 0.12;
      [-1, 1].forEach(function (s) {
        P.push({ t: 'line', a: [s * halfW, yu], b: [s * (halfW - len), yu], stroke: STYLE.tick, w: STYLE.tickW });
      });
      if (big) P.push({ t: 'text', at: [-halfW + 0.34, yu], s: fmtYd(y), anchor: 'start', color: STYLE.label, size: 0.75, baseline: 'middle' });
    }

    // On-line markers under offensive players
    var o = rd.offense;
    o.onLine.forEach(function (k) {
      var q = pl[k]; P.push({ t: 'line', a: [q[0] - 0.22, -0.3], b: [q[0] + 0.22, -0.3], stroke: STYLE.onLine, w: STYLE.barW, ghost: rd.side === 'D' });
    });
    o.offLine.forEach(function (e) {
      if (e.state === 'AMBIGUOUS') {
        var q = pl[e.k]; P.push({ t: 'line', a: [q[0] - 0.22, q[1] - 0.3], b: [q[0] + 0.22, q[1] - 0.3], stroke: STYLE.ambig, w: STYLE.barW, dash: [2, 2] });
        P.push({ t: 'text', at: [q[0], q[1] - 0.45], s: 'ON? ' + fmtYd(e.yd), anchor: 'middle', color: STYLE.ambig, size: 0.7, weight: 700 });
      }
    });

    // Header chip: the read, in one line
    var chip;
    if (rd.side === 'D') {
      var d = rd.defense;
      chip = 'RUSH ' + d.rushCount + ' \u00b7 UNDER ' + d.underneath.length + ' \u00b7 DEEP ' + d.deep.length + (d.atLine.length ? ' \u00b7 LOS ' + d.atLine.length : '') + ' \u00b7 ' + o.strength.label;
    } else {
      chip = o.lineCount + ' ON LINE' + (o.lineLegal ? '' : ' \u26a0') + ' \u00b7 QB ' + Math.abs(o.qbYd) + ' YD \u00b7 ' + o.strength.label;
    }
    P.push({ t: 'chip', at: [-halfW + 0.1, yMax - 0.12], s: chip, bg: STYLE.chipBg, color: STYLE.chipFg, size: 0.8 });

    // Ball events relative to the LOS (offense only): where the hand-off / catch happens, in yards
    if (opts.events !== false && o.events) {
      o.events.forEach(function (e) {
        P.push({ t: 'dot', at: [e.atX, e.atYd / U], r: 0.07, fill: STYLE.event });
        P.push({ t: 'text', at: [e.atX + 0.14, e.atYd / U - 0.05], s: (e.type === 'give' ? 'GIVE ' : 'CATCH ') + fmtYd(e.atYd), anchor: 'start', color: STYLE.event, size: 0.72, weight: 700, baseline: 'middle' });
      });
    }
    return { read: rd, prims: P, halfW: halfW };
  }

  /* ---------- adapters ---------- */
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function toSVG(built, view) {
    var S = view.scale, out = ['<g class="pa-los" pointer-events="none">'];
    built.prims.forEach(function (p) {
      if (p.t === 'rect') {
        var a = view.toPx(p.x0, p.y1), b = view.toPx(p.x1, p.y0);
        out.push('<rect x="' + Math.min(a[0], b[0]) + '" y="' + Math.min(a[1], b[1]) + '" width="' + Math.abs(b[0] - a[0]) + '" height="' + Math.abs(b[1] - a[1]) + '" fill="' + p.fill + '"/>');
      } else if (p.t === 'line') {
        var a2 = view.toPx(p.a[0], p.a[1]), b2 = view.toPx(p.b[0], p.b[1]);
        out.push('<line x1="' + a2[0] + '" y1="' + a2[1] + '" x2="' + b2[0] + '" y2="' + b2[1] + '" stroke="' + p.stroke + '" stroke-width="' + p.w + '"' +
          (p.dash ? ' stroke-dasharray="' + p.dash.join(' ') + '"' : '') + (p.ghost ? ' opacity=".45"' : '') + ' stroke-linecap="round"/>');
      } else if (p.t === 'dot') {
        var dp = view.toPx(p.at[0], p.at[1]);
        out.push('<circle cx="' + dp[0] + '" cy="' + dp[1] + '" r="' + Math.max(2.5, p.r * S) + '" fill="' + p.fill + '"/>');
      } else if (p.t === 'text') {
        var t = view.toPx(p.at[0], p.at[1]), fs = Math.max(8, S * 0.22 * p.size);
        out.push('<text x="' + t[0] + '" y="' + t[1] + '" font-size="' + fs + '" font-family="system-ui,-apple-system,sans-serif" font-weight="' + (p.weight || 500) +
          '" fill="' + p.color + '" text-anchor="' + p.anchor + '"' + (p.baseline ? ' dominant-baseline="' + p.baseline + '"' : '') + '>' + esc(p.s) + '</text>');
      } else if (p.t === 'chip') {
        var c = view.toPx(p.at[0], p.at[1]), fs2 = Math.max(8, S * 0.22 * p.size), w = p.s.length * fs2 * 0.7 + 12;
        out.push('<g><rect x="' + c[0] + '" y="' + c[1] + '" rx="4" width="' + w + '" height="' + (fs2 + 8) + '" fill="' + p.bg + '"/>' +
          '<text x="' + (c[0] + 5) + '" y="' + (c[1] + fs2 + 2) + '" font-size="' + fs2 + '" font-family="system-ui,-apple-system,sans-serif" font-weight="700" fill="' + p.color + '" letter-spacing=".04em">' + esc(p.s) + '</text></g>');
      }
    });
    out.push('</g>');
    return out.join('');
  }

  function drawCanvas(ctx, built, view) {
    var S = view.scale;
    ctx.save();
    built.prims.forEach(function (p) {
      if (p.t === 'rect') {
        var a = view.toPx(p.x0, p.y1), b = view.toPx(p.x1, p.y0);
        ctx.fillStyle = p.fill; ctx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      } else if (p.t === 'line') {
        var a2 = view.toPx(p.a[0], p.a[1]), b2 = view.toPx(p.b[0], p.b[1]);
        ctx.globalAlpha = p.ghost ? 0.45 : 1; ctx.strokeStyle = p.stroke; ctx.lineWidth = p.w; ctx.lineCap = 'round';
        ctx.setLineDash(p.dash || []); ctx.beginPath(); ctx.moveTo(a2[0], a2[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (p.t === 'dot') {
        var dp = view.toPx(p.at[0], p.at[1]); ctx.fillStyle = p.fill; ctx.beginPath(); ctx.arc(dp[0], dp[1], Math.max(2.5, p.r * S), 0, 6.2832); ctx.fill();
      } else if (p.t === 'text' || p.t === 'chip') {
        var t = view.toPx(p.at[0], p.at[1]), fs = Math.max(8, S * 0.22 * p.size);
        ctx.font = (p.t === 'chip' || p.weight === 700 ? '700 ' : '500 ') + fs + 'px system-ui,-apple-system,sans-serif';
        if (p.t === 'chip') {
          var w = ctx.measureText(p.s).width + 10; ctx.fillStyle = p.bg; ctx.fillRect(t[0], t[1], w, fs + 8);
          ctx.fillStyle = p.color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(p.s, t[0] + 5, t[1] + fs + 2);
        } else {
          ctx.fillStyle = p.color; ctx.textAlign = p.anchor === 'middle' ? 'center' : p.anchor === 'end' ? 'right' : 'left';
          ctx.textBaseline = p.baseline === 'middle' ? 'middle' : 'alphabetic'; ctx.fillText(p.s, t[0], t[1]);
        }
      }
    });
    ctx.restore();
  }

  var API = { build: build, toSVG: toSVG, drawCanvas: drawCanvas, STYLE: STYLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.PALOS = API;
})(typeof window !== 'undefined' ? window : this);
