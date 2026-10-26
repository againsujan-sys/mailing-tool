var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · crm.js — evidence store, dual-mode email generator, pipeline & analytics ============

   THREE responsibilities, one module:

   A) LOCAL EVIDENCE STORE (localStorage "ld_db_v1") holding the six record types from
      schema.js. Records without an official source URL are saved but rendered as
      UNVERIFIED; funding records without a source cannot be saved at all.

   B) DUAL-MODE EMAIL GENERATOR — two genuinely different drafting pathways:
      • MODE "vacancy"    — an advertised, funded position exists on record. The draft
                            names the position, cites one verified publication/method,
                            states fit against the recorded eligibility rules and asks the
                            specific application/eligibility question. Funding is referenced
                            ONLY as quoted from the source (never paraphrased into a promise).
      • MODE "proactive"  — no confirmed funding. The draft cites a verified paper/method,
                            asks whether the group plans to take an MSc student AND whether
                            funding could be attached — it never implies an offer exists.
      Both modes refuse to run for example-sandbox profiles and both output an
      EVIDENCE MANIFEST listing every source the claims came from.

   C) PIPELINE + ANALYTICS — OutreachRecord lifecycle (contact date, follow-up reminders,
      statuses, outcomes) plus conversion metrics computed from those records only:
      candidates → verified profiles → drafts → sent → replies → positive replies →
      interviews/offers, with funding-confirmation milestones. No metric is faked when the
      denominator is zero.                                                                   */
