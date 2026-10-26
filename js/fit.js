var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · fit.js — four independent status indicators (NO single percentage) ============

   The old build showed one "fit %" ring and an "acceptance feasibility / reply likelihood"
   heuristic. Both were MISLEADING: no browser-side score can estimate the probability that a
   human replies or that a committee admits someone. They have been REMOVED and replaced by
   four INDEPENDENT, auditable statuses — each derived only from recorded evidence:

     1. RESEARCH ALIGNMENT   – concrete, listed overlaps between your confirmed profile
                               (topic / interests / skills / methods) and this researcher's
                               verified publications & stated methods. Never a probability.
     2. FUNDING EVIDENCE     – is there a dated, sourced statement of funding for a student
                               position? confirmed | partial | none found | not applicable.
     3. ELIGIBILITY          – does the programme/opportunity match YOUR recorded criteria
                               (degree level, intake, countries, grading scale, language test)?
                               pass | check | fail | unknown — with the reason per rule.
     4. CONTACT REQUIREMENTS – identity resolution + e-mail evidence separation + whether the
                               programme requires/forbids contacting a supervisor first.

   Each status carries its own source/freshness line; statuses are never multiplied together
   into a single number.                                                              */
(function(){
  window.LD = window.LD || {};

  LD.STATUS_BANDS = {
    alignment:{ strong:{label:"Strong alignment",cls:"b-green"}, good:{label:"Good alignment",cls:"b-blue"},
                moderate:{label:"Moderate alignment",cls:"b-amber"}, weak:{label:"Weak / no listed overlap",cls:"b-red"} },
    funding:{ confirmed:{label:"Funding evidence: CONFIRMED",cls:"b-green"},
              partial:{label:"Funding evidence: PARTIAL",cls:"b-amber"},
              none:{label:"Funding evidence: NONE FOUND",cls:"b-slate"},
              "not-applicable":{label:"Not applicable (closed)",cls:"b-red"} },
    eligibility:{ pass:{label:"Eligibility: PASS on recorded rules",cls:"b-green"},
                  check:{label:"Eligibility: CHECK required",cls:"b-amber"},
                  fail:{label:"Eligibility: FAIL on a hard rule",cls:"b-red"},
                  unknown:{label:"Eligibility: UNKNOWN (no policy recorded)",cls:"b-slate"} },
    contact:{ strong:{label:"Contact: officially listed address ✓",cls:"b-green"},
              fair:{label:"Contact: syntax + MX only",cls:"b-blue"},
              weak:{label:"Contact: unverified address",cls:"b-amber"},
              missing:{label:"Contact: no address on record",cls:"b-slate"},
              invalid:{label:"Contact: malformed address",cls:"b-red"},
              prohibited:{label:"Contact: supervisor contact PROHIBITED by policy",cls:"b-red"},
              mandatory:{label:"Contact: supervisor contact REQUIRED before applying",cls:"b-amber"} }
  };

  /* ---------- 1. Research Alignment (transparent overlap ledger) ---------- */
  LD.alignmentStatus = function(prof, profile){
    var fit = LD.computeResearchFit ? LD.computeResearchFit(LD.toProfessorLite(prof), profile||{}) : {count:0};
    var n = fit.count||0;
    var band = n===0?"weak":n<=2?"moderate":n<=5?"good":"strong";
    var ev=[];
    (fit.overlapTerms||[]).slice(0,8).forEach(function(t){ ev.push({kind:"term",text:t}); });
    (fit.sharedTopics||[]).forEach(function(t){ ev.push({kind:"topic",text:t}); });
    (fit.matchedMethods||[]).forEach(function(m){ ev.push({kind:"method",text:m}); });
    (fit.pubsMatched||[]).forEach(function(t){ ev.push({kind:"paper",text:t}); });
    return { key:"alignment", title:"Research Alignment", band:band,
             label:LD.STATUS_BANDS.alignment[band].label, cls:LD.STATUS_BANDS.alignment[band].cls,
             count:n, detail:ev,
             note:"Count of concrete, individually listed overlaps between your confirmed profile and this researcher's verified work. NOT a probability of admission or reply." };
  };

  /* ---------- 2. Funding Evidence ---------- */
  LD.fundingStatus = function(prof){
    var lvl = LD.fundingFromEvidence ? LD.fundingFromEvidence(prof) : "none";
    if(prof && prof.availability==="closed") lvl="not-applicable";
    var meta = LD.FUNDING_LEVELS[lvl] || LD.FUNDING_LEVELS.none;
    var recs = (prof && prof.fundingEvidence || []).filter(function(e){ return e && (e.url||e.text); });
    var linked = LD.db && LD.db.funding ? LD.db.funding.filter(function(f){ return f.linkedProfessorId===prof.id; }) : [];
    var best = null;
    recs.concat(linked.map(function(f){ return { text:f.position+" — "+(f.stipend||f.amount||""), url:(f.source&&f.source.url)||f.programUrl||"", date:(f.source&&f.source.checkedAt)||"" }; }))
        .forEach(function(r){ if(!best && r.url) best=r; });
    return { key:"funding", title:"Funding Evidence", band:lvl, label:meta.label,
             cls: ({confirmed:"b-green",partial:"b-amber","not-applicable":"b-red"}[lvl]||"b-slate"),
             note:meta.note+(linked.length?" · "+linked.length+" structured opportunity record(s) on file.":""),
             evidence: best ? [best] : [],
             opportunities: linked };
  };

  /* ---------- 3. Eligibility (hard rules vs your recorded criteria) ---------- */
  LD.eligibilityStatus = function(prof, profile, opportunity){
    profile = profile||{};
    var checks=[];
    function push(rule,verdict,note){ checks.push({rule:rule,verdict:verdict,note:note}); }
    var opp = opportunity || (LD.db&&LD.db.funding||[]).filter(function(f){return f.linkedProfessorId===(prof&&prof.id);})[0] || null;
    var pol = LD.matchingPolicy(prof) || null;

    if(profile.degreeLevel) push("Degree level", (opp&&!opp.degreeLevel)||!opp?"unknown":
      String(opp.degreeLevel).toLowerCase().indexOf(String(profile.degreeLevel).toLowerCase())>-1?"pass":"fail",
      opp?("Opportunity: "+opp.degreeLevel+" · you: "+profile.degreeLevel):"No structured opportunity recorded — verify the programme's degree level.");
    else push("Degree level","unknown","Tell us your target degree in the Academic Profile.");

    // Intake — taken from the USER's selected intake, never hard-coded.
    if(profile.intake) push("Intake", pol?( (pol.intakeOptions||[]).some(function(i){return i===profile.intake;})?"pass":"check"):"unknown",
      pol?("Policy lists intakes: "+((pol.intakeOptions||[]).join(", ")||"not stated")+" · you selected "+profile.intake)
         :"No admissions policy recorded for this programme — confirm your intake exists.");
    else push("Intake","unknown","No intake selected in your profile.");

    if(profile.country) push("Country preference", !opp?"unknown":(String(opp.country||"").toLowerCase()===String(profile.country).toLowerCase()?"pass":"check"),
      opp?("Opportunity country: "+(opp.country||"—")):"No opportunity record.");
    if(profile.gradingScale) push("Grading minimum", pol&&pol.requirements&&pol.requirements.length?( "check"):"unknown",
      pol?("Programme requirements recorded — compare against “"+profile.gradingScale+"”."):"No grading requirement recorded.");
    if(profile.languageTest) push("Language test", pol?("check"):"unknown", pol?("Recorded requirements mention documents/tests — verify yours against them."):"No policy on file.");
    if(profile.graduationYear && pol) push("Graduation timing","check","Verify any year-of-graduation limit in the official call.");

    var fails = checks.filter(function(c){return c.verdict==="fail";}).length;
    var unknowns = checks.filter(function(c){return c.verdict==="unknown";}).length;
    var checks_ = checks.filter(function(c){return c.verdict==="check";}).length;
    var band = fails>0 ? "fail" : (checks_>0 || unknowns>0 ? "check" : (pol||opp ? "pass":"unknown"));
    return { key:"eligibility", title:"Eligibility", band:band,
             label:LD.STATUS_BANDS.eligibility[band].label, cls:LD.STATUS_BANDS.eligibility[band].cls,
             note:"Rule-by-rule comparison of your recorded criteria against the structured opportunity/admissions-policy records. Empty records stay UNKNOWN — they are never guessed as eligible.",
             checks:checks, opportunity:opp, policy:pol };
  };

  /* Find an AdmissionsPolicy record matching a professor's institution. */
  LD.matchingPolicy = function(prof){
    if(!prof || !LD.db || !LD.db.policies) return null;
    var uni = LD.normText(prof.uni||prof.affiliation||"");
    if(!uni) return null;
    return (LD.db.policies||[]).filter(function(p){
      var pi=LD.normText(p.institution||"");
      return pi && (uni.indexOf(pi)>-1 || pi.indexOf(uni.split(" ")[0])>-1);
    })[0]||null;
  };

  /* ---------- 4. Contact Requirements ---------- */
  LD.contactStatus = function(prof){
    prof = LD.toProfessorLite(prof);
    var req = LD.contactRequirements(prof);
    var pol = LD.matchingPolicy(prof);
    var band = req.level, label=req.label, cls=LD.STATUS_BANDS.contact[band]?LD.STATUS_BANDS.contact[band].cls:"b-slate", extra="";
    if(pol && pol.supervisorContact==="prohibited"){ band="prohibited"; label=LD.STATUS_BANDS.contact.prohibited.label; cls="b-red";
      extra=" ⚠ This programme forbids pre-application supervisor contact."; }
    else if(pol && pol.supervisorContact==="mandatory"){ band="mandatory"; label=LD.STATUS_BANDS.contact.mandatory.label; cls="b-amber";
      extra=" This programme requires written supervisor agreement BEFORE you apply."; }
    var ident = prof.identity || LD.resolveIdentity(prof);
    var im = LD.IDENTITY_STATUS[ident.status];
    return { key:"contact", title:"Contact Requirements", band:band, label:label, cls:cls,
             note:req.note+extra, email:LD.primaryEmail(prof),
             identity:{ status:ident.status, label:im.label, cls:im.cls, note:im.note },
             policy: pol||null };
  };

  /* ---------- assemble all four (used by cards, dossier, pipeline) ---------- */
  LD.evaluateAll = function(prof, profile){
    return { alignment:LD.alignmentStatus(prof,profile), funding:LD.fundingStatus(prof),
             eligibility:LD.eligibilityStatus(prof,profile), contact:LD.contactStatus(prof),
             computedAt:LD.nowIso() };
  };

  /* render the four-status block (compact for cards, full elsewhere) */
  LD.renderStatusPills = function(ev, compact){
    var order=["alignment","funding","eligibility","contact"];
    return '<div class="grid grid-cols-2 gap-1.5">'+order.map(function(k){
      var s=ev[k];
      return '<div class="rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-1.5" title="'+LD.escapeHtml(compact?s.note:"")+'">'+
        '<p class="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">'+s.title+'</p>'+
        '<span class="badge '+s.cls+' !text-[10px] !py-0.5">'+LD.escapeHtml(s.label.replace(/^(Funding evidence|Eligibility|Contact requirement): /,""))+'</span></div>';
    }).join("")+'</div>';
  };
  LD.renderStatusDetail = function(ev){
    var out="";
    ["alignment","funding","eligibility","contact"].forEach(function(k){
      var s=ev[k];
      out+='<div class="rounded-xl border border-slate-200 p-3">'+
        '<div class="flex items-center justify-between gap-2"><p class="font-bold text-sm">'+s.title+'</p><span class="badge '+s.cls+'">'+LD.escapeHtml(s.label)+'</span></div>'+
        '<p class="text-[11px] leading-snug text-slate-500 mt-1">'+LD.escapeHtml(s.note)+'</p>';
      if(k==="alignment" && s.detail && s.detail.length)
        out+='<div class="mt-2 flex flex-wrap gap-1">'+s.detail.slice(0,12).map(function(d){
          return '<span class="badge b-slate !text-[10px]">'+d.kind+": "+LD.escapeHtml(String(d.text))+'</span>';}).join("")+'</div>';
      if(k==="eligibility" && s.checks)
        out+='<ul class="mt-2 space-y-1 text-[11px]">'+s.checks.map(function(c){
          var v={pass:["✓","b-green"],fail:["✗","b-red"],check:["⚠","b-amber"],unknown:["❔","b-slate"]}[c.verdict];
          return '<li class="flex gap-1.5 items-start"><span class="badge '+v[1]+' !text-[10px] !py-0">'+v[0]+' '+c.rule+'</span><span class="text-slate-500">'+LD.escapeHtml(c.note)+'</span></li>';}).join("")+'</ul>';
      if(k==="contact"){
        if(s.identity) out+='<p class="mt-2 text-[11px]"><span class="badge '+s.identity.cls+'">'+s.identity.icon+' '+LD.escapeHtml(s.identity.label)+'</span> <span class="text-slate-500">'+LD.escapeHtml(s.identity.note)+'</span></p>';
        if(s.email) out+='<p class="mt-1 text-[11px] font-mono">'+LD.escapeHtml(s.email.address)+'</p>'+
          '<p class="text-[10px] text-slate-400">syntax '+s.email.syntax+' · mx '+s.email.mx+' · official listing '+s.email.officialListing+' · mailbox '+s.email.mailbox+'</p>';
        if(s.policy) out+='<p class="mt-1 text-[11px] text-slate-600">Programme rule: <b>'+LD.escapeHtml(s.policy.supervisorContact)+'</b> supervisor contact '+LD.freshnessLine(s.source||s.policy.source,"policy")+'</p>';
      }
      if(k==="funding" && s.evidence && s.evidence.length)
        out+='<p class="mt-2 text-[11px] text-slate-600">'+LD.escapeHtml(s.evidence[0].text)+'<br/>'+LD.freshnessLine({sourceUrl:s.evidence[0].url,checkedAt:s.evidence[0].date,status:"needs-review"},"funding source")+'</p>';
      out+='</div>';
    });
    return out;
  };

  /* lightweight normaliser used across modules (full version lives in schema.js) */
  LD.toProfessorLite = function(raw){
    if(!raw) return raw;
    if(raw._lite) return raw;
    var p = Object.assign({}, raw);
    p.affiliation = p.affiliation || p.uni || "";
    p.identifiers = p.identifiers || {};
    if(!p.emails) p.emails = p.email ? [{address:p.email,syntax:"unchecked",mx:"unchecked",officialListing:"unchecked",mailbox:"not-confirmed",sourceUrl:p.profileUrl||"",checkedAt:LD.nowIso()}] : [];
    if(!p.availability) p.availability = (p.openToStudents===false?"closed":"unknown");
    if(!p.identity) LD.resolveIdentity(p);
    p._lite=true; return p;
  };
})();
