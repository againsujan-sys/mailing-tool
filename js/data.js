var LD=(window.LD=window.LD||{});
/* ============ LetterDesk · data.js — demo dataset & stipend insights ============ */
window.LD = window.LD || {};

LD.STIPENDS = [
  { country:"United States",   ra:"$2,000–3,200", ta:"$1,800–2,800", tuition:"Usually waived", note:"Stipend + tuition waiver common in CS/Engineering; health insurance often included." },
  { country:"Canada",          ra:"CA$1,800–2,800", ta:"CA$1,600–2,400", tuition:"Covered for funded admits", note:"Tri-council PhD fellowships ≈ CA$35k/yr; MSc base funding varies by lab." },
  { country:"Germany",         ra:"€1,400–2,300", ta:"€950–1,300", tuition:"None (semester fee only)", note:"TV-L E13 at 50–100% position is the standard PhD contract." },
  { country:"Netherlands",     ra:"€2,700–3,700", ta:"€700–1,100 (part-time)", tuition:"Statutory fee ~€2.5k", note:"PhD candidates are employees on CAO scale 13 with benefits." },
  { country:"Switzerland",     ra:"CHF 3,500–5,000", ta:"CHF 500–1,000 extra", tuition:"~CHF 800/yr", note:"Highest stipends in Europe; ETH/EPFL assistant roles competitive." },
  { country:"United Kingdom",  ra:"£1,400–1,900", ta:"£1,200–1,800 (casual)", tuition:"Covered if UKRI-funded", note:"Stipends tax-free up to threshold; research councils set minimum rates." },
  { country:"Australia",       ra:"AU$3,300–4,000", ta:"AU$2,800–3,600", tuition:"Offset via RTP scholarship", note:"RTP living allowance ≈ AU$32k/yr tax-free; HEPA indexation applies." },
  { country:"Nordics (SE/NO/DK/FI)", ra:"€2,000–3,200", ta:"included in role", tuition:"Free (EEA); fees for non-EEA in SE/DK", note:"Doctoral researchers are salaried employees with pension contributions." },
  { country:"Singapore",       ra:"SGD 2,700–3,500", ta:"SGD 600–1,000", tuition:"Covered by SINGA/university scholarships", note:"Nanyang/NUS graduate scholarships include maintenance + tuition grant." },
  { country:"France",          ra:"€1,600–2,100", ta:"€600–900 (monitorat)", tuition:"Low public fees", note:"Contrat doctoral = 3-year CDD employee contract, legally protected." },
  { country:"South Korea",     ra:"₩1,500,000–2,500,000", ta:"often bundled", tuition:"BK21 programs cover it", note:"National scholarships (BK21 FOUR) tie funding to lab participation." },
  { country:"Japan",           ra:"¥140,000–200,000 (MEXT/JSPS)", ta:"¥40,000–80,000 RA tasks", tuition:"Often exempted 50–100%", note:"MEXT scholarship covers airfare + full tuition; lab RA top-ups common." }
];

