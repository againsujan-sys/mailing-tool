/* ============ LetterDesk · app.js — wizard state machine, rendering, verification UI, pipeline, settings ============ */
(function(){
  window.LD = window.LD || {};
  var $ = function(id){ return document.getElementById(id); };
  var state = {
    step: 1,
    maxUnlocked: 1,          // steps you may click into
    results: [],             // professor list from search/demo
    selectedId: null,
    skills: [],
    variant: 0,
    draftMeta: null,
    plainView: false,
    pipeline: [],
    settings: { groqKey:"", model:"llama-3.3-70b-versatile", autoVerify:true }
  };
  LD._state = state;

  /* ---------- persistence ---------- */
  function ls(k,v){ try{ if(v===undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k,JSON.stringify(v)); }catch(e){ return null; } }
  function loadPersisted(){
    state.settings = Object.assign(state.settings, ls("ld_settings")||{});
    state.pipeline = ls("ld_pipeline")||[];
    var prof = ls("ld_profile"); if(prof) setTimeout(function(){ fillProfileForm(prof); },0);
  }
  function saveProfile(){
    ls("ld_profile", { name:$("pName").value.trim(), degree:$("pDegree").value, role:$("pRole").value, uni:$("pUni").value.trim(),
      field:$("pField").value.trim(), topic:$("pTopic").value.trim(), skills:state.skills, gpa:$("pGpa").value.trim(),
      english:$("pEnglish").value, exp:$("pExp").value.trim() });
  }
  function fillProfileForm(p){
    $("pName").value=p.name||""; $("pDegree").value=p.degree||"PhD"; $("pRole").value=p.role||$("pRole").value;
    $("pUni").value=p.uni||""; $("pField").value=p.field||""; $("pTopic").value=p.topic||"";
    $("pGpa").value=p.gpa||""; $("pEnglish").value=p.english||""; $("pExp").value=p.exp||"";
    state.skills = p.skills||[]; renderSkills();
  }

  /* ---------- toast ---------- */
  LD.toast = function(msg, kind){
    var w=$("toastWrap"); if(!w) return;
    var d=document.createElement("div"); d.className="toast "+(kind||"info"); d.textContent=msg;
    w.appendChild(d); setTimeout(function(){ d.style.opacity="0"; d.style.transition="opacity .3s"; setTimeout(function(){d.remove();},320); }, 3400);
  };

  /* ---------- example-data guard (draft generation / mailto / CRM pipeline) ----------
     Example-sandbox profiles (LD.GEO_EXAMPLE, flagged example:true) exist only so the UI
     can be exercised offline. They must NEVER flow into live outreach or CRM tracking. */
  function guardExampleProfile(actionLabel){
    var currentProfile = getSelected();
    if (currentProfile && currentProfile.example) {
        alert("Cannot perform live outreach or CRM tracking on example/demonstration data.");
        return true;
    }
    return false;
  }
  LD.guardExampleProfile = guardExampleProfile;

  /* ---------- word-limit bounds come from js/facts.js (120–180 recommended band),
     never hard-coded here. ctxFromUI injects the saved limit so LD.getWordLimit(ctx)
     honours it; the meter & send-gates read state.settings.wordLimit. ---------- */
  function effectiveWordLimit(){
    var n = parseInt(state.settings.wordLimit,10);
    if (LD.MIN_LIMIT!=null && LD.MAX_LIMIT!=null && !(n>=LD.MIN_LIMIT && n<=LD.MAX_LIMIT)) n = (LD.DEFAULT_LIMIT||180);
    return n;
  }
  function syncWordBoundsFromFacts(){
    if(!LD.TARGET_LOW || !LD.DEFAULT_LIMIT) return;
    var lim = effectiveWordLimit();
    var lo = $("wlLowBind"), hi = $("wlHighBind");
    if(lo) lo.textContent = LD.TARGET_LOW;                    /* ≈120 — from facts.js */
    if(hi) hi.textContent = lim;                              /* upper bound = configured limit (default 180) */
    var wl = $("wordLimit");
    if(wl){ if(LD.MIN_LIMIT!=null) wl.min = LD.MIN_LIMIT; if(LD.MAX_LIMIT!=null) wl.max = LD.MAX_LIMIT; }
    var gen = $("genBtn");
    if(gen) gen.innerHTML = "✍ Generate draft (~"+LD.TARGET_LOW+"–"+lim+" words)";
  }

  /* ---------- modal ---------- */
  LD.openModal = function(id){ var m=$(id); if(m){ m.classList.remove("hidden"); m.classList.add("show"); document.body.style.overflow="hidden"; } };
  LD.closeModal = function(id){ var m=$(id); if(m){ m.classList.add("hidden"); m.classList.remove("show"); document.body.style.overflow=""; } };
  document.addEventListener("keydown", function(e){ if(e.key==="Escape"){ ["howModal","stipendModal","settingsModal"].forEach(LD.closeModal); } });

  LD.closeMobile = function(){ $("mobileNav").classList.add("hidden"); };
  document.addEventListener("DOMContentLoaded", function(){
    var mb=$("menuBtn"); if(mb) mb.onclick=function(){ $("mobileNav").classList.toggle("hidden"); };
  });

  /* ---------- STEP MACHINE (the part that was stuck before) ---------- */
  LD.goStep = function(n){
    n = parseInt(n,10);
    if(!(n>=1 && n<=3)) return;
    if(n > state.maxUnlocked){
      // gate: can't jump ahead without prerequisites
      if(n===2 && !getSelected()) { LD.toast("Pick a professor in Step 1 first.","err"); return; }
      if(n===3){ if(!getSelected()){ LD.toast("Pick a professor first.","err"); return;} if(!$("pName").value.trim()||!$("pTopic").value.trim()){ LD.toast("Fill your name & thesis topic in Step 2.","err"); goStepVisual(2); return; } }
      return;
    }
    goStepVisual(n);
  };
  function goStepVisual(n){
    state.step=n;
    if(n>state.maxUnlocked) state.maxUnlocked=n;
    [1,2,3].forEach(function(i){
      var panel=$("step-"+i), item=document.querySelector('.step-item[data-step="'+i+'"]');
      if(panel) panel.classList.toggle("hidden", i!==n);
      if(item){ item.classList.toggle("active", i===n); item.classList.toggle("done", i<n);
        var dot=item.querySelector(".step-dot"); if(dot) dot.innerHTML = i<n ? "✓" : String(i); }
    });
    window.scrollTo({top: Math.max(0, ($("stepper").getBoundingClientRect().top + window.scrollY) - 120), behavior:"smooth"});
    if(n===2){ updateFeasibility(); renderSelMini(); }
    if(n===3){ refreshEmailPanel(); updateWordMeter(); }
  }
  LD.toStep3 = function(){
    if(!$("pName").value.trim()){ LD.toast("Please enter your full name.","err"); $("pName").focus(); return; }
    if(!$("pTopic").value.trim()){ LD.toast("Add your thesis/research interest — it powers the draft.","err"); $("pTopic").focus(); return; }
    saveProfile(); state.maxUnlocked=Math.max(state.maxUnlocked,3); goStepVisual(3);
    if(!LD._state.draftMeta || true){ /* auto-generate first draft for instant gratification */ LD.generate(); }
  };

  /* ---------- selection ---------- */
  function getSelected(){ return state.results.find(function(p){return p.id===state.selectedId;}) || null; }
  LD.getSelected = getSelected;
  LD.selectProf = function(id){
    state.selectedId=id;
    document.querySelectorAll(".pcard").forEach(function(c){ c.classList.toggle("selected", c.dataset.id===id); });
    $("toStep2Btn").disabled=false;
    var p=getSelected();
    if(p){
      LD.toast("Selected "+p.name+" — continue to Step 2.","ok");
      state.maxUnlocked=Math.max(state.maxUnlocked,2);   // selecting a professor unlocks Step 2 immediately
    }
    updateFeasibility(); renderSelMini();
  };

  /* multi-engine implementation lives in search.js as LD.runSearch */
  var SEARCH_IMPL = function(opts){ return LD.runSearch(opts); };

  /* ---------- search flow ---------- */
  LD.quick = function(q,c){ $("q").value=q; if(c)$("country").value=c; LD.search(); };
  /* Offline UI sandbox: the fictional LD.DEMO_PROFESSORS table was DELETED (invented
     people, universities and DOIs must never be able to flow into a real email).
     The example-sandbox geoscience profiles in js/geology.js replace it. They are
     merged into the current result set via LD.mergeGeoExample() and every entry is
     flagged example:true, so drafts/mailto/CRM actions stay blocked for them. */
  LD.loadGeoDemo = function(){
    state.results = LD.mergeGeoExample(state.results);
    var profile = ($("pName") && $("pName").value.trim()) ? { topic:$("pTopic")?$("pTopic").value.trim():"", field:"", skills:state.skills } : null;
    state.results.forEach(function(p){
      var r = LD.computeResearchFit(p, profile || { topic: ($("q").value.trim()||"geology"), skills:state.skills });
      p.fit = r.display; p.researchFit = r;
    });
    state.results.sort(function(a,b){ return (b.fit||0)-(a.fit||0); });
    $("searchStatus").classList.add("hidden");
    showResults(true);
    LD.toast("Example sandbox loaded — browsing only. Drafts, mailto and CRM tracking are blocked for example data.","info");
  };
  LD.search = function(){
    var q=$("q").value.trim(), country=$("country").value, engines=$("engines").value;
    if(!q){ $("q").focus(); LD.toast("Type a research topic to search.","err"); return; }
    $("searchError").classList.add("hidden");
    $("resultsWrap").classList.add("hidden");
    $("searchEmpty").classList.add("hidden");
    $("searchStatus").classList.remove("hidden");
    $("searchBtn").disabled=true; $("searchBtn").textContent="Searching…";
    var engNames={openalex:"OpenAlex",semantic:"Semantic Scholar",crossref:"Crossref"};
    var want = engines==="all"?["openalex","semantic","crossref"]:[engines];
    $("engineProgress").innerHTML = want.map(function(e){
      return '<div class="engine-card run" id="eng-'+e+'"><div class="flex justify-between font-bold"><span>'+engNames[e]+'</span><span class="pct">0%</span></div><div class="bar"><i></i></div><div class="msg text-slate-500 mt-1">connecting…</div></div>';
    }).join("");
    function setEng(e,st,pct,msg){
      var card=$("eng-"+e); if(!card) return;
      card.className="engine-card "+(st==="run"?"run":st==="ok"?"ok":"err");
      card.querySelector(".pct").textContent=pct+"%";
      card.querySelector(".bar>i").style.width=pct+"%";
      if(msg) card.querySelector(".msg").textContent=msg;
    }
    SEARCH_IMPL({
      query:q, country:country, engines:engines,
      onEngine:function(e,st,pct){
        setEng(e,st,pct, st==="run"?(pct>=80?"merging results…":"fetching papers…"):st==="ok"?"done ✓":"failed (see note below)");
      },
      onDone:function(err,res,partialErrors){
        $("searchBtn").disabled=false; $("searchBtn").textContent="Search";
        if(err){
          $("searchStatus").classList.add("hidden");
          var box=$("searchError"); box.classList.remove("hidden");
          if(String(err.message)==="no_results"){
            box.innerHTML="<b>No usable profiles found.</b> Try broader terms (e.g. “groundwater modelling” instead of a niche phrase), or press <button class='underline font-bold' onclick='LD.loadGeoDemo()'>Load Example Sandbox</button> to explore the studio offline.";
          } else {
            box.innerHTML="<b>Live search unavailable:</b> "+escapeHtml(err.message)+".<br/>This can happen when APIs rate-limit or you are offline. <button class='underline font-bold' onclick='LD.loadGeoDemo()'>Load Example Sandbox →</button>";
          }
          return;
        }
        state.results=res;
        if(partialErrors && partialErrors.length){ LD.toast("Some engines failed: "+partialErrors.join("; "),"info"); }
        $("searchStatus").classList.add("hidden");
        showResults(false);
        if(state.settings.autoVerify) autoVerifyTop(res.slice(0,4));
      }
    });
  };
  function escapeHtml(s){ return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }

  function showResults(isDemo){
    $("resultsWrap").classList.remove("hidden");
    LD.renderResults();
    if(isDemo) LD.toast(state.results.length+" demo professors ready.","ok");
  }

  /* ---------- render cards ---------- */
  LD.renderResults = function(){
    var wrap=$("profCards"); if(!wrap) return;
    var sortBy=$("sortBy")?$("sortBy").value:"fit";
    var onlyV=$("onlyVerified")?$("onlyVerified").checked:false;
    var list=state.results.slice();
    if(onlyV) list=list.filter(function(p){return p.verified==="valid"||p.verified==="likely";});
    list.sort(function(a,b){
      if(sortBy==="hindex") return (b.hIndex||0)-(a.hIndex||0);
      if(sortBy==="recent") return (b.lastActive||0)-(a.lastActive||0);
      if(sortBy==="cited") return (b.citations||0)-(a.citations||0);
      return (b.fit||0)-(a.fit||0);
    });
    $("resultCount").textContent="· "+list.length+" professors"+(isLive(list)?" · live data":"");
    if(!list.length){ wrap.innerHTML='<div class="col-span-full text-center py-8 text-slate-400">No matches for this filter.</div>'; return; }
    wrap.innerHTML=list.map(cardHTML).join("");
  };
  function isLive(l){ return l.some(function(p){return (p.sources||[]).indexOf("demo")===-1 && !p.example;}); }

  function fitColor(f){ return f>=80?"#10b981":f>=65?"#3b6cf6":f>=50?"#f59e0b":"#ef4444"; }
  function srcBadge(s){ return {openalex:'<span class="badge b-blue">OpenAlex</span>',semantic:'<span class="badge b-amber">S2</span>',crossref:'<span class="badge b-green">Crossref</span>',example:'<span class="badge b-red">EXAMPLE</span>'}[s]||""; }

  /* ---------- funding strip on cards: structured funding records ONLY.
     The legacy LD.STIPENDS table and the old stip.ra / stip.ta property lookups were
     DELETED (unsourced averages). Cards now show evidence-backed records from
     js/fundability.js (LD.db.funding, each with an official source URL) or the plain
     country guidance text from fundability's schema in data.js — never invented amounts. */
  function fundingStrip(p){
    var recs = (LD.db && LD.db.funding ? LD.db.funding : []).filter(function(f){ return f.linkedProfessorId===p.id && f.source && f.source.url; });
    if(recs.length){
      return ' · 💶 '+recs.length+' sourced funding record'+(recs.length>1?'s':'')+' ('+escapeHtml(String((recs[0].source&&recs[0].source.checkedAt)||"").slice(0,10))+')';
    }
    var g = LD.stipendFor(p.country);
    return g ? ' · 💶 '+escapeHtml(g.country)+': '+escapeHtml(g.guidance) : '';
  }

  function cardHTML(p){
    var papers=(p.recentPapers||[]).slice(0,3).map(function(x){
      return '<li class="flex gap-1.5 items-start"><span class="mt-1 w-1 h-1 rounded-full bg-brand-400 shrink-0"></span><span class="leading-snug"><b class="font-semibold">'+escapeHtml(x.title||"")+'</b> <span class="text-slate-400">· '+escapeHtml(x.venue||"")+' '+(x.year||"")+'</span>'+(x.doi?' <a class="text-brand-600 underline decoration-dotted" target="_blank" rel="noopener" href="https://doi.org/'+encodeURIComponent(x.doi)+'">DOI:'+escapeHtml(x.doi)+'</a>':"")+'</span></li>';
    }).join("");
    var topics=(p.topics||[]).slice(0,4).map(function(t){return '<span class="badge b-slate">'+escapeHtml(t)+'</span>';}).join(" ");
    var sel = p.id===state.selectedId;
    var ev = null; try { ev = LD.evaluateAll(p, LD.profileForDraft ? LD.profileForDraft(p.id) : {}); } catch(e){}
    return ''+
    '<article class="pcard p-5 flex flex-col gap-3'+(sel?" selected":"")+(p.example?' opacity-90 ring-1 ring-rose-200':"")+'" data-id="'+p.id+'">'+
      '<span class="sel-flag">SELECTED ✓</span>'+
      (p.example?'<div class="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-rose-700">⚠ Example sandbox — not an outreach target</div>':'')+
      '<div class="flex items-start gap-3">'+
        '<div class="avatar-grad w-12 h-12 rounded-full grid place-items-center font-display font-bold text-white shrink-0">'+escapeHtml(p.initials||"??")+'</div>'+
        '<div class="min-w-0 flex-1">'+
          '<h4 class="font-display font-bold leading-tight truncate">'+escapeHtml(p.name)+'</h4>'+
          '<p class="text-xs text-slate-500 leading-snug">'+escapeHtml([p.title,p.dept].filter(Boolean).join(" · ")||"Faculty")+'</p>'+
          '<p class="text-xs text-slate-500 truncate">'+(LD.COUNTRY_FLAGS[p.country]||"🌐")+' '+escapeHtml(p.uni||"")+'</p>'+
        '</div>'+
        '<div class="text-right shrink-0" title="Research-fit display length from LD.computeResearchFit — listed topical overlaps only. NOT a reply or admission likelihood.">'+
          '<svg viewBox="0 0 40 40" class="w-11 h-11 -rotate-90"><circle cx="20" cy="20" r="16" stroke="#e2e8f0" stroke-width="4" fill="none"/><circle cx="20" cy="20" r="16" stroke="'+fitColor(p.fit||0)+'" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="100.5" stroke-dashoffset="'+(100.5-(100.5*(p.fit||0)/100))+'"/></svg>'+
          '<p class="text-[10px] font-extrabold -mt-8">'+(p.researchFit?p.researchFit.count:(p.fit||0)+(p.fit?"%":""))+'</p><p class="text-[8px] font-bold text-slate-400 mt-4">OVERLAPS</p>'+
        '</div>'+
      '</div>'+
      '<div class="grid grid-cols-3 gap-2 text-center">'+
        statCell(p.hIndex,"h-index")+statCell(fmtN(p.citations),"citations")+statCell(fmtN(p.papers),"papers")+
      '</div>'+
      (ev?LD.renderStatusPills(ev,true):'')+
      '<div class="flex flex-wrap gap-1">'+topics+'</div>'+
      '<div class="text-[11px] text-slate-400 flex flex-wrap gap-1 items-center">sources: '+(p.sources||[]).map(srcBadge).join("")+' · active '+(p.lastActive||"—")+fundingStrip(p)+'</div>'+
      (papers?'<details class="paper-fold"><summary class="text-xs font-bold text-brand-700 select-none">▾ Recent publications (real DOIs)</summary><ul class="mt-2 space-y-1.5 text-[12px] text-slate-600 list-none pl-0">'+papers+'</ul></details>':'')+
      '<div class="mt-auto pt-1 flex items-center justify-between gap-2 border-t border-slate-100">'+
        '<span class="email-badge text-[11px] font-bold text-slate-400" data-email-state="'+(p.email?"none":"noemail")+'">'+(p.email? "✉ "+shortEmail(p.email) : "✉ no public email")+'</span>'+
        '<div class="flex gap-1.5">'+
          (p.profileUrl?'<a target="_blank" rel="noopener" href="'+escapeHtml(p.profileUrl)+'" class="btn-mini !text-[11px]" title="Source profile">Profile ↗</a>':"")+
          '<button class="btn-mini !bg-brand-600 !text-white hover:!bg-brand-700 !text-[11px]" onclick="LD.selectProf(\''+p.id+'\')">Select</button>'+
        '</div>'+
      '</div>'+
    '</article>';
  }
  function statCell(v,l){ return '<div class="bg-slate-50 rounded-lg py-1.5"><p class="font-display font-bold">'+(v==null?"—":v)+'</p><p class="text-[9px] uppercase tracking-wide text-slate-400 font-bold">'+l+'</p></div>'; }
  function fmtN(n){ if(n==null) return null; if(n>=1000) return (n/1000).toFixed(1).replace(/\.0$/,"")+"k"; return n; }
  function shortEmail(e){ return e.length>26? e.slice(0,12)+"…"+e.slice(e.indexOf("@")) : e; }

  /* ---------- auto email verification (Google DoH) ---------- */
  function autoVerifyTop(profs){
    profs.forEach(function(p){
      if(!p.email) return;
      LD.verifyEmail(p.email).then(function(r){
        p.verified=r.level;
        updateCardBadge(p);
      }).catch(function(){ p.verified="unknown"; updateCardBadge(p); });
    });
  }
  function updateCardBadge(p){
    var card=document.querySelector('.pcard[data-id="'+p.id+'"]'); if(!card) return;
    var el=card.querySelector(".email-badge"); if(!el) return;
    var map={valid:["b-green","✓ verified · live MX"],likely:["b-blue","~ likely deliverable"],invalid:["b-red","✗ dead domain"],unknown:["b-amber","? could not check"]};
    var m=map[p.verified]||["b-slate","✉ unverified"];
    el.className="email-badge badge "+m[0];
    el.textContent=m[1]+(p.freeMail&&p.verified==="valid"?" · free mail":"");
  }
  LD.updateCardBadge = updateCardBadge;

  /* ---------- selected mini card (step 2) ---------- */
  function renderSelMini(){
    var box=$("selProfMini"); var p=getSelected();
    if(!box) return;
    if(!p){ box.innerHTML='<p class="text-[11px] font-bold uppercase tracking-widest text-brand-600 mb-2">Selected professor</p><p class="text-sm text-slate-500">None yet — go back to Step 1 and pick a profile card.</p>'; return; }
    var ev=null; try{ ev = LD.evaluateAll(p, LD.profileForDraft ? LD.profileForDraft(p.id) : {}); }catch(e){}
    box.innerHTML='' +
      '<p class="text-[11px] font-bold uppercase tracking-widest text-brand-600 mb-2">Selected professor</p>' +
      (p.example?'<div class="mb-3 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[11px] font-bold text-rose-700">⚠ EXAMPLE-SANDBOX record — drafts, mailto and CRM tracking are blocked for this profile.</div>':'') +
      '<div class="flex items-center gap-3">' +
        '<div class="avatar-grad w-11 h-11 rounded-full grid place-items-center font-display font-bold text-white shrink-0">'+escapeHtml(p.initials||"??")+'</div>' +
        '<div class="min-w-0"><p class="font-bold leading-tight truncate">'+escapeHtml(p.name)+'</p><p class="text-xs text-slate-500 truncate">'+escapeHtml((p.dept||"")+(p.uni?" · "+p.uni:""))+'</p></div>' +
      '</div>' +
      '<div class="mt-3 grid grid-cols-3 gap-2 text-center text-sm">' +
        '<div class="bg-white rounded-lg py-1.5 border border-brand-100"><b class="font-display">'+(p.hIndex||"—")+'</b><p class="text-[10px] text-slate-400 font-bold uppercase">h-index</p></div>' +
        '<div class="bg-white rounded-lg py-1.5 border border-brand-100"><b class="font-display">'+fmtN(p.citations)+'</b><p class="text-[10px] text-slate-400 font-bold uppercase">citations</p></div>' +
        '<div class="bg-white rounded-lg py-1.5 border border-brand-100"><b class="font-display">'+(ev&&ev.alignment?ev.alignment.count:(p.researchFit?p.researchFit.count:"—"))+'</b><p class="text-[10px] text-slate-400 font-bold uppercase">listed overlaps</p></div>' +
      '</div>' +
      (ev?'<div class="mt-3">'+LD.renderStatusPills(ev,true)+'</div>':'') +
      /* structured funding evidence only — the legacy stip.ra / stip.ta table lookups were deleted */
      (ev&&ev.funding?'<p class="mt-3 text-xs text-slate-600 bg-white/70 rounded-lg p-2.5 border border-brand-100">💶 <b>'+escapeHtml(p.country||"Funding")+'</b>: '+escapeHtml(ev.funding.label)+' — '+escapeHtml(ev.funding.note)+(ev.funding.evidence&&ev.funding.evidence.length?' <a class="underline decoration-dotted text-brand-700" target="_blank" rel="noopener" href="'+escapeHtml(ev.funding.evidence[0].url)+'">source</a>':"")+'</p>':"")+
      (p.email?'<p class="mt-2 text-xs text-slate-500">✉ '+escapeHtml(p.email)+' <span class="badge '+vb(p.verified)+'">'+vlabel(p.verified)+'</span></p>':'<p class="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">⚠ No public email from APIs — find it on their lab page, then paste it below to enable sending.</p><input id="manualEmail" class="fld mt-2" placeholder="Paste professor email to enable sending" oninput="LD.setManualEmail(this.value)" />') +
      (ev?'<details class="mt-3"><summary class="text-xs font-bold text-brand-700 cursor-pointer select-none">▾ Full status detail (alignment · funding · eligibility · contact)</summary><div class="mt-2 space-y-2">'+LD.renderStatusDetail(ev)+'</div></details>':'') +
      '<button onclick="LD.goStep(1)" class="mt-3 text-xs font-bold text-brand-700 hover:underline">← change professor</button>';
  }
  function vb(v){ return v==="valid"?"b-green":v==="likely"?"b-blue":v==="invalid"?"b-red":"b-slate"; }
  function vlabel(v){ return v==="valid"?"✓ verified":v==="likely"?"~ likely":v==="invalid"?"✗ invalid":"unverified"; }
  LD.setManualEmail = function(v){ var p=getSelected(); if(p){ p.email=v.trim(); if(p.email){ p.verified=null; LD.verifySelectedEmail(); } } };

  /* ---------- feasibility scoring (SWAPPED: the legacy heuristic "reply-likelihood"
     point model was DELETED — it invented odds labels like "Strong odds"/"Low odds" from
     h-index bands and guessed recruiting signals. Step 2 now delegates to
     LD.computeResearchFit (geology.js) for the overlap number, renders sourced status
     pills via LD.renderStatusPills / LD.renderStatusDetail (fit.js), and takes funding
     figures only from structured records handled by fundability.js. ---------- */
  LD.updateFeasibility = updateFeasibility;
  function updateFeasibility(){
    var ring=$("feasRing"), num=$("feasNum"), list=$("feasList"), badge=$("feasBadge");
    if(!ring) return;
    var p=getSelected();
    if(!p){ ring.style.strokeDashoffset=326.7; num.textContent="0"; badge.textContent="—"; badge.className="text-xs font-bold rounded-full px-2.5 py-1 bg-slate-100 text-slate-400"; list.innerHTML='<li class="text-slate-400">Select a professor to compute research fit.</li>'; return; }
    var profile = LD.profileForDraft ? LD.profileForDraft(p.id) : { topic:$("pTopic").value.trim(), skills:state.skills };
    var r = LD.computeResearchFit(LD.toProfessorLite ? LD.toProfessorLite(p) : p, profile || {});
    p.researchFit = r; p.fit = r.display;
    var ev=null; try{ ev = LD.evaluateAll(p, profile||{}); }catch(e){}
    var C=326.7, pct=r.display||0;
    ring.style.strokeDashoffset = (C - C*pct/100);
    ring.setAttribute("stroke", pct>=75?"#10b981":pct>=55?"#3b6cf6":pct>=40?"#f59e0b":"#ef4444");
    num.textContent = r.count;   /* listed topical overlaps — NOT reply odds */
    badge.textContent = r.count===0?"No listed overlap":r.count<=2?"Moderate overlap":r.count<=5?"Good overlap":"Strong overlap";
    badge.className = "text-xs font-bold rounded-full px-2.5 py-1 " + (r.count>=6?"bg-emerald-100 text-emerald-700":r.count>=3?"bg-brand-100 text-brand-700":r.count>=1?"bg-amber-100 text-amber-700":"bg-rose-100 text-rose-700");
    list.innerHTML = (ev?LD.renderStatusPills(ev,true):'<li class="text-slate-400">Status engine unavailable.</li>')+
      '<li class="text-[10px] text-slate-400 mt-2">Research-fit display length from LD.computeResearchFit · status pills from LD.renderStatusPills (fit.js) · funding figures only from structured records in fundability.js. This is not a reply or admission likelihood.</li>';
    state.feasibility=pct;
  }

  /* ---------- skills chips ---------- */
  LD.skillKey = function(e){
    if(e.key==="Enter"||e.key===","){ e.preventDefault();
      var v=e.target.value.trim().replace(/,$/,""); if(v && state.skills.indexOf(v)===-1 && state.skills.length<12){ state.skills.push(v); renderSkills(); } e.target.value=""; updateFeasibility(); saveProfile();
    } else if(e.key==="Backspace" && !e.target.value && state.skills.length){ state.skills.pop(); renderSkills(); }
  };
  function renderSkills(){
    var box=$("skillsBox"); if(!box) return;
    box.querySelectorAll(".skill-tag").forEach(function(t){t.remove();});
    var inp=$("skillInput");
    state.skills.forEach(function(s,i){
      var t=document.createElement("span"); t.className="skill-tag";
      t.innerHTML=escapeHtml(s)+' <button aria-label="remove" onclick="LD.rmSkill('+i+')">×</button>';
      box.insertBefore(t,inp);
    });
  }
  LD.rmSkill=function(i){ state.skills.splice(i,1); renderSkills(); updateFeasibility(); saveProfile(); };

  /* ---------- generation ---------- */
  function ctxFromUI(){
    return {
      prof:getSelected(),
      profile:{ name:$("pName").value.trim(), degree:$("pDegree").value, uni:$("pUni").value.trim(), field:$("pField").value.trim(),
        topic:$("pTopic").value.trim(), skills:state.skills, exp:$("pExp").value.trim(), gpa:$("pGpa").value.trim(), english:$("pEnglish").value },
      tone:$("tone").value, ask:$("askType").value, attach:$("attach").value,
      opts:{ linkedin:$("optLinkedIn").checked, scholar:$("optScholar").checked, available:$("optAvailable").checked, startMonth:"Fall 2026",
             wordLimit: effectiveWordLimit() },   /* facts.js LD.getWordLimit(ctx) honours this band (120–180 default) */
      variant: state.variant
    };
  }
  LD.generate = function(){
    /* Example-guard: never generate an outreach draft for example/demonstration data. */
    if (guardExampleProfile("draft generation")) return;
    var p=getSelected();
    if(!p){ LD.toast("Go back to Step 1 and select a professor.","err"); LD.goStep(1); return; }
    if(!$("pName").value.trim()||!$("pTopic").value.trim()){ LD.toast("Step 2 needs your name & research topic.","err"); LD.goStep(2); return; }
    saveProfile();
    var mode=document.querySelector('input[name="mode"]:checked').value;
    var ctx=ctxFromUI();
    var btn=$("genBtn"); btn.disabled=true; var old=btn.textContent;
    if(mode==="local"){
      btn.textContent="Generating…";
      setTimeout(function(){
        state.variant++; ctx.variant=state.variant;
        var d=LD.localDraft(ctx); applyDraft(d,"local"); btn.disabled=false; btn.textContent=old;
      },260);
    } else if(mode==="gptprompt"){
      btn.textContent="Building prompt…";
      var mp=LD.buildMegaPrompt(ctx);
      copyText(mp).then(function(ok){
        btn.disabled=false; btn.textContent=old;
        if(ok) LD.toast("Mega-prompt copied! Paste into ChatGPT/Gemini/Claude, then drop the result here.","ok");
        $("aiNotice").classList.remove("hidden");
        $("aiNotice").innerHTML="<b>ChatGPT Prompt Builder.</b> The full prompt was copied to your clipboard. After ChatGPT replies, paste its email into the box below — the word meter and cliché scanner will validate it.<br/><span class='opacity-70'>Tip: ask the model “make it sound like a real student, not AI”.</span>";
        applyDraft({subject:"(paste after ChatGPT reply)", body:"", words:0},"prompt");
        $("draftBody").focus();
      });
    } else if(mode==="groq"){
      var key=state.settings.groqKey;
      if(!key){ btn.disabled=false; btn.textContent=old; LD.toast("Add your free Groq API key in ⚙ Settings first.","err"); LD.openModal("settingsModal"); return; }
      btn.textContent="Llama 3 thinking…";
      $("aiNotice").classList.remove("hidden"); $("aiNotice").innerHTML="⏳ Calling Groq ("+escapeHtml(state.settings.model)+")…";
      LD.groqDraft(ctx,key,state.settings.model).then(function(d){
        applyDraft(d,"groq"); btn.disabled=false; btn.textContent=old;
        LD.toast("AI draft generated & trimmed under 150 words ✓","ok");
      }).catch(function(err){
        btn.disabled=false; btn.textContent=old;
        $("aiNotice").innerHTML="<b>Groq failed:</b> "+escapeHtml(err.message)+". Falling back to local template — or switch mode / check your key in ⚙ Settings.";
        var d=LD.localDraft(Object.assign(ctx,{variant:++state.variant})); applyDraft(d,"local-fallback");
      });
    }
  };

  function applyDraft(d, engine){
    $("subj").value=d.subject||"";
    $("draftBody").value=d.body||"";
    state.draftMeta={engine:engine, profId:state.selectedId, subject:d.subject, generatedAt:Date.now()};
    updateWordMeter();
    var lim=effectiveWordLimit();
    if(engine==="groq") $("aiNotice").innerHTML="✅ Generated with <b>Groq · "+escapeHtml(state.settings.model)+"</b>, auto-trimmed to the "+LD.TARGET_LOW+"–"+lim+"-word band (facts.js) and cliché-scanned.";
    if(engine==="local"||engine==="local-fallback") $("aiNotice").classList.add("hidden");
    if(engine!=="prompt" && d.words>lim){ $("aiNotice").classList.remove("hidden"); $("aiNotice").innerHTML+=" <b class='text-rose-700'>Over limit!</b> Trim before sending."; }
  }

  /* ---------- word meter + cliché scan while editing ----------
     Bounds come from js/facts.js (recommended band LD.TARGET_LOW≈120 … configured limit,
     default LD.DEFAULT_LIMIT=180) — the old hard-coded 150 is gone. */
  function updateWordMeter(){
    var t=$("draftBody").value, w=LD.countWords(t);
    var lim=effectiveWordLimit(), low=(LD.TARGET_LOW||120);
    var pill=$("wcPill"); pill.textContent=w+" / "+lim;
    pill.title="Target band ≈"+low+"–"+lim+" words (js/facts.js)";
    pill.className="wc-pill "+(w>lim?"over":(w>=low?" ":"warn"));
    var cl=LD.findCliches(t);
    var cp=$("clichePill"); cp.textContent="clichés: "+cl.length;
    cp.className="shrink-0 text-[11px] font-bold rounded-full px-2.5 py-1 "+(cl.length?"bg-rose-100 text-rose-700":"bg-emerald-50 text-emerald-700");
    cp.title=cl.join(" | ");
    $("readTime").textContent="~"+Math.max(5,Math.round(w/3.5))+"s read";
    syncWordBoundsFromFacts();
  }
  document.addEventListener("DOMContentLoaded", function(){
    var ta=$("draftBody"); if(ta){ ta.addEventListener("input",updateWordMeter); }
    ["pName","pTopic","pGpa","pExp","pUni","pField"].forEach(function(id){ var el=$(id); if(el) el.addEventListener("input",function(){ updateFeasibility(); saveProfile(); }); });
    ["pDegree","pRole","pEnglish"].forEach(function(id){ var el=$(id); if(el) el.addEventListener("change",function(){ updateFeasibility(); saveProfile(); }); });
    var q=$("q"); if(q) q.addEventListener("keydown",function(e){ if(e.key==="Enter") LD.search(); });
    loadPersisted(); renderPipeline(); updateFeasibility();
    syncStep2QuickFields();   /* Step-2 quick fields ↔ profile.js canonical store */
    syncWordBoundsFromFacts();
    $("hdr-count-n").textContent=state.pipeline.length;
  });

  /* ---------- email panel on step 3 ---------- */
  function refreshEmailPanel(){
    var box=$("emailCheck"), btn=$("verifyBtn"); var p=getSelected();
    if(!p || !p.email){ box.innerHTML='<p class="text-slate-400">No email for this professor yet. Their lab homepage or faculty directory usually lists one — add it manually in Step 2.</p>'; btn.classList.add("hidden"); return; }
    btn.classList.remove("hidden");
    if(p.verified){ paintEmailResult(p); }
    else { box.innerHTML='<p class="text-slate-500"><b>'+escapeHtml(p.email)+'</b> — not checked yet. Press verify to query Google DNS-over-HTTPS.</p>'; }
  }
  LD.verifySelectedEmail = function(){
    var p=getSelected(); if(!p||!p.email){ LD.toast("No email to verify.","err"); return; }
    $("emailCheck").innerHTML='<p class="text-brand-700 font-semibold animate-pulse">Querying dns.google (MX → A fallback)…</p>';
    LD.verifyEmail(p.email).then(function(r){
      p.verified=r.level; paintEmailResult(p,r); LD.updateCardBadge(p); updateFeasibility();
    }).catch(function(e){
      $("emailCheck").innerHTML='<p class="text-rose-700 font-bold">Verification request failed ('+escapeHtml(e.message)+'). Check your network connection.</p>';
    });
  };
  function paintEmailResult(p,r){
    r=r||{level:p.verified,reason:""};
    var map={valid:["✅","text-emerald-700","bg-emerald-50 border-emerald-200"],likely:["🟦","text-blue-700","bg-blue-50 border-blue-200"],invalid:["❌","text-rose-700","bg-rose-50 border-rose-200"]};
    var m=map[r.level]||["❓","text-slate-500","bg-slate-50 border-slate-200"];
    $("emailCheck").innerHTML='<div class="rounded-xl border '+m[2]+' p-3"><p class="font-bold '+m[1]+'">'+m[0]+' '+escapeHtml(p.email)+'</p><p class="text-xs text-slate-600 mt-1">'+escapeHtml(r.reason||"")+(r.freeMail?' · <b>free-mail domain</b> (less formal for outreach)':"")+'</p><p class="text-[10px] text-slate-400 mt-1">via Google DNS-over-HTTPS · dns.google/resolve</p></div>';
  }

  /* ---------- copy / download / mailto ---------- */
  function copyText(t){
    if(navigator.clipboard && navigator.clipboard.writeText){ return navigator.clipboard.writeText(t).then(function(){return true;}).catch(function(){return legacyCopy(t);}); }
    return Promise.resolve(legacyCopy(t));
  }
  function legacyCopy(t){ try{ var ta=document.createElement("textarea"); ta.value=t; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); var ok=document.execCommand("copy"); ta.remove(); return ok; }catch(e){ return false; } }
  LD.copyDraft = function(){
    var txt=fullDraftText(); if(!txt){ LD.toast("Nothing to copy — generate a draft first.","err"); return; }
    copyText(txt).then(function(ok){ LD.toast(ok?"Draft copied to clipboard ✓":"Copy failed — select text manually.",ok?"ok":"err"); });
  };
  function fullDraftText(){
    var body=$("draftBody").value.trim(); if(!body) return "";
    return "Subject: "+$("subj").value.trim()+"\n\n"+body;
  }
  LD.downloadDraft = function(){
    var txt=fullDraftText(); if(!txt){ LD.toast("Generate a draft first.","err"); return; }
    var p=getSelected(); var a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([txt],{type:"text/plain"}));
    a.download="outreach-"+((p&&p.name||"professor").replace(/\W+/g,"-").toLowerCase())+".txt";
    document.body.appendChild(a); a.click(); a.remove(); LD.toast("Downloaded .txt","ok");
  };
  LD.openMailto = function(){
    /* Example-guard: mailto is a live-outreach action — blocked for demonstration data. */
    if (guardExampleProfile("mailto outreach")) return;
    var p=getSelected(); if(!p){ LD.toast("Select a professor first.","err"); return; }
    if(LD.countWords($("draftBody").value)>effectiveWordLimit()){ LD.toast("Trim below "+LD.TARGET_LOW+"–"+effectiveWordLimit()+" words before sending 😉","err"); return; }
    if(!p.email){ LD.toast("No email on record — add one in Step 2.","err"); return; }
    var body=$("draftBody").value.replace(/\n/g,"%0D%0A");
    window.location.href="mailto:"+encodeURIComponent(p.email)+"?subject="+encodeURIComponent($("subj").value)+"&body="+body;
  };
  LD.togglePlain = function(){
    state.plainView=!state.plainView;
    $("plainBtn").textContent=state.plainView?"Back to editor":"Show raw plain text";
    if(state.plainView){ $("draftBody").setAttribute("readonly",""); } else { $("draftBody").removeAttribute("readonly"); }
  };

  /* ---------- pipeline ---------- */
  LD.saveToPipeline = function(){
    /* Example-guard: CRM pipeline tracking must never contain example/demonstration records. */
    if (guardExampleProfile("CRM pipeline tracking")) return;
    var p=getSelected(); var body=$("draftBody").value.trim();
    if(!p||!body){ LD.toast("Need a selected professor + generated draft.","err"); return; }
    var lim=effectiveWordLimit(); var w=LD.countWords(body); if(w>lim){ LD.toast("Draft is "+w+" words — trim under "+lim+" first.","err"); return; }
    if(state.pipeline.some(function(x){return x.profId===p.id && x.body===body;})){ LD.toast("Already saved.","info"); return; }
    state.pipeline.unshift({ id:"pl"+Date.now(), profId:p.id, profName:p.name, uni:p.uni, email:p.email, subject:$("subj").value, body:body, words:w, status:"notsent", feas:state.feasibility||p.fit||0, at:new Date().toLocaleDateString() });
    ls("ld_pipeline",state.pipeline); renderPipeline(); $("hdr-count-n").textContent=state.pipeline.length;
    LD.toast("Saved to pipeline 📌","ok");
  };
  LD.setStatus = function(id,st){ state.pipeline.forEach(function(x){if(x.id===id)x.status=st;}); ls("ld_pipeline",state.pipeline); renderPipeline(); };
  LD.delPipe = function(id){ state.pipeline=state.pipeline.filter(function(x){return x.id!==id;}); ls("ld_pipeline",state.pipeline); renderPipeline(); $("hdr-count-n").textContent=state.pipeline.length; };
  LD.clearPipeline = function(){ if(!confirm("Clear all pipeline entries?")) return; state.pipeline=[]; ls("ld_pipeline",[]); renderPipeline(); $("hdr-count-n").textContent=0; };
  LD.loadPipe = function(id){
    var it=state.pipeline.find(function(x){return x.id===id;}); if(!it) return;
    var match=state.results.find(function(p){return p.id===it.profId;});
    if(match){ state.selectedId=match.id; }
    $("subj").value=it.subject; $("draftBody").value=it.body; updateWordMeter();
    LD.goStep(3); LD.toast("Loaded draft for "+it.profName,"info");
  };
  function renderPipeline(){
    var wrap=$("pipeline"); if(!wrap) return;
    if(!state.pipeline.length){ wrap.innerHTML='<p class="text-slate-400 col-span-full">Saved drafts appear here. Progress: Not sent → Sent → Replied → Interview → Offer 🎉</p>'; return; }
    var order=["notsent","sent","replied","interview","offer"], labels={"notsent":"Not sent","sent":"Sent ✉","replied":"Replied 💬","interview":"Interview 🎤","offer":"Offer 🎉"};
    wrap.innerHTML=state.pipeline.map(function(it){
      return '<div class="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:border-brand-300 transition">'+
        '<div class="flex items-start justify-between gap-2"><div class="min-w-0"><p class="font-bold truncate">'+escapeHtml(it.profName)+'</p><p class="text-xs text-slate-500 truncate">'+escapeHtml(it.uni||"")+' · '+escapeHtml(it.at)+'</p></div>'+
        '<button class="text-slate-400 hover:text-rose-600 font-bold" onclick="LD.delPipe(\''+it.id+'\')" title="Delete">✕</button></div>'+
        '<p class="text-xs text-slate-600 mt-2 line-clamp-2" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">'+escapeHtml(it.subject)+' · '+it.words+' words'+(it.feas?' · fit '+it.feas+'%':"")+'</p>'+
        '<div class="mt-3 flex items-center justify-between gap-2 flex-wrap">'+
          '<select class="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold st-'+it.status+'" onchange="LD.setStatus(\''+it.id+'\',this.value)">'+order.map(function(s){return '<option value="'+s+'"'+(s===it.status?" selected":"")+'>'+labels[s]+'</option>';}).join("")+'</select>'+
          '<div class="flex gap-1.5"><button class="btn-mini !text-[11px]" onclick="LD.loadPipe(\''+it.id+'\')">Open</button>'+(it.email?'<a class="btn-mini !text-[11px]" href="mailto:'+encodeURIComponent(it.email)+'">Mail</a>':"")+'</div>'+
        '</div></div>';
    }).join("");
  }

  /* ---------- Step-2 quick fields ↔ profile.js canonical store ----------
     Sync via LD.legacyProfileBridge (js/profile.js): the bridge exposes the saved
     profile as the old flat shape {name, uni, degree, field, topic, gpa, exp, skills}. */
  function syncStep2QuickFields(){
    if(!LD.legacyProfileBridge) return;
    var b = {}; try{ b = LD.legacyProfileBridge() || {}; }catch(e){ return; }
    function set(id,v){ var el=$(id); if(el && v && !el.value) el.value=v; }
    set("pName",b.name); set("pUni",b.uni); set("pField",b.field);
    set("pTopic",b.topic); set("pGpa",b.gpa); set("pExp",b.exp);
    if((!state.skills || !state.skills.length) && Array.isArray(b.skills)) state.skills=b.skills.slice(0,12);
    renderSkills();
    /* two-way: when the user edits a Step-2 quick field, push it into profile.js's
       canonical store so LD.profileForDraft / fundability see the same values. */
    ["pName","pUni","pField","pTopic","pGpa","pExp"].forEach(function(id){
      var el=$(id); if(!el) return;
      el.addEventListener("change", function(){
        if(!LD.basicChanged) return;
        var map={pName:"pfName",pUni:"pfUni",pField:"pfField",pTopic:"pfTopic",pGpa:"pfGpa",pExp:"pfExp"};
        LD.basicChanged(map[id]);
      });
    });
  }

  /* ---------- settings ---------- */
  LD.saveSettings = function(){
    state.settings.groqKey=$("groqKey").value.trim();
    state.settings.model=$("modelSel").value;
    state.settings.autoVerify=$("autoVerify").checked;
    var wlEl=$("wordLimit");
    if(wlEl){   /* clamp to facts.js bounds (LD.MIN_LIMIT–LD.MAX_LIMIT) */
      var n=parseInt(wlEl.value,10);
      if(LD.MIN_LIMIT!=null && LD.MAX_LIMIT!=null && !(n>=LD.MIN_LIMIT && n<=LD.MAX_LIMIT)){
        n = Math.max(LD.MIN_LIMIT, Math.min(LD.MAX_LIMIT, isNaN(n)?LD.DEFAULT_LIMIT:n));
        wlEl.value=n;
      }
      state.settings.wordLimit=n;
    }
    ls("ld_settings",state.settings);
    syncWordBoundsFromFacts(); updateWordMeter();
    LD.closeModal("settingsModal"); LD.toast("Settings saved locally ✓","ok");
  };
  document.addEventListener("DOMContentLoaded", function(){
    setTimeout(function(){ $("groqKey").value=state.settings.groqKey||""; $("modelSel").value=state.settings.model||"llama-3.3-70b-versatile"; $("autoVerify").checked=!!state.settings.autoVerify; },50);
  });

  /* expose stepper helper used inside goStep */
  function goStepGuard(){}
})();
