var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · attachments.js — real file selection & validation ============
   WHAT THIS MODULE DOES (and honestly does not do):

   • Real <input type="file"> selection. Files live as in-memory File objects for the
     current browser session only — they are NEVER uploaded anywhere by LetterDesk and
     are NOT persisted to localStorage (browsers cannot persist File handles).
   • Validation: extension/MIME must be PDF (or image for scans), per-file size limit,
     total-size limit, duplicate detection, missing-file detection after reload.
   • mailto fallback: browsers CANNOT attach files through a mailto: link. The app
     therefore (a) blocks final approval if the draft mentions attachments while none
     are selected, (b) shows the exact selected filenames so you can attach those same
     files in your mail client, and (c) records the state "Awaiting Send Confirmation"
     until you confirm the send manually. This is clearly labelled in the UI — we never
     pretend a mailto link carried the files.
   • Gmail API path (when configured): the selected File objects ARE the payload;
     sendGmail reads them with FileReader → base64url multipart message. If OAuth is
     not configured the panel shows "Direct send: Not Configured".                    */
(function(){
  window.LD = window.LD || {};

  var MAX_FILE_BYTES  = 5 * 1024 * 1024;    // 5 MB per file (Gmail single-attachment practical limit)
  var MAX_TOTAL_BYTES = 20 * 1024 * 1024;   // 20 MB total
  var ALLOWED_EXT     = ["pdf"];
  var ALLOWED_MIME    = ["application/pdf"];

  var sel = [];                              // [{id,name,size,type,file,lastModified}]
  LD._attachments = sel;

  function fmtSize(b){
    if(b==null) return "?";
    if(b<1024) return b+" B";
    if(b<1024*1024) return (b/1024).toFixed(0)+" KB";
    return (b/(1024*1024)).toFixed(2)+" MB";
  }
  LD.fmtSize = fmtSize;

  LD.validateFile = function(f){
    var name = String(f.name||"").toLowerCase();
    var extOk = ALLOWED_EXT.some(function(e){ return name.endsWith("."+e); });
    var mimeOk = !f.type || ALLOWED_MIME.indexOf(f.type)>-1;
    if(!extOk && !mimeOk) return { ok:false, reason:"Only PDF documents can be attached (scans of CV/transcript count as PDF). Got: "+(f.type||"unknown type") };
    if(!extOk && f.type==="") return { ok:false, reason:"Unrecognised file type — convert to PDF first." };
    if(f.size > MAX_FILE_BYTES) return { ok:false, reason:"File is "+fmtSize(f.size)+" — over the "+fmtSize(MAX_FILE_BYTES)+" per-file limit. Compress or split the PDF." };
    if(f.size === 0) return { ok:false, reason:"File is empty (0 bytes) — it would fail to upload." };
    var total = sel.reduce(function(s,x){return s+x.size;},0) + f.size;
    if(total > MAX_TOTAL_BYTES) return { ok:false, reason:"Total attachment size would exceed "+fmtSize(MAX_TOTAL_BYTES)+"." };
    if(sel.some(function(x){ return x.name===f.name && x.size===f.size && x.lastModified===f.lastModified; }))
      return { ok:false, reason:"This exact file is already selected." };
    return { ok:true };
  };

  LD.addAttachmentFiles = function(fileList){
    var added=0, rejected=[];
    Array.prototype.slice.call(fileList||[]).forEach(function(f){
      var v = LD.validateFile(f);
      if(!v.ok){ rejected.push(f.name+": "+v.reason); return; }
      sel.push({ id:"att"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
                 name:f.name, size:f.size, type:f.type||"application/pdf",
                 lastModified:f.lastModified, file:f, addedAt:new Date().toISOString() });
      added++;
    });
    if(window.LD.toast){
      if(added) LD.toast(added+" file"+(added>1?"s":"")+" selected ✓","ok");
      rejected.forEach(function(r){ LD.toast(r,"err"); });
    }
    LD.renderAttachments();
    if(LD.invalidateApproval) LD.invalidateApproval("attachments changed");
    return { added:added, rejected:rejected };
  };

  LD.removeAttachment = function(id){
    var i = sel.findIndex(function(x){return x.id===id;});
    if(i>-1) sel.splice(i,1);
    LD.renderAttachments();
    if(LD.invalidateApproval) LD.invalidateApproval("attachments changed");
  };
  LD.clearAttachments = function(){
    sel.length=0; LD.renderAttachments();
    if(LD.invalidateApproval) LD.invalidateApproval("attachments cleared");
  };

  LD.attachmentNames = function(){ return sel.map(function(x){return x.name;}); };
  LD.attachmentBytes = function(){ return sel.reduce(function(s,x){return s+x.size;},0); };

  /* Cross-check the words used in the draft ("CV", "transcript", …) against selected files. */
  LD.attachmentMismatch = function(draftText){
    var t = String(draftText||"").toLowerCase();
    var mentions = [];
    if(/\bcv\b|curriculum vitae/.test(t)) mentions.push("CV");
    if(/transcript/.test(t)) mentions.push("transcript");
    if(/research statement|statement of research/.test(t)) mentions.push("research statement");
    if(/writing sample/.test(t)) mentions.push("writing sample");
    var names = sel.map(function(x){return x.name.toLowerCase();}).join(" | ");
    var missing = [];
    mentions.forEach(function(m){
      var key = m.toLowerCase().split(" ")[0];        // cv / transcript / research / writing
      if(names.indexOf(key)===-1) missing.push(m);
    });
    return { mentions:mentions, missing:missing, noneSelected:sel.length===0 && mentions.length>0 };
  };

  /* ---------- render into #attachBox (Step 3) ---------- */
  LD.renderAttachments = function(){
    var box=document.getElementById("attachBox"); if(!box) return;
    var listId=document.getElementById("apprAttachList");
    if(listId) listId.textContent = sel.length ? sel.map(function(x){return x.name;}).join(", ") : "— none selected —";
    if(!sel.length){
      box.innerHTML='<p class="text-xs text-slate-400">No files selected. Files chosen here stay in this browser tab only — they are never uploaded or stored by LetterDesk. After a page reload you must re-select them (browser security).</p>';
      return;
    }
    box.innerHTML='<ul class="space-y-1.5">'+sel.map(function(f){
      return '<li class="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">'+
        '<span class="min-w-0 flex items-center gap-2"><span class="shrink-0">📎</span>' +
        '<span class="truncate text-[12px] font-bold" title="'+LD.escapeHtml(f.name)+'">'+LD.escapeHtml(f.name)+'</span>' +
        '<span class="text-[10px] text-slate-400 shrink-0">'+fmtSize(f.size)+' · PDF</span></span>' +
        '<button class="btn-mini !text-[11px] !py-1 text-rose-700" onclick="LD.removeAttachment(\''+f.id+'\')" title="Remove">✕ Remove</button></li>';
    }).join("")+'</ul>'+
    '<p class="mt-1.5 text-[10px] text-slate-400">Total '+fmtSize(LD.attachmentBytes())+' · limits: '+fmtSize(MAX_FILE_BYTES)+'/file, '+fmtSize(MAX_TOTAL_BYTES)+' overall · PDF only.</p>';
  };

  /* read one selected file → base64url string (for Gmail API multipart build) */
  LD.fileToBase64Url = function(att){
    return new Promise(function(resolve,reject){
      if(!att || !att.file) return reject(new Error("File handle lost — re-select the attachment after reloading the page."));
      var fr=new FileReader();
      fr.onload=function(){
        var bin=atob(fr.result.split(",")[1]);
        var out=bin.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
        resolve(out);
      };
      fr.onerror=function(){ reject(new Error("Could not read "+att.name)); };
      fr.readAsDataURL(att.file);
    });
  };
})();
