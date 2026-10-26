var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · schema.js — canonical record types & evidence freshness ============

   LetterDesk stores SIX primary record types. Every volatile claim (funding, vacancy,
   deadline, availability, contact e-mail) must carry EVIDENCE FRESHNESS METADATA:

       evidence: { sourceUrl, sourceName, checkedAt, verificationStatus }

   verificationStatus ∈ verified | partial | needs-review | contradicted | unavailable
   (see js/verify.js · LD.CLAIM_STATUS). A record without a sourceUrl can be drafted but is
   always rendered as UNVERIFIED and can never raise a fit status to a positive value.

   1. Professor          identity resolution + verified contact (see LD.resolveIdentity)
   2. Publication        DOI, title, year, abstract, methods, limitations, verification date
   3. Laboratory         themes, group roster, recruitment evidence, source date
   4. FundingOpportunity position, eligibility, amount, tuition, stipend, deadline, source+status
   5. AdmissionsPolicy   program, supervisor-contact rule, requirements, deadlines
   6. OutreachRecord     professor, evidence used, draft, status, follow-up date           */
(function(){
  window.LD = window.LD || {};

  /* ---------- field dictionaries (single source of truth for forms & renderers) ---------- */
  LD.SCHEMA = {
    Professor: {
      id:"string (stable, derived from ORCID > OpenAlex > name@institution)",
      name:"string", title:"string (as stated at the source — never inferred)",
      affiliation:"string (institution)", department:"string", country:"string",
      identifiers:{ orcid:"0000-…", openAlex:"A…", scholar:"string" },
      profileUrl:"official faculty/lab page URL",
      identity:{ status:"resolved|probable|ambiguous|unresolved", sources:["url…"], checkedAt:"ISO" },
      emails:[ { address:"string",
                 syntax:"pass|fail|unchecked",            // L1 — format only
                 mx:"pass|fail|unchecked",               // L3 — domain accepts mail
                 officialListing:"pass|fail|unchecked",  // L2 — listed on an official page
                 mailbox:"not-confirmed",                // L4 — impossible in-browser
                 sourceUrl:"where the address was found", checkedAt:"ISO" } ],
      researchAreas:["area id"], topics:["string"], methods:["string (only methods evidenced by papers/profile)"],
      publications:[Publication], laboratoryId:"string",
      availability:"funded-ad|project-unfunded|unknown|closed",
      availabilityEvidence:{ quote:"verbatim text", sourceUrl:"url", checkedAt:"ISO" },
      example:"boolean (example-sandbox record — outreach blocked)"
    },
    Publication: {
      doi:"string (validated format)", title:"string", year:"number", venue:"string",
      abstract:"string", authors:["string"],
      methods:["string — ONLY what the paper states; never assumed"],
      limitations:"string — stated limitations (quote or paraphrase with marker)",
      futureWork:"string — stated future work / next steps",
      citedBy:"number", source:"string (OpenAlex|Semantic Scholar|Crossref)",
      url:"landing page", verification:{ status:"verified|partial|needs-review|contradicted|unavailable",
        checkedAt:"ISO", resolver:"string", resolvedTitle:"string", apiUrl:"string" }
    },
    Laboratory: {
      id:"string", name:"string", professorIds:["string"], lead:"string",
      institution:"string", url:"string",
      themes:["string"], roster:[ { name:"string", role:"MSc|PhD|Postdoc|PI|Engineer", note:"string" } ],
      recruitmentEvidence:[ { quote:"verbatim", url:"source URL", kind:"vacancy|group-page|news|grant",
                              checkedAt:"ISO", status:"verified|needs-review" } ],
      sourceDate:"ISO — date the group page was captured",
      grants:[ { name:"string", funder:"string", url:"string", years:"string", studentFundingStated:"yes|no|unclear" } ]
    },
    FundingOpportunity: {
      id:"string", position:"string (advertised position/scholarship name)",
      institution:"string", country:"string", degreeLevel:"MSc|PhD|Postdoc|any",
      eligibility:"string (nationality, degree background, grading, language)",
      amount:"number|null", currency:"ISO|null", basis:"per month|per year|null",
      tuitionCoverage:"full|partial|none|not stated", stipend:"string|null",
      deadline:"ISO date | 'rolling' | 'not stated'",
      type:"scholarship|employment salary|stipend|tuition waiver|living-cost estimate",
      linkedProfessorId:"string|null", programUrl:"string",
      source:{ url:"REQUIRED", name:"string", checkedAt:"ISO", status:"verified|needs-review|expired" },
      notes:"string"
    },
    AdmissionsPolicy: {
      id:"string", institution:"string", program:"string", degreeLevel:"MSc|PhD",
      supervisorContact:"mandatory|recommended|neutral|prohibited|not stated",
      contactRuleQuote:"verbatim sentence from the official page",
      requirements:[ "degree background", "grading minimum", "language test", "documents" ],
      intakeOptions:["Fall 2027 …"], applicationDeadline:"date|rolling|not stated",
      fundingNotes:"string", tuitionFees:"string",
      source:{ url:"REQUIRED", name:"string", checkedAt:"ISO", status:"verified|needs-review" }
    },
    OutreachRecord: {
      id:"string", professorId:"string", professorName:"string", institution:"string",
      emailUsed:"string", emailVerification:"object snapshot",
      mode:"vacancy|proactive",                     // dual-mode generator (see crm.js)
      fundingOpportunityId:"string|null", admissionsPolicyId:"string|null",
      evidenceUsed:[ { kind:"publication|funding|recruitment|policy", ref:"DOI/URL", label:"string" } ],
      subject:"string", body:"string", words:"number", wordLimit:"number",
      status:"draft|notsent|sent|replied-positive|replied-negative|interview|offer|no-reply|closed",
      contactDate:"ISO|null", followUpDate:"ISO|null", outcome:"string",
      approval:{ proofread:false, facts:false, paperOpened:false, attachments:false, approved:false, at:null },
      createdAt:"ISO", updatedAt:"ISO"
    }
  };

  /* ---------- evidence helpers ---------- */
  LD.nowIso = function(){ return new Date().toISOString(); };
  LD.evidence = function(sourceUrl, sourceName, status){
    return { sourceUrl:String(sourceUrl||""), sourceName:String(sourceName||""),
             checkedAt:LD.nowIso(), status:status||"needs-review" };
  };
  LD.hasSource = function(ev){ return !!(ev && /^https?:\/\/.+/i.test(String(ev.sourceUrl||ev.url||""))); };
  LD.FRESH_DAYS = 90;   // after this many days a volatile claim is shown as "stale — re-check"
  LD.evidenceAgeDays = function(ev){
    var d = ev && (ev.checkedAt||ev.sourceDate); if(!d) return null;
    var t = Date.parse(d); if(isNaN(t)) return null;
    return Math.floor((Date.now()-t)/86400000);
  };
  LD.isStale = function(ev){ var a=LD.evidenceAgeDays(ev); return a==null ? true : a>LD.FRESH_DAYS; };

  /* Render one compact freshness line: source · date · status badge. Never hides absence. */
  LD.freshnessLine = function(ev,label){
    if(!ev || !(ev.sourceUrl||ev.url)){
      return '<span class="badge b-red">⛔ no source recorded</span> '+
             '<span class="text-[11px] text-slate-500">'+LD.escapeHtml(label||"This claim")+' is unverified — confirm it at the institution before relying on it.</span>';
    }
    var age=LD.evidenceAgeDays(ev), stale=LD.isStale(ev);
    var stMap={verified:["b-green","✓ verified"],partial:["b-amber","≈ partial"],
               "needs-review":["b-amber","⚠ needs review"],contradicted:["b-red","✗ contradicted"],
               unavailable:["b-slate","❔ source unavailable"],expired:["b-red","⌛ expired"]};
    var st=stMap[ev.status]||stMap["needs-review"];
    var date = ev.checkedAt ? String(ev.checkedAt).slice(0,10) : "date?";
    return '<span class="badge '+st[0]+'">'+st[1]+'</span>'+
      '<span class="text-[11px] text-slate-500">'+LD.escapeHtml(label||(ev.sourceName||"source"))+' · '+
      '<a class="underline decoration-dotted text-brand-700" target="_blank" rel="noopener" href="'+LD.escapeHtml(ev.sourceUrl||ev.url||"#")+'">source</a>'+
      ' · last checked '+LD.escapeHtml(date)+(age!=null?" ("+age+"d ago)":"")+
      (stale?' <span class="badge b-amber">⏳ stale — re-check</span>':"")+'</span>';
  };

  /* ---------- IDENTITY RESOLUTION ----------
     Preferring persistent scholarly identifiers over name strings avoids the classic
     duplicate-person problem ("J. Smith" vs "John Smith") and merges multi-engine hits.
     Priority: ORCID → OpenAlex author ID → institutional faculty page → name+affiliation. */
  LD.identityKey = function(p){
    if(!p) return "";
    if(p.identifiers && p.identifiers.orcid)  return "orcid:"+String(p.identifiers.orcid).toLowerCase();
    if(p.identifiers && p.identifiers.openAlex) return "openalex:"+String(p.identifiers.openAlex).toLowerCase();
    var i = p.profileUrl && /^https?:\/\/[^/]+\/.*$/i.test(p.profileUrl) ? "url:"+p.profileUrl.toLowerCase().replace(/[#?].*$/,"") : "";
    if(i) return i;
    var nm = LD.normText(p.name||"").replace(/\s+(sr|jr|ii|iii)$/,"");
    var aff = LD.normText(p.affiliation||p.uni||"");
    return "name:"+nm+"@"+aff;
  };
  LD.IDENTITY_STATUS = {
    resolved:  { label:"Identity resolved", cls:"b-green", icon:"🆔",
                 note:"Matched on a persistent identifier (ORCID / OpenAlex) or an official university faculty page." },
    probable:  { label:"Probable match", cls:"b-blue", icon:"≈",
                 note:"Name + institution agree across ≥2 scholarly sources, but no persistent identifier was found. Confirm on the faculty page." },
    ambiguous: { label:"Ambiguous — multiple candidates", cls:"b-amber", icon:"⚠",
                 note:"The same name maps to several institutions/author records. Do not outreach until you pick the right person." },
    unresolved:{ label:"Unresolved", cls:"b-slate", icon:"❔",
                 note:"Only a bare author string from a citation database. Treat every personal claim as unverified." }
  };
  LD.resolveIdentity = function(p){
    var src=[], hasOrcid=!!(p.identifiers&&p.identifiers.orcid)||/^https?:\/\/orcid\.org\//i.test(p.profileUrl||"");
    var hasOpenAlex=!!(p.identifiers&&p.identifiers.openAlex);
    var official=/\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2,3}$|universit|college|eth\b|kth|itu\b|polimi|\bucd\.|uib\.|ntnu\.|usno\.|cicgeo/i.test(p.profileUrl||"");
    var engines=(p.sources||[]).filter(function(s){return s!=="example";}).length;
    if(hasOrcid||hasOpenAlex){ src.push("persistent identifier"); }
    if(official) src.push("official faculty page");
    var status = (hasOrcid||hasOpenAlex) ? "resolved"
               : (official && engines>=1) ? "resolved"
               : (engines>=2 && (p.uni||p.affiliation)) ? "probable"
               : engines>=1 ? "ambiguous" : "unresolved";
    p.identity = { status:status, sources:src.length?src:["scholarly author string only"], checkedAt:LD.nowIso() };
    return p.identity;
  };

  /* ---------- CONTACT SEPARATION (syntax/MX ≠ official directory listing) ---------- */
  LD.addEmailEvidence = function(p, address, meta){
    meta=meta||{};
    p.emails=p.emails||[];
    var rec={ address:String(address||"").trim(),
              syntax:"unchecked", mx:"unchecked", officialListing:"unchecked", mailbox:"not-confirmed",
              sourceUrl:meta.sourceUrl||"", checkedAt:LD.nowIso() };
    if(rec.address && !/^https?:\/\//.test(rec.sourceUrl||"")) rec.sourceUrl="";
    p.emails=p.emails.filter(function(e){ return e.address!==rec.address; });
    p.emails.unshift(rec);
    return rec;
  };
  LD.primaryEmail = function(p){ return (p&&p.emails&&p.emails[0])||null; };
  LD.contactRequirements = function(p){
    var e=LD.primaryEmail(p);
    if(!e) return { level:"missing", label:"Contact requirement: NO VERIFIED ADDRESS",
                    note:"No e-mail on record. Find it on the official faculty/lab directory before outreach." };
    if(e.officialListing==="pass") return { level:"strong", label:"Contact requirement: OFFICIALLY LISTED ✓",
      note:"Published on "+(e.sourceUrl||"an official page")+" (checked "+String(e.checkedAt||"").slice(0,10)+"). Syntax "+e.syntax+" · MX "+e.mx+" · mailbox not confirmed." };
    if(e.mx==="pass") return { level:"fair", label:"Contact requirement: SYNTAX + DOMAIN MX ✓ (not officially listed)",
      note:"The address parses and the domain accepts mail — that is NOT proof the mailbox belongs to this person. Prefer the directory listing." };
    if(e.syntax==="pass") return { level:"weak", label:"Contact requirement: SYNTAX ONLY",
      note:"Format valid; no DNS or directory evidence yet." };
    return { level:"invalid", label:"Contact requirement: MALFORMED ADDRESS", note:"Cannot be delivered as written." };
  };

  /* ---------- normalise any legacy card into the Professor shape ---------- */
  LD.toProfessor = function(raw){
    if(!raw) return raw;
    var p = Object.assign({}, raw);
    p.affiliation = p.affiliation || p.uni || "";
    p.identifiers = p.identifiers || { orcid:p.orcid||"", openAlex:p.openAlexId||"", scholar:p.scholar||"" };
    if(!p.publications) p.publications = (p.recentPapers||[]).map(LD.toPublication);
    if(!p.emails){
      p.emails = p.email ? [{ address:p.email, syntax:(p.verified==="invalid"?"fail":"pass"),
        mx:(p.verified==="valid"||p.verified==="likely")?"pass":"unchecked",
        officialListing:"unchecked", mailbox:"not-confirmed", sourceUrl:p.profileUrl||"", checkedAt:LD.nowIso() }] : [];
    }
    if(!p.availability) p.availability = (p.openToStudents===true?"unknown":p.openToStudents===false?"closed":"unknown");
    if(!p.availabilityEvidence) p.availabilityEvidence=null;
    if(!p.identity) LD.resolveIdentity(p);
    p.example = !!p.example;
    return p;
  };
  LD.toPublication = function(x){
    x=x||{};
    return { doi:LD.cleanDoi?LD.cleanDoi(x.doi):"", title:x.title||"", year:x.year||null, venue:x.venue||"",
             abstract:x.abstract||"", authors:x.authors||[], methods:x.methods||[],
             limitations:x.limitations||"", futureWork:x.futureWork||"", citedBy:x.cited||x.citedBy||null,
             source:x.source||"", url:x.url||x.landingUrl||"", verification:x.verification||null };
  };

  /* ---------- serialisation for export ---------- */
  LD.exportRecords = function(){
    var db = LD.db || { professors:[], publications:[], laboratories:[], funding:[], policies:[], outreach:[] };
    return { app:"LetterDesk", version:2, exportedAt:LD.nowIso(),
             schema:Object.keys(LD.SCHEMA),
             records:{ Professor:db.professors||[], Publication:db.publications||[], Laboratory:db.laboratories||[],
                       FundingOpportunity:db.funding||[], AdmissionsPolicy:db.policies||[], OutreachRecord:db.outreach||[] } };
  };
})();
