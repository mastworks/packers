/* Packer Army - Analysis panel (analyze-panel.js)
 * Depends on analyze.js (window.PAAnalyze). No other dependencies.
 *
 *   PAAnalyzePanel.open(plays, opts)   // full-screen coach overlay, filterable
 *   PAAnalyzePanel.badge(report, fmt, n) // small "2 RULE" chip HTML for a play tile
 *   PAAnalyzePanel.guardSave(play)     // editor pre-save: returns true if OK to save
 */
(function (root) {
  'use strict';
  var A = root.PAAnalyze;
  var CSS = '' +
    '.paa-wrap{position:fixed;inset:0;z-index:9999;background:#0f1a17f2;color:#f4f1e8;font:14px/1.4 -apple-system,system-ui,sans-serif;display:flex;flex-direction:column;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}' +
    '.paa-top{display:flex;align-items:center;gap:8px;padding:12px 16px;background:#203731;border-bottom:2px solid #FFB612}' +
    '.paa-top h2{margin:0;font-size:16px;letter-spacing:.06em;flex:1}' +
    '.paa-x{background:none;border:1px solid #FFB612;color:#FFB612;border-radius:6px;padding:6px 10px;font-weight:700}' +
    '.paa-chips{display:flex;gap:6px;flex-wrap:wrap;padding:10px 16px}' +
    '.paa-chip{border:1px solid #ffffff40;background:none;color:inherit;border-radius:999px;padding:5px 10px;font-weight:700;font-size:12px}' +
    '.paa-chip[aria-pressed=true]{background:#FFB612;color:#203731;border-color:#FFB612}' +
    '.paa-list{overflow:auto;padding:0 16px 24px;flex:1}' +
    '.paa-item{border-left:4px solid #888;background:#ffffff0d;border-radius:6px;padding:10px 12px;margin:8px 0}' +
    '.paa-item b{display:block;font-size:12px;letter-spacing:.05em;opacity:.8;margin-bottom:2px}' +
    '.paa-fix{margin-top:4px;color:#FFB612;font-size:13px}' +
    '.paa-rule{border-color:#e5484d}.paa-risk{border-color:#FFB612}.paa-tell{border-color:#5eb1ef}.paa-info{border-color:#8b9a95}' +
    '.paa-badge{display:inline-block;font:700 10px/1 system-ui;padding:3px 5px;border-radius:4px;background:#e5484d;color:#fff}' +
    '.paa-badge.risk{background:#FFB612;color:#203731}' +
    '.paa-foot{padding:8px 16px;font-size:11px;opacity:.7;border-top:1px solid #ffffff20}';
  function css() { if (document.getElementById('paa-css')) return; var s = document.createElement('style'); s.id = 'paa-css'; s.textContent = CSS; document.head.appendChild(s); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var last = null;

  function open(plays, opts) {
    css();
    var rep = last = A.run(plays, opts);
    var active = { rule: true, risk: true, tell: true, info: false };
    var fmt = 'ALL';
    var el = document.createElement('div');
    el.className = 'paa-wrap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Playbook analysis');
    function render() {
      var fmts = ['ALL'].concat(Object.keys(rep.book || {}));
      var items = rep.findings.filter(function (f) { return active[f.sev] && (fmt === 'ALL' || f.fmt === fmt); });
      el.innerHTML =
        '<div class="paa-top"><h2>PLAY ANALYSIS \u00b7 ' + rep.plays + ' PLAYS</h2><button class="paa-x" data-x>CLOSE</button></div>' +
        '<div class="paa-chips">' +
        ['rule', 'risk', 'tell', 'info'].map(function (k) { return '<button class="paa-chip" data-sev="' + k + '" aria-pressed="' + active[k] + '">' + k.toUpperCase() + ' ' + rep.counts[k] + '</button>'; }).join('') +
        fmts.map(function (f) { return '<button class="paa-chip" data-fmt="' + f + '" aria-pressed="' + (fmt === f) + '">' + f + '</button>'; }).join('') +
        '</div><div class="paa-list">' +
        (items.length ? items.map(function (f) {
          return '<div class="paa-item paa-' + f.sev + '"><b>' + f.sev.toUpperCase() + ' \u00b7 ' + esc(f.fmt) + ' #' + esc(f.n) + ' \u00b7 ' + esc(f.name) + '</b>' + esc(f.msg) +
            (f.fix ? '<div class="paa-fix">' + esc(f.fix) + '</div>' : '') + '</div>';
        }).join('') : '<p>Nothing in this filter.</p>') +
        '</div><div class="paa-foot">Timing uses estimated speeds (config). Rule refs: 2025 SFX rulebook. RULE = likely flag \u00b7 RISK = likely to fail \u00b7 TELL = tips off the defense.</div>';
    }
    el.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-x')) { el.remove(); return; }
      if (t.dataset.sev) active[t.dataset.sev] = !active[t.dataset.sev];
      if (t.dataset.fmt) fmt = t.dataset.fmt;
      render();
    });
    render();
    document.body.appendChild(el);
    return rep;
  }

  function badge(rep, fmt, n) {
    rep = rep || last; if (!rep) return '';
    var f = A.forPlay(rep, fmt, n);
    var r = f.filter(function (x) { return x.sev === 'rule'; }).length, k = f.filter(function (x) { return x.sev === 'risk'; }).length;
    if (r) return '<span class="paa-badge" title="Rule issues">' + r + ' RULE</span>';
    if (k) return '<span class="paa-badge risk" title="Risks">' + k + ' RISK</span>';
    return '';
  }

  function guardSave(play, opts) {
    var rep = A.run([play], opts), rules = rep.findings.filter(function (f) { return f.sev === 'rule'; });
    if (!rules.length) return true;
    // Non-blocking message so we never trigger browser alert/confirm dialogs.
    css();
    var el = document.createElement('div');
    el.className = 'paa-wrap';
    el.innerHTML = '<div class="paa-top"><h2>RULE CHECK \u00b7 ' + esc(play.name) + '</h2><button class="paa-x" data-x>BACK TO EDIT</button></div><div class="paa-list">' +
      rules.map(function (f) { return '<div class="paa-item paa-rule">' + esc(f.msg) + (f.fix ? '<div class="paa-fix">' + esc(f.fix) + '</div>' : '') + '</div>'; }).join('') + '</div>';
    el.addEventListener('click', function (e) { if (e.target.closest('[data-x]')) el.remove(); });
    document.body.appendChild(el);
    return false;
  }

  root.PAAnalyzePanel = { open: open, badge: badge, guardSave: guardSave, css: css };
})(window);
