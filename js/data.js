var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · data.js — reference tables & funding intelligence schema ============

   HISTORY / SECURITY NOTE (kept deliberately so it is never repeated):
   • The previous "LD.DEMO_PROFESSORS" set (Dr. Elena Kowalski, Prof. Daniel Okafor,
     Dr. Mei-Ling Chen, Prof. Sarah Whitfield …) was FICTIONAL: invented people,
     invented universities, invented DOIs (some containing placeholder runs such as
     "xxxxx") and COMPUTER-SCIENCE examples ("sparse attention", "efficient
     transformers"). Fictional papers must NEVER be able to flow into a real email,
     so the dataset has been DELETED from this file and from the app.
   • A second fictional set (LD.GEO_DEMO — "Prof. Ingrid Solheim", "Dr. Marco
     Ferretti", "Prof. Ayodele Bankole", "Dr. Sofia Ramírez", "Prof. Tansu Yılmaz",
     "Dr. Fatima Al-Zahra") also shipped in js/geology.js with fake emails at real
     institutions and fabricated paper titles/DOIs. It has been DELETED as well.
     The offline UI sandbox is now LD.GEO_EXAMPLE in js/geology.js: clearly marked
     EXAMPLE-SANDBOX entries that use REAL geology researchers and ONLY publications
     independently resolved live against Crossref on 2026-10-26 (resolver metadata is
     embedded next to each DOI). Availability/funding fields are deliberately EMPTY
     ("unknown — verify at source"), so nothing unverifiable can reach a draft.
     js/app.js refuses to build drafts or send for any profile flagged example:true.
   • Live search results carry no "demo"/"example" source tag.
   • The old LD.STIPENDS table showed unsourced historical averages ("$2,000–3,200").
     Those numbers were presented without date, currency basis or source, which can be
     mistaken for current offers. They are replaced by the structured funding-record
     schema below plus clearly-labelled GENERAL GUIDANCE that states what kinds of
     funding exist per country — not how much any specific person would receive today. */
window.LD = window.LD || {};

/* ---------- Funding-evidence record schema (one entry per advertised opportunity) ----------
   Every figure shown in the Funding panel MUST fill these fields; anything unknown stays
   null and renders as "— (not stated — verify at source)". A record without a source URL
   cannot be saved at all (enforced in js/crm.js). */
LD.FUNDING_FIELDS = [
  { key:"institution", label:"Institution" },
  { key:"country",     label:"Country" },
  { key:"degreeLevel", label:"Degree level (MSc / PhD / any)" },
  { key:"amount",      label:"Amount (number)" },
  { key:"currency",    label:"Currency (ISO, e.g. EUR/NOK/USD)" },
  { key:"basis",       label:"Per month or per year" },
  { key:"year",        label:"Academic year / effective date" },
  { key:"tuition",     label:"Tuition coverage (full / partial / none / n.a.)" },
  { key:"grossNet",    label:"Gross or net (tax status)" },
  { key:"type",        label:"Type: scholarship | employment salary | stipend | tuition waiver | living-cost estimate" },
  { key:"assistantship", label:"Assistantship/scheme name (RA, TA, IRC ELA, RTP…)" },
  { key:"insuranceFees", label:"Insurance & fees covered?" },
  { key:"intlEligible",label:"International students eligible? (yes/no/conditional)" },
  { key:"sourceUrl",   label:"Official source URL (REQUIRED)", required:true },
  { key:"checkedAt",   label:"Date checked (auto-stamped)" }
];

/* Honest taxonomy so a salary is never displayed as a scholarship, etc. */
LD.FUNDING_TYPES = ["scholarship","employment salary","stipend","tuition waiver","living-cost estimate"];

/* Country-level GUIDANCE (categories of schemes that exist — NOT amounts, NOT offers). */
LD.FUNDING_GUIDANCE = [
  { country:"Norway",      note:"PhD/MSc research posts are usually EMPLOYMENT contracts (State Employees' terms, code 1011) with salary + pension; tuition is free at public universities. Look for advertised vacancies at each university's job portal." },
  { country:"Germany",     note:"Master's programmes are generally unfunded; DAAD scholarships exist for international students (competitive, application BEFORE admission). Doctoral researchers are paid under TV-L E13." },
  { country:"Netherlands", note:"MSc: few full scholarships (Holland Scholarship covers part of first-year tuition). PhD candidates are employees on CAO scale 13. University-specific grants vary." },
  { country:"Switzerland", note:"Excellent but extremely competitive; ETH/EPFL master's excellence fellowships are deadline-driven and self-declared. PhD salaries are the highest in Europe (employee contracts)." },
  { country:"Canada",      note:"Thesis MSc funding packages are common in geosciences (TA + RA + internal awards), but amounts differ by faculty — check the department's 'Funding for graduate students' page, not general rankings." },
  { country:"Australia",   note:"RTP scholarships (tuition offset + living allowance, indexed yearly) cover domestic and international HDR students; MSc-by-research eligibility varies — verify each university round." },
  { country:"United Kingdom", note:"Research Council studentships (UKRI) mainly fund PhDs; MSc funding is limited (university bursaries, Leverhulme/trust awards). STEM masters scholarships come and go — always check the current call." },
  { country:"United States", note:"Geoscience thesis MSc students are typically funded via assistantships (GAA/GTA) from department budgets or advisor grants; package values are published per university's graduate school page." },
  { country:"Ireland",     note:"Irish Research Council ELA scheme funds specific advertised projects (incl. MSc-level) with a published stipend rate per year — read the individual advert." },
  { country:"France",      note:"Master's largely tuition-subsidised but stipend-free; doctoral contracts (contrat doctoral) are salaried. Region/lab-specific master grants exist." },
  { country:"Sweden",      note:"No tuition for EU/EEA; living costs apply for non-EEA exchange MSc; PhD = employment. Some university scholarships (e.g. Swedish Institute) for selected countries." }
];

/* What counts as an acceptable official funding source (used by CRM validation + UI warnings). */
LD.isOfficialFundingSource = function(url){
  return /^https?:\/\/(www\.)?[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(url||"") &&
         !/^(https?:\/\/(twitter\.com|x\.com|facebook\.com|linkedin\.com|reddit\.com))/i.test(url||"");
};

/* Flags for the Funding panel: type-confusion guard. */
LD.fundingRecordIssues = function(r){
  var issues=[];
  if(!r.sourceUrl) issues.push("No official source — cannot be shown as evidence.");
  if(r.type==="living-cost estimate") issues.push("This is an ESTIMATE, not an offer — keep the label visible.");
  if(!r.checkedAt) issues.push("Missing date-checked stamp — funding pages change.");
  if(r.amount!=null && !r.currency) issues.push("Amount without currency is meaningless.");
  if(r.grossNet==="net" && r.type==="employment salary") issues.push("Net salary depends on personal tax situation — quote gross instead.");
  return issues;
};

/* ---------- Country flags (display helper) ---------- */
LD.COUNTRY_FLAGS = { "United States":"🇺🇸","United Kingdom":"🇬🇧","Germany":"🇩🇪","Canada":"🇨🇦","Australia":"🇦🇺","Netherlands":"🇳🇱","Switzerland":"🇨🇭","Sweden":"🇸🇪","France":"🇫🇷","Singapore":"🇸🇬","Japan":"🇯🇵","South Korea":"🇰🇷","Ireland":"🇮🇪","Denmark":"🇩🇰","Finland":"🇫🇮","Norway":"🇳🇴","New Zealand":"🇳🇿","Italy":"🇮🇹","Spain":"🇪🇸","Turkey":"🇹🇷","Nepal":"🇳🇵","Iceland":"🇮🇸","Austria":"🇦🇹","Poland":"🇵🇱","Czechia":"🇨🇿","Brazil":"🇧🇷","Chile":"🇨🇱","South Africa":"🇿🇦","India":"🇮🇳","China":"🇨🇳","Israel":"🇮🇱","Kenya":"🇰🇪","Mexico":"🇲🇽" };

/* Kept for compatibility: returns guidance TEXT (never fake amounts) for a country. */
LD.stipendFor = function(country){
  if(!country) return null;
  var row = LD.FUNDING_GUIDANCE.filter(function(s){ return s.country===country || String(country).indexOf(s.country)>-1 || s.country.indexOf(country)>-1; })[0];
  return row ? { country:row.country, guidance:row.note } : null;
};
