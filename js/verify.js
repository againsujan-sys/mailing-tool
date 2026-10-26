var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · verify.js — DOI / publication claim verification ============
   Rules implemented here (see also facts.js provenance audit):

   • A DOI string is only trusted when it PASSES FORMAT VALIDATION. Placeholders such as
     "10.48550/arXiv.2402.xxxxx", empty strings or non-DOI text are rejected outright and
     can never enter a generated email.
   • When the user clicks "Resolve & verify", the app queries Crossref (https://api.crossref.org)
     for that DOI and compares the RETURNED title, authors and year with the local record.
     The result is one of five honest statuses — never more, never guessed:

        verified          Verified Against Source      (title+author+year all agree)
        partial           Partially Supported          (≥2 of 3 fields agree)
        needs-review      Needs Review                 (<2 fields agree / metadata missing)
        contradicted      Contradicted                 (resolver returned a DIFFERENT paper)
        unavailable       Source Unavailable           (network error / HTTP failure / not found)

   • Resolving a DOI proves the identifier points at a real publication. It does NOT prove
     that any AI-generated summary sentence about that paper is correct — the UI says so,
     and the provenance audit still requires the human to open the paper before approval.
   • Every verification records {status, checkedAt, resolver, resolvedTitle, resolvedAuthors,
     resolvedYear, originalUrl} on the paper object; the original source URL is preserved.
   • Duplicate publications (same DOI twice, or same normalized title) are collapsed in
     dedupePapers() and flagged on cards.                                                              */
(function(){
  window.LD = window.LD || {};

  /* ---------- claim status vocabulary (shared with facts.js + UI badges) ---------- */
  LD.CLAIM_STATUS = {
    "verified":     { label:"Verified Against Source", cls:"b-green", icon:"✓" },
    "partial":      { label:"Partially Supported",     cls:"b-amber", icon:"≈" },
    "needs-review": { label:"Needs Review",            cls:"b-amber", icon:"⚠" },
    "contradicted": { label:"Contradicted",            cls:"b-red",   icon:"✗" },
    "unavailable":  { label:"Source Unavailable",      cls:"b-slate", icon:"❔" }
  };
  LD.claimBadge = function(status){
    var s = LD.CLAIM_STATUS[status] || LD.CLAIM_STATUS["needs-review"];
    return '<span class="badge '+s.cls+'" title="'+s.label+'">'+s.icon+' '+s.label+'</span>';
  };

  /* ---------- DOI format validation ----------
     Canonical: "10.<prefix ≥4 digits>/<suffix ≥1 non-space char>".
     Anything containing placeholder runs (xxxx), "n/a", or angle brackets fails. */
  LD.isValidDoi = function(doi){
    if(!doi || typeof doi!=="string") return false;
    var d = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i,"");
    if(/x{3,}|n\/a|placeholder|todo|\?\?|[<>"'`\s]/i.test(d)) return false;
    return /^10\.\d{4,9}\/\S+$/.test(d);
  };
  LD.cleanDoi = function(doi){
    return String(doi||"").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i,"");
  };
  LD.doiUrl = function(doi){ return "https://doi.org/"+encodeURIComponent(LD.cleanDoi(doi)); };

  /* ---------- text comparison helpers ---------- */
  function normText(s){
    return String(s||"").toLowerCase()
      .replace(/[áàâäãå]/g,"a").replace(/[éèêë]/g,"e").replace(/[íìîï]/g,"i")
      .replace(/[óòôöõ]/g,"o").replace(/[úùûü]/g,"u").replace(/ñ/g,"n")
      .replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
  }
  LD.normText = normText;
  function titleMatch(a,b){
    var x=normText(a), y=normText(b);
    if(!x||!y) return null;                       // cannot compare → unknown
    if(x===y) return true;
    if(x.length>15 && (x.indexOf(y)>-1 || y.indexOf(x)>-1)) return true;  // subtitle variants
    var xa=x.split(" "), yb=new Set(y.split(" "));
    var hit=xa.filter(function(w){return w.length>3 && yb.has(w);}).length;
    return hit >= Math.max(2, Math.ceil(Math.min(xa.length,yb.size)*0.6));
  }
  function authorOverlap(localFamilies, remoteAuthors){
    var rem = (remoteAuthors||[]).map(function(a){ return normText(a.family||a.name||"").split(" ").pop(); }).filter(Boolean);
    var loc = (localFamilies||[]).map(function(f){ return normText(f).split(" ").pop(); }).filter(Boolean);
    if(!rem.length || !loc.length) return null;
    return loc.some(function(f){ return rem.indexOf(f)>-1; });
  }
  function yearMatch(a,b){
    var x=parseInt(a,10), y=parseInt(b,10);
    if(!x||!y) return null;
    return Math.abs(x-y)<=1;                      // online-first vs issue year tolerance
  }

  /* ---------- resolve one DOI through Crossref ---------- */
  LD.resolveDoi = function(doi){
    var clean = LD.cleanDoi(doi);
    if(!LD.isValidDoi(clean)) return Promise.resolve({ ok:false, reason:"invalid_format" });
    var url = "https://api.crossref.org/works/"+encodeURIComponent(clean);
    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, 12000) : null;
    return fetch(url, { headers:{ "Accept":"application/json" }, signal: ctrl?ctrl.signal:undefined })
      .then(function(r){
        if(timer) clearTimeout(timer);
        if(r.status===404) return { ok:false, reason:"not_found", doi:clean };
        if(!r.ok) throw new Error("Crossref HTTP "+r.status);
        return r.json();
      })
      .then(function(j){
        if(j && j.ok!==undefined && j.message===undefined && j.status==="error") return { ok:false, reason:"resolver_error" };
        var m = (j && j.message) || null;
        if(!m) return { ok:false, reason:"not_found", doi:clean };
        return {
          ok:true, doi:clean, resolver:"Crossref REST (api.crossref.org)",
          title:(m.title&&m.title[0])||"",
          container:(m["container-title"]&&m["container-title"][0])||"",
          year:(m.published&&m.published["date-parts"]&&m.published["date-parts"][0]&&m.published["date-parts"][0][0])||
               (m.issued&&m.issued["date-parts"]&&m.issued["date-parts"][0]&&m.issued["date-parts"][0][0])||null,
          authors:(m.author||[]).map(function(a){ return { given:a.given||"", family:a.family||a.name||"" }; }),
          citedBy:m["is-referenced-by-count"]||0,
          sourceUrl:"https://api.crossref.org/works/"+encodeURIComponent(clean),
          landingUrl:"https://doi.org/"+clean
        };
      })
      .catch(function(err){
        if(timer) clearTimeout(timer);
        return { ok:false, reason:(err && (err.name==="AbortError"?"timeout":"network")), detail:String(err&&err.message||err) };
      });
  };

  /* ---------- compare resolver output against the local record ---------- */
  LD.comparePaper = function(paper, res){
    var t = titleMatch(paper.title, res.title);
    var a = authorOverlap((paper.authors||[]).map(function(x){return typeof x==="string"?x:(x.family||x.name);}), res.authors);
    var y = yearMatch(paper.year, res.year);
    var yes=[t,a,y].filter(function(v){return v===true;}).length;
    var known=[t,a,y].filter(function(v){return v!==null;}).length;
    var no=[t,a,y].filter(function(v){return v===false;}).length;
    var status;
    if(yes===3) status="verified";
    else if(known>=2 && yes>=2 && no===0) status="partial";
    else if(no>=1 && yes===0) status="contradicted";
    else if(yes>=1) status="partial";
    else status="needs-review";
    return { status:status, titleOk:t, authorOk:a, yearOk:y,
             detail:"Title "+mark(t)+" · Author "+mark(a)+" · Year "+mark(y)+
                    (res.container?(" — resolved venue: "+res.container):"") };
  };
  function mark(v){ return v===true?"✓":v===false?"✗":"—"; }

  /* ---------- full verification of one paper object (mutates + returns it) ---------- */
  LD.verifyPaper = function(paper){
    if(!paper) return Promise.resolve(null);
    if(!LD.isValidDoi(paper.doi)){
      paper.verification = { status:"needs-review", checkedAt:new Date().toISOString(),
        reason:"DOI missing or invalid format — placeholder/fake DOIs are never sent.", resolver:null };
      return Promise.resolve(paper);
    }
    return LD.resolveDoi(paper.doi).then(function(res){
      if(!res.ok){
        paper.verification = { status:"unavailable", checkedAt:new Date().toISOString(),
          reason:res.reason||"resolver failed", resolver:"Crossref",
          originalUrl:paper.url||null };
        return paper;
      }
      var cmp = LD.comparePaper(paper,res);
      paper.verification = Object.assign({
        status:cmp.status, detail:cmp.detail, checkedAt:new Date().toISOString(),
        resolver:res.resolver, resolvedTitle:res.title, resolvedYear:res.year,
        resolvedAuthors:res.authors.map(function(a){return [a.given,a.family].filter(Boolean).join(" ");}),
        landingUrl:res.landingUrl, apiUrl:res.sourceUrl,
        originalUrl:paper.url||res.landingUrl
      }, {});
      return paper;
    });
  };

  /* ---------- batch: verify every paper on a professor (sequential, rate-limit friendly) ---------- */
  LD.verifyProfessorPapers = function(prof, onEach){
    var papers=(prof.recentPapers||[]).slice();
    var chain=Promise.resolve();
    papers.forEach(function(p,i){
      chain = chain.then(function(){
        return LD.verifyPaper(p).then(function(done){ if(onEach) onEach(done,i); });
      }).then(function(){ return new Promise(function(r){ setTimeout(r,700); }); }); // polite spacing
    });
    return chain.then(function(){ prof._papersVerifiedAt=new Date().toISOString(); return prof; });
  };

  /* ---------- duplicate detection across a result list ----------
     Same DOI (normalized) or identical normalized title+first-author → merge sources. */
  LD.dedupePapers = function(papers){
    var seen={}, out=[];
    (papers||[]).forEach(function(p){
      var key = p.doi ? ("doi:"+LD.cleanDoi(p.doi).toLowerCase())
                      : ("t:"+normText(p.title)+"|"+normText((p.authors&&p.authors[0])||""));
      if(seen[key]){
        var s=seen[key];
        s.sources = Array.from(new Set((s.sources||[s.source||"unknown"]).concat([p.source||"unknown"])));
        if(!s.abstract && p.abstract) s.abstract=p.abstract;
        s.dupCount=(s.dupCount||1)+1;
        return;
      }
      var copy=Object.assign({},p,{sources:[p.source||"unknown"]});
      seen[key]=copy; out.push(copy);
    });
    return out;
  };
  LD.findDuplicatePapers = function(papers){
    var keys={}, dups=0;
    (papers||[]).forEach(function(p){
      var k = p.doi ? ("doi:"+LD.cleanDoi(p.doi).toLowerCase()) : ("t:"+normText(p.title));
      if(keys[k]) dups++; else keys[k]=1;
    });
    return dups;
  };

  /* ---------- unsafe HTML / script-injection guard (used for ALL rendered API text) ---------- */
  LD.escapeHtml = function(s){
    return String(s==null?"":s).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  };
  LD.sanitizeText = function(s){
    return String(s==null?"":s).replace(/<script[\s\S]*?<\/script>/gi," ")
      .replace(/<\/?(?!b\b|i\b|em\b|strong\b)[^>]*>/gi,"")   // strip tags except simple emphasis
      .replace(/javascript:/gi,"")
      .replace(/on\w+\s*=/gi,"");
  };
})();
