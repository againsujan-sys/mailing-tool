var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · profile.js — My Academic Profile ===========================
   A single editable, confirmable source of truth for everything the email generator is
   allowed to claim about YOU. Rules enforced here and consumed by draft.js/facts.js:

   • Every field starts as an EDITABLE DEFAULT (pre-filled from the user's own data),
     never a fixed claim. The user must edit and explicitly CONFIRM each section.
   • Nothing is ever asserted in an email unless the field is filled AND confirmed.
     Empty / unconfirmed ⇒ the generator silently omits it (no placeholder text).
   • Publications, instruments and analyses are NEVER auto-claimed: they only exist if
     the user adds them to "Research experience" and ticks the confirmation box.
   • Per-professor interest selection: the six research-interest chips are defaults;
     for each professor the user picks which subset applies. Only that subset drives
     the Research Fit Score and the "research connection" sentence of the draft.
   • Stored in localStorage under "ld_profile_v2".                              */
(function(){
  window.LD = window.LD || {};
  var $ = function(id){ return document.getElementById(id); };
  var KEY = "ld_profile_v2";
  var INTENT_KEY = "ld_intent_";        // per-professor selected interests: ld_intent_<profId>

  /* ---------- PRIVACY: blank defaults only ----------
     This file is PUBLIC JavaScript served to every visitor of the deployed site.
     Personal academic data (name, home institution, grades, employer, personal
     website) must NEVER be hard-coded here — anything written into these defaults
     is exposed to the whole world and cached by CDNs. The previous build shipped a
     real student's name, campus, percentage and portfolio URL in this object; it
     has been removed. Every field now starts EMPTY and lives only in the owner's
     browser (localStorage "ld_profile_v2"). */
  var DEFAULTS = {
    basics:{ name:"", headline:"",
             email:"", phone:"", website:"",
             linkedin:"", scholar:"", orcid:"" },
    education:[ { degree:"", institution:"",
                  country:"", year:"", grade:"",
                  coursework:"",
                  confirmed:false } ],
    experience:[ { role:"", org:"",
                   dates:"", responsibilities:"",
                   skills:"", confirmed:false } ],
    research:[ { title:"", status:"completed",   // completed | proposed — never mixed silently
                 methods:"", fieldwork:"", datasets:"", publications:"", presentations:"", confirmed:false } ],
    skills:[ "QGIS","geological mapping","field surveys","geotechnical investigation","laboratory methods" ],
    prefs:{ intake:"Fall 2027", countries:["Norway","Germany","Netherlands","Switzerland","Canada","Australia"],
            thesisMSc:true, fullFunding:true },
    docs:{ cv:"", transcript:"", researchStatement:"", portfolio:"" },
    contact:{ preferredEmail:"", phone:"", links:"" },
    interests:[ {label:"Engineering Geology", on:true},{label:"Hydrogeology", on:true},
                {label:"Geohazards", on:true},{label:"Glaciology", on:true},
                {label:"Geophysics", on:true},{label:"Environmental Geoscience", on:true} ],
    sectionsConfirmed:{ education:false, experience:false, research:false, skills:false, prefs:false, docs:false, contact:false }
  };

  function clone(o){ return JSON.parse(JSON.stringify(o)); }
  function lsGet(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }

  var P = null;                                   // live profile object
  LD.getProfile = function(){ return P || (P = mergeSaved()); };
  function mergeSaved(){
    var saved = lsGet(KEY);
    var base = clone(DEFAULTS);
    if(saved && typeof saved==="object"){
      // shallow-merge every top-level group so new default fields appear after upgrades
      Object.keys(base).forEach(function(g){
        if(saved[g]==null) return;
        if(Array.isArray(base[g])) base[g]=saved[g];
        else if(typeof base[g]==="object") base[g]=Object.assign({},base[g],saved[g]);
        else base[g]=saved[g];
      });
    }
    return base;
  }
  function save(){ lsSet(KEY,P); }

  /* ---------- active (profile-level) interests ---------- */
  LD.activeInterests = function(){
    P = P || mergeSaved();
    return (P.interests||[]).filter(function(i){return i.on;}).map(function(i){return i.label;});
  };

  /* ---------- per-professor interest selection ----------
     For each professor, only the interests the user actively selects are used in
     the fit score and the draft. Falls back to profile-level active interests. */
  LD.setIntentInterests = function(profId, labels){ lsSet(INTENT_KEY+profId, labels||[]); };
  LD.getIntentInterests = function(profId){
    var v = lsGet(INTENT_KEY+profId);
    if(Array.isArray(v)) return v;
    return null;                                    // null ⇒ use profile defaults
  };

  /* ---------- view-model for the draft engine (facts stay verbatim) ---------- */
  LD.profileForDraft = function(profId){
    P = P || mergeSaved();
    /* Step-2 quick fields (pName/pUni/pField/pTopic/pGpa/pExp) take precedence when filled —
       they are the same user's data, synced through LD.legacyProfileBridge / LD.basicChanged. */
    var quick = (typeof $==="function" && $("step-2")) ? {
      name: ($("pName")&&$("pName").value.trim())||"", uni: ($("pUni")&&$("pUni").value.trim())||"",
      field:($("pField")&&$("pField").value.trim())||"", topic:($("pTopic")&&$("pTopic").value.trim())||"",
      gpa:  ($("pGpa")&&$("pGpa").value.trim())||"",   exp:  ($("pExp")&&$("pExp").value.trim())||""
    } : {};
    var sel = profId ? LD.getIntentInterests(profId) : null;
    var interests = (sel && sel.length) ? sel : LD.activeInterests();
    var edu = (P.education||[])[0] || {};
    var topicBits = [];
    if(P.prefs && P.prefs.thesisMSc) topicBits.push("thesis-based MSc");
    interests.forEach(function(i){ topicBits.push(i.toLowerCase()); });
    var expLines = (P.experience||[]).filter(function(x){ return x.confirmed && (x.role||x.responsibilities); })
      .map(function(x){ return [x.role, x.org, x.dates].filter(Boolean).join(" · ") + (x.responsibilities?": "+x.responsibilities:""); });
    var resDone = (P.research||[]).filter(function(r){ return r.confirmed && r.status==="completed" && (r.title||r.methods); });
    var resProp = (P.research||[]).filter(function(r){ return r.confirmed && r.status==="proposed" && (r.title||r.methods); });
    var pubs = [];
    resDone.forEach(function(r){ if(r.publications && !/^(none|n\/a|-)$/i.test(String(r.publications).trim())) pubs.push(String(r.publications).trim()); });
    return {
      name:quick.name||P.basics.name, headline:P.basics.headline,
      degree: edu.degree||"", uni: quick.uni||edu.institution||"", gradYear: edu.year||"",
      grade: quick.gpa||edu.grade||"", gpa: quick.gpa||edu.grade||"", coursework: edu.coursework||"",
      field: quick.field||P.basics.field||"Geology",
      topic: quick.topic||topicBits.join(" · "),
      interests: interests,
      skills: (P.skills||[]).slice(),
      exp: quick.exp||expLines.join("; "),
      researchCompleted: resDone, researchProposed: resProp,
      publications: pubs,                       // ONLY user-confirmed entries — never invented
      website: P.basics.website, email: P.contact.preferredEmail || P.basics.email,
      phone: P.contact.phone, linkedin: P.basics.linkedin, scholar: P.basics.scholar, orcid: P.basics.orcid,
      intake: P.prefs.intake, countries: P.prefs.countries,
      thesisMSc: !!P.prefs.thesisMSc, requireFunding: !!P.prefs.fullFunding,
      docs: P.docs,
      confirmedSections: P.sectionsConfirmed,
      _src:"My Academic Profile (editable defaults, user-confirmed)"
    };
  };

  /* ================= RENDER ================= */
  function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }

  function secHead(title,note,secKey){
    var c = P.sectionsConfirmed[secKey];
    return '<div class="flex items-center justify-between flex-wrap gap-2 mb-1">'+
      '<h3 class="font-display font-bold">'+title+'</h3>'+
      '<label class="inline-flex items-center gap-1.5 text-[11px] font-bold '+(c?"text-emerald-700":"text-slate-400")+' cursor-pointer">'+
        '<input type="checkbox" class="rounded border-slate-300" '+(c?"checked":"")+' onchange="LD.confirmSection(\''+secKey+'\',this.checked)"/> I confirm this section is accurate</label></div>'+
      (note?'<p class="text-[11px] leading-snug text-slate-400 mb-3">'+note+'</p>':'<div class="mb-2"></div>');
  }

  LD.renderProfilePage = function(){
    P = P || mergeSaved();
    var wrap=$("profilePage"); if(!wrap) return;
    wrap.innerHTML =
      '<section class="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">'+
      '<div class="bg-white rounded-2xl shadow-card border border-slate-200 p-5 sm:p-7">'+
        '<div class="flex flex-wrap items-start justify-between gap-3">'+
          '<div><h2 class="font-display font-extrabold text-2xl">My Academic Profile</h2>'+
          '<p class="text-sm text-slate-500 mt-1">The <b>only</b> source the email generator may use for claims about you. Everything below starts as an <b>editable default</b> — fix it, clear it, or add to it, then tick “I confirm”. Unconfirmed or empty fields are <b>never claimed</b> in drafts. Stored only in this browser.</p></div>'+
          '<button onclick="LD.resetProfileDefaults()" class="btn-mini shrink-0" title="Restore the pre-filled defaults">↺ Reset defaults</button>'+
        '</div>'+
        '<div class="mt-4 grid sm:grid-cols-2 gap-4">'+
          fld("pfName","Full name *",P.basics.name)+
          fld("pfHeadline","Headline / standing line",P.basics.headline)+
          fld("pfEmail","Preferred email *",P.contact.preferredEmail||P.basics.email,"you@example.com")+
          fld("pfPhone","Phone (optional)",P.contact.phone)+
          fld("pfWebsite","Academic website / portfolio URL",P.basics.website,"e.g. your-name.github.io")+
          fld("pfLinkedin","LinkedIn URL (optional)",P.basics.linkedin)+
          fld("pfScholar","Google Scholar URL (optional)",P.basics.scholar)+
          fld("pfOrcid","ORCID (optional)",P.basics.orcid,"https://orcid.org/…")+
        '</div>'+
      '</div>'+

      /* ---- research interests (editable defaults + per-professor picker) ---- */
      '<div class="bg-white rounded-2xl shadow-card border border-slate-200 p-5 sm:p-7">'+
        secHead("Research interests","Editable defaults. In Step 1/2 you select which of these apply to <b>each professor</b> — only the selected subset drives the Research Fit Score and the draft’s connection sentence.",null)+
        '<div id="pfInterestChips" class="flex flex-wrap gap-1.5"></div>'+
        '<div class="mt-3 flex flex-wrap items-center gap-2"><input id="pfNewInterest" class="fld !w-64" placeholder="Add another interest…" onkeydown="if(event.key===\'Enter\'){LD.addInterest(this.value);this.value=\'\';}"/>'+
        '<span class="text-[11px] text-slate-400">click a chip to toggle · × removes</span></div>'+
        '<div id="pfIntentBox" class="mt-4 hidden rounded-xl border border-brand-200 bg-brand-50/60 p-4"></div>'+
      '</div>'+

      /* ---- education ---- */
      '<div class="bg-white rounded-2xl shadow-card border border-slate-200 p-5 sm:p-7">'+
        secHead("Education","Degree, institution, graduation year, grade and relevant coursework. Grades are quoted <b>verbatim</b> — exact percentage/class only, never rounded up.",'education')+
        '<div id="pfEduList" class="space-y-3"></div>'+
        '<button onclick="LD.addEdu()" class="btn-mini mt-3">＋ Add degree</button>'+
      '</div>'+

      /* ---- experience ---- */
      '<div class="bg-white rounded-2xl shadow-card border border-slate-200 p-5 sm:p-7">'+
        secHead("Work experience","Role, employer/project, dates, responsibilities and specific technical skills. Only confirmed entries can appear in emails.",'experience')+
        '<div id="pfExpList" class="space-y-3"></div>'+
        '<button onclick="LD.addExp()" class="btn-mini mt-3">＋ Add experience</button>'+
      '</div>'+

      /* ---- research experience ---- */
      '<div class="bg-white rounded-2xl shadow-card border border-slate-200 p-5 sm:p-7">'+
        secHead("Research experience","Projects, methods, fieldwork, datasets, publications and presentations — with completed work kept <b>separate from proposed research</b>. The generator will never claim a publication, instrument or analysis unless you record and confirm it here.",'research')+
        '<div id="pfResList" class="space-y-3"></div>'+
        '<button onclick="LD.addRes()" class="btn-mini mt-3">＋ Add research entry</button>'+
        '<p class="mt-3 text-[11px] leading-snug text-slate-400">⚠ If you have no publications, leave the publications field empty — drafts will cite <b>the professor’s</b> verified papers only, and state nothing about yours.</p>'+
      '</div>'+

      /* ---- technical skills ---- */
      '<div class="bg-white rounded-2xl shadow-card border border-slate-200 p-5 sm:p-7">'+
        secHead("Technical skills","Only skills you can substantiate (QGIS, geological mapping, field surveys, geotechnical investigation, laboratory methods…).",'skills')+
        '<div id="pfSkillChips" class="flex flex-wrap gap-1.5"></div>'+
        '<div class="mt-3"><input id="pfNewSkill" class="fld !w-64" placeholder="Add skill, press Enter…" onkeydown="if(event.key===\'Enter\'){LD.addSkill(this.value);this.value=\'\';}"/></div>'+
      '</div>'+

      /* ---- application preferences ---- */
      '<div class="bg-white rounded-2xl shadow-card border border-slate-200 p-5 sm:p-7">'+
        secHead("Application preferences","Intended entry term, preferred countries, thesis-based MSc preference and funding requirement. These shape subject lines and the ask — they say nothing about what supervisors offer.",'prefs')+
        '<div class="grid sm:grid-cols-2 gap-4">'+
          '<div><label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5" for="pfIntake">Intended entry term</label>'+
            '<select id="pfIntake" class="fld" onchange="LD.prefChanged()">'+intakeOpts()+'</select></div>'+
          '<div><label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5" for="pfCountries">Preferred countries (comma-separated)</label>'+
            '<input id="pfCountries" class="fld" value="'+esc((P.prefs.countries||[]).join(", "))+'" oninput="LD.prefChanged()"/></div>'+
          '<div class="flex flex-col gap-2 justify-center">'+
            '<label class="inline-flex items-center gap-2 text-sm cursor-pointer"><input id="pfThesis" type="checkbox" class="rounded border-slate-300" '+(P.prefs.thesisMSc?"checked":"")+' onchange="LD.prefChanged()"/> Thesis-based MSc (not coursework)</label>'+
            '<label class="inline-flex items-center gap-2 text-sm cursor-pointer"><input id="pfFunding" type="checkbox" class="rounded border-slate-300" '+(P.prefs.fullFunding?"checked":"")+' onchange="LD.prefChanged()"/> Full funding required</label>'+
          '</div>'+
          '<p class="text-[11px] leading-snug text-slate-400 self-center">“Full funding required” changes only <b>your ask</b>: drafts phrase funding as a question and never imply an offer exists.</p>'+
        '</div>'+
      '</div>'+

      /* ---- documents ---- */
      '<div class="bg-white rounded-2xl shadow-card border border-slate-200 p-5 sm:p-7">'+
        secHead("Documents","URLs or file names of what you will <b>really attach</b>. The attachment checklist in Step 3 cross-checks the draft against this list.",'docs')+
        '<div class="grid sm:grid-cols-2 gap-4">'+
          fld("pfDocCV","CV (link or filename)",P.docs.cv,"e.g. CV_YourName.pdf")+
          fld("pfDocTr","Transcript (link or filename)",P.docs.transcript)+
          fld("pfDocRS","Research statement (link or filename)",P.docs.researchStatement)+
          fld("pfDocPort","Portfolio URL",P.docs.portfolio||P.basics.website)+
        '</div>'+
      '</div>'+

      '<div class="flex flex-wrap items-center justify-between gap-3">'+
        '<button onclick="LD.goStep(1)" class="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold px-5 py-2.5 text-sm transition">← Back to search</button>'+
        '<div class="text-right"><p id="pfConfSummary" class="text-[11px] font-bold mb-1"></p>'+
        '<button onclick="LD.goStep(2)" class="rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 text-sm shadow-card transition">Continue → Professor &amp; fit</button></div>'+
      '</div>'+
      '</section>';

    renderInterests(); renderEdu(); renderExp(); renderRes(); renderSkills(); renderIntentBox(); updateConfSummary();
  };

  function fld(id,label,val,ph){
    return '<div><label class="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5" for="'+id+'">'+label+'</label>'+
      '<input id="'+id+'" class="fld" value="'+esc(val||"")+'" placeholder="'+esc(ph||"")+'" oninput="LD.basicChanged(\''+id+'\')"/></div>';
  }
  function intakeOpts(){
    var opts=["Spring 2027","Fall 2027","Spring 2028","Fall 2028","Any / not specified"];
    var cur=P.prefs.intake; if(cur && opts.indexOf(cur)<0) opts.unshift(cur);
    return opts.map(function(o){ return '<option'+(o===cur?' selected':'')+'>'+esc(o)+'</option>'; }).join("");
  }

  /* ---------- interest chips ---------- */
  function renderInterests(){
    var box=$("pfInterestChips"); if(!box) return;
    box.innerHTML=P.interests.map(function(it,i){
      return '<span class="badge '+(it.on?"b-green":"b-slate")+' cursor-pointer select-none !text-[12px] !py-1.5" title="Click to '+(it.on?"de-select":"select")+'" onclick="LD.toggleInterest('+i+')">'+(it.on?"✓ ":"")+esc(it.label)+
        ' <button class="ml-1 opacity-60 hover:opacity-100 font-bold" onclick="event.stopPropagation();LD.rmInterest('+i+')" aria-label="remove">×</button></span>';
    }).join("")||'<span class="text-xs text-slate-400">No interests yet — add one below.</span>';
  }
  LD.toggleInterest=function(i){ P.interests[i].on=!P.interests[i].on; save(); renderInterests(); renderIntentBox(); };
  LD.rmInterest=function(i){ P.interests.splice(i,1); save(); renderInterests(); renderIntentBox(); };
  LD.addInterest=function(v){ v=String(v||"").trim(); if(!v) return; if(P.interests.some(function(x){return x.label.toLowerCase()===v.toLowerCase();})) return;
    P.interests.push({label:v,on:true}); save(); renderInterests(); $("pfNewInterest")&&($("pfNewInterest").value=""); renderIntentBox(); };

  /* ---------- per-professor intent box (shown when a professor is selected) ---------- */
  function renderIntentBox(){
    var box=$("pfIntentBox"); if(!box) return;
    var prof = LD.getSelected && LD.getSelected();
    if(!prof){ box.classList.add("hidden"); box.innerHTML=""; return; }
    box.classList.remove("hidden");
    var chosen = LD.getIntentInterests(prof.id);
    var sel = (chosen==null) ? LD.activeInterests() : chosen;
    box.innerHTML='<p class="text-xs font-bold uppercase tracking-wide text-brand-700 mb-1">Interests relevant to '+esc(prof.name)+' <span class="normal-case font-medium text-slate-400">(select only what genuinely applies to their work — this subset drives the fit score &amp; draft)</span></p>'+
      '<div class="flex flex-wrap gap-1.5">'+P.interests.map(function(it){
        var on=sel.indexOf(it.label)>-1;
        return '<button class="badge '+(on?"b-blue":"b-slate")+' !text-[12px] !py-1.5" onclick="LD.toggleIntent(\''+prof.id+'\',\''+esc(it.label).replace(/'/g,"&#39;")+'\')">'+(on?"✓ ":"")+esc(it.label)+'</button>';
      }).join("")+'</div>'+
      (chosen==null?'<p class="mt-2 text-[11px] text-slate-400">Currently following your profile defaults. Click any chip to override for this professor.</p>':
       (sel.length?'':'<p class="mt-2 text-[11px] text-amber-700">Nothing selected for this professor — the draft will make NO research-connection claim. Select at least one honest overlap.</p>'));
  }
  LD.toggleIntent=function(profId,label){
    var prof=LD.getSelected(); if(!prof||prof.id!==profId) return;
    var cur=LD.getIntentInterests(profId);
    var sel=(cur==null)?LD.activeInterests().slice():cur.slice();
    var ix=sel.indexOf(label); if(ix>-1) sel.splice(ix,1); else sel.push(label);
    LD.setIntentInterests(profId,sel); renderIntentBox();
    if(LD.updateFeasibility) LD.updateFeasibility();
  };

  /* ---------- education list ---------- */
  function renderEdu(){
    var box=$("pfEduList"); if(!box) return;
    box.innerHTML=P.education.map(function(e,i){
      return '<div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">'+
        row2(i,"degree","Degree (exact title)",e.degree,"e.g. B.Sc. Geology")+
        row2(i,"institution","Institution",e.institution,"e.g. Tri-Chandra Multiple Campus, Tribhuvan University")+
        row2(i,"year","Graduation year",e.year,"2023")+
        row2(i,"grade","Grade / division (verbatim)",e.grade,"e.g. First Division · 60.35%")+
        '<div><label class="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Relevant coursework</label><textarea rows="2" class="fld resize-none text-[13px]" oninput="LD.eduChanged('+i+',\'coursework\',this.value)">'+esc(e.coursework||"")+'</textarea></div>'+
        confirmRow("education",i,e.confirmed)+
        '<button class="text-[11px] font-bold text-rose-600 hover:underline" onclick="LD.rmEdu('+i+')">Remove entry</button>'+
      '</div>';
    }).join("")||'<p class="text-xs text-slate-400">No education recorded — drafts will state nothing about your degree.</p>';
  }
  function row2(i,key,label,val,ph){
    return '<div class="grid sm:grid-cols-2 gap-2"><div><label class="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">'+label+'</label>'+
      '<input class="fld !py-2 text-[13px]" value="'+esc(val||"")+'" placeholder="'+esc(ph||"")+'" oninput="LD.eduChanged('+i+',\''+key+'\',this.value)"/></div></div>';
  }
  function confirmRow(group,i,c){
    return '<label class="inline-flex items-center gap-2 text-[12px] font-semibold cursor-pointer"><input type="checkbox" class="rounded border-slate-300" '+(c?"checked":"")+' onchange="LD.itemConfirm(\''+group+'\','+i+',this.checked)"/> I can substantiate this entry</label>';
  }
  LD.eduChanged=function(i,k,v){ P.education[i][k]=v; save(); };
  LD.addEdu=function(){ P.education.push({degree:"",institution:"",year:"",grade:"",coursework:"",confirmed:false}); save(); renderEdu(); updateConfSummary(); };
  LD.rmEdu=function(i){ P.education.splice(i,1); save(); renderEdu(); updateConfSummary(); };

  /* ---------- experience list ---------- */
  function renderExp(){
    var box=$("pfExpList"); if(!box) return;
    box.innerHTML=P.experience.map(function(e,i){
      return '<div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">'+
        twoCol(i,"role","Role / position",e.role,"e.g. Civil Sub-Engineer","org","Employer / project",e.org,"e.g. Government transmission-line project")+
        twoCol(i,"dates","Dates",e.dates,"2024 – present","skills","Specific technical skills used",e.skills,"e.g. borehole logging supervision")+
        '<div><label class="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Responsibilities</label><textarea rows="2" class="fld resize-none text-[13px]" oninput="LD.expChanged('+i+',\'responsibilities\',this.value)">'+esc(e.responsibilities||"")+'</textarea></div>'+
        confirmRow("experience",i,e.confirmed)+
        '<button class="text-[11px] font-bold text-rose-600 hover:underline" onclick="LD.rmExp('+i+')">Remove entry</button>'+
      '</div>';
    }).join("")||'<p class="text-xs text-slate-400">No experience recorded — drafts will claim none.</p>';
  }
  function twoCol(i,k1,l1,v1,p1,k2,l2,v2,p2){
    return '<div class="grid sm:grid-cols-2 gap-2">'+
      '<div><label class="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">'+l1+'</label><input class="fld !py-2 text-[13px]" value="'+esc(v1||"")+'" placeholder="'+esc(p1||"")+'" oninput="LD.expChanged('+i+',\''+k1+'\',this.value)"/></div>'+
      '<div><label class="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">'+l2+'</label><input class="fld !py-2 text-[13px]" value="'+esc(v2||"")+'" placeholder="'+esc(p2||"")+'" oninput="LD.expChanged('+i+',\''+k2+'\',this.value)"/></div></div>';
  }
  LD.expChanged=function(i,k,v){ P.experience[i][k]=v; save(); };
  LD.addExp=function(){ P.experience.push({role:"",org:"",dates:"",responsibilities:"",skills:"",confirmed:false}); save(); renderExp(); updateConfSummary(); };
  LD.rmExp=function(i){ P.experience.splice(i,1); save(); renderExp(); updateConfSummary(); };

  /* ---------- research list (completed vs proposed) ---------- */
  function renderRes(){
    var box=$("pfResList"); if(!box) return;
    box.innerHTML=P.research.map(function(r,i){
      return '<div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">'+
        '<div class="grid sm:grid-cols-2 gap-2">'+
          '<div><label class="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Project title</label><input class="fld !py-2 text-[13px]" value="'+esc(r.title||"")+'" oninput="LD.resChanged('+i+',\'title\',this.value)"/></div>'+
          '<div><label class="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Status</label>'+
            '<select class="fld !py-2 text-[13px]" onchange="LD.resChanged('+i+',\'status\',this.value)"><option value="completed"'+(r.status!=="proposed"?" selected":"")+'>Completed work</option><option value="proposed"'+(r.status==="proposed"?" selected":"")+'>Proposed research</option></select></div>'+
        '</div>'+
        '<div class="grid sm:grid-cols-2 gap-2">'+
          '<div><label class="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Methods / instruments actually used</label><input class="fld !py-2 text-[13px]" value="'+esc(r.methods||"")+'" placeholder="only what you truly used" oninput="LD.resChanged('+i+',\'methods\',this.value)"/></div>'+
          '<div><label class="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Fieldwork / datasets</label><input class="fld !py-2 text-[13px]" value="'+esc(r.fieldwork||"")+'" oninput="LD.resChanged('+i+',\'fieldwork\',this.value)"/></div>'+
        '</div>'+
        '<div class="grid sm:grid-cols-2 gap-2">'+
          '<div><label class="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Publications (leave EMPTY if none)</label><input class="fld !py-2 text-[13px]" value="'+esc(r.publications||"")+'" placeholder="citation + DOI, or blank" oninput="LD.resChanged('+i+',\'publications\',this.value)"/></div>'+
          '<div><label class="block text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Presentations</label><input class="fld !py-2 text-[13px]" value="'+esc(r.presentations||"")+'" oninput="LD.resChanged('+i+',\'presentations\',this.value)"/></div>'+
        '</div>'+
        confirmRow("research",i,r.confirmed)+
        '<button class="text-[11px] font-bold text-rose-600 hover:underline" onclick="LD.rmRes('+i+')">Remove entry</button>'+
      '</div>';
    }).join("")||'<p class="text-xs text-slate-400">No research entries recorded. Nothing about publications, instruments or analyses will be claimed.</p>';
  }
  LD.resChanged=function(i,k,v){ P.research[i][k]=v; save(); };
  LD.addRes=function(){ P.research.push({title:"",status:"completed",methods:"",fieldwork:"",datasets:"",publications:"",presentations:"",confirmed:false}); save(); renderRes(); updateConfSummary(); };
  LD.rmRes=function(i){ P.research.splice(i,1); save(); renderRes(); updateConfSummary(); };

  /* ---------- skills ---------- */
  function renderSkills(){
    var box=$("pfSkillChips"); if(!box) return;
    box.innerHTML=(P.skills||[]).map(function(s,i){
      return '<span class="badge b-blue !text-[12px] !py-1.5">'+esc(s)+' <button class="ml-1 opacity-60 hover:opacity-100 font-bold" onclick="LD.rmSkillP('+i+')" aria-label="remove">×</button></span>';
    }).join("")||'<span class="text-xs text-slate-400">No skills listed.</span>';
  }
  LD.addSkill=function(v){ v=String(v||"").trim(); if(!v) return; if(P.skills.indexOf(v)>-1) return; P.skills.push(v); save(); renderSkills(); };
  LD.rmSkillP=function(i){ P.skills.splice(i,1); save(); renderSkills(); };

  /* ---------- confirmation plumbing ---------- */
  LD.itemConfirm=function(group,i,c){
    var arr = group==="education"?P.education : group==="experience"?P.experience : P.research;
    if(arr&&arr[i]!=null){ arr[i].confirmed=!!c; save(); }
    if(c){ // ticking every item auto-ticks the section
      var all=arr.every(function(x){return x.confirmed;}) && arr.length;
      if(all){ P.sectionsConfirmed[group]=true; syncSectionChecks(); }
    } else { P.sectionsConfirmed[group]=false; syncSectionChecks(); }
    updateConfSummary();
  };
  LD.confirmSection=function(k,c){ P.sectionsConfirmed[k]=!!c;
    if(c){ var map={education:P.education,experience:P.experience,research:P.research}; if(map[k]) map[k].forEach(function(x){x.confirmed=true;}); }
    save(); renderEdu(); renderExp(); renderRes(); syncSectionChecks(); updateConfSummary(); };
  function syncSectionChecks(){
    document.querySelectorAll('input[onchange^="LD.confirmSection"]').forEach(function(el){
      var m=(el.getAttribute("onchange")||"").match(/confirmSection\('(\w+)'/); if(m) el.checked=!!P.sectionsConfirmed[m[1]];
    });
  }
  function updateConfSummary(){
    var el=$("pfConfSummary"); if(!el) return;
    var groups=["education","experience","research","skills","prefs","docs","contact"];
    var n=groups.filter(function(g){return P.sectionsConfirmed[g];}).length;
    el.textContent = n+"/"+groups.length+" sections confirmed"+(n<groups.length?" — unconfirmed fields are omitted from drafts":" — profile ready ✓");
    el.className="text-[11px] font-bold mb-1 "+(n===groups.length?"text-emerald-700":"text-amber-700");
  }

  /* ---------- basic-field plumbing ---------- */
  LD.basicChanged=function(id){
    var el=$(id); if(!el) return;               /* quick-field bridge may name a pf* id that isn't rendered */
    var v=el.value.trim();
    switch(id){
      case "pfName": P.basics.name=v; break;
      case "pfHeadline": P.basics.headline=v; break;
      case "pfEmail": P.contact.preferredEmail=v; P.basics.email=v; break;
      case "pfPhone": P.contact.phone=v; break;
      case "pfWebsite": P.basics.website=v; break;
      case "pfLinkedin": P.basics.linkedin=v; break;
      case "pfScholar": P.basics.scholar=v; break;
      case "pfOrcid": P.basics.orcid=v; break;
      case "pfUni": { var eu0=(P.education&&P.education[0])||(P.education[0]={}); eu0.institution=v; break; }
      case "pfField": P.basics.field=v; break;
      case "pfTopic": P.basics.topic=v; break;
      case "pfGpa": { var eul=(P.education&&P.education.length)?P.education[P.education.length-1]:null; if(eul) eul.grade=v; break; }
      case "pfExp": { var ex=P.experience&&P.experience[0]?P.experience[0]:(P.experience[0]={}); ex.responsibilities=v; break; }
      case "pfDocCV": P.docs.cv=v; break;
      case "pfDocTr": P.docs.transcript=v; break;
      case "pfDocRS": P.docs.researchStatement=v; break;
      case "pfDocPort": P.docs.portfolio=v; break;
    }
    save();
  };
  LD.prefChanged=function(){
    P.prefs.intake=$("pfIntake").value;
    P.prefs.countries=$("pfCountries").value.split(",").map(function(s){return s.trim();}).filter(Boolean);
    P.prefs.thesisMSc=$("pfThesis").checked; P.prefs.fullFunding=$("pfFunding").checked;
    P.sectionsConfirmed.prefs=true; save(); updateConfSummary();
  };
  LD.resetProfileDefaults=function(){ if(!confirm("Reset the profile to the pre-filled editable defaults? Your edits will be lost.")) return;
    P=clone(DEFAULTS); save(); LD.renderProfilePage(); LD.toast("Profile reset to editable defaults.","info"); };

  /* ---------- expose the old flat-profile bridge used by app.js step gating ---------- */
  LD.legacyProfileBridge = function(){
    var vp = LD.profileForDraft(null);
    return { name:vp.name, uni:vp.uni, degree: vp.degree ? ("MSc applicant — "+vp.degree) : "MSc", field:vp.field,
             topic:vp.topic, gpa:vp.gpa, english:"", exp:vp.exp, intake:vp.intake, skills:vp.skills };
  };

  /* first paint */
  document.addEventListener("DOMContentLoaded", function(){
    P = mergeSaved();
    if($("profilePage")) LD.renderProfilePage();
  });
})();
