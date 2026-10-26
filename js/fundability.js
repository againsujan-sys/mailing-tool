var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · fundability.js — two-stage Fundability Decision Engine ============

   STAGE 1 — HARD FILTERS (binary, evidence-driven; failing one removes the item from the
   ranked shortlist and states WHY):
     • Availability not "closed"                       (a confirmed "not accepting students" kills it)
     • Programme contact rule not "prohibited"         (do not email if the programme forbids it)
     • Deadline not past (per recorded FundingOpportunity/AdmissionsPolicy source date)
     • Eligibility has no hard FAIL verdict            (degree level mismatch etc.)
     • Identity status is not "ambiguous"              (wrong person risk)
     • Example-sandbox records are always excluded     (they can never be outreach targets)

   STAGE 2 — RANKING (transparent, additive, auditable — NOT a probability):
     +40  verified funding evidence for a student position (confirmed)
     +22  partial funding evidence (grant/project linked, student pay unstated)
     +30  strong research alignment · +20 good · +10 moderate · 0 weak
     +12  ≥1 publication with DOI verified against a resolver within 90 days
     +10  publication recency inside the last 3 years
     +8   identity resolved via ORCID / OpenAlex / official faculty page
     +6   officially listed contact e-mail
     +5   an AdmissionsPolicy record exists for the programme (deadlines known)
     −15  stale evidence (>90 days) on the funding claim actually used
   Every score line lists its contributing factors so the ordering can be re-derived by hand. */
