/* ============ LetterDesk · publish.js — one-click static site export (store-and-forward ZIP, no external libs) ============ */
(function(){
  var LD=(window.LD=window.LD||{});

  /* ---------- CRC32 ---------- */
  var CRC_T = (function(){ var t=new Uint32Array(256); for(var n=0;n<256;n++){ var k=n; for(var b=0;b<8;b++) k=(k&1)?(0xEDB88320^(k>>>1)):(k>>>1); t[n]=k>>>0; } return t; })();
  function crc32(buf){ var c=0xFFFFFFFF; for(var i=0;i<buf.length;i++) c=CRC_T[(c^buf[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }

  /* ---------- ZIP writer (stored / no compression) ---------- */
  function makeZip(files){
    var enc = new TextEncoder(), chunks=[], central=[], offset=0;
    function le16(n){ return [n&255,(n>>8)&255]; }
    function le32(n){ return [n&255,(n>>8)&255,(n>>16)&255,(n>>>24)&255]; }
    files.forEach(function(f){
      var nameB = enc.encode(f.name), dataB = (typeof f.data==="string")?enc.encode(f.data):f.data;
      var crc = crc32(dataB);
      var local = new Uint8Array([].concat(le32(0x04034b50), le16(20), le16(0), le16(0), le16(0), le16(0),
        le32(crc), le32(dataB.length), le32(dataB.length), le16(nameB.length), le16(0)));
      chunks.push(local, nameB, dataB);
      central.push(new Uint8Array([].concat(le32(0x02014b50), le16(20), le16(20), le16(0), le16(0), le16(0), le16(0),
        le32(crc), le32(dataB.length), le32(dataB.length), le16(nameB.length), le16(0), le16(0), le16(0), le16(0), le32(0), le32(offset))));
      central.push(nameB);
      offset += local.length + nameB.length + dataB.length;
    });
    var cdSize = 0; central.forEach(function(c){ cdSize += c.length; });
    var end = new Uint8Array([].concat(le32(0x06054b50), le16(0), le16(0), le16(files.length), le16(files.length), le32(cdSize), le32(offset), le16(0)));
    return new Blob([].concat(chunks, central, [end]), { type:"application/zip" });
  }

  /* ---------- fetch a sibling asset of this page ---------- */
  function get(u){ return fetch(u, {cache:"no-store"}).then(function(r){ if(!r.ok) throw new Error(u+" → HTTP "+r.status); return r.text(); }); }

  LD.copyText = function(text, btn){
    function done(ok){ if(btn){ var o=btn.textContent; btn.textContent = ok?"Copied ✓":"Copy failed"; setTimeout(function(){ btn.textContent=o; },1400); } }
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(function(){done(true);},function(){fallback();}); }
    else fallback();
    function fallback(){ try{ var ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); var ok=document.execCommand("copy"); ta.remove(); done(ok);}catch(e){done(false);} }
  };

  /* ---------- build & download the deployable zip ---------- */
  LD.buildSiteZip = function(){
    var st = document.getElementById("zipStatus"), btn = document.getElementById("btnBuildZip");
    if(!st) return;
    if(btn){ btn.disabled=true; btn.textContent="Packaging…"; }
    st.textContent = "Fetching site files…";
    Promise.all([
      get("index.html"), get("css/styles.css"),
      get("js/data.js"), get("js/search.js"), get("js/draft.js"), get("js/app.js"), get("js/publish.js")
    ]).then(function(parts){
      var readme =
"# LetterDesk — Academic Outreach Studio\n\n" +
"Static site: HTML + Tailwind (CDN) + vanilla JavaScript. No server required.\n\n" +
"## Publish in ~30 seconds (Netlify Drop)\n" +
"1. Unzip this folder.\n" +
"2. Open https://app.netlify.com/drop\n" +
"3. Drag the unzipped folder onto the page → you get a live *.netlify.app URL.\n" +
"   (Temporary without an account; sign in free to keep it permanently.)\n\n" +
"## GitHub Pages\n" +
"Push these files to a repo, then Settings → Pages → Source: Deploy from a branch → main /(root) → Save.\n" +
"Live at https://<username>.github.io/<repo>/\n\n" +
"## Vercel / Cloudflare Pages\n" +
"Import the repo or upload the folder. Framework preset: Other. Output directory: root. No build command.\n\n" +
"## Notes\n" +
"- Add your free Groq API key in ⚙ Settings on the deployed site (stored only in your browser).\n" +
"- Local Template and ChatGPT Prompt Builder modes need no keys at all.\n";
      var files = [
        {name:"letterdesk-site/index.html", data:parts[0]},
        {name:"letterdesk-site/css/styles.css", data:parts[1]},
        {name:"letterdesk-site/js/data.js", data:parts[2]},
        {name:"letterdesk-site/js/search.js", data:parts[3]},
        {name:"letterdesk-site/js/draft.js", data:parts[4]},
        {name:"letterdesk-site/js/app.js", data:parts[5]},
        {name:"letterdesk-site/js/publish.js", data:parts[6]},
        {name:"letterdesk-site/README.md", data:readme}
      ];
      var blob = makeZip(files);
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "letterdesk-site.zip";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 8000);
      st.textContent = "Saved letterdesk-site.zip — drop its folder on Netlify ↓";
      if(window.LD.toast) LD.toast("Site packaged! Unzip it and drag the folder onto Netlify Drop.","ok");
    }).catch(function(err){
      st.textContent = "";
      if(btn){ btn.disabled=false; btn.textContent="⬇ Download Site (.zip)"; }
      var msg = (location.protocol==="file:")
        ? "Browser blocked file packaging on file:// — open via http (python3 -m http.server) or push to GitHub instead."
        : ("Packaging failed: " + err.message);
      if(window.LD.toast) LD.toast(msg,"err"); else alert(msg);
    }).finally(function(){ if(btn && !btn.disabled) btn.textContent="⬇ Download Site (.zip)"; });
  };
})();