/* Demo professors — used when offline or via "Load Demo Data". Shaped exactly like live API results. */
LD.DEMO_PROFESSORS = [
  { id:"demo-1", name:"Dr. Elena Kowalski", initials:"EK", title:"Associate Professor", dept:"Computer Science", uni:"Technical University of Munich", country:"Germany",
    email:"e.kowalski@in.tum.de", hIndex:34, citations:6120, papers:128, lastActive:2025, verified:null, sources:["openalex","demo"],
    topics:["efficient transformers","sparse attention","edge inference","model compression"],
    profileUrl:"https://www.openalex.org", scholarUrl:"", linkedin:"",
    recentPapers:[
      {title:"Sparse Routing for Low-Latency Transformer Inference on Edge Devices", year:2025, venue:"NeurIPS", doi:"10.48550/arXiv.2505.11234", cited:12},
      {title:"Quantization-Aware Distillation for On-Device NLP", year:2024, venue:"ACL", doi:"10.18653/v1/2024.acl-long.412", cited:87},
      {title:"A Benchmark for Energy-Efficient Attention Implementations", year:2023, venue:"MLSys", doi:"10.48550/arXiv.2303.09876", cited:154}
    ], groupSize:"12 PhD students · hires 2–3 per cycle", openToStudents:true },
  { id:"demo-2", name:"Prof. Daniel Okafor", initials:"DO", title:"Full Professor", dept:"Electrical & Computer Engineering", uni:"University of Toronto", country:"Canada",
    email:"d.okafor@utoronto.ca", hIndex:41, citations:9840, papers:203, lastActive:2025, verified:null, sources:["semantic","demo"],
    topics:["reinforcement learning","robotics","control systems","sim-to-real transfer"],
    profileUrl:"https://www.semanticscholar.org", scholarUrl:"", linkedin:"",
    recentPapers:[
      {title:"Sample-Efficient RL for Manipulation under Distribution Shift", year:2025, venue:"RSS", doi:"10.48550/arXiv.2502.04455", cited:9},
      {title:"World Models for Sim-to-Real Transfer in Legged Locomotion", year:2024, venue:"ICRA", doi:"10.1109/ICRA48891.2024.00512", cited:63},
      {title:"Curriculum Strategies for Multi-Task Robot Policies", year:2022, venue:"CoRL", doi:"10.48550/arXiv.2210.01122", cited:210}
    ], groupSize:"9 PhD + 4 postdocs · funded by NSERC alliance grant", openToStudents:true },
  { id:"demo-3", name:"Dr. Mei-Ling Chen", initials:"MC", title:"Assistant Professor", dept:"Materials Science", uni:"National University of Singapore", country:"Singapore",
    email:"mchen@nus.edu.sg", hIndex:22, citations:2980, papers:64, lastActive:2025, verified:null, sources:["crossref","demo"],
    topics:["perovskite solar cells","thin-film photovoltaics","device stability","bandgap tuning"],
    profileUrl:"", scholarUrl:"", linkedin:"",
    recentPapers:[
      {title:"Long-Term Operational Stability of Wide-Bandgap Perovskites", year:2025, venue:"Nature Energy", doi:"10.1038/s41560-025-01721-3", cited:18},
      {title:"Additive Engineering for Tandem Perovskite/Si Modules", year:2024, venue:"Joule", doi:"10.1016/j.joule.2024.06.008", cited:52},
      {title:"In-Situ Passivation Layers for Inverted PSC Architecture", year:2023, venue:"Advanced Materials", doi:"10.1002/adma.2023.04471", cited:131}
    ], groupSize:"6 PhD students · new group, actively recruiting", openToStudents:true },
  { id:"demo-4", name:"Prof. Henrik Larsson", initials:"HL", title:"Professor", dept:"Civil & Environmental Engineering", uni:"KTH Royal Institute of Technology", country:"Sweden",
    email:"hlars@kth.se", hIndex:37, citations:7450, papers:166, lastActive:2024, verified:null, sources:["openalex","demo"],
    topics:["computational fluid dynamics","urban hydrology","flood modelling","climate adaptation"],
    profileUrl:"", scholarUrl:"", linkedin:"",
    recentPapers:[
      {title:"GPU-Accelerated CFD for Flash-Flood Nowcasting in Nordic Cities", year:2024, venue:"Water Resources Research", doi:"10.1029/2024WR036112", cited:29},
      {title:"Coupled Surface-Groundwater Modelling Under Warming Climates", year:2023, venue:"Journal of Hydrology", doi:"10.1016/j.jhydrol.2023.129444", cited:77}
    ], groupSize:"14 members · EU Horizon project hiring until Q3", openToStudents:true },
  { id:"demo-5", name:"Dr. Amara Diallo", initials:"AD", title:"Lecturer (Assoc. Prof equivalent)", dept:"Epidemiology & Biostatistics", uni:"University of Oxford", country:"United Kingdom",
    email:"amara.diallo@spd.ox.ac.uk", hIndex:19, citations:1870, papers:48, lastActive:2025, verified:null, sources:["openalex","semantic","demo"],
    topics:["infectious disease modelling","bayesian statistics","vaccine effectiveness","causal inference"],
    profileUrl:"", scholarUrl:"", linkedin:"",
    recentPapers:[
      {title:"Bayesian Hierarchical Models for Multi-Country Vaccine Effectiveness", year:2025, venue:"BMJ", doi:"10.1136/bmj-2025-078112", cited:7},
      {title:"Causal Inference Under Interference in Spatial Epidemics", year:2024, venue:"Statistics in Medicine", doi:"10.1002/sim.2024.6118", cited:23}
    ], groupSize:"5 PhD · NIH Wellcome funded, TA term required", openToStudents:true },
  { id:"demo-6", name:"Prof. Sarah Whitfield", initials:"SW", title:"Full Professor", dept:"Computer Science", uni:"Stanford University", country:"United States",
    email:"swhitfield@stanford.edu", hIndex:58, citations:24300, papers:312, lastActive:2025, verified:null, sources:["semantic","demo"],
    topics:["large language models","retrieval-augmented generation","AI safety","instruction tuning"],
    profileUrl:"", scholarUrl:"", linkedin:"",
    recentPapers:[
      {title:"Retrieval Grounding Reduces Hallucination in Long-Form Generation", year:2025, venue:"ICLR", doi:"10.48550/arXiv.2501.09911", cited:31},
      {title:"Constitutional Fine-Tuning at Scale: An Empirical Study", year:2024, venue:"NeurIPS", doi:"10.48550/arXiv.2406.05522", cited:198},
      {title:"Instruction Hierarchy and Prompt Injection Defenses", year:2024, venue:"ACL", doi:"10.18653/v1/2024.acl-long.88", cited:245}
    ], groupSize:"20+ · extremely competitive; 1–2 PhD slots/year", openToStudents:false }
];

LD.COUNTRY_FLAGS = { "United States":"🇺🇸","United Kingdom":"🇬🇧","Germany":"🇩🇪","Canada":"🇨🇦","Australia":"🇦🇺","Netherlands":"🇳🇱","Switzerland":"🇨🇭","Sweden":"🇸🇪","France":"🇫🇷","Singapore":"🇸🇬","Japan":"🇯🇵","South Korea":"🇰🇷","Ireland":"🇮🇪","Denmark":"🇩🇰","Finland":"🇫🇮","Norway":"🇳🇴","New Zealand":"🇳🇿","Italy":"🇮🇹","Spain":"🇪🇸" };

LD.stipendFor = function(country){
  if(!country) return null;
  var rows = LD.STIPENDS.filter(function(s){ return s.country.indexOf(country)>-1 || country.indexOf(s.country)>-1; });
  return rows[0]||null;
};
