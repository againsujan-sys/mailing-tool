var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · profverify.js — Professor & Email Verification Tool ============
   Standalone tool section on the page (#verifyTool). Given a professor name, institution,
   email address and (optionally) the official source URL where that email was found, it runs:

     1. IDENTITY CHECK — OpenAlex author search (public, CORS-enabled). Looks for an author
        whose name matches AND whose institutional affiliation matches. Returns matched
        author name, institution, ORCID, h-index-like summary count when available.
     2. EMAIL LADDER — reuses LD.verifyEmailLayer from search.js:
          L1 syntax      – address parses
          L2 official    – an official source URL was recorded by the user
          L3 mx          – domain has MX records (Google DNS-over-HTTPS)
          L4 smtp        – never claimed in-browser → "not confirmed"
     3. DOMAIN↔INSTITUTION CONSISTENCY — heuristic check whether the email domain plausibly
        belongs to the stated institution (.edu/.ac.xx/uni-*.de or shared keyword, e.g.
        "University of Oslo" ↔ "uio.no" is NOT auto-provable, so it only flags mismatches
        like a gmail address or an obviously different university keyword).

   Verdict vocabulary is honest and finite:
     strong   – identity matched in OpenAlex AND academic domain consistent AND official listing
     likely   – most signals agree, one is missing
     weak     – format valid but little corroborating evidence — verify manually before sending
     invalid  – malformed address
   Nothing is ever guessed; every row states exactly what it proved and what it did not.     */
(function(){
  window.LD = window.LD || {};
  var $ = function(id){ return document.getElementById(id); };

  /* ---------- small helpers ---------- */
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];}); }
  function normName(s){
    return String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/\b(prof\.?|dr\.?|associate|assistant|full|emeritus)\b/g," ")
      .replace(/[^a-z ]+/g," ").replace(/\s+/g," ").trim();
  }
  function familyOf(s){ var w=normName(s).split(" "); return w[w.length-1]||""; }
  function givenTokens(s){ var w=normName(s).split(" "); return w.slice(0,-1); }
  function domainOf(email){ return String(email||"").split("@")[1]||""; }
  function instKeywords(inst){
    // "University of Oslo" -> ["university","oslo"] ; "ETH Zürich" -> ["eth","zurich"]
    return String(inst||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9 ]+/g," ").split(" ")
      .filter(function(w){ return w.length>2 && !["the","of","and","for","college","institute"].includes(w==="institute"?"institute":w) || (w==="eth"); })
      .filter(Boolean);
  }

  var FREE_MAIL = ["gmail.com","yahoo.com","hotmail.com","outlook.com","qq.com","163.com","126.com","proton.me","protonmail.com","icloud.com","aol.com","mail.com","gmx.de","gmx.net","yandex.com"];

  function isAcademicDomain(d){
    d = d.toLowerCase();
    if(FREE_MAIL.indexOf(d)>-1) return false;
    return /\.(edu(\.[a-z]{2})?)$|\.ac\.[a-z]{2,3}$|\.uni-[a-z]+\.de$|\.edu\b/.test(d) ||
           /univ|universit|college|institut|ethz?|kth|tum|polimi|ucd|uo\.[a-z]{2}|uio|uhb|ulg/i.test(d);
  }

  /* ---------- 1. identity check via OpenAlex ---------- */
  LD.pvFindAuthor = function(name, institution){
    var q = name.trim();
    if(!q) return Promise.resolve({found:false, reason:"No name supplied."});
    var url = "https://api.openalex.org/authors?search="+encodeURIComponent(q)+"&per-page=5";
    return fetch(url,{headers:{Accept:"application/json"}}).then(function(r){
      if(!r.ok) throw new Error("OpenAlex HTTP "+r.status);
      return r.json();
    }).then(function(j){
      var works = j.results||[];
      if(!works.length) return {found:false, reason:"No OpenAlex author record matches “"+name+"”. This does NOT mean the person doesn't exist — many professors simply have no OpenAlex profile."};
      var fam = familyOf(name), givens = givenTokens(name);
      var best=null, bestScore=-1;
      works.forEach(function(a){
        var an = normName(a.display_name);
        var score = 0;
        if(an===normName(name)) score+=40;
        if(fam && an.split(" ").indexOf(fam)>-1) score+=25;
        givens.forEach(function(g){ if(g.length>1 && an.indexOf(g)===0) score+=10; });
        var aff = ((a.affiliations&&a.affiliations[0]&&a.affiliations[0].institution&&a.affiliations[0].institution.display_name)||"").toLowerCase();
        var kws = instKeywords(institution);
        var instHit = null;
        kws.forEach(function(k){ if(aff.indexOf(k)>-1 && !instHit) instHit=k; });
        if(instHit) score+=20;
        if(score>bestScore){ bestScore=score; best={author:a, aff:aff, instHit:instHit}; }
      });
      if(!best || bestScore<25) return {found:false, best:best&&best.author, reason:"Closest OpenAlex match \u201c"+(best&&best.author.display_name)+"\u201d does not clearly correspond to \u201c"+name+"\u201d at \u201c"+institution+"\u201d."};
      return {
        found:true, score:bestScore, exact: bestScore>=65,
        matchedName: best.author.display_name,
        institutionOnRecord: best.aff || "(no current affiliation listed)",
        instKeywordHit: best.instHit,
        orcid: best.author.orcid ? String(best.author.orcid).replace("https://orcid.org/","") : "",
        works: best.author.works_count||0,
        cited: best.author.cited_by_count||0,
        id: best.author.id||""
      };
    });
  };

  /* ---------- 3. domain ↔ institution consistency ---------- */
  LD.pvDomainCheck = function(email, institution){
    var d = domainOf(email).toLowerCase();
    if(!d) return {ok:false, level:"none", text:"No domain to check."};
    if(FREE_MAIL.indexOf(d)>-1) return {ok:false, level:"free", text:"“"+d+"” is a free-mail provider. Professors rarely use personal mailboxes for official contact — treat this address with suspicion unless it came straight from their own page."};
    var acd = isAcademicDomain(d);
    var kws = instKeywords(institution);
    var domCore = d.replace(/\.(edu|ac\.[a-z]{2,3}|org|de|no|se|dk|fi|nl|uk|us|ca|au|ch|at|fr|it|es|eu)$/,"").replace(/^www\./,"");
    var hit = null;
    kws.forEach(function(k){ if(k.length>=3 && domCore.indexOf(k)>-1 && !hit) hit=k; });
    if(hit) return {ok:true, level:"match", text:"Domain “"+d+"” contains the institution keyword “"+hit+"” — consistent with "+institution+"."};
    if(acd)  return {ok:true, level:"academic", text:"“"+d+"” looks like an academic mail domain. Automatic cross-check against “"+institution+"” isn't possible (e.g. uio.no ↔ University of Oslo) — confirm visually on their directory page."};
    return {ok:false, level:"other", text:"“"+d+"” is neither a recognised academic pattern nor an obvious match for "+institution+". Verify the address on the institution's own site before trusting it."};
  };

  /* ---------- run the whole ladder + render ---------- */
  function row(iconCls, icon, title, detail){
    return '<div class="flex gap-3 items-start rounded-lg border border-slate-200 bg-white p-3">'
      +'<span class="badge '+iconCls+' shrink-0 mt-0.5">'+icon+'</span>'
      +'<div class="min-w-0"><p class="font-bold text-[13px] leading-snug">'+title+'</p>'
      +(detail?'<p class="text-xs text-slate-500 mt-0.5 leading-snug">'+detail+'</p>':'')+'</div></div>';
  }

  LD.runVerification = function(){
    var name=$("vName").value.trim(), inst=$("vInst").value.trim(), email=$("vEmail").value.trim(), src=$("vSource").value.trim();
    var out=$("vResults"), st=$("vStatus"), btn=$("vRunBtn");
    if(!email){ LD.toast("Enter the email address you want to verify.","err"); return; }
    btn.disabled=true; st.textContent="Running checks…";
    out.innerHTML='<p class="text-sm font-semibold text-brand-700">Checking identity (OpenAlex) + DNS/MX (dns.google)…</p>';

    var meta = { sourceUrl:src, sourceName:src||"", captured:new Date().toISOString().slice(0,10) };
    var pIdentity = (name? LD.pvFindAuthor(name, inst||name) : Promise.resolve({found:false,reason:"No name supplied — identity not checked."})).catch(function(e){ return {found:false, error:true, reason:"OpenAlex unreachable ("+(e.message||"network")+") — identity check inconclusive."}; });
    var pLadder = LD.verifyEmailFull(email, meta).catch(function(e){ return {levels:[],best:"invalid",error:e}; });
    var pDomain = Promise.resolve(LD.pvDomainCheck(email, inst));

    Promise.all([pIdentity,pLadder,pDomain]).then(function(res){
      var ident=res[0], lad=res[1], dom=res[2];
      var html="";

      /* verdict first */
      var l1=lad.levels&&lad.levels[0]||{}, l2=lad.levels&&lad.levels[1]||{}, l3=lad.levels&&lad.levels[2]||{};
      var verdict, vcls, vnote;
      if(lad.best==="invalid"){ verdict="Invalid address"; vcls="pv-red"; vnote="Fix the format — nothing else matters until this passes."; }
      else if(ident.found && ident.exact && l3.passed && dom.ok && l2.passed){ verdict="Strong — verified"; vcls="pv-green"; vnote="Identity matched in OpenAlex, address listed on an official page you recorded, domain accepts mail and is consistent with the institution."; }
      else if((ident.found||l2.passed) && l3.passed && dom.ok){ verdict="Likely — good signals"; vcls="pv-blue"; vnote="Most independent checks agree. Mailbox-level delivery is still NOT confirmed (needs a server SMTP session)."; }
      else if(l3.passed || ident.found){ verdict="Weak — partial evidence"; vcls="pv-amber"; vnote="Some evidence exists but key checks are missing. Confirm the address on the professor's own university page before sending anything."; }
      else { verdict="Unverified — do not rely on this"; vcls="pv-red"; vnote="Format may parse, but there is no DNS or identity evidence. Treat as unconfirmed."; }

      html += '<div class="'+vcls+' rounded-xl p-3.5 mb-3 border">'
            + '<p class="font-display font-extrabold text-sm">'+esc(verdict)+'</p>'
            + '<p class="text-xs mt-1 leading-snug">'+esc(vnote)+'</p></div>';

      html += '<div class="space-y-2">';
      /* 1 identity */
      if(ident.found){
        html += row("b-green","✓","Professor identity: matched in OpenAlex",
          "“"+esc(ident.matchedName)+"” · affiliation on record: "+esc(ident.institutionOnRecord)
          +(ident.orcid?' · <a class="underline font-semibold" target="_blank" rel="noopener" href="https://orcid.org/'+esc(ident.orcid)+'">ORCID '+esc(ident.orcid)+"</a>":"")
          +" · "+(ident.works||0)+" works, "+(ident.cited||0)+" citations. Does NOT prove they currently supervise students.");
      } else {
        html += row(ident.error?"b-slate":"b-amber","!","Professor identity: not matched", esc(ident.reason||""));
      }
      /* 2 syntax */
      html += row(l1.passed?"b-green":"b-red", l1.passed?"✓":"✗", "Level 1 · Syntax: "+esc(l1.label||""), esc(l1.detail||""));
      /* 3 official listing */
      html += row(l2.passed?"b-green":"b-slate", l2.passed?"🏫":"—", "Level 2 · Official listing: "+esc(l2.label||""),
        l2.passed? "Source recorded: <a class=\"underline font-semibold\" target=\"_blank\" rel=\"noopener\" href=\""+esc(src)+"\">"+esc(src)+"</a>. A browser cannot read arbitrary university pages (CORS), so this level counts the source YOU recorded — open the link and double-check the name beside the address."
                 : esc(l2.detail||""));
      /* 4 mx */
      html += row(l3.passed?(l3.icon==="~"?"b-amber":"b-blue"):((l3.label||"").indexOf("inconclusive")>-1?"b-slate":"b-red"), esc(l3.icon||"?"), "Level 3 · Domain mail records: "+esc(l3.label||""), esc(l3.detail||""));
      /* 5 mailbox */
      html += row("b-amber","⛔","Level 4 · Mailbox deliverability: NOT confirmed","Confirming a specific mailbox requires an SMTP RCPT handshake from a mail server — impossible from a static site. LetterDesk never guesses this level.");
      /* 6 domain consistency */
      html += row(dom.ok?"b-green":"b-amber", dom.ok?"✓":"!", "Domain ↔ institution consistency", esc(dom.text));
      html += '</div>';

      html += '<p class="mt-3 text-[11px] text-slate-400 leading-snug">Checked '+new Date().toLocaleString()+" · sources: api.openalex.org (author records) · dns.google/resolve (MX/A). Results are advisory: the final confirmation is always the professor's live university profile page.</p>";

      out.innerHTML = html;
      st.textContent = "Done.";
      btn.disabled=false;
    });
  };

  LD.resetVerification = function(){
    ["vName","vInst","vEmail","vSource"].forEach(function(id){ var el=$(id); if(el) el.value=""; });
    $("vStatus").textContent="";
    $("vResults").innerHTML='<p class="text-sm text-slate-400">No check run yet. Fill in the form and press <b>Verify professor &amp; email</b> — results appear here with a combined verdict.</p>';
  };

  LD.goVerify = function(){
    var s=$("verifyTool"); if(!s) return;
    // make sure wizard panels aren't hiding the page bottom
    s.scrollIntoView({behavior:"smooth", block:"start"});
  };
})();
