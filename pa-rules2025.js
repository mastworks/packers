/* Packer Army: the independent analyzer (analyze.js) cites the 2019 SFX rulebook; this league plays the 2025 book
   (docs_sfx_2025_rulebook.txt). Same rules, different section numbers, plus one 2025 exception for motion.
   Wraps PAAnalyze.run so every finding shows the 2025 reference. The analyzer file itself is not modified. */
(function(root){
  var A=root.PAAnalyze; if(!A||A._sfx2025) return;
  var MAP={'X.1':'XI.1','XI.1':'XII.1 / XV.2','XI.2':'XII.2','XII.3':'XIII.3','XII.10':'XIII.10','XII.11':'XIII.11','XII.14':'XIII.14'};
  var re=/\b(X\.1|XI\.1|XI\.2|XII\.3|XII\.10|XII\.11|XII\.14)\b/g;
  var fix=function(s){ return s==null?s:String(s).replace(re,function(m){ return MAP[m]||m; }); };
  var run=A.run;
  A.run=function(plays,opts){
    var rep=run.call(A,plays,opts);
    rep.findings.forEach(function(f){
      f.msg=fix(f.msg); f.fix=fix(f.fix);
      if(f.code==='MOTION_FORWARD'){ f.sev='risk'; f.msg+=' (2025 SFX XV.2 allows it when a back motions out to a receiver spot: check with the referee.)'; }
    });
    var c={rule:0,risk:0,tell:0,info:0}; rep.findings.forEach(function(f){ c[f.sev]=(c[f.sev]||0)+1; }); rep.counts=c;
    return rep;
  };
  A._sfx2025=true;
})(window);
