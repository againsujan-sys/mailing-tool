var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · facts.js — strict fact separation for drafts ============
   Every generated email draws on THREE strictly separated layers, never mixed silently:

     1) VERIFIED FACTS    – professor name/title, university/department, publication
                            title + DOI. Each element is usable only when backed by a
                            source (official profile URL, scholarly API record). The
                            provenance audit (LD.factAudit) reports one row per element
                            of the outreach checklist and flags anything unverified.
     2) USER PROFILE      – degree, institution, percentage, confirmed experience.
                            Quoted VERBATIM from Step 2 fields; missing field ⇒ the
                            email claims nothing about it. Nothing is invented,
                            upgraded or rounded.
     3) GENERATED LANGUAGE – openers/transitions/closings (template or AI). These are
                            boilerplate until proofread; sending stays locked behind
                            explicit user approval (see app.js approval gate).

   Word budget: configurable limit (Settings → word limit, default 180). Recommended
   initial-email band ≈ 120–180 words, counted on the BODY ONLY (subject and
   signature excluded). The limit is a guardrail, not a goal — trimming happens at
   sentence boundaries so clarity is never sacrificed to hit a number.               */
(function(){
  window.LD = window.LD || {};
  var DEFAULT_LIMIT = 180;
  var TARGET_LOW = 120;

  LD.getWordLimit = function(ctx){
    var n = ctx && ctx.opts ? parseInt(ctx.opts.wordLimit,10) : NaN;
    return (n>=60 && n<=400) ? n : DEFAULT_LIMIT;
  };
  LD.TARGET_LOW = TARGET_LOW;
  LD.DEFAULT_LIMIT = DEFAULT_LIMIT;
  LD.MIN_LIMIT = 60;   /* accepted bounds for ctx.opts.wordLimit — keep in sync with LD.getWordLimit */
  LD.MAX_LIMIT = 400;

  /* ---------- body-only word count (excludes subject & signature block) ---------- */
  LD.bodyWords = function(body){
    var b = String(body||"");
    b = b.split(/\n(?:Sincerely|Best regards|Kind regards|With regards)[\s\S]*$/i)[0];
    b = b.replace(/^Dear [^\n]*,\s*\n+/i,"");           // greeting line is not "content"
    return LD.countWords(b);
  };

  /* ---------- sentence-boundary trim (clarity beats the count) ---------- */
  LD.enforceLimitBody = function(text,maxWords){
    var cap = maxWords || DEFAULT_LIMIT;
    if(LD.countWords(text) <= cap) return String(text||"").trim();
    var paras = String(text).trim().split(/\n\n+/);
    var changed = true;
    while(changed && LD.countWords(paras.join("\n\n")) > cap){
      changed = false;
      for(var i=paras.length-1;i>=1;i--){              // never drop the intro paragraph
        var sents = paras[i].split(/(?<=[.!?])\s+/).filter(Boolean);
        if(sents.length>1){ sents.pop(); paras[i]=sents.join(" "); changed=true; break; }
        else if(i>0){ paras.splice(i,1); changed=true; break; }
      }
    }
    var out = paras.join("\n\n");
    if(LD.countWords(out) > cap){                      // last resort: hard cut with clean end
      out = out.trim().split(/\s+/).slice(0,cap).join(" ").replace(/[,;:.]\s*$/,"")+".";
    }
    return out.trim();
  };

  /* ================= PROVENANCE AUDIT — one row per checklist element ================= */
  LD.factAudit = function(ctx){
    var p = ctx.prof || {}, me = ctx.profile || {}, rows = [];
    function row(el,status,detail,action){ rows.push({el:el,status:status,detail:detail,action:action}); }
    var srcUrl = p.profileUrl || "";
    var official = !!srcUrl && /\.edu(\.[a-z]{2})?$|\.ac\.[a-z]{2,3}$|universit|college|eth\b|kth|itu\b|polimi|ucd\.|uib\./i.test(srcUrl);

    /* Professor's name & title — verify against the official university profile */
    if(p.nameVerified === true)
      row("Professor's name & title","ok","Confirmed against "+(p.nameVerifiedSource||"the official university profile page"),"");
    else if(p.title && official)
      row("Professor's name & title","warn","Name + title taken from the linked official page ("+srcUrl+") — open it and confirm the exact current title before sending.","Open the profile link; fix the salutation if the title differs.");
    else if(p.name)
      row("Professor's name & title","warn","Name comes from scholarly APIs ("+((p.sources||[]).join("/")||"unknown")+") — NOT yet checked against the university's own profile page. API titles can be stale or wrong.","Verify on the department faculty page before sending.");
    else
      row("Professor's name & title","fail","No professor selected / no name available.","Go back to Step 1 and select a profile.");

    /* University & department — must match the selected professor's affiliation */
    if(p.uni && p.dept) row("University & department","ok",p.dept+" · "+p.uni+" — affiliation as recorded on this profile.","");
    else if(p.uni) row("University & department","warn","University present ("+p.uni+") but no department on record — the draft omits it instead of guessing.","Add the department from their official page if you want it named.");
    else row("University & department","fail","No affiliation on record — the draft asserts none.","Fill it from the official profile before sending.");

    /* Publication title & DOI — retrieved from a scholarly source, validated link */
    var papers = (p.recentPapers||[]), cited=null;
    for(var i=0;i<papers.length;i++){ if(papers[i]&&papers[i].title&&papers[i].doi){ cited=papers[i]; break; } }
    if(cited){
      var via = cited.source ? "via "+cited.source : "from "+((p.sources||[]).join("/")||"scholarly API");
      row("Publication title & DOI","ok","\u201C"+cited.title+"\u201D — DOI "+cited.doi+" retrieved "+via+". Validated link: https://doi.org/"+cited.doi,"Open the DOI link and read at least the abstract before citing it.");
    } else {
      row("Publication title & DOI","fail","No publication with a resolvable DOI on record — the draft cites NO paper rather than inventing one.","Find a real paper (their group page / Crossref) or delete the reference manually.");
    }

    /* Research connection — actual link explained, not keyword echo */
    var fit=null; try{ fit = LD.computeResearchFit ? LD.computeResearchFit(p,me) : null; }catch(e){}
    if(fit && fit.count>0)
      row("Research connection",(fit.count>=2?"ok":"warn"),"Concrete overlaps used: "+[fit.overlapTerms.slice(0,6).join(", "), fit.sharedTopics.length?("shared topics — "+fit.sharedTopics.join(", ")):"", fit.matchedMethods.length?("matched methods — "+fit.matchedMethods.join(", ")):""].filter(Boolean).join(" · "),"Read the sentence aloud: does it explain WHY the work connects, beyond shared keywords?");
    else
      row("Research connection","fail","No measurable overlap between your topic/skills and this supervisor's listed work — the draft keeps the link minimal instead of faking enthusiasm.","Sharpen your thesis topic/skills in Step 2 or choose a closer supervisor.");

    /* Academic results — exact degree, institution, percentage from the profile */
    var hasRes = !!(me.degree && me.uni), pct = String(me.gpa||"").trim();
    if(hasRes && pct) row("Academic results","ok","Quoted verbatim from your Step 2 profile: "+me.degree+" · "+me.uni+" · \u201C"+pct+"\u201D.","Check the figure matches your official transcript exactly.");
    else if(hasRes) row("Academic results","warn","Degree + institution stated; no grade entered, so none is claimed.","Optional: add the exact class/percentage you can evidence.");
    else row("Academic results","fail","Degree/institution missing — the draft states no academic results.","Complete Step 2.");

    /* Work experience — only items the user confirmed */
    if(me.exp) row("Work experience","warn","\u201C"+String(me.exp).slice(0,140)+(me.exp.length>140?"…":"")+"\u201D is used EXACTLY as you typed it — the generator adds nothing.","Confirm every item happened and you would defend it in an interview.");
    else row("Work experience","ok","Nothing entered → nothing claimed. The draft asserts no experience.","Add experience only if you can confirm it.");

    /* Funding availability — never implied without evidence */
    var lvl = (LD.fundingFromEvidence ? LD.fundingFromEvidence(p) : (p.funding||"none"));
    if(lvl==="confirmed"){
      var ev=(p.fundingEvidence||[])[0]||{};
      row("Funding availability","ok","Evidence-backed: "+(ev.text||"funded position")+(ev.url?(" — "+ev.url+(ev.date?" (captured "+ev.date+")":"")):"")+". The email still only ASKS whether it is open.","Re-check the posting is live on the day you send.");
    } else if(lvl==="partial"){
      row("Funding availability","warn","A related grant/project exists, but student pay is NOT documented. The email asks whether funding could be attached — it implies none exists.","Treat any funding as unconfirmed until the vacancy says otherwise.");
    } else if(lvl==="not-applicable"){
      row("Funding availability","fail","Supervisor confirmed they are NOT accepting students — do not send this email.","Pick another supervisor.");
    } else {
      row("Funding availability","ok","No funding evidence on record → funding appears only as a question; nothing is implied.","Never upgrade the wording to assume a paid position.");
    }

    /* Subject line — MSc / research area / intake */
    var subj = String(ctx.subject||"").toLowerCase(), deg = String(me.degree||"").toLowerCase();
    var degOk = /(msc|master|phd|postdoc)/.test(subj) || !deg;
    var firstWord = String(me.topic||"").split(/\s+/)[0]||"zz";
    var areaOk = subj.indexOf(String(me.field||"zz").toLowerCase())>-1 || subj.indexOf(firstWord.toLowerCase())>-1 ||
                 (p.topics||[]).some(function(t){ return subj.indexOf(t.toLowerCase().split(" ")[0])>-1; });
    var intakeOk = /(20\d\d|fall|spring|summer|intake)/.test(subj) || !(me.intake||"").trim();
    if(degOk && areaOk)
      row("Subject line",(intakeOk?"ok":"warn"),"Degree tag "+(degOk?"✓":"✗")+" · research area "+(areaOk?"✓":"✗")+" · intake "+(intakeOk?"✓":"—")+".","Add the intended intake (e.g. “Fall 2027”) to the subject where useful.");
    else
      row("Subject line","warn","Missing "+[!degOk?"the degree (MSc/PhD)":null,!areaOk?"the research area":null].filter(Boolean).join(" and ")+" — professors triage mail by subject.","Rewrite as: “MSc inquiry — <area> — <intake>”.");

    /* Word count — actual body count vs configurable limit */
    var bw = ctx.bodyWords!=null ? ctx.bodyWords : LD.bodyWords(ctx.body||"");
    var capN = LD.getWordLimit(ctx);
    if(bw>capN) row("Word count","fail","Body is "+bw+" words — over your "+capN+"-word limit (count excludes subject & signature).","Trim whole sentences or raise the limit in Settings if this department expects detail.");
    else if(bw && bw<TARGET_LOW) row("Word count","warn","Body is "+bw+" words — below the ~"+TARGET_LOW+"–"+capN+" band; fine if clear, but consider adding the missing element (paper reference, direction, ask).","Aim ≈"+TARGET_LOW+"–"+capN+" words for the initial email.");
    else row("Word count","ok","Body shows "+bw+" words (excluding subject & signature); limit "+capN+" is configurable in Settings.","");

    /* Attachments — only files that will really be attached */
    var att = String(ctx.attach||"").trim();
    if(!att || /nothing/i.test(att)) row("Attachments","ok","“Nothing attached” selected → the draft references no files and offers materials on request.","If you change your mind, attach the file AND update this selector.");
    else row("Attachments","warn","Draft mentions: "+att+". These exact files must be physically attached before sending — mailto cannot carry attachments.","Attach "+att+" in your mail client right before pressing send.");

    /* Final output gate */
    row("Final output","warn","Generated language (openers/transitions/closings) is boilerplate until YOU proofread it. Sending stays locked until all five approval checks are ticked.","Proofread → verify sources → approve.");
    return rows;
  };
})();
