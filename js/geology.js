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

  /* ---------- Demo geoscience supervisors ----------
     Every availability/funding claim below is tied to a named SOURCE + DATE,
     exactly like real records must be. The demo mixes all four states so the
     distinction is visible offline. */
  LD.GEO_DEMO = [
    { id:"geo-1", name:"Prof. Ingrid Solheim", initials:"IS", title:"Professor of Glaciology", dept:"Earth Science", uni:"University of Bergen", country:"Norway",
      email:"ingrid.solheim@uib.no", hIndex:31, citations:4210, papers:97, lastActive:2025, verified:null, sources:["demo","openalex"],
      areas:["glaciology","geohazards"],
      topics:["ice-sheet mass balance","Svalbard glaciers","glacial outburst floods","InSAR ice velocity"],
      methods:["InSAR velocity mapping","radio-echo sounding","balance-ablation surveys","open-source ice-flow modelling"],
      profileUrl:"https://www.uib.no/en/geo", scholarUrl:"", linkedin:"",
      availability:"funded-ad",
      availabilitySource:{ url:"https://www.uib.no/en/positions/12345/phd-research-fellow-glaciology", captured:"2026-09-12",
        quote:"Two 3-year fully funded Research Fellow positions in glacial hydrology, including tuition and monthly salary under the State Employees' Terms." },
      funding:"confirmed",
      fundingEvidence:[ { text:"Vacancy 12345: two fully funded Research Fellow posts (state salary code 1011).", url:"https://www.uib.no/en/positions/12345/phd-research-fellow-glaciology", date:"2026-09-12" } ],
      intake:"Spring 2027", degreeType:"MSc",
      recentPapers:[
        { title:"Winter surface melt on Svalbard glaciers detected from Sentinel-1 backscatter", year:2025, venue:"The Cryosphere", doi:"10.5194/tc-19-1123-2025", cited:14, abstract:"Radar backscatter time series reveal recurrent winter melt events on seven Svalbard glaciers, revising mass-balance projections.", source:"Crossref (DOI resolution)" },
        { title:"GLOF runout modelling for Grímsvötn outlet catchments under warming scenarios", year:2024, venue:"Journal of Glaciology", doi:"10.1017/jog.2024.31", cited:38, abstract:"2-D depth-integrated simulations quantify how rising geothermal melt shifts jökulhlaup peak discharge downstream.", source:"Crossref (publisher page)" },
        { title:"Ice-penetrating radar constraints on subglacial water storage, Austfonna", year:2023, venue:"Annals of Glaciology", doi:"10.5194/aog-64-45-2023", cited:52, abstract:"Radio-echo profiles map distributed basal water pockets feeding seasonal speed-up events.", source:"Publisher landing page" }
      ], groupSize:"11 members · 2 funded PhD posts advertised Sep 2026", openToStudents:true },

    { id:"geo-2", name:"Dr. Marco Ferretti", initials:"MF", title:"Associate Professor of Hydrogeology", dept:"Civil & Environmental Engineering", uni:"Politecnico di Milano", country:"Italy",
      email:"marco.ferretti@polimi.it", hIndex:24, citations:2380, papers:71, lastActive:2025, verified:null, sources:["demo","semantic"],
      areas:["hydrogeology","environmental-geoscience"],
      topics:["groundwater modelling","PFAS transport","Managed aquifer recharge","agricultural nitrate risk"],
      methods:["MODFLOW / FEFLOW modelling","pump-test analysis","reactive transport modelling","monitor-well networks"],
      profileUrl:"https://www.polimi.it/en", scholarUrl:"", linkedin:"",
      availability:"project-unfunded",
      availabilitySource:{ url:"https://www.polimi.it/en/research/projects/groundwater-futures", captured:"2026-08-30",
        quote:"We host the Po-valley PFAS intercomparison project; interested MSc students may attach a thesis to the dataset (funding not specified)." },
      funding:"partial",
      fundingEvidence:[ { text:"Project 'Groundwater Futures' lists an ERDF grant covering field work; no line item for student salary.", url:"https://www.polimi.it/en/research/projects/groundwater-futures", date:"2026-08-30" } ],
      intake:"Fall 2027", degreeType:"MSc",
      recentPapers:[
        { title:"Machine-learning surrogate for regional PFAS plume prediction in the Po aquifer", year:2025, venue:"Water Resources Research", doi:"10.1029/2025WR039112", cited:9, abstract:"A convolutional surrogate reproduces reactive-transport results at ~1% runtime, enabling scenario screening for well-field protection.", source:"Wiley publisher page (DOI)" },
        { title:"Managed aquifer recharge feasibility under Mediterranean drought cycles", year:2024, venue:"Journal of Hydrology", doi:"10.1016/j.jhydrol.2024.131887", cited:41, abstract:"Coupled surface–subsurface models show recovery efficiency caps near 55% without pre-treatment.", source:"Elsevier (ScienceDirect)" },
        { title:"Nitrate threshold exceedance mapping for Lombardy private wells", year:2023, venue:"Science of the Total Environment", doi:"10.1016/j.scitotenv.2023.163445", cited:66, abstract:"Ten-year well registry plus logistic regression identifies irrigation intensity as dominant predictor.", source:"Elsevier (ScienceDirect)" }
      ], groupSize:"8 PhD students · hosts EU project data for MSc theses", openToStudents:true },

    { id:"geo-3", name:"Prof. Ayodele Bankole", initials:"AB", title:"Professor of Applied Geophysics", dept:"Earth & Ocean Sciences", uni:"University of British Columbia", country:"Canada",
      email:"a.bankole@ubc.ca", hIndex:39, citations:7620, papers:154, lastActive:2025, verified:null, sources:["demo","openalex"],
      areas:["geophysics","engineering-geology"],
      topics:["near-surface geophysics","ERT site investigation","urban seismic refraction","geophysical well logging"],
      methods:["resistivity & IP surveys","reflection seismics processing","geophysical well logging","full waveform inversion"],
      profileUrl:"https://www.eos.ubc.ca", scholarUrl:"", linkedin:"",
      availability:"unknown",
      availabilitySource:null,
      funding:"none",
      fundingEvidence:[],
      intake:"Any / not specified", degreeType:"Any",
      recentPapers:[
        { title:"Full-waveform inversion of shallow seismic data for tunnel advance prediction", year:2025, venue:"Geophysics", doi:"10.1190/geo2025-0112.1", cited:6, abstract:"Field trials at two mountain-tunnel portals cut over-excavation risk by resolving weak zones 15 m ahead of face.", source:"SEG publisher page (DOI)" },
        { title:"Joint ERT–GPR characterisation of karst voids under urban infrastructure", year:2024, venue:"Journal of Applied Geophysics", doi:"10.1016/j.jappgeo.2024.05.014", cited:22, abstract:"Data fusion reduces false-positive void detections by 38% versus single-method surveys.", source:"Elsevier (ScienceDirect)" },
        { title:"Borehole radar attenuation as a clay-content proxy in deltaic sediments", year:2023, venue:"Near Surface Geophysics", doi:"10.1002/nsg.12266", cited:35, abstract:"Calibration against core logs supports rapid lithological interpolation in Fraser Delta sites.", source:"Wiley publisher page (DOI)" }
      ], groupSize:"10 members · NSERC discovery grant active until 2028", openToStudents:true },

    { id:"geo-4", name:"Dr. Sofia Ramírez", initials:"SR", title:"Lecturer in Seismology & Natural Hazards", dept:"Geological Sciences", uni:"ETH Zürich", country:"Switzerland",
      email:"sofia.ramirez@earth.northwestern-demo.invalid", hIndex:18, citations:1290, papers:44, lastActive:2025, verified:null, sources:["demo","semantic"],
      areas:["seismology","geohazards","tectonics"],
      topics:["induced seismicity","earthquake early warning","fault kinematics","Alpine landslide risk"],
      methods:["waveform analysis & spectral inversion","micro-seismic monitoring","PSHA probabilistic hazard assessment","InSAR deformation time-series"],
      profileUrl:"https://earth.ethz.ch", scholarUrl:"", linkedin:"",
      availability:"closed",
      availabilitySource:{ url:"https://ethz.ch/personpages/sofia.ramirez.html", captured:"2026-07-18",
        quote:"I am on study leave in 2026/27 and cannot supervise new MSc or PhD students; please do not send applications this cycle." },
      funding:"not-applicable",
      fundingEvidence:[],
      intake:"Any / not specified", degreeType:"Any",
      recentPapers:[
        { title:"Moment-tensor inversions of Basel geothermal traffic-induced events", year:2025, venue:"Geophysical Journal International", doi:"10.1093/gji/ggaf088", cited:8, abstract:"Double-couple dominance suggests shear reactivation rather than tensile cracking during injection pauses.", source:"OUP publisher page (DOI)" },
        { title:"Slow-slip modulation of landslide tremor in the Albula valley", year:2024, venue:"Solid Earth", doi:"10.5194/se-15-221-2024", cited:17, abstract:"Three borehole arrays link tremor swarms to deep creep pulses coinciding with wet-season pore-pressure rise.", source:"Copernicus (publisher page)" }
      ], groupSize:"6 members · study leave 2026/27", openToStudents:false },

    { id:"geo-5", name:"Prof. Tansu Yılmaz", initials:"TY", title:"Professor of Engineering Geology", dept:"Geological Engineering", uni:"Istanbul Technical University", country:"Turkey",
      email:"yilmaz@itu.edu.tr", hIndex:27, citations:3410, papers:118, lastActive:2024, verified:null, sources:["demo","crossref"],
      areas:["engineering-geology","geohazards"],
      topics:["rockfall hazard","urban tunneling","seismic microzonation","weathering of building stone"],
      methods:["in-situ stress measurement","rock mass classification","runout modelling (rampages / FLAD)","LiDAR change detection"],
      profileUrl:"https://www.itu.edu.tr", scholarUrl:"", linkedin:"",
      availability:"unknown",
      availabilitySource:null,
      funding:"none",
      fundingEvidence:[ { text:"TUBITAK project page names ITU as partner; student support not stated.", url:"https://www.tubitak.gov.tr/demo-project-rockfall", date:"2026-05-02" } ],
      intake:"Fall 2027", degreeType:"MSc",
      recentPapers:[
        { title:"Rockfall runout calibration along the Bosphorus slope corridors", year:2024, venue:"Landslides", doi:"10.1007/s10346-024-02211-8", cited:19, abstract:"LiDAR-derived fragment paths constrain rampages coefficients for protective-net placement.", source:"Springer publisher page (DOI)" },
        { title:"Site-response proxies from HVSR for historic peninsula microzonation", year:2023, venue:"Bulletin of Earthquake Engineering", doi:"10.1007/s10518-023-01744-2", cited:44, abstract:"Horizontal-to-vertical spectral ratios correlate with buried paleo-valley geometry mapped by drilling.", source:"Springer publisher page (DOI)" }
      ], groupSize:"14 members", openToStudents:true },

    { id:"geo-6", name:"Dr. Fatima Al-Zahra", initials:"FA", title:"Assistant Professor of Environmental Geoscience", dept:"Earth Systems Science", uni:"University College Dublin", country:"Ireland",
      email:"f.alzahra@ucd.ie", hIndex:15, citations:940, papers:33, lastActive:2025, verified:null, sources:["demo","openalex"],
      areas:["environmental-geoscience","hydrogeology"],
      topics:["acid mine drainage","constructed wetlands","peatland carbon storage","tailings containment"],
      methods:["sequential extraction geochemistry","passive remediation design","isotope hydrology","monitor-well networks"],
      profileUrl:"https://www.ucd.ie/earthsci", scholarUrl:"", linkedin:"",
      availability:"funded-ad",
      availabilitySource:{ url:"https://gccd.ucd.ie/join-us", captured:"2026-10-03",
        quote:"Fully funded MSc studentship in mine-water treatment (Irish Research Council ELA scheme), stipend €25,000/yr + fees, start Jan 2027." },
      funding:"confirmed",
      fundingEvidence:[ { text:"IRC ELA studentship advert: stipend EUR 25,000/yr + fees, start Jan 2027.", url:"https://gccd.ucd.ie/join-us", date:"2026-10-03" } ],
      intake:"Spring 2027", degreeType:"MSc",
      recentPapers:[
        { title:"Sulfate-reducing passive treatment of legacy Irish mine drainage", year:2025, venue:"Environmental Science & Technology", doi:"10.1021/acs.est.5c02211", cited:11, abstract:"Two years of outflow records show substrate longevity dominates removal efficiency over microbial dosage.", source:"ACS publisher page (DOI)" },
        { title:"Peat-substrate carbon accounting for restored cutover bogs", year:2024, venue:"Geoderma", doi:"10.1016/j.geoderma.2024.116842", cited:27, abstract:"Eddy-flux comparison across three restorations suggests rewetting reverses decadal CO2 sources within 4 years.", source:"Elsevier (ScienceDirect)" }
      ], groupSize:"5 members · 1 funded MSc studentship open Oct 2026", openToStudents:true }
  ];

  /* Merge geology demo profiles into the current result set (dedupe by id). */
  LD.mergeGeoDemo = function(list){
    var have = {};
    (list||[]).forEach(function(p){ have[p.id]=1; });
    var add = JSON.parse(JSON.stringify(LD.GEO_DEMO)).filter(function(p){ return !have[p.id]; });
    return add.concat(list||[]);
  };
})();
