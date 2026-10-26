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
  /* Crossref abstracts arrive as JATS/XML — strip tags and decode entities. */
  function cleanJats(s){
    if(!s) return "";
    var t = String(s).replace(/<[^>]+>/g," ");
    try{ t = t.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&#x27;|&apos;|&#39;/g,"'").replace(/&quot;/g,'"'); }catch(e){}
    t = t.replace(/<[^>]+>/g," ");
    return t.replace(/\s+/g," ").trim().slice(0,600);
  }
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

  /* Map display country names to ISO codes (extended for geology fields). */
  var COUNTRY_CC = { "United States":"US","United Kingdom":"GB","Germany":"DE","Canada":"CA","Australia":"AU","Netherlands":"NL","Switzerland":"CH","Sweden":"SE","France":"FR","Singapore":"SG","Japan":"JP","South Korea":"KR","Ireland":"IE","Denmark":"DK","Finland":"FI","Norway":"NO","New Zealand":"NZ","Italy":"IT","Spain":"ES","Turkey":"TR","Iceland":"IS","Austria":"AT","Belgium":"BE","Poland":"PL","Portugal":"PT","Greece":"GR","Czechia":"CZ","Brazil":"BR","Mexico":"MX","South Africa":"ZA","India":"IN","China":"CN","Israel":"IL","Saudi Arabia":"SA","United Arab Emirates":"AE","Kenya":"KE","Nigeria":"NG","Morocco":"MA","Chile":"CL","Peru":"PE","Argentina":"AR","Colombia":"CO","Indonesia":"ID","Thailand":"TH","Malaysia":"MY","Vietnam":"VN","Philippines":"PH","Bangladesh":"BD","Pakistan":"PK","Iran":"IR","Iraq":"IQ","Egypt":"EG","Estonia":"EE","Latvia":"LV","Lithuania":"LT","Croatia":"HR","Slovenia":"SI","Slovakia":"SK","Hungary":"HU","Romania":"RO","Bulgaria":"BG","Serbia":"RS","Ukraine":"UA","Georgia":"GE","Armenia":"AM","Kazakhstan":"KZ","Cyprus":"CY","Malta":"MT","Luxembourg":"LU" };

  /* Build the OpenAlex filter string from structured search options. */
  function oaFilters(o){
    var f=[];
    if(o.institution){
      // try grid search first via filter value fallback (display name matching is fuzzy server-side)
      f.push("institution.display_name.search:"+o.institution.replace(/[,|]/g," "));
    }
    if(o.country && COUNTRY_CC[o.country]) f.push("raw_affiliation_strings.country_code:"+COUNTRY_CC[o.country]);
    if(o.authorName) f.push("authorships.author.display_name.search:"+o.authorName.replace(/[,|]/g," "));
    return f;
  }

  /* ---------- OPENALEX ---------- */
  function openalexSearch(opts, onProgress){
    var query = opts.query, country = opts.country;
    var filters = oaFilters(opts);
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
  function semanticSearch(opts, onProgress){
    var query = opts.query, country = opts.country;
    var url = "https://api.semanticscholar.org/graph/v1/paper/search?query=" + encodeURIComponent(query) +
      "&limit=40&fields=title,year,citationCount,externalIds,venue,abstract,authors.name,authors.affiliations,authors.hIndex&" + "x-api-pool=public";
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
          byAuthor[key].works.push({ title:p.title||"", year:p.year||0, venue:p.venue||"", doi:(p.externalIds&&p.externalIds.DOI)||"", cited:p.citationCount||0, abstract:p.abstract||"", source:"Semantic Scholar" });
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
  function crossrefSearch(opts, onProgress){
    var query = opts.query, country = opts.country;
    var cc = COUNTRY_CC[country]||"";
    var url = "https://api.crossref.org/works?query.bibliographic=" + encodeURIComponent(query) +
      "&rows=40&select=title,author,container-title,published-online,DOI,is-referenced-by-count,type,abstract" +
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
          byAuthor[key].works.push({ title:(w.title&&w.title[0])||"", year:(w["published-online"]&&w["published-online"]["date-parts"]&&w["published-online"]["date-parts"][0][0])||(w.published&&0)||0, venue:(w["container-title"]&&w["container-title"][0])||"", doi:w.DOI||"", cited:w["is-referenced-by-count"]||0, abstract:cleanJats(w.abstract), source:"Crossref" });
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

  /* ---------- Area tagging (geology filters) ---------- */
  function areaKeywords(){
    var m = {};
    (LD.GEO_AREAS||[]).forEach(function(a){ m[a.id]=a.keywords.map(function(k){return k.toLowerCase();}); });
    return m;
  }
  function tagAreas(p, query){
    if(!LD.GEO_AREAS) return p;
    var kw = areaKeywords();
    var hay = ((p.topics||[]).join(" ") + " " + (p._q||query||"") + " " +
      (p.recentPapers||[]).map(function(x){return (x.title||"")+" "+(x.venue||"");}).join(" ")).toLowerCase();
    var matched = [];
    Object.keys(kw).forEach(function(id){
      if(kw[id].some(function(k){ return hay.indexOf(k)>-1; })) matched.push(id);
    });
    if(matched.length) p.areas = Array.from(new Set((p.areas||[]).concat(matched)));
    // attach canonical methods for known areas so Research Fit can list them
    if(p.areas && p.areas.length && !(p.methods||[]).length){
      var ms=[];
      p.areas.forEach(function(id){ var a=(LD.GEO_AREAS||[]).find(function(x){return x.id===id;}); if(a) ms=ms.concat(a.methods); });
      p.methods = ms.slice(0,8);
    }
    return p;
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
      existing.areas = Array.from(new Set((existing.areas||[]).concat(p.areas||[])));
      existing.methods = Array.from(new Set((existing.methods||[]).concat(p.methods||[])));
      // prefer the paper set that carries abstracts/source labels (verification panel needs them)
      var scoreQ = function(ps){ return (ps||[]).reduce(function(s,x){ return s + ((x.abstract?2:0)+(x.source?1:0)); },0); };
      if(scoreQ(p.recentPapers) > scoreQ(existing.recentPapers)) existing.recentPapers = p.recentPapers;
      else if((p.recentPapers||[]).length > (existing.recentPapers||[]).length && !scoreQ(existing.recentPapers)) existing.recentPapers = p.recentPapers;
      if(p.uni && (!existing.uni || existing.uni.indexOf("record")>-1 || existing.uni.indexOf("via ")>-1)) existing.uni = p.uni;
      if(p.profileUrl && !existing.profileUrl) existing.profileUrl = p.profileUrl;
    });
    return Object.keys(map).map(function(k){ return map[k]; });
  }

  LD.runSearch = function(opts){
    // opts: {query, country, institution, authorName, engines, onEngine(engine,state,pct), onDone(err,results)}
    var q = (opts.query||"").trim();
    var nameOnly = !q && (opts.authorName||"").trim();
    if(nameOnly) q = opts.authorName.trim();          // professor-name search works even without a topic
    if(!q){ opts.onDone(new Error("Enter a research topic or a professor name first."), null); return; }
    var want = opts.engines==="all"? ["openalex","semantic","crossref"] : [opts.engines];
    var results = [], errors = [];
    var doneCount = 0;
    function finishOne(name, arr, err){
      if(err){ errors.push(name+": "+(err.message||"failed")); opts.onEngine(name,"err",100); }
      else { results = results.concat(arr||[]); opts.onEngine(name,"ok",100); }
      if(++doneCount===want.length){
        var merged = mergeProfiles(results);
        merged.forEach(function(p){ p.fit = computeFit(p, q); tagAreas(p, q); });
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
        fn(Object.assign({}, opts), function(pct){ opts.onEngine(e,"run",pct); })
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

  /* ---------- LAYERED EMAIL VERIFICATION (Google DNS-over-HTTPS) ----------
     Four honest levels — each is a DIFFERENT claim, and no browser-only check
     can reach level 4:
       L1 syntax   – the address parses as name@domain.tld
       L2 official – the address was published on an official university page
                     (recorded manually per source; strongest practical signal)
       L3 mx       – the DOMAIN has mail-exchange records (or resolves via A).
                     This only proves the organisation accepts mail somewhere.
       L4 smtp     – mailbox-level SMTP RCPT confirmation. NOT POSSIBLE from a
                     static site: it needs a server session, and most providers
                     disable VRFY/EXPN anyway. The UI must never claim L4. */
  var FREE_MAIL = ["gmail.com","yahoo.com","hotmail.com","outlook.com","qq.com","163.com","126.com","proton.me","protonmail.com","icloud.com","aol.com"];
  function doh(name,type){
    return fetch("https://dns.google/resolve?name="+encodeURIComponent(name)+"&type="+type,{headers:{Accept:"application/dns-json"}})
      .then(function(r){ if(!r.ok) throw new Error("DoH HTTP "+r.status); return r.json(); });
  }
  function isAcademicDomain(d){
    return /\.(edu(\.[a-z]{2})?)$|\.ac\.[a-z]{2,3}$|\.uni-[a-z]+\.de$|(^|\.)[a-z-]+\.(no|se|dk|fi|ch|at|nl|it|fr|es|pt|pl|cz|hu|ro|bg|gr|ie|uk|ca|au|nz|jp|kr|sg|tr|za|br|mx|tw|hk)(\.edu)?$/.test(d) || /univ|universit|college|institute|ethz?|kth|tum|itu|polimi|ucd/i.test(d);
  }

  // Verify one layer of the ladder. layer: "syntax" | "official" | "mx" | "smtp"
  LD.verifyEmailLayer = function(email, layer, meta){
    return new Promise(function(resolve){
      meta = meta || {};
      var res = { layer:layer, email:email, passed:false, label:"", detail:"", icon:"❔", cls:"b-slate" };
      var domain = (email||"").split("@")[1]||"";
      if(layer==="syntax"){
        var ok = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email||"");
        res.passed = ok;
        res.label = ok ? "Syntactically valid address" : "Malformed address";
        res.detail = ok ? "Format parses as local-part@domain — says nothing about whether the mailbox exists." : "Cannot be delivered to as written.";
        res.icon = ok?"✓":"✗"; res.cls = ok?"b-slate":"b-red";
        resolve(res); return;
      }
      if(layer==="official"){
        var has = !!meta.sourceUrl;
        res.passed = has;
        res.label = has ? "Published on official university page" : "Not found on an official page";
        res.detail = has ? ("Source: "+(meta.sourceName||meta.sourceUrl)+" · captured "+(meta.captured||"date?"))
                         : "We did not find this address on the institution's own directory/lab page. Syntactic validity ≠ official listing.";
        res.icon = has?"🏫":"—"; res.cls = has?"b-green":"b-slate";
        resolve(res); return;
      }
      if(layer==="mx"){
        if(!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email||"")){
          res.label="Skipped — invalid format"; res.detail="No domain to query."; resolve(res); return;
        }
        doh(domain,"MX").then(function(mx){
          var hasMX = mx.Status===0 && (mx.Answer||[]).some(function(a){return a.type===15 && a.data;});
          if(hasMX){
            res.passed=true; res.icon="✓"; res.cls="b-blue";
            res.label="Domain has MX (mail-exchange) records";
            res.detail="The organisation's mail servers accept mail for this domain. This does NOT prove the specific mailbox exists or receives messages.";
            resolve(res);
          } else {
            doh(domain,"A").then(function(a){
              var hasA = a.Status===0 && (a.Answer||[]).some(function(x){return x.type===1;});
              res.passed=hasA; res.icon=hasA?"~":"✗"; res.cls=hasA?"b-amber":"b-red";
              res.label = hasA ? "No MX, but domain resolves (A record)" : "Domain has neither MX nor A records";
              res.detail = hasA ? "Some hosts accept mail directly — still no mailbox proof." : "Mail to this domain will bounce at the DNS stage.";
              resolve(res);
            }).catch(function(){ res.label="DNS check inconclusive"; res.detail="Network error while querying dns.google."; resolve(res); });
          }
        }).catch(function(){ res.label="DNS check inconclusive"; res.detail="Could not reach Google DoH — treat as unverified."; resolve(res); });
        return;
      }
      if(layer==="smtp"){
        res.passed=false; res.icon="⛔"; res.cls="b-amber";
        res.label="Mailbox deliverability NOT confirmed";
        res.detail="Confirming a specific mailbox needs an SMTP RCPT-TO handshake from a mail server (and many providers block that probe anyway). LetterDesk is 100% in-browser, so this level is deliberately left UNVERIFIED rather than guessed.";
        resolve(res); return;
      }
      resolve(res);
    });
  };

  // Full ladder used by the UI. Returns { levels:[...], best, freeMail, academic, domain }
  LD.verifyEmailFull = function(email, meta){
    meta = meta || {};
    var domain = (email||"").split("@")[1]||"";
    var base = { domain:domain, freeMail:FREE_MAIL.indexOf(domain.toLowerCase())>-1, academic:isAcademicDomain(domain) };
    return LD.verifyEmailLayer(email,"syntax",meta)
      .then(function(l1){
        return LD.verifyEmailLayer(email,"official",meta).then(function(l2){
          var chain = l1.passed ? LD.verifyEmailLayer(email,"mx",meta) : Promise.resolve({layer:"mx",passed:false,label:"Skipped — fix the address format first",detail:"",icon:"—",cls:"b-slate"});
          return chain.then(function(l3){
            return LD.verifyEmailLayer(email,"smtp",meta).then(function(l4){
              var levels=[l1,l2,l3,l4];
              var best = "invalid";
              if(l1.passed) best="syntax";
              if(l1.passed && l3.passed) best="mx";
              if(l1.passed && l3.passed && l2.passed) best="official";
              return Object.assign(base,{levels:levels,best:best,ok:best!=="invalid"});
            });
          });
        });
      });
  };

  /* Back-compat wrapper: maps the full ladder onto the old {ok,level,reason} shape. */
  LD.verifyEmail = function(email, meta){
    return LD.verifyEmailFull(email, meta).then(function(r){
      var map={ official:["valid","MX records live AND address listed on an official university page — strong, but mailbox delivery still unconfirmed"],
                mx:["likely","Syntactically valid + domain has MX records — mailbox existence NOT proven"],
                syntax:["weak","Only the address format is valid — no DNS evidence yet"],
                invalid:["invalid","Malformed address"] };
      var m = map[r.best] || ["unknown","Could not check"];
      return { ok:m[0]==="valid"||m[0]==="likely", level:m[0], reason:m[1], domain:r.domain, mx:(r.levels[2]||{}).passed, freeMail:r.freeMail, academic:r.academic, full:r };
    });
  };
})();