(function(){
  window.LD = window.LD || {};

  /* ---------- Stage 1 ---------- */
  LD.hardFilters = function(prof, profile){
    var reasons=[], ok=true;
    profile = profile || {};
    if(prof.example){ ok=false; reasons.push({rule:"Example sandbox",verdict:"fail",note:"EXAMPLE-DATA record — never usable as a real outreach target."}); }
    if(prof.availability==="closed"){ ok=false; reasons.push({rule:"Availability",verdict:"fail",note:"Confirmed NOT accepting students."}); }
    var pol = LD.matchingPolicy(prof);
    if(pol && pol.supervisorContact==="prohibited"){ ok=false; reasons.push({rule:"Contact rule",verdict:"fail",note:"Programme prohibits contacting supervisors before applying — apply through the official channel instead."}); }
    // deadline check from structured records
    var opps = (LD.db&&LD.db.funding||[]).filter(function(f){ return f.linkedProfessorId===prof.id; });
    var dl = [];
    opps.forEach(function(o){ if(o.deadline && o.deadline!=="rolling" && o.deadline!=="not stated") dl.push(o.deadline); });
    if(pol && pol.applicationDeadline && pol.applicationDeadline!=="rolling" && pol.applicationDeadline!=="not stated") dl.push(pol.applicationDeadline);
    var past = dl.filter(function(d){ var t=Date.parse(d); return !isNaN(t) && t < Date.now(); });
    if(past.length && past.length===dl.length){ ok=false; reasons.push({rule:"Deadline",verdict:"fail",note:"All recorded deadlines have passed ("+past.join(", ")+")."}); }
    else if(past.length){ reasons.push({rule:"Deadline",verdict:"check",note:past.length+" of "+dl.length+" recorded deadline(s) already passed — act on the remaining ones."}); }
    var elig = LD.eligibilityStatus(prof, profile);
    if(elig.band==="fail"){ ok=false; var f=elig.checks.filter(function(c){return c.verdict==="fail";})[0];
      reasons.push({rule:"Eligibility",verdict:"fail",note:(f?f.rule+": "+f.note:"Hard eligibility mismatch.")}); }
    var ident = prof.identity||LD.resolveIdentity(prof);
    if(ident.status==="ambiguous"){ ok=false; reasons.push({rule:"Identity",verdict:"fail",note:"Ambiguous identity — multiple candidate persons. Resolve before any outreach."}); }
    if(!ok) return { pass:false, reasons:reasons.concat(reasons.length?[]:[{rule:"—",verdict:"fail",note:"No reason recorded."}]), eligibility:elig, policy:pol, opportunities:opps };
    return { pass:true, reasons:reasons, eligibility:elig, policy:pol, opportunities:opps };
  };

  /* ---------- Stage 2 ---------- */
  LD.rankScore = function(prof, profile){
    var factors=[], total=0;
    function add(pts,label,why){ if(!pts) return; total+=pts; factors.push({pts:pts,label:label,why:why||""}); }
    var fs = LD.fundingStatus(prof);
    add(fs.band==="confirmed"?40:fs.band==="partial"?22:0,"Funding evidence ("+fs.band+")",fs.note);
    var al = LD.alignmentStatus(prof, profile);
    add({strong:30,good:20,moderate:10,weak:0}[al.band],"Research alignment ("+al.count+" listed overlap"+(al.count===1?"":"s")+")");
    var nowY=new Date().getFullYear();
    var pubs=(prof.recentPapers||[]);
    var freshVerified = pubs.filter(function(x){ return x.verification && x.verification.status==="verified" && !LD.isStale(x.verification); });
    add(freshVerified.length?12:0,"DOI verified at a resolver ≤90d", freshVerified.length?freshVerified[0].doi:"");
    var recent = pubs.filter(function(x){ return x.year && x.year>=nowY-3; });
    add(recent.length?10:0,"Publication in the last 3 years", recent.length?String(recent[0].year):"");
    var ident = prof.identity||LD.resolveIdentity(prof);
    add(ident.status==="resolved"?8:0,"Identity resolved via persistent ID / official page");
    var cs = LD.contactStatus(prof);
    add(cs.band==="strong"?6:0,"Officially listed contact address");
    var pol = LD.matchingPolicy(prof);
    add(pol?5:0,"Admissions policy recorded (deadlines & contact rule known)");
    var usedStale = fs.band==="confirmed" && fs.evidence.length && LD.isStale({checkedAt:fs.evidence[0].date});
    add(usedStale?-15:0,"Stale funding evidence penalty");
    factors.sort(function(a,b){ return b.pts-a.pts; });
    return { score:Math.max(0,total), factors:factors };
  };

  /* ---------- run both stages over a result list ---------- */
  LD.fundabilityRank = function(list, profile){
    profile = profile || (LD.profileForDraft ? LD.profileForDraft(null) : {});
    var rows=(list||[]).map(function(p){
      var h=LD.hardFilters(p,profile), r=LD.rankScore(p,profile);
      return { prof:p, filters:h, rank:r, eligible:h.pass, score:r.score };
    });
    var passing = rows.filter(function(x){ return x.eligible; })
                      .sort(function(a,b){ return b.score-a.score; });
    var blocked = rows.filter(function(x){ return !x.eligible; });
    return { ranked:passing, blocked:blocked, all:rows, profileUsed:profile };
  };

  /* ---------- render the decision table ---------- */
  LD.renderFundability = function(res){
    function row(x,i){
      var p=x.prof;
      return '<div class="rounded-xl border border-slate-200 bg-white p-3 flex gap-3 items-start">'+
        '<span class="font-display font-extrabold text-brand-600 w-6 shrink-0 text-right">#'+(i+1)+'</span>'+
        '<div class="min-w-0 flex-1">'+
          '<p class="font-bold truncate">'+LD.escapeHtml(p.name)+' <span class="text-[11px] font-normal text-slate-500">· '+LD.escapeHtml(p.uni||p.affiliation||"—")+'</span></p>'+
          '<div class="mt-1.5">'+LD.renderStatusPills(LD.evaluateAll(p,x.profileUsed),true)+'</div>'+
          '<p class="text-[11px] text-slate-500 mt-1.5"><b>Stage-2 factors:</b> '+
            (x.rank.factors.length? x.rank.factors.map(function(f){ return '<span class="badge '+(f.pts>0?"b-green":"b-red")+' !text-[10px]">'+(f.pts>0?"+":"")+f.pts+" "+LD.escapeHtml(f.label)+'</span>'; }).join(" ")
              : '<span class="text-slate-400">none — no positive evidence recorded yet</span>')+
          '</p>'+
        '</div>'+
        '<div class="text-right shrink-0"><p class="font-display font-extrabold text-lg">'+x.score+'</p><p class="text-[9px] uppercase tracking-wide font-bold text-slate-400">rank pts</p></div>'+
      '</div>';
    }
    var out = res.ranked.length ? res.ranked.map(row).join("")
      : '<p class="text-sm text-slate-500">Nothing passed Stage 1 yet. Record a funding opportunity or admissions policy, or broaden your search.</p>';
    if(res.blocked.length){
      out += '<details class="mt-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3"><summary class="cursor-pointer font-bold text-sm text-rose-800">⛔ '+res.blocked.length+' filtered out by Stage 1 (hard rules)</summary>'+
        '<ul class="mt-2 space-y-2 text-[12px]">'+res.blocked.map(function(x){
          return '<li><b>'+LD.escapeHtml(x.prof.name)+'</b> — '+x.filters.reasons.filter(function(r){return r.verdict==="fail";}).map(function(r){ return LD.escapeHtml(r.rule+": "+r.note); }).join(" · ")+'</li>';
        }).join("")+'</ul></details>';
    }
    return out;
  };
})();
