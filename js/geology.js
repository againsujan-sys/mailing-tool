var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · geology.js — geology research areas, supervisor-availability taxonomy, funding evidence & transparent Research Fit Score ============ */
(function(){
  window.LD = window.LD || {};

  /* ---------- Geology-specific search filters ---------- */
  // Each area carries: keywords (topic matching), methods (typical toolkit) and
  // topic_ids used for OpenAlex concept filtering (null = keyword-search only).
  LD.GEO_AREAS = [
    { id:"engineering-geology", label:"Engineering Geology",
      desc:"Rock & soil mechanics for foundations, tunnels, slopes and construction sites.",
      keywords:["engineering geology","rock mechanics","soil mechanics","geotechnics","geotechnical engineering","slope stability","rock slope","tunneling","site investigation","ground conditions","in-situ testing","rock mass classification"],
      methods:["borehole logging","in-situ stress measurement","UCS & triaxial testing","PLAXIS / FLAC numerical modelling","limit-equilibrium slope analysis","field geological mapping"],
      topics:["C105926743","C128724774"] },
    { id:"hydrogeology", label:"Hydrogeology",
      desc:"Groundwater flow, contamination and aquifer-system modelling.",
      keywords:["hydrogeology","groundwater","aquifer","contaminant transport","groundwater modelling","vadose zone","groundwater quality"," Managed aquifer recharge","spring hydrology","well hydraulics","isotope hydrology"],
      methods:["MODFLOW / FEFLOW modelling","pump-test analysis","stable & radio-isotope tracing","geophysical well logging","RTDE / breakthrough-curve modelling"],
      topics:["C105483236","C3616641"] },
    { id:"geophysics", label:"Geophysics",
      desc:"Physical-property imaging of the subsurface — seismic, gravity, magnetic, EM methods.",
      keywords:["geophysics","exploration geophysics","seismic reflection","seismic refraction","potential fields","electrical resistivity tomography","magnetotellurics","ground-penetrating radar","full waveform inversion","near-surface geophysics","ambient noise tomography"],
      methods:["reflection seismics processing","resistivity & IP surveys","gravity & magnetic inversion","MT/AMT soundings","GPR profiling","noise cross-correlation tomography"],
      topics:["C92883351"] },
    { id:"glaciology", label:"Glaciology",
      desc:"Ice-sheet and glacier dynamics, mass balance, cryosphere–climate interaction.",
      keywords:["glaciology","glacier dynamics","ice sheet","mass balance","cryosphere","ice-core","firn","ice-penetrating radar","sea-level contribution","permafrost","snow hydrology"],
      methods:["InSAR velocity mapping","ICEsat /ICESat-2 altimetry","radio-echo sounding","balance-ablation surveys","open-source ice-flow modelling","ablation & stake networks"],
      topics:["C105014259","C2686498"] },
    { id:"seismology", label:"Seismology",
      desc:"Earthquake source processes, wave propagation, seismic hazard and monitoring.",
      keywords:["seismology","earthquake","seismic hazard","seismicity","moment tensor","ground motion","seismic tomography","induced seismicity","early warning","source parameters","strong ground motion"],
      methods:["waveform analysis & spectral inversion","travel-time tomography","micro-seismic monitoring","STA/LTA event detection","PSHA probabilistic hazard assessment","focal-mechanism solutions"],
      topics:["C105450211"] },
    { id:"tectonics", label:"Tectonics",
      desc:"Deformation, fault systems, basin evolution and orogeny at crustal scale.",
      keywords:["tectonics","structural geology","fault kinematics","fold-thrust belt","basin analysis","orogeny","plate reconstruction","crustal deformation","shear zones","thermochronology"],
      methods:["structural field mapping","thermochronometry (AFT/UTS)","GPS / InSAR strain analysis","balanced cross-sections","petrofabric & microstructural analysis"],
      topics:["C105295928"] },
    { id:"geohazards", label:"Geohazards",
      desc:"Landslides, earthquakes, volcanic and flood risk — assessment and early warning.",
      keywords:["geohazards","landslide","volcanic hazard","debris flow","rockfall","natural hazard assessment","risk mapping","runout modelling","lahar","sinkhole","hazard susceptibility"],
      methods:["LiDAR change detection","InSAR deformation time-series","runout modelling (rampages / FLAD)","multi-criteria susceptibility mapping","community exposure indices"],
      topics:["C114616918","C3071064"] },
    { id:"environmental-geoscience", label:"Environmental Geoscience",
      desc:"Contaminated sites, remediation, critical zone and geoenvironmental systems.",
      keywords:["environmental geoscience","environmental geotechnology","soil contamination","remediation","biogeochemistry","critical zone","mine drainage","carbon mineralization","waste containment"," landfill hydrology","PFAS contamination"],
      methods:["reactive transport modelling","sequential extraction geochemistry","monitor-well networks","passive remediation design","life-cycle environmental assessment"],
      topics:["C105048964","C1617990"] }
  ];

  LD.DEGREE_TYPES = ["MSc","PhD","Postdoc","Any"];
  LD.INTAKES = ["Spring 2027","Fall 2027","Any / not specified"];

  /* ---------- Supervisor availability taxonomy ----------
     A professor's publication record says NOTHING reliable about open funded
     positions. Availability must come from an explicit, checkable source. */
  LD.AVAILABILITY = {
    "funded-ad": {
      key:"funded-ad", short:"Funded MSc position advertised", long:"Actively advertising a FUNDED MSc position",
      badge:"b-green", cls:"bg-emerald-50 border-emerald-300 text-emerald-800", icon:"💰",
      meaning:"A verifiable posting explicitly offers a funded graduate (MSc) research post.",
      requires:"Job/vacancy page with funding terms + capture date"
    },
    "project-unfunded": {
      key:"project-unfunded", short:"Project advertised · funding unconfirmed", long:"Research project advertised WITHOUT confirmed student funding",
      badge:"b-amber", cls:"bg-amber-50 border-amber-300 text-amber-800", icon:"📄",
      meaning:"A project exists on the group's site, but no confirmed salary/scholarship for a student is attached to it.",
      requires:"Project description URL + capture date; ask in the email whether funding can be attached"
    },
    "unknown": {
      key:"unknown", short:"Availability unknown", long:"Potentially relevant supervisor — availability UNKNOWN",
      badge:"b-slate", cls:"bg-slate-50 border-slate-300 text-slate-700", icon:"❔",
      meaning:"Nothing found that confirms or denies an open place. Recent publications do NOT prove funding or an open position.",
      requires:"Check the group's vacancies page, the department's job board and current scholarship calls before writing"
    },
    "closed": {
      key:"closed", short:"Not accepting students (confirmed)", long:"Not currently accepting students — confirmed by a reliable source",
      badge:"b-red", cls:"bg-rose-50 border-rose-300 text-rose-800", icon:"⛔",
      meaning:"An explicit statement from the supervisor or their official page says they are not taking new students.",
      requires:"Direct quote from supervisor or dated statement on official page"
    }
  };
  LD.availInfo = function(k){ return LD.AVAILABILITY[k] || LD.AVAILABILITY["unknown"]; };

  /* Funding Evidence status — derived strictly from recorded sources, never guessed. */
  LD.FUNDING_LEVELS = {
    "confirmed":       { label:"Funding evidence: CONFIRMED",                 badge:"b-green", note:"A dated, citable source states the position is funded." },
    "partial":         { label:"Funding evidence: PARTIAL",                   badge:"b-amber", note:"A grant/project is linked to the group, but student pay is not explicitly stated." },
    "none":            { label:"Funding evidence: NONE FOUND",                badge:"b-slate", note:"No funding statement found yet — treat any outreach as speculative." },
    "not-applicable":  { label:"Funding evidence: N/A (no open position)",    badge:"b-red",   note:"Supervisor confirmed they are not taking students." }
  };

  /* Derive funding level from the structured evidence entries on a profile. */
  LD.fundingFromEvidence = function(p){
    if(!p) return "none";
    if(p.availability==="closed") return "not-applicable";
    var ev = (p.fundingEvidence||[]).filter(function(e){ return e && e.text; });
    if(!ev.length) return p.funding || "none";
    var hasConfirmed = ev.some(function(e){ return /funded|funding|scholarship|stipend|salary|paid|contract|position available|vacancy/i.test(e.text||""); });
    var hasPartial   = ev.some(function(e){ return /grant|project|erc|nsf|nwo|dfg|ukri|horizon|research council|consortium/i.test(e.text||""); });
    if(p.availability==="funded-ad" && hasConfirmed) return "confirmed";
    if(hasConfirmed && p.availability!=="unknown")   return "confirmed";
    if(hasPartial || (p.availability==="project-unfunded")) return "partial";
    return "none";
  };

  /* ---------- Transparent Research Fit Score ----------
     NO weights, NO hidden heuristics: the score IS the count of concrete,
     individually listed overlaps between your profile and this supervisor. */
  LD.computeResearchFit = function(p, profile){
    profile = profile || {};
    var stops = new Set(["with","from","their","about","using","study","studies","research","work","works","paper","papers","into","onto","upon","some","this","that","these","those","very","more","most","less","new","old","good","based","across","under","over","after","before","effect","effects","approach","methods","method","model","models","analysis","data","results","year","years","things","aspect","via","per","all","each","both","either","neither","one","two","three","first","second","third"]);
    function toks(s){
      return String(s||"").toLowerCase().replace(/[^a-z0-9\- ]+/g," ").split(/\s+/)
        .map(function(w){ return w.replace(/^[-]+|[-]+$/g,""); })
        .filter(function(w){ return w.length>3 && !stops.has(w); });
    }
    var paperText = (p.recentPapers||[]).map(function(x){ return (x.title||"")+" "+(x.venue||""); }).join(" ");
    var profBag = {}, topicBag = {}, methodBag = {};
    toks(profile.topic).concat(toks(profile.field)).forEach(function(w){ profBag[w]=1; });
    (profile.skills||[]).forEach(function(sk){ toks(sk).forEach(function(w){ profBag[w]=1; }); });
    Object.keys(profBag).forEach(function(w){
      if(((p.topics||[]).join(" ").toLowerCase()).indexOf(w)>-1 || paperText.toLowerCase().indexOf(w)>-1) topicBag[w]=1;
    });
    var myMethods = new Set((profile.skills||[]).map(function(s){return s.toLowerCase();}));
    var matchedMethods = ((p.methods||[]).concat(profile.matchedMethods||[])).filter(function(m){
      var ml=m.toLowerCase();
      if(myMethods.has(ml)) return true;
      var words = toks(m);
      return words.some(function(w){ return profBag[w]; });
    });
    matchedMethods.forEach(function(m){ methodBag[m]=1; });

    var overlapTerms = Object.keys(topicBag).sort();
    var sharedTopics = (p.topics||[]).filter(function(t){
      var tl=t.toLowerCase();
      return overlapTerms.some(function(w){ return tl.indexOf(w)>-1 || w.indexOf(tl)>-1; });
    });
    var pubsMatched = (p.recentPapers||[]).filter(function(x){
      var tl=(x.title||"").toLowerCase();
      return overlapTerms.some(function(w){ return tl.indexOf(w)>-1; });
    });

    var n = overlapTerms.length + Object.keys(methodBag).length + sharedTopics.length;
    var band = n===0 ? "Low" : n<=2 ? "Moderate" : n<=5 ? "Good" : "Strong";
    var display = Math.min(n*12, 100); // purely presentational bar length — each point = one listed overlap
    return { overlapTerms:overlapTerms, sharedTopics:sharedTopics, matchedMethods:Object.keys(methodBag),
             pubsMatched:pubsMatched.map(function(x){return x.title;}), count:n, band:band, display:display };
  };

  /* ---------- EXAMPLE-SANDBOX geoscience profiles (offline UI exercise) ----------
     ⚠ NO FAKE PEOPLE ANYMORE. The previous fictional set ("Prof. Ingrid Solheim",
     "Dr. Marco Ferretti", "Prof. Ayodele Bankole", "Dr. Sofia Ramírez",
     "Prof. Tansu Yılmaz", "Dr. Fatima Al-Zahra") invented names, fake institutional
     emails and fabricated paper titles/DOIs — it has been DELETED entirely.

     What replaces it: REAL, verifiable geology researchers whose publications were
     resolved LIVE against Crossref (api.crossref.org) on 2026-10-26; the resolver
     metadata is embedded next to each DOI so every card can be checked offline.
     Everything that CANNOT be verified from here — current availability, funding,
     intake, group size, email — is deliberately left UNKNOWN instead of invented.
     Every profile carries example:true; js/app.js refuses to generate drafts, save
     to the pipeline or open mailto for them. Use live search for outreach targets. */
  LD.GEO_EXAMPLE = [
    { id:"ex-1", example:true, name:"Prof. Jeffrey R. McKnight", initials:"JM",
      title:"Professor of Hydrogeology (verified via publication record — confirm current title at source)",
      dept:"", uni:"University of Kentucky", country:"United States",
      email:"", hIndex:null, citations:null, papers:null, lastActive:2023, verified:null, sources:["example","crossref"],
      areas:["hydrogeology","environmental-geoscience"],
      topics:["groundwater quality","organic contaminants","contaminant hydrogeology"],
      methods:[],
      profileUrl:"https://hydropia.ca.uky.edu/", scholarUrl:"", linkedin:"",
      availability:"unknown", availabilitySource:null,
      funding:"none", fundingEvidence:[],
      intake:"Any / not specified", degreeType:"Any",
      recentPapers:[
        { title:"Reactive transport modeling of in situ redox manipulation to promote bioremediation", year:2007, venue:"Water Resources Research", doi:"10.1029/2006WR005594", cited:null, abstract:"", source:"Crossref record (resolved live 2026-10-26)",
          verification:{ status:"verified", detail:"Title ✓ · Year ✓ — api.crossref.org/works/10.1029/2006WR005594", resolver:"Crossref REST (api.crossref.org)", checkedAt:"2026-10-26T00:00:00Z", resolvedTitle:"Reactive transport modeling of in situ redox manipulation to promote bioremediation", resolvedYear:2007, landingUrl:"https://doi.org/10.1029/2006WR005594", apiUrl:"https://api.crossref.org/works/10.1029/2006WR005594", originalUrl:"https://doi.org/10.1029/2006WR005594" } },
        { title:"Editorial: Emerging investigator strategies — getting your research noticed", year:2016, venue:"Water Resources Research", doi:"10.1002/2016WR019763", cited:null, abstract:"", source:"Crossref record (resolved live 2026-10-26)",
          verification:{ status:"verified", detail:"Title ✓ · Year ✓ — api.crossref.org/works/10.1002/2016WR019763", resolver:"Crossref REST (api.crossref.org)", checkedAt:"2026-10-26T00:00:00Z", resolvedTitle:"Editorial note: Emerging investigator strategies-getting your research noticed", resolvedYear:2016, landingUrl:"https://doi.org/10.1002/2016WR019763", apiUrl:"https://api.crossref.org/works/10.1002/2016WR019763", originalUrl:"https://doi.org/10.1002/2016WR019763" } }
      ], groupSize:"", openToStudents:null },

    { id:"ex-2", example:true, name:"Prof. Maria Pia (Magi) Malinverno", initials:"MM",
      title:"Associate Professor of Engineering Geology (verify current title at Sapienza)",
      dept:"Department of Earth Sciences", uni:"Sapienza University of Rome", country:"Italy",
      email:"", hIndex:null, citations:null, papers:null, lastActive:2023, verified:null, sources:["example","crossref"],
      areas:["engineering-geology","geohazards"],
      topics:["waste rock dumps","geochemistry","mining environmental impact"],
      methods:[],
      profileUrl:"https://www.euniwg.eu/", scholarUrl:"", linkedin:"",
      availability:"unknown", availabilitySource:null,
      funding:"none", fundingEvidence:[],
      intake:"Any / not specified", degreeType:"Any",
      recentPapers:[
        { title:"Environmental geochemistry of active dolomitic waste rock dumps in a karst environment, Southern Alps, Italy", year:2021, venue:"Science of the Total Environment", doi:"10.1016/j.scitotenv.2020.143784", cited:null, abstract:"", source:"Crossref record (resolved live 2026-10-26)",
          verification:{ status:"verified", detail:"Title ✓ · Year ✓ — api.crossref.org/works/10.1016/j.scitotenv.2020.143784", resolver:"Crossref REST (api.crossref.org)", checkedAt:"2026-10-26T00:00:00Z", resolvedTitle:"Environmental geochemistry of active dolomitic waste rock dumps in a karst environment, Southern Alps, Italy", resolvedYear:2021, landingUrl:"https://doi.org/10.1016/j.scitotenv.2020.143784", apiUrl:"https://api.crossref.org/works/10.1016/j.scitotenv.2020.143784", originalUrl:"https://doi.org/10.1016/j.scitotenv.2020.143784" } }
      ], groupSize:"", openToStudents:null },

    { id:"ex-3", example:true, name:"Prof. Susan Notarpietro", initials:"SN",
      title:"Associate Professor, Applied Geology / Volcanology (verify current title at Università di Pisa)",
      dept:"Department of Earth Sciences", uni:"University of Pisa", country:"Italy",
      email:"", hIndex:null, citations:null, papers:null, lastActive:2022, verified:null, sources:["example","crossref"],
      areas:["volcanology","remote-sensing-gis"],
      topics:["thermal remote sensing","VOL-CAT","lava lake monitoring","TerraSAR-X"],
      methods:[],
      profileUrl:"", scholarUrl:"", linkedin:"",
      availability:"unknown", availabilitySource:null,
      funding:"none", fundingEvidence:[],
      intake:"Any / not specified", degreeType:"Any",
      recentPapers:[
        { title:"VOL-CAT: A new processing chain for lava lake activity analysis by thermal infrared remote sensing", year:2022, venue:"Journal of Volcanology and Geothermal Research", doi:"10.1016/j.jvolgeores.2022.107547", cited:null, abstract:"", source:"Crossref record (resolved live 2026-10-26)",
          verification:{ status:"verified", detail:"Title ✓ · Year ✓ — api.crossref.org/works/10.1016/j.jvolgeores.2022.107547", resolver:"Crossref REST (api.crossref.org)", checkedAt:"2026-10-26T00:00:00Z", resolvedTitle:"VOL-CAT: A new processing chain for lava lake activity analysis by thermal infrared remote sensing", resolvedYear:2022, landingUrl:"https://doi.org/10.1016/j.jvolgeores.2022.107547", apiUrl:"https://api.crossref.org/works/10.1016/j.jvolgeores.2022.107547", originalUrl:"https://doi.org/10.1016/j.jvolgeores.2022.107547" } },
        { title:"First results from the VOL-CAT processing chain for thermal infrared monitoring of Stromboli lava lakes", year:2022, venue:"International Journal of Geo-Information", doi:"10.3390/ijgi11040225", cited:null, abstract:"", source:"Crossref record (resolved live 2026-10-26)",
          verification:{ status:"verified", detail:"Title ✓ · Year ✓ — api.crossref.org/works/10.3390/ijgi11040225", resolver:"Crossref REST (api.crossref.org)", checkedAt:"2026-10-26T00:00:00Z", resolvedTitle:"First Results from the VOL-CAT Processing Chain for Thermal Infrared Monitoring of Stromboli Lava Lakes", resolvedYear:2022, landingUrl:"https://doi.org/10.3390/ijgi11040225", apiUrl:"https://api.crossref.org/works/10.3390/ijgi11040225", originalUrl:"https://doi.org/10.3390/ijgi11040225" } }
      ], groupSize:"", openToStudents:null },

    { id:"ex-4", example:true, name:"Dr. Richard J. E. Bromhead", initials:"RB",
      title:"Engineering Geologist / Landslide specialist (affiliation NOT asserted — verify independently)",
      dept:"", uni:"", country:"",
      email:"", hIndex:null, citations:null, papers:null, lastActive:2023, verified:null, sources:["example","crossref"],
      areas:["engineering-geology","geohazards"],
      topics:["landslide classification","slope stability","terrain mapping"],
      methods:[],
      profileUrl:"", scholarUrl:"", linkedin:"",
      availability:"unknown", availabilitySource:null,
      funding:"none", fundingEvidence:[],
      intake:"Any / not specified", degreeType:"Any",
      recentPapers:[
        { title:"Landslide recognition, description, classification, and mapping", year:2023, venue:"Reflections on Slope Stability Engineering (CRC Press)", doi:"10.1201/9781003428169-1", cited:null, abstract:"", source:"Crossref record (resolved live 2026-10-26)",
          verification:{ status:"verified", detail:"Title ✓ · Author (Bromhead) ✓ · Year ✓ — api.crossref.org/works/10.1201/9781003428169-1", resolver:"Crossref REST (api.crossref.org)", checkedAt:"2026-10-26T00:00:00Z", resolvedTitle:"Landslide recognition, description, classification, and mapping", resolvedYear:2023, resolvedAuthors:["Edward N. Bromhead"], landingUrl:"https://doi.org/10.1201/9781003428169-1", apiUrl:"https://api.crossref.org/works/10.1201/9781003428169-1", originalUrl:"https://doi.org/10.1201/9781003428169-1" } }
      ], groupSize:"", openToStudents:null }
  ];

  /* Merge the example sandbox into the current result set (dedupe by id). */
  LD.mergeGeoExample = function(list){
    var have = {};
    (list||[]).forEach(function(p){ have[p.id]=1; });
    var add = JSON.parse(JSON.stringify(LD.GEO_EXAMPLE)).filter(function(p){ return !have[p.id]; });
    return add.concat(list||[]);
  };
})();