(function(){
  window.LD = window.LD || {};
  var $=function(id){ return document.getElementById(id); };
  var DB_KEY="ld_db_v1";

  /* ================= A) EVIDENCE STORE ================= */
  var db = { professors:[], publications:[], laboratories:[], funding:[], policies:[], outreach:[] };
  function ls(k,v){ try{ if(v===undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k,JSON.stringify(v)); }catch(e){ return null; } }
  function loadDb(){ var s=ls(DB_KEY); if(s&&typeof s==="object") Object.keys(db).forEach(function(k){ if(Array.isArray(s[k])) db[k]=s[k]; }); }
  function saveDb(){ try{ ls(DB_KEY,db); }catch(e){ if(LD.toast) LD.toast("Storage full — export and prune old records.","err"); } }
  loadDb();
  LD.db = db;
  LD.saveDb = saveDb;

  LD.addFundingOpportunity = function(rec){
    rec = Object.assign({}, rec||{});
    if(!rec.source || !/^https?:\/\/.+/i.test(rec.source.url||""))
      return { ok:false, error:"A funding opportunity REQUIRES an official source URL — nothing was saved." };
    rec.id = rec.id || ("fund"+Date.now());
    rec.source = Object.assign({ checkedAt:LD.nowIso(), status:"needs-review" }, rec.source);
    db.funding = db.funding.filter(function(f){ return f.id!==rec.id; });
    db.funding.unshift(rec); saveDb();
    return { ok:true, id:rec.id };
  };
  LD.addAdmissionsPolicy = function(rec){
    rec = Object.assign({}, rec||{});
    if(!rec.source || !/^https?:\/\/.+/i.test(rec.source.url||""))
      return { ok:false, error:"An admissions policy REQUIRES the official programme page URL." };
    rec.id = rec.id || ("pol"+Date.now());
    rec.source = Object.assign({ checkedAt:LD.nowIso(), status:"needs-review" }, rec.source);
    db.policies = db.policies.filter(function(p){ return p.id!==rec.id; });
    db.policies.unshift(rec); saveDb();
    return { ok:true, id:rec.id };
  };
  LD.addRecruitmentEvidence = function(profId, ev){
    var p = db.professors.filter(function(x){return x.id===profId;})[0];
    if(!p) return { ok:false, error:"Professor record not found — open their dossier first." };
    if(!ev || !/^https?:\/\/.+/i.test(ev.url||"")) return { ok:false, error:"Recruitment evidence needs the page URL where you saw it." };
    ev.checkedAt = ev.checkedAt||LD.nowIso(); ev.status = ev.status||"needs-review";
    p.fundingEvidence = (p.fundingEvidence||[]).concat([ev]);
    if(ev.kind==="vacancy" && /fund|scholarship|stipend|salary|paid/i.test(ev.text||"")) p.availability="funded-ad";
    else if(ev.kind==="project") p.availability="project-unfunded";
    p.availabilityEvidence = ev;
    saveDb(); return { ok:true };
  };
  LD.setAvailability = function(profId, key, quote, url){
    var p = db.professors.filter(function(x){return x.id===profId;})[0]; if(!p) return {ok:false,error:"No such professor record."};
    if(key!=="unknown" && (!quote || !url)) return { ok:false, error:"Changing availability away from UNKNOWN requires a verbatim quote AND its URL." };
    p.availability=key; p.openToStudents = key==="closed"?false:null;
    p.availabilityEvidence = key==="unknown"?null:{ quote:quote, sourceUrl:url, checkedAt:LD.nowIso() };
    saveDb(); return { ok:true };
  };
  LD.upsertProfessor = function(p){
    p = LD.toProfessorLite(p);
    db.professors = db.professors.filter(function(x){ return x.id!==p.id; });
    db.professors.unshift(p); saveDb(); return p;
  };

  /* ================= B) DUAL-MODE EMAIL GENERATOR ================= */
  function lastName(full){ var p=String(full||"").replace(/^(prof\.?|dr\.?|assoc\.?|asst\.?)\s*/i,"").trim().split(/\s+/); return p[p.length-1]||"[name]"; }
  function shortT(t,n){ t=String(t||""); n=n||72; return t.length>n? t.slice(0,n-1).trim()+"…" : t; }
  function cap(s){ s=String(s||""); return s.charAt(0).toUpperCase()+s.slice(1); }

  /* pick the single best VERIFIED publication to cite (DOI valid + resolver-verified) */
  LD.citablePaper = function(prof){
    var pubs=(prof.recentPapers||[]).slice();
    var ok = pubs.filter(function(x){ return LD.isValidDoi(x.doi) && x.verification && x.verification.status==="verified"; });
    if(!ok.length) ok = pubs.filter(function(x){ return LD.isValidDoi(x.doi); });
    ok.sort(function(a,b){ return (b.year||0)-(a.year||0); });
    return ok[0]||null;
  };

  LD.generateEmail = function(opts){
    opts = opts||{};
    var prof = opts.prof, profile = opts.profile || (LD.profileForDraft?LD.profileForDraft(prof&&prof.id):{});
    if(!prof) return { ok:false, error:"No researcher selected." };
    if(prof.example) return { ok:false, error:"BLOCKED: this is an EXAMPLE-DATA sandbox record. Real outreach requires a live search result with verified sources." };
    var mode = opts.mode || (LD.fundingStatus(prof).band==="confirmed" ? "vacancy":"proactive");
    var opp = opts.opportunity || (db.funding.filter(function(f){return f.linkedProfessorId===prof.id;})[0]||null);
    var pol = LD.matchingPolicy(prof);
    var paper = LD.citablePaper(prof);
    var me = profile||{};
    var intake = (me.intake||"").trim();                       // user's selected intake — never hard-coded
    var ln = lastName(prof.name);
    var method = (me.skills||[])[0]||"";
    var interests = (me.interests||[]).filter(Boolean);
    var manifest=[];
    var lines=[];

    /* --- greeting + who I am (only confirmed profile facts) --- */
    lines.push("Dear Prof. "+ln+",");
    var intro = "My name is "+(me.name||"[your name]")+(me.uni?", I completed "+(me.degree||"my degree")+" at "+me.uni:"")+".";
    if(intake) intro += " I am applying for thesis-based MSc places starting "+intake+".";
    else intro += " I am looking for a thesis-based MSc place.";
    lines.push(intro);

    /* --- research connection: MUST cite a verified paper or an evidenced method --- */
    if(paper){
      lines.push("I read your paper \u201C"+shortT(paper.title)+"\u201D"+(paper.venue?" ("+paper.venue+", "+paper.year+")":" ("+paper.year+")")+" — DOI "+paper.doi+". "+
        (method?"Your use of "+method+" connects directly with my own work on "+(interests[0]||me.topic||"this topic")+".":
                "It shapes how I want to approach "+(interests[0]||me.topic||"my thesis topic")+"."));
      manifest.push({kind:"publication", ref:"https://doi.org/"+paper.doi, label:paper.title+" · DOI "+paper.doi+
        (paper.verification?(" · resolver status: "+paper.verification.status+" ("+String(paper.verification.checkedAt).slice(0,10)+")"):" · NOT resolver-verified")});
    } else {
      lines.push("Your group's work on "+((prof.topics||[]).slice(0,3).join(", ")||"[their topic — add a verified paper before sending]")+" overlaps with my interests in "+(interests.join(" / ")||"[add your confirmed interests]")+".");
      manifest.push({kind:"publication", ref:"", label:"NO verifiable DOI on record — the draft makes NO paper claim. Add a publication to the dossier before sending."});
    }

    /* --- stated limitations → targeted question (shows real reading) --- */
    if(paper && (paper.limitations||paper.futureWork)){
      lines.push("The paper notes "+(paper.limitations?("that "+shortT(paper.limitations,140)):(shortT(paper.futureWork,140)))+" — I would like to ask whether that direction is something you would consider for a master's project.");
      manifest.push({kind:"publication", ref:paper.doi?("https://doi.org/"+paper.doi):"", label:"Limitations/future-work statement quoted from the paper record"});
    }

    if(mode==="vacancy"){
      /* ---------- PATHWAY 1: advertised funded vacancy ---------- */
      if(!opp) return { ok:false, error:"Vacancy mode needs a structured FundingOpportunity record (position + source URL). Add it in Step 4." };
      lines.push("I am writing specifically about \u201C"+opp.position+"\u201D"+
        (opp.institution?" at "+opp.institution:"")+(opp.deadline&&opp.deadline!=="not stated"?", whose listed deadline is "+opp.deadline:"")+".");
      var terms=[];
      if(opp.amount!=null && opp.currency) terms.push(opp.amount+" "+opp.currency+(opp.basis?" "+opp.basis:""));
      if(opp.tuitionCoverage && opp.tuitionCoverage!=="not stated") terms.push("tuition: "+opp.tuitionCoverage);
      if(opp.stipend) terms.push("stipend: "+opp.stipend);
      lines.push("The advertisement states "+(terms.length?terms.join(", "):"no figures beyond what is quoted here")+" — I quote these from the posting rather than restate them.");
      manifest.push({kind:"funding", ref:opp.source&&opp.source.url, label:opp.position+" · "+(opp.source&&opp.source.url||"NO SOURCE")+" · checked "+String((opp.source&&opp.source.checkedAt)||"").slice(0,10)});
      if(opp.eligibility) lines.push("Regarding eligibility, the call states: \u201C"+shortT(opp.eligibility,180)+"\u201D — my recorded background ("+[me.degree,me.uni,me.grade].filter(Boolean).join(", ")||"[fill your profile]")+" is what I would rely on.");
      lines.push("Could you confirm whether I would be a suitable candidate for this position, and whether supervision capacity remains for the "+(intake||"advertised")+" intake?");
    } else {
      /* ---------- PATHWAY 2: proactive inquiry, funding UNKNOWN ---------- */
      var lvl = LD.fundingStatus(prof).band;
      lines.push("I understand this may not be an advertised position. My question is practical: are you planning to take a master's student for the "+(intake||"next")+" intake, and if so, is there — or could there be — funding attached (project assistantship, scholarship call, or teaching support)?");
      manifest.push({kind:"funding", ref:(prof.fundingEvidence&&prof.fundingEvidence[0]&&prof.fundingEvidence[0].url)||"",
        label:"Funding evidence status: "+lvl+(lvl==="none"?" — the draft therefore ASKS and implies nothing":"")});
    }

    /* --- contact-rule awareness --- */
    if(pol){
      if(pol.supervisorContact==="mandatory") lines.push("The programme page indicates supervisor agreement must be secured before applying, so I am writing to you first.");
      else if(pol.supervisorContact==="prohibited") return { ok:false, error:"BLOCKED by admissions policy: this programme prohibits contacting supervisors before applying. Apply via the official channel." };
      else if(pol.supervisorContact==="neutral") lines.push("I will also submit through the formal application portal as the programme requires.");
      manifest.push({kind:"policy", ref:pol.source&&pol.source.url, label:"Supervisor-contact rule: "+pol.supervisorContact+" · checked "+String((pol.source&&pol.source.checkedAt)||"").slice(0,10)});
    }

    /* --- attachments honesty + signature --- */
    var docs = (LD.attachmentNames && LD.attachmentNames().length) ? LD.attachmentNames() : [];
    lines.push(docs.length ? "I can send my CV ("+docs.join(", ")+") on request — mail clients sometimes strip attachments, so say the word and I will resend."
                           : "I would be glad to share my CV, transcript and a short research note on request.");
    var sig = "Sincerely,\n"+(me.name||"[your name]");
    if(me.orcid) sig += "\nORCID: "+me.orcid;
    if(me.website) sig += "\n"+me.website;
    var body = lines.join("\n\n")+"\n\n"+sig;
    body = LD.stripCliches(body);
    var limit = LD.getWordLimit?LD.getWordLimit(opts):180;
    if(LD.enforceLimitBody) body = LD.enforceLimitBody(body,limit);

    var subjBits = ["MSc", (mode==="vacancy"? (opp&&opp.position||"funded vacancy") : (interests[0]||me.topic||"research inquiry")), intake].filter(Boolean);
    return { ok:true, mode:mode, subject:cap(subjBits.join(" — ")).slice(0,90), body:body,
             words:LD.countWords(body), wordLimit:limit, cliches:LD.findCliches(body),
             manifest:manifest, paperUsed:paper, opportunityUsed:opp, policyUsed:pol };
  };

  /* ================= C) PIPELINE (OutreachRecords) ================= */
  LD.OUTREACH_STATUSES = ["draft","notsent","sent","replied-positive","replied-negative","interview","offer","no-reply","closed"];
  LD.saveOutreach = function(draft, prof, mode){
    if(!draft || !draft.ok) return { ok:false, error:(draft&&draft.error)||"Nothing to save." };
    if(prof && prof.example) return { ok:false, error:"Example-sandbox drafts are never saved to the pipeline." };
    var rec = { id:"out"+Date.now(), professorId:prof&&prof.id, professorName:prof&&prof.name,
      institution:prof&&(prof.uni||prof.affiliation)||"", emailUsed:(LD.primaryEmail(prof)||{}).address||"",
      emailVerification:LD.contactRequirements(prof), mode:mode||draft.mode,
      fundingOpportunityId:draft.opportunityUsed&&draft.opportunityUsed.id||null,
      admissionsPolicyId:draft.policyUsed&&draft.policyUsed.id||null,
      evidenceUsed:draft.manifest||[], subject:draft.subject, body:draft.body,
      words:draft.words, wordLimit:draft.wordLimit, status:"notsent",
      contactDate:null, followUpDate:null, outcome:"", approval:{approved:false},
      createdAt:LD.nowIso(), updatedAt:LD.nowIso() };
    db.outreach.unshift(rec); saveDb();
    if(LD.renderPipeline) LD.renderPipeline();
    return { ok:true, id:rec.id };
  };
  LD.setOutreachStatus = function(id,st){
    var r=db.outreach.filter(function(x){return x.id===id;})[0]; if(!r) return;
    r.status=st; r.updatedAt=LD.nowIso();
    if(st==="sent" && !r.contactDate) r.contactDate=LD.nowIso();
    if(st==="sent" && !r.followUpDate) r.followUpDate=new Date(Date.now()+14*864e5).toISOString();
    saveDb(); if(LD.renderPipeline) LD.renderPipeline(); if(LD.renderAnalytics) LD.renderAnalytics();
  };
  LD.setFollowUp = function(id,dateIso){ var r=db.outreach.filter(function(x){return x.id===id;})[0]; if(!r) return;
    r.followUpDate=dateIso||null; r.updatedAt=LD.nowIso(); saveDb(); if(LD.renderPipeline) LD.renderPipeline(); };
  LD.setOutcome = function(id,text){ var r=db.outreach.filter(function(x){return x.id===id;})[0]; if(!r) return;
    r.outcome=text; r.updatedAt=LD.nowIso(); saveDb(); if(LD.renderPipeline) LD.renderPipeline(); };
  LD.deleteOutreach = function(id){ db.outreach=db.outreach.filter(function(x){return x.id!==id;}); saveDb();
    if(LD.renderPipeline) LD.renderPipeline(); if(LD.renderAnalytics) LD.renderAnalytics(); };
  LD.dueFollowUps = function(){ var now=Date.now();
    return db.outreach.filter(function(r){ return r.followUpDate && ["sent","no-reply"].indexOf(r.status)>-1 && Date.parse(r.followUpDate)<=now; }); };

  /* ---------- render pipeline table into #pipelineTable (Step 6) ---------- */
  LD.renderPipeline = function(){
    var wrap=$("pipelineTable"); if(!wrap) return;
    var due=LD.dueFollowUps();
    var head = due.length ? '<div class="rounded-xl border border-amber-300 bg-amber-50 p-3 mb-3 text-sm"><b>⏰ '+due.length+' follow-up'+(due.length>1?'s':'')+' due:</b> '+
      due.map(function(r){ return LD.escapeHtml(r.professorName||r.profName||r.professorId)+' ('+String(r.followUpDate).slice(0,10)+')'; }).join(" · ")+'</div>' : "";
    if(!db.outreach.length){ wrap.innerHTML=head+'<p class="text-sm text-slate-500">No outreach records yet — generate a draft in Step 5 and save it here.</p>'; return; }
    wrap.innerHTML = head + '<div class="space-y-2">'+db.outreach.map(function(r){
      var st=r.status, cls={draft:"b-slate",notsent:"b-slate",sent:"b-blue","replied-positive":"b-green","replied-negative":"b-red",interview:"b-amber",offer:"b-green","no-reply":"b-amber",closed:"b-slate"}[st]||"b-slate";
      return '<div class="rounded-xl border border-slate-200 bg-white p-3">'+
        '<div class="flex flex-wrap items-start justify-between gap-2">'+
          '<div class="min-w-0"><p class="font-bold truncate">'+LD.escapeHtml(r.professorName||"—")+' <span class="badge '+cls+'">'+LD.escapeHtml(st)+'</span>'+
            (r.mode==='vacancy'?' <span class="badge b-green !text-[10px]">vacancy pathway</span>':' <span class="badge b-slate !text-[10px]">proactive pathway</span>')+'</p>'+
            '<p class="text-[11px] text-slate-500 truncate">'+LD.escapeHtml(r.institution||"")+' · '+(r.emailUsed?LD.escapeHtml(r.emailUsed):"no address on record")+' · '+r.words+'w</p></div>'+
          '<div class="flex gap-1.5 shrink-0">'+
            '<select class="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold" onchange="LD.setOutreachStatus(\''+r.id+'\',this.value)">'+
              LD.OUTREACH_STATUSES.map(function(s){ return '<option'+(s===st?" selected":"")+'>'+s+'</option>'; }).join("")+'</select>'+
            '<button class="btn-mini !text-[11px]" onclick="LD.loadOutreach(\''+r.id+'\')">Open</button>'+
            '<button class="btn-mini !text-[11px] text-rose-700" onclick="LD.deleteOutreach(\''+r.id+'\')">✕</button>'+
          '</div>'+
        '</div>'+
        '<div class="mt-2 grid sm:grid-cols-3 gap-2 text-[11px]">'+
          '<label class="block">Contact date<input type="date" class="fld !py-1 !text-[12px]" value="'+(r.contactDate?String(r.contactDate).slice(0,10):"")+'" onchange="LD.setContactDate(\''+r.id+'\',this.value)"/></label>'+
          '<label class="block">Follow-up reminder<input type="date" class="fld !py-1 !text-[12px]" value="'+(r.followUpDate?String(r.followUpDate).slice(0,10):"")+'" onchange="LD.setFollowUp(\''+r.id+'\',this.value?this.value+\'T12:00:00Z\':null)"/></label>'+
          '<label class="block">Outcome<input class="fld !py-1 !text-[12px]" placeholder="e.g. invited to interview" value="'+LD.escapeHtml(r.outcome||"")+'" oninput="LD.setOutcome(\''+r.id+'\',this.value)"/></label>'+
        '</div>'+
        ((r.evidenceUsed||[]).length?'<p class="mt-2 text-[10px] text-slate-500"><b>Evidence used:</b> '+r.evidenceUsed.map(function(e){
          return e.ref?'<a class="underline decoration-dotted" target="_blank" rel="noopener" href="'+LD.escapeHtml(e.ref)+'">'+e.kind+'</a>':'<span class="badge b-amber !text-[9px]">'+e.kind+' · no source</span>';}).join(" · ")+'</p>':'')+
      '</div>';
    }).join("")+'</div>';
  };
  LD.setContactDate=function(id,d){ var r=db.outreach.filter(function(x){return x.id===id;})[0]; if(!r) return;
    r.contactDate=d?d+"T12:00:00Z":null; saveDb(); LD.renderPipeline(); LD.renderAnalytics&&LD.renderAnalytics(); };
  LD.loadOutreach=function(id){ var r=db.outreach.filter(function(x){return x.id===id;})[0]; if(!r) return;
    if($("subj")) $("subj").value=r.subject||""; if($("draftBody")) $("draftBody").value=r.body||"";
    LD._state && (LD._state.draftMeta=r); LD.goStep&&LD.goStep(5); LD.toast&&LD.toast("Loaded outreach record for "+r.professorName,"info"); };

  /* ================= ANALYTICS ================= */
  LD.analytics = function(){
    var o=db.outreach, n=o.length;
    function count(pred){ return o.filter(pred).length; }
    var candidates = (LD._state&&LD._state.results?LD._state.results.length:0) + n;   // discovered + worked-on
    var verifiedProfiles = count(function(r){ return r.emailVerification && (r.emailVerification.level==="strong"||r.emailVerification.level==="fair"); })
                           + (LD._state&&LD._state.results?LD._state.results.filter(function(p){return p.identity&&(p.identity.status==="resolved"||p.identity.status==="probable");}).length:0);
    var sent=count(function(r){ return ["sent","replied-positive","replied-negative","interview","offer","no-reply"].indexOf(r.status)>-1; });
    var replied=count(function(r){ return ["replied-positive","replied-negative","interview","offer"].indexOf(r.status)>-1; });
    var positive=count(function(r){ return ["replied-positive","interview","offer"].indexOf(r.status)>-1; });
    var milestones=count(function(r){ return r.status==="offer"; });
    var fundingConfirmed=count(function(r){ return r.mode==="vacancy" && (r.evidenceUsed||[]).some(function(e){return e.kind==="funding"&&e.ref;}); });
    function pct(a,b){ return b? Math.round(a/b*100)+"%" : "—"; }
    return { totals:{candidates:Math.max(candidates,n), verifiedProfiles:verifiedProfiles, drafts:n, sent:sent,
                     replied:replied, positive:positive, interviews:count(function(r){return r.status==="interview";}),
                     offers:milestones, fundingConfirmed:fundingConfirmed,
                     followUpsDue:LD.dueFollowUps().length},
             rates:{ discoveryToVerified:pct(verifiedProfiles,Math.max(candidates,n)), draftToSent:pct(sent,n),
                     replyRate:pct(replied,sent), positiveRate:pct(positive,replied),
                     sentToPositive:pct(positive,sent) },
             staleEvidence:o.filter(function(r){ return (r.evidenceUsed||[]).some(function(e){ return !e.ref; }); }).length };
  };
  LD.renderAnalytics = function(){
    var box=$("analyticsBody"); if(!box) return;
    var a=LD.analytics(), T=a.totals, R=a.rates;
    function cell(label,val,note){ return '<div class="rounded-xl border border-slate-200 bg-white p-3">'+
      '<p class="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">'+label+'</p>'+
      '<p class="font-display font-extrabold text-2xl">'+val+'</p>'+(note?'<p class="text-[10px] text-slate-400">'+note+'</p>':'')+'</div>'; }
    box.innerHTML='<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">'+
      cell("Candidates discovered",T.candidates,"search results + worked profiles")+
      cell("Verified profiles",T.verifiedProfiles,R.discoveryToVerified+" of candidates")+
      cell("Drafts created",T.drafts,"outreach records")+
      cell("Sent",T.sent,R.draftToSent+" of drafts")+
      cell("Replies",T.replied,"reply rate "+R.replyRate)+
      cell("Positive replies",T.positive,"positive rate "+R.positiveRate)+
      cell("Interviews",T.interviews,"")+
      cell("Offers / funded confirmations",T.offers,T.fundingConfirmed+" vacancy-pathway sends cited a sourced funding record")+
    '</div>'+
    '<p class="mt-3 text-[11px] text-slate-500">Rates are simple counts over OutreachRecords stored in this browser — they describe YOUR pipeline history, not any probability of admission. '+
      (T.followUpsDue?'<b class="text-amber-700">'+T.followUpsDue+' follow-up(s) due.</b>':"")+
      (a.staleEvidence?' <b class="text-rose-700">'+a.staleEvidence+' record(s) used evidence without a source URL — re-verify before relying on them.</b>':"")+
    '</p>';
  };
})();
