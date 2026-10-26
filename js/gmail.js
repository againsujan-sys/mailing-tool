var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · gmail.js — Gmail API direct send (OAuth 2.0, PKCE) ============

   SECURITY MODEL — read before configuring:
   • This is a STATIC site (GitHub Pages). OAuth client SECRETS must NEVER be placed in
     frontend source; Google's "Web application" client type requires a secret and is
     therefore UNSUITABLE here. Use an "Android"/"iOS" style client (PKCE makes the flow
     safe without a secret) OR, better, route token exchange through a small backend /
     serverless proxy (see backend/ folder + .env.example).
   • The Client ID is public by design (it identifies the app, not a secret). Access
     tokens live only in this browser tab's memory (+ optional sessionStorage for the
     current session). Refresh tokens are NOT stored unless you deliberately enable the
     backend flow, which keeps them server-side.
   • Scopes: the MINIMAL set only — "https://www.googleapis.com/auth/gmail.send".
     Nothing else is ever requested. Disconnect clears every token immediately.

   STATUS WITHOUT CONFIGURATION: LD.gmail.configured() returns false, the UI shows
   "Direct send: Not Configured", and the mailto fallback stays available. No fake
   success is ever reported.                                                          */
(function(){
  window.LD = window.LD || {};
  var SCOPE = "https://www.googleapis.com/auth/gmail.send";
  var LS_CLIENT = "ld_gmail_client_id";      // public client ID (user-entered in Settings)
  var TOKEN_KEY = "ld_gmail_token";          // sessionStorage — cleared on disconnect/tab close
  var stateMem = null;                        // CSRF/state + PKCE verifier for THIS flow

  function b64url(buf){
    var s = String.fromCharCode.apply(null, new Uint8Array(buf));
    return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  }
  function randStr(n){
    var a = new Uint8Array(n); crypto.getRandomValues(a);
    return b64url(a.buffer).slice(0,n);
  }
  async function sha256(str){
    return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)));
  }

  var G = LD.gmail = {};
  G.clientId = function(){ return localStorage.getItem(LS_CLIENT)||""; };
  G.setClientId = function(v){ v=String(v||"").trim(); if(v) localStorage.setItem(LS_CLIENT,v); else localStorage.removeItem(LS_CLIENT); };
  G.clearKey = function(){ localStorage.removeItem(LS_CLIENT); };
  G.configured = function(){ return !!G.clientId() && typeof crypto!=="undefined" && !!crypto.subtle; };
  G.token = function(){ try{ return JSON.parse(sessionStorage.getItem(TOKEN_KEY)); }catch(e){ return null; } };
  G.connected = function(){
    var t=G.token();
    return !!(t && t.access_token && (!t.expires_at || t.expires_at > Date.now()+30000));
  };
  G.account = function(){ return G.connected() ? (G.token().email||"(connected)") : null; };

  /* ---------- connect (authorization-code + PKCE, implicit-free) ---------- */
  G.connect = async function(){
    if(!G.configured()) throw new Error("No OAuth Client ID configured (⚙ Settings → Connected accounts).");
    if(!location.origin || location.origin==="null") throw new Error("OAuth needs an http(s) origin — run via GitHub Pages or a local http server.");
    var verifier = randStr(64), challenge = await sha256(verifier);
    stateMem = { state: randStr(16), verifier: verifier, ts: Date.now() };
    sessionStorage.setItem("ld_gmail_flow", JSON.stringify(stateMem));
    var p = new URLSearchParams({
      client_id: G.clientId(), response_type:"code", redirect_uri: location.origin + location.pathname,
      scope: SCOPE, code_challenge: challenge, code_challenge_method:"S256",
      state: stateMem.state, access_type:"online", prompt:"consent", include_granted_scopes:"true"
    });
    location.assign("https://accounts.google.com/o/oauth2/v2/auth?"+p.toString());
  };

  /* handle ?code=...&state=... on load — called from app bootstrap */
  G.handleCallback = async function(){
    var q = new URLSearchParams(location.search);
    var code = q.get("code"), state = q.get("state"), err = q.get("error");
    if(err){ sessionStorage.removeItem("ld_gmail_flow"); history.replaceState({}, "", location.pathname); throw new Error("Google authorization refused: "+err); }
    if(!code) return false;
    var flow = null; try{ flow = JSON.parse(sessionStorage.getItem("ld_gmail_flow")); }catch(e){}
    sessionStorage.removeItem("ld_gmail_flow");
    history.replaceState({}, "", location.pathname);            // scrub code from URL bar
    if(!flow || flow.state!==state) throw new Error("OAuth state mismatch — possible CSRF; authorization discarded.");
    var body = new URLSearchParams({
      client_id: G.clientId(), grant_type:"authorization_code",
      redirect_uri: location.origin + location.pathname,
      code: code, code_verifier: flow.verifier
    });
    var r = await fetch("https://oauth2.googleapis.com/token", { method:"POST", body: body, headers:{ "Content-Type":"application/x-www-form-urlencoded" }});
    var j = await r.json().catch(function(){ return {}; });
    if(!r.ok || !j.access_token) throw new Error("Token exchange failed: "+(j.error_description||j.error||("HTTP "+r.status))+
      " — public clients created as 'Web application' cannot exchange tokens without a secret; use a PKCE-safe client type or the bundled backend proxy.");
    j.expires_at = Date.now() + (j.expires_in||3500)*1000;
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(j));
    return true;
  };

  G.disconnect = function(){
    sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem("ld_gmail_flow");
    var t = G.token();
    // best-effort server revocation happens only while a token still exists
    if(t && t.access_token){ fetch("https://oauth2.googleapis.com/revoke?token="+encodeURIComponent(t.access_token), {method:"POST"}).catch(function(){}); }
  };

  /* ---------- build RFC-2822 multipart message with real attachments ---------- */
  G.buildMessage = function(o){
    // o: {from,to,subject,bodyText,attachments:[{name,mime,b64url}]}
    var boundary = "ldbnd"+Math.random().toString(36).slice(2);
    var headers = [
      "From: "+(o.from||"me"),
      "To: "+o.to,
      "Subject: =?UTF-8?B?"+btoa(unescape(encodeURIComponent(o.subject||"")))+"?=",
      "Date: "+new Date().toUTCString(),
      "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="'+boundary+'"'
    ];
    var b64body = btoa(unescape(encodeURIComponent(o.bodyText||""))).replace(/(.{76})/g,"$1\r\n");
    var msg = headers.join("\r\n") + "\r\n\r\n" +
      "Content-Type: text/plain; charset=UTF-8\r\n" +
      "Content-Transfer-Encoding: base64\r\n\r\n" + b64body + "\r\n";
    (o.attachments||[]).forEach(function(a){
      msg += "--"+boundary+"\r\n" +
        "Content-Type: "+(a.mime||"application/pdf")+"; name=\""+a.name+"\"\r\n" +
        "Content-Transfer-Encoding: base64\r\n" +
        "Content-Disposition: attachment; filename=\""+a.name+"\"\r\n\r\n" +
        String(a.b64url).replace(/-/g,"+").replace(/_/g,"/") + "\r\n";
    });
    msg += "--"+boundary+"--\r\n";
    // re-encode whole message base64url for the API raw field
    var bytes = new TextEncoder().encode(msg);
    var bin=""; for(var i=0;i<bytes.length;i++) bin+=String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  };

  /* ---------- send with duplicate protection ---------- */
  var inflight = {};   // hash -> true while POST running
  var sentHashes = {}; // persistent per-session guard {hash: {at, id}}
  G._sentLog = sentHashes;

  function hashStr(s){ var h=0; for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0; } return String(h>>>0); }

  G.send = async function(o){
    if(!G.connected()) throw new Error("Not connected — connect your Gmail account first (⚙ Settings → Connected accounts).");
    if(!o.to || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(o.to)) throw new Error("Invalid recipient address — nothing was sent.");
    var key = hashStr([o.to,o.subject,o.bodyText,(o.attachments||[]).map(function(a){return a.name+a.size||"";}).join(",")].join("|"));
    if(inflight[key]) throw new Error("A send for this exact message is already in progress — please wait.");
    if(sentHashes[key]) throw new Error("DUPLICATE BLOCKED: this exact message was already sent at "+new Date(sentHashes[key].at).toLocaleTimeString()+" (Gmail id "+sentHashes[key].id+"). Edit the message or clear the send lock in Settings to intentionally resend.");
    inflight[key]=true;
    try{
      var raw = G.buildMessage(o);
      var r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method:"POST",
        headers:{ Authorization:"Bearer "+G.token().access_token, "Content-Type":"application/json" },
        body: JSON.stringify({ raw: raw })
      });
      var j = await r.json().catch(function(){ return {}; });
      if(!r.ok || !j.id){
        var m = (j.error && (j.error.message||j.error.description)) || ("Gmail HTTP "+r.status);
        if(r.status===401){ sessionStorage.removeItem(TOKEN_KEY); m += " (token expired — reconnect the account)"; }
        throw new Error(m);
      }
      sentHashes[key] = { at: Date.now(), id:j.id, threadId:j.threadId||"" };
      return { ok:true, messageId:j.id, threadId:j.threadId||"", labelIds:j.labelIds||[] };
    } finally { delete inflight[key]; }
  };

  /* force-clear the duplicate-send lock (explicit user action) */
  G.clearSendLock = function(){ sentHashes = {}; G._sentLog = sentHashes; LD.gmail._sentLog = sentHashes; };
})();
