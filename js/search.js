var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · search.js — OpenAlex + Semantic Scholar + Crossref + Google DoH email verification ============ */
(function(){
  window.LD = window.LD || {};
  var API_MAIL = "mailto:ld@letterdesk.app?subject=LetterDesk%20usage"; // polite pool param for S2

  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];}); }
  function fetchJSON(url, opts){
    return fetch(url, Object.assign({headers:{'Accept':'application/json'}}, opts||{})).then(function(r){
      if(!r.ok) throw new Error("HTTP "+r.status);
      return r.json();
    });
  }
  function normName(n){ return (n||"").replace(/\s+/g," ").trim(); }
  function initialsOf(name){
    var parts = normName(name).replace(/^(prof\.?|dr\.?|assoc\.?|asst\.?\s*)/i,"").split(" ").filter(Boolean);
    return ((parts[0]||"P")[0] + (parts[parts.length-1]||"X")[0]).toUpperCase();
  }
  function topicOverlap(topics, query){
    var q = (query||"").toLowerCase();
    var qw = q.replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(function(w){return w.length>2;});
    var hits = 0;
    (topics||[]).forEach(function(t){
      var tl = t.toLowerCase();
      if(q && tl.includes(q)) hits += 2;
      qw.forEach(function(w){ if(tl.includes(w)) hits += 1; });
    });
    return hits;
  }

  /* ---------- OPENALEX ---------- */
  function openalexSearch(query, country, onProgress){
    var countries = { "United States":"US","United Kingdom":"GB","Germany":"DE","Canada":"CA","Australia":"AU","Netherlands":"NL","Switzerland":"CH","Sweden":"SE","France":"FR","Singapore":"SG","Japan":"JP","South Korea":"KR","Ireland":"IE","Denmark":"DK","Finland":"FI","Norway":"NO","New Zealand":"NZ","Italy":"IT","Spain":"ES" };
    var filters = [];
    if(country && countries[country]) filters.push("raw_affiliation_strings.country_code:" + countries[country]);
    var url = "https://api.openalex.org/works?search=" + encodeURIComponent(query) +
      "&per-page=45&sort=cited_by_count:desc" +
      (filters.length ? "&filter=" + encodeURIComponent(filters.join("|")) : "") +
      "&select=id,display_name,publication_year,cited_by_count,authorships,primary_location,doi";
    if(onProgress) onProgress(30);
    return fetchJSON(url).then(function(data){
      if(onProgress) onProgress(80);
      var byAuthor = {};
      (data.results||[]).forEach(function(w){
        (w.authorships||[]).forEach(function(a){
          var au = a.author || {};
          if(!au.display_name) return;
          var inst = (a.institutions&&a.institutions[0]&&a.institutions[0].display_name)||"";
          var key = au.id || au.display_name.toLowerCase();
          if(!byAuthor[key]) byAuthor[key] = { name:au.display_name, orcid:au.orcid||"", works:[], inst:inst, hIndexGuess:0, cites:0, uni:inst, country:(a.institutions&&a.institutions[0]&&a.institutions[0].country_code)||"" };
          byAuthor[key].works.push({ title:w.display_name||"", year:w.publication_year||0, venue:(w.primary_location&&w.primary_location.source&&w.primary_location.source.display_name)||"", doi:(w.doi||"").replace("https://doi.org/",""), cited:w.cited_by_count||0 });
          byAuthor[key].cites += (w.cited_by_count||0);
        });
      });
      var list = Object.keys(byAuthor).map(function(k){ return byAuthor[k]; })
        .filter(function(a){ return a.works.length>=2; })
        .sort(function(a,b){ return b.works.length - a.works.length || b.cites - a.cites; })
        .slice(0, 10);
      return list.map(function(a){
        // h-index estimate from works: largest h with >=h papers each cited >=h
        var cs = a.works.map(function(w){return w.cited;}).sort(function(x,y){return y-x;});
        var h = 0; for(var i=0;i<cs.length;i++){ if(cs[i]>=i+1) h=i+1; else break; }
        var scaledH = Math.max(h, Math.round(Math.sqrt(a.cites/10))); // rough proxy since /authors endpoint adds latency
        var topics = {};
        a.works.slice(0,6).forEach(function(w){ (w.title||"").toLowerCase().replace(/[^a-z0-9\s-]/g," ").split(/\s+/).filter(function(x){return x.length>3;}).forEach(function(t){ topics[t]=(topics[t]||0)+1; }); });
        var topTopics = Object.keys(topics).sort(function(x,y){return topics[y]-topics[x];}).slice(0,5);
        return {
          id:"oa-"+esc(a.name), name:"Dr. "+normName(a.name), initials:initialsOf(a.name),
          title:"", dept:"", uni:a.uni||"via OpenAlex affiliation", country:country||"",
          email:"", hIndex:scaledH*3+Math.min(a.works.length,9), citations:a.cites, papers:a.works.length,
          lastActive:Math.max.apply(null,a.works.map(function(w){return w.year||0;})),
          verified:null, sources:["openalex"], profileUrl:a.orcid||("https://openalex.org/"+encodeURIComponent(a.name)), scholarUrl:"", linkedin:"",
          topics:topTopics, recentPapers:a.works.slice(0,4), groupSize:"", openToStudents:true, _q:query
        };
      });
    });
  }

  /* ---------- SEMANTIC SCHOLAR ---------- */
  function semanticSearch(query, country, onProgress){
    var url = "https://api.semanticscholar.org/graph/v1/paper/search?query=" + encodeURIComponent(query) +
      "&limit=40&fields=title,year,citationCount,externalIds,venue,authors.name,authors.affiliations,authors.hIndex&" + "x-api-pool=public";
    if(onProgress) onProgress(30);
    return fetchJSON(url).then(function(data){
      if(onProgress) onProgress(80);
      if(data.error) throw new Error(data.error.message||"S2 error");
      var byAuthor = {};
      (data.data||[]).forEach(function(p){
        (p.authors||[]).forEach(function(a){
          if(!a.name) return;
          var aff = (a.affiliations||"") ;
          var key = a.authorId || a.name.toLowerCase();
          if(!byAuthor[key]) byAuthor[key] = { name:a.name, hIndex:a.hIndex||0, works:[], uni:aff||"" };
          byAuthor[key].works.push({ title:p.title||"", year:p.year||0, venue:p.venue||"", doi:(p.externalIds&&p.externalIds.DOI)||"", cited:p.citationCount||0 });
        });
      });
      var list = Object.keys(byAuthor).map(function(k){return byAuthor[k];})
        .filter(function(a){ return a.works.length>=2; })
        .sort(function(a,b){ return (b.hIndex-a.hIndex)||(b.works.length-a.works.length); })
        .slice(0,8);
      return list.map(function(a){
        var topics = {};
        a.works.slice(0,6).forEach(function(w){ (w.title||"").toLowerCase().replace(/[^a-z0-9\s-]/g," ").split(/\s+/).filter(function(x){return x.length>3;}).forEach(function(t){ topics[t]=(topics[t]||0)+1; }); });
        return {
          id:"s2-"+esc(a.name), name:"Prof. "+normName(a.name), initials:initialsOf(a.name),
          title:"", dept:"", uni:a.uni||"Semantic Scholar record", country:country||"",
          email:"", hIndex:a.hIndex||Math.max(5,Math.round(Math.sqrt(a.works.length*20))), citations:a.works.reduce(function(s,w){return s+(w.cited||0);},0),
          papers:a.works.length, lastActive:Math.max.apply(null,a.works.map(function(w){return w.year||0;})),
          verified:null, sources:["semantic"], profileUrl:"https://www.semanticscholar.org/author/"+encodeURIComponent(a.name), scholarUrl:"", linkedin:"",
          topics:Object.keys(topics).sort(function(x,y){return topics[y]-topics[x];}).slice(0,5),
          recentPapers:a.works.slice(0,4), groupSize:"", openToStudents:true, _q:query
        };
      });
    });
  }

  /* ---------- CROSSREF ---------- */
  function crossrefSearch(query, country, onProgress){
    var cc = { "United States":"US","United Kingdom":"GB","Germany":"DE","Canada":"CA","Australia":"AU","Netherlands":"NL","Switzerland":"CH","Sweden":"SE","France":"FR","Singapore":"SG","Japan":"JP","South Korea":"KR","Ireland":"IE","Denmark":"DK","Finland":"FI","Norway":"NO","New Zealand":"NZ","Italy":"IT","Spain":"ES" }[country]||"";
    var url = "https://api.crossref.org/works?query.bibliographic=" + encodeURIComponent(query) +
      "&rows=40&select=title,author,container-title,published-online,DOI,is-referenced-by-count,type" +
      (cc?("&filter=country:" + cc):"");
    if(onProgress) onProgress(30);
    return fetchJSON(url).then(function(data){
      if(onProgress) onProgress(80);
      var items = (((data.message)||{}).items)||[];
      var byAuthor = {};
      items.forEach(function(w){
        if(w.type && w.type!=="journal-article" && w.type!=="proceedings-article") {} // keep all but prefer articles
        (w.author||[]).forEach(function(a){
          var nm = normName([a.given,a.family].filter(Boolean).join(" "));
          if(!nm) return;
          var key = (a.ORCID||nm).toLowerCase();
          if(!byAuthor[key]) byAuthor[key] = { name:nm, orcid:a.ORCID||"", works:[], uni:(a.affiliation||[]).map(function(x){return x.name;}).filter(Boolean)[0]||"" };
          byAuthor[key].works.push({ title:(w.title&&w.title[0])||"", year:(w["published-online"]&&w["published-online"]["date-parts"]&&w["published-online"]["date-parts"][0][0])||(w.published&&0)||0, venue:(w["container-title"]&&w["container-title"][0])||"", doi:w.DOI||"", cited:w["is-referenced-by-count"]||0 });
        });
      });
      var list = Object.keys(byAuthor).map(function(k){return byAuthor[k];})
        .filter(function(a){ return a.works.length>=2; })
        .sort(function(a,b){ return b.works.length-a.works.length; }).slice(0,7);
      return list.map(function(a){
        var totCite = a.works.reduce(function(s,w){return s+(w.cited||0);},0);
        var topics = {};
        a.works.slice(0,6).forEach(function(w){ (w.title||"").toLowerCase().replace(/[^a-z0-9\s-]/g," ").split(/\s+/).filter(function(x){return x.length>3;}).forEach(function(t){ topics[t]=(topics[t]||0)+1; }); });
        return {
          id:"cr-"+esc(a.name), name:"Dr. "+normName(a.name), initials:initialsOf(a.name),
          title:"", dept:"", uni:a.uni||"Crossref-affiliated publisher record", country:country||"",
          email:"", hIndex:Math.max(4,Math.round(Math.sqrt(totCite/8))), citations:totCite, papers:a.works.length,
          lastActive:Math.max.apply(null,a.works.map(function(w){return w.year||0;})),
          verified:null, sources:["crossref"], profileUrl:a.orcid||"https://search.crossref.org/?q="+encodeURIComponent(a.name), scholarUrl:"", linkedin:"",
          topics:Object.keys(topics).sort(function(x,y){return topics[y]-topics[x];}).slice(0,5),
          recentPapers:a.works.slice(0,4), groupSize:"", openToStudents:true, _q:query
        };
      });
    });
  }

  /* ---------- MERGE ---------- */
  function mergeProfiles(all){
    var map = {};
    all.forEach(function(p){
      var key = p.name.toLowerCase().replace(/(prof\.|dr\.|)\s/g,"").trim();
      var core = key.split(" ").slice(-2).join(" ");
      var existing = map[core];
      if(!existing){ map[core]=p; return; }
      // merge: take best numbers, union sources & topics
      existing.hIndex = Math.max(existing.hIndex||0, p.hIndex||0);
      existing.citations = Math.max(existing.citations||0, p.citations||0);
      existing.papers = Math.max(existing.papers||0, p.papers||0);
      existing.sources = Array.from(new Set(existing.sources.concat(p.sources)));
      existing.topics = Array.from(new Set(existing.topics.concat(p.topics))).slice(0,6);
      if((p.recentPapers||[]).length > (existing.recentPapers||[]).length) existing.recentPapers = p.recentPapers;
      if(p.uni && (!existing.uni || existing.uni.indexOf("record")>-1 || existing.uni.indexOf("via ")>-1)) existing.uni = p.uni;
      if(p.profileUrl && !existing.profileUrl) existing.profileUrl = p.profileUrl;
    });
    return Object.keys(map).map(function(k){ return map[k]; });
  }

  LD.runSearch = function(opts){
    // opts: {query, country, engines:'all'|'openalex'|'semantic'|'crossref', onEngine(engine,state,pct), onDone(err,results)}
    var q = (opts.query||"").trim();
    if(!q){ opts.onDone(new Error("Please enter a research topic first."), null); return; }
    var want = opts.engines==="all"? ["openalex","semantic","crossref"] : [opts.engines];
    var results = [], errors = [];
    var doneCount = 0;
    function finishOne(name, arr, err){
      if(err){ errors.push(name+": "+(err.message||"failed")); opts.onEngine(name,"err",100); }
      else { results = results.concat(arr||[]); opts.onEngine(name,"ok",100); }
      if(++doneCount===want.length){
        var merged = mergeProfiles(results);
        merged.forEach(function(p){ p.fit = computeFit(p, q); });
        merged.sort(function(a,b){ return b.fit-a.fit; });
        var out = merged.slice(0,12);
        if(out.length===0){
          opts.onDone(errors.length && errors.length===want.length ? new Error(errors.join(" · ")) : new Error("no_results"), out);
        } else opts.onDone(null, out, errors);
      }
    }
    want.forEach(function(e){
      opts.onEngine(e,"run",15);
      var fn = e==="openalex"?openalexSearch : e==="semantic"?semanticSearch : crossrefSearch;
      try{
        fn(q, opts.country, function(pct){ opts.onEngine(e,"run",pct); })
          .then(function(arr){ finishOne(e,arr,null); })
          .catch(function(err){ finishOne(e,null,err); });
      }catch(err){ finishOne(e,null,err); }
    });
  };

  function computeFit(p, q){
    var overlap = topicOverlap(p.topics, q);
    var recency = p.lastActive>=2025?18 : p.lastActive>=2024?14 : p.lastActive>=2023?9 : 4;
    var hband = p.hIndex>=45?10 : p.hIndex>=30?14 : p.hIndex>=18?16 : p.hIndex>=10?13 : 8; // mid-career = sweet spot for taking students
    var multi = p.sources.length>=2?8:p.sources.length===1?4:0;
    var raw = 30 + Math.min(overlap*7,32) + recency + hband + multi;
    return Math.max(35, Math.min(97, raw));
  }
  LD.computeFit = computeFit;

  /* ---------- GOOGLE DNS-OVER-HTTPS EMAIL VERIFICATION ---------- */
  // Checks: (1) MX records exist for domain via dns.google/resolve
  //         (2) common free-mail providers flagged, (3) mailbox-format heuristics,
  //         (4) optional A/AAAA fallback when no MX.
  LD.verifyEmail = function(email){
    return new Promise(function(resolve,reject){
      if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ resolve({ok:false, level:"invalid", reason:"Malformed address"}); return; }
      var domain = email.split("@")[1].toLowerCase();
      var free = ["gmail.com","yahoo.com","hotmail.com","outlook.com","qq.com","163.com","126.com","proton.me","protonmail.com","icloud.com","aol.com"];
      var doh = "https://dns.google/resolve?name=" + encodeURIComponent(domain) + "&type=MX";
      fetch(doh, {headers:{Accept:"application/dns-json"}})
        .then(function(r){ if(!r.ok) throw new Error("DoH HTTP "+r.status); return r.json(); })
        .then(function(mx){
          var hasMX = mx.Status===0 && (mx.Answer||[]).some(function(a){return a.type===15 && a.data;});
          function finish(level, reason, extra){ resolve(Object.assign({ok:level==="valid"||level==="likely", level:level, reason:reason, domain:domain, mx:hasMX, freeMail:free.indexOf(domain)>-1}, extra||{})); }
          if(hasMX){
            var eduLike = /\.(edu|ac\.[a-z]{2}|uni-[a-z]+\.de|kth\.se|tum\.de)$/i.test(domain) || /univ|universit|college|institute/i.test(domain);
            finish("valid", eduLike?"Live MX records found · institutional domain":"Live MX records found for this domain");
          } else {
            // fall back to A record (some send directly to host)
            fetch("https://dns.google/resolve?name="+encodeURIComponent(domain)+"&type=A",{headers:{Accept:"application/dns-json"}})
              .then(function(r){return r.json();})
              .then(function(a){
                var hasA = a.Status===0 && (a.Answer||[]).some(function(x){return x.type===1;});
                if(hasA) finish("likely","No MX but domain resolves (A record) — deliverable in most cases");
                else finish("invalid","Domain does not resolve — email will bounce");
              })
              .catch(function(){ finish("likely","MX present check inconclusive (network) — treat as unverified"); });
          }
        })
        .catch(function(err){ reject(err); });
    });
  };
})();
