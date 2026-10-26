var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · draft.js — 150-word drafts, cliché filter, local templates, Groq/Llama-3, ChatGPT prompt builder ============ */
(function(){
  window.LD = window.LD || {};
  var WORD_LIMIT = 150;

  /* ---- AI cliché blacklist (filtered from local output + flagged in editor) ---- */
  LD.CLICHES = [
    "i hope this email finds you well","hope this message finds you well","i am writing to express my",
    "deep interest","profound interest","unwavering","delve","delves","delving","game-changer","game changer",
    "cutting-edge","state-of-the-art landscape","it is worth noting","in today's fast-paced world",
    "i am eager to","passionate about contributing","esteemed university","world-renowned",
    "plays a crucial role","plays a pivotal role","shed light","navigate the complexities",
    "a testament to","leverage synergies","seamless","holistic approach","paradigm shift",
    "i am reaching out","attentive consideration","your invaluable guidance","under your esteemed supervision",
    "please do not hesitate","at your earliest convenience","i look forward to hearing from you"
  ];

  LD.countWords = function(t){ t=(t||"").trim(); return t? t.split(/\s+/).length : 0; };

  LD.findCliches = function(text){
    var low = (text||"").toLowerCase();
    var found = [];
    LD.CLICHES.forEach(function(c){ if(low.indexOf(c)>-1) found.push(c); });
    return found;
  };

  LD.stripCliches = function(text){
    var out = text;
    // remove whole cliché sentences
    out = out.split(/(?<=[.!?])\s+/).filter(function(s){
      var low = s.toLowerCase();
      return !LD.CLICHES.some(function(c){ return low.indexOf(c)>-1; });
    }).join(" ");
    // word-level swaps
    out = out.replace(/\bdelv(?:e|es|ing) into\b/gi,"examine")
             .replace(/\bdelve\b/gi,"examine")
             .replace(/\bgame-?changer\b/gi,"strong result")
             .replace(/\bcutting-edge\b/gi,"recent")
             .replace(/\bstate-of-the-art\b/gi,"current best")
             .replace(/\bseamless(?:ly)?\b/gi,"smooth")
             .replace(/\bI am eager to\b/gi,"I would like to")
             .replace(/\bhope this (?:email|message) finds you well\.?\s*/gi,"")
             .replace(/\bI hope this email finds you well\.?\s*/gi,"");
    return out.replace(/\s{2,}/g," ").trim();
  };

  LD.enforceLimit = function(text){
    var words = (text||"").trim().split(/\s+/);
    if(words.length<=WORD_LIMIT) return text.trim();
    // trim sentence-wise until under limit, keeping greeting/signature blocks
    return words.slice(0, WORD_LIMIT).join(" ").replace(/[,;:–—-]\s*$/,"") + ".";
  };

  /* ---- helpers for template engine ---- */
  function pick(arr, seed){ return arr[Math.abs(seed||0) % arr.length]; }
  function hashStr(s){ var h=0; s=String(s||""); for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return h; }
  function lastName(full){ var p=(full||"").replace(/^(prof\.?|dr\.?|assoc\.?|asst\.?)\s*/i,"").trim().split(/\s+/); return p[p.length-1]||"there"; }
  function shortTitle(t){ t=t||""; return t.length>78 ? t.slice(0,75).trim()+"…" : t; }

  /* ================= LOCAL TEMPLATE ENGINE ================= */
  LD.localDraft = function(ctx){
    // ctx: {prof, profile:{name,degree,uni,field,topic,skills[],exp,gpa,english}, tone, ask, attach, opts:{linkedin,scholar,available,startMonth}, variant}
    var p = ctx.prof, me = ctx.profile, v = ctx.variant||0;
    var seed = hashStr(p.name + me.topic + v);
    var ln = lastName(p.name);
    var paper = (p.recentPapers&&p.recentPapers[0])||null;
    var topicPhrase = (me.topic||"").trim() || (me.field||"this area");
    var skills = (me.skills||[]).slice(0,4);
    var skillTxt = skills.length ? skills.join(", ") : "research tooling relevant to this area";
    var commonTopic = "";
    if(p.topics && p.topics.length){
      var tl = topicPhrase.toLowerCase();
      commonTopic = p.topics.filter(function(t){ return tl.indexOf(t)>-1 || t.indexOf(tl.split(" ")[0]||"zz")>-1; })[0] || p.topics[0];
    }

    var openers = [
      "Dear Prof. "+ln+",\n\nI am "+me.name+", a "+(me.degree||"PhD")+" applicant working on "+topicPhrase+".",
      "Dear Prof. "+ln+",\n\nMy name is "+me.name+" and my research focuses on "+topicPhrase+".",
      "Dear Prof. "+ln+",\n\nI hold a "+(me.degree||"graduate")+" background from "+(me.uni||"my university")+" and work on "+topicPhrase+"."
    ];
    var bridge = [];
    if(paper){
      bridge.push("Your "+(paper.year||"recent")+(paper.venue?" "+paper.venue:"")+" paper \u201C"+shortTitle(paper.title)+"\u201D "+(paper.doi?"(DOI: "+paper.doi+") ":"")+"directly informs my thesis.");
      bridge.push("Your work on \u201C"+shortTitle(paper.title)+"\u201D "+(paper.doi?"(DOI "+paper.doi+") ":"")+"is exactly the direction I want to push further.");
      bridge.push("Reading your "+(paper.venue||"recent")+((paper.year)?" "+paper.year:"")+" paper \u201C"+shortTitle(paper.title)+"\u201D "+(paper.doi?"(DOI: "+paper.doi+") ":"")+"shaped my current project.");
    } else if(commonTopic){
      bridge.push("Your group's focus on "+commonTopic+" matches my own work closely.");
    } else {
      bridge.push("Your recent publications align strongly with my research agenda.");
    }
    var value = [
      "With "+skillTxt+", I can contribute from week one.",
      "I bring "+skillTxt+" and prior research experience.",
      "My toolkit ("+skillTxt+") maps directly onto these problems."
    ];
    var expLine = me.exp ? " "+me.exp.split(/[;\n]/)[0].trim().replace(/\.$/,"")+"." : "";
    var asks = {
      "RA position + supervision":"Are you taking funded research assistants for the coming year? I would welcome the chance to join your group as an RA.",
      "TA position":"Are any teaching assistantship positions open for next term? I am prepared to support undergraduate courses alongside my research.",
      "RA + TA combined":"Do you have combined RA/TA funding available? I am happy to split time between research and teaching support.",
      "PhD inquiry / open to advice":"If a funded PhD seat opens in your lab, I would love to apply — or I would value brief advice on fit."
    };
    var closers = [
      "My CV and "+(ctx.attach==="Nothing attached"?"portfolio":(ctx.attach||"CV").toLowerCase())+" are attached. Thank you for your time.",
      "Materials are attached; I would be glad to share more on request. Thanks for considering my note.",
      "Attachments include my "+(ctx.attach||"CV").toLowerCase()+". I appreciate your consideration."
    ];
    var sig = "\n\nSincerely,\n"+me.name;
    if(ctx.opts && ctx.opts.available) sig += "\nAvailable from "+(ctx.opts.startMonth||"Fall 2026")+".";
    if(ctx.opts && ctx.opts.linkedin && me.linkedin) sig += "\nLinkedIn: "+me.linkedin;
    if(ctx.opts && ctx.opts.scholar && me.scholar) sig += "\nScholar: "+me.scholar;

    var body = [pick(openers,seed), pick(bridge,seed+1)+expLine, pick(value,seed+2), picks(asks,v), pick(closers,seed+3)].join("\n\n")+sig;
    // tone tweaks
    if(ctx.tone==="Formal academic") body = body.replace(/Thanks/g,"Thank you").replace(/love to/g,"would be honored to");
    if(ctx.tone==="Direct & technical") body = body.replace(/I would welcome the chance to/g,"I would like to");
    if(ctx.tone==="Warm & collaborative") body = body.replace(/directly informs my thesis/,"fits naturally with my thesis");

    body = LD.stripCliches(body);
    body = LD.enforceLimit(body);
    var subjT = commonTopic || topicPhrase.split(/\s+/).slice(0,4).join(" ");
    var subjects = [
      "Prospective "+(me.degree==="Postdoc"?"postdoc":"graduate researcher")+" — "+cap(subjT)+" — RA inquiry",
      cap(topicPhrase.split(/\s+/).slice(0,5).join(" "))+": interested in joining your group (funded RA)",
      "RA/TA application inquiry — "+me.name+" ("+cap(subjT)+")"
    ];
    return { subject: pick(subjects, seed+7), body: body, words: LD.countWords(body), cliches: LD.findCliches(body) };
  };
  function picks(o,v){ var k=Object.keys(o); return o[k[Math.abs(Math.round(v||0))%k.length]]; }
  function cap(s){ s=String(s||""); return s.charAt(0).toUpperCase()+s.slice(1); }

  /* ================= CHATGPT PROMPT BUILDER ================= */
  LD.buildMegaPrompt = function(ctx){
    var p = ctx.prof, me = ctx.profile;
    var papers = (p.recentPapers||[]).slice(0,3).map(function(x){ return "- \""+x.title+"\" ("+(x.venue||"n/a")+", "+(x.year||"")+") DOI: "+(x.doi||"n/a")+", cited by "+(x.cited||0); }).join("\n");
    return [
      "You are an admissions-savvy academic mentor. Write ONE outreach email from me to a professor to ask about a funded position.",
      "",
      "HARD RULES:",
      "1. STRICTLY under 150 words (body only, excluding subject and signature).",
      "2. Ban these phrases entirely: \"" + LD.CLICHES.slice(0,12).join('", "') + "\" and similar filler.",
      "3. Cite exactly one of their real papers below with its DOI — no invented facts.",
      "4. One specific sentence connecting MY background to THAT paper.",
      "5. End with a single clear question (the ask) and reference attachments.",
      "6. Tone: "+ctx.tone+". Subject line max 8 words.",
      "",
      "=== THEIR PROFILE ===",
      "Name: "+p.name+" | "+(p.title||"Faculty")+" | "+(p.dept||"")+" "+p.uni,
      "Topics: "+(p.topics||[]).join(", "),
      "Recent papers:\n"+papers,
      "",
      "=== MY PROFILE ===",
      "Name: "+me.name+" | Target: "+(me.degree||"PhD")+" | Seeking: "+ctx.ask,
      "University: "+(me.uni||"-")+" | Field: "+(me.field||"-"),
      "Thesis/interest: "+(me.topic||"-"),
      "Skills: "+((me.skills||[]).join(", ")||"-"),
      "Experience: "+(me.exp||"-"),
      (me.gpa?"GPA: "+me.gpa+"\n":"")+(me.english?"English test: "+me.english+"\n":""),
      "Attachments: "+ctx.attach+(ctx.opts.available?", available "+(ctx.opts.startMonth||"Fall 2026"):""),
      "",
      "Output format:",
      "SUBJECT: <line>",
      "BODY: <email>",
      "WORD COUNT: <number>"
    ].join("\n");
  };

  /* ================= GROQ / LLAMA 3 ================= */
  LD.groqDraft = function(ctx, apiKey, model){
    var prompt = LD.buildMegaPrompt(ctx);
    return fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+apiKey },
      body: JSON.stringify({
        model: model || "llama-3.3-70b-versatile",
        temperature: 0.55,
        max_tokens: 700,
        messages:[
          {role:"system", content:"You write concise, human-sounding academic outreach emails under 150 words. Never use flowery AI clichés."},
          {role:"user", content: prompt}
        ]
      })
    }).then(function(r){
      if(!r.ok){ return r.json().catch(function(){return {};}).then(function(j){ throw new Error((j.error&&j.error.message)||("Groq HTTP "+r.status)); }); }
      return r.json();
    }).then(function(j){
      var txt = (((j.choices||[])[0]||{}).message||{}).content || "";
      var m = txt.match(/SUBJECT:\s*(.+)\n[\s\S]*?BODY:\s*([\s\S]+?)(?:\n\s*WORD COUNT[\s\S]*)?$/i);
      var subject, body;
      if(m){ subject=m[1].trim(); body=m[2].trim(); }
      else {
        var lines = txt.split("\n").filter(Boolean);
        subject = lines[0] && lines[0].length<90 ? lines[0] : "Prospective graduate researcher — "+((ctx.prof.topics||["research"])[0]);
        body = lines.slice(subject===lines[0]?1:0).join("\n").replace(/^BODY:\s*/i,"").trim();
      }
      body = LD.stripCliches(body);
      body = LD.enforceLimit(body);
      if(LD.countWords(body)>WORD_LIMIT) throw new Error("AI output exceeded 150 words after trimming");
      return { subject:subject, body:body, words:LD.countWords(body), cliches:LD.findCliches(body), engine:"groq/"+(model||"llama-3.3-70b-versatile") };
    });
  };
})();
