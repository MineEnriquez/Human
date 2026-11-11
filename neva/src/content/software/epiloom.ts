// Epiloom (FICTIONAL): an open-source Python framework for agent-based disease modelling, used as "the existing
// code base" in the AI for Software Engineers path. Its design is modelled on Starsim (starsim.org, MIT licence):
// a Sim assembles pluggable modules (diseases, networks, demographics, interventions, connectors, analyzers),
// with common random numbers and explicit time units. The names below are Epiloom's; they are simplified
// analogues of Starsim concepts, not Starsim's API. `import epiloom as el`.

export type ModuleKind = "sim" | "disease" | "network" | "demographics" | "intervention" | "product" | "connector" | "analyzer" | "calibration" | "time" | "distribution";
/** What a parameter's value must be: "rate" needs el.peryear()/el.perday(), "duration" needs el.years()/el.months()/el.days(). */
export type Unit = "rate" | "duration" | "probability" | "count" | "year" | "none";
export type Param = { name: string; type: string; unit: Unit; required: boolean; default?: string; desc: string };
export type ApiSymbol = { name: string; kind: ModuleKind; signature: string; params: Param[]; desc: string; deprecated?: { since: string; use: string } };

const P = (name: string, type: string, unit: Unit, desc: string, opt?: { required?: boolean; default?: string }): Param =>
  ({ name, type, unit, desc, required: opt?.required ?? false, default: opt?.default });

export const API: ApiSymbol[] = [
  // ---------------------------------------------------------------- Sim
  { name: "Sim", kind: "sim", signature: "el.Sim(n_agents=10_000, start=2000, stop=2030, dt=el.years(1), rand_seed=0, diseases=None, networks=None, demographics=None, interventions=None, connectors=None, analyzers=None, label=None)",
    desc: "Assembles the model from modules and runs it. Modules are passed as lists. Results are under sim.results.<module_name>.",
    params: [
      P("n_agents", "int", "count", "Number of simulated agents.", { default: "10_000" }),
      P("start", "int", "year", "First calendar year.", { default: "2000" }),
      P("stop", "int", "year", "Last calendar year (exclusive of the final step).", { default: "2030" }),
      P("dt", "duration", "duration", "Timestep, e.g. el.months(1).", { default: "el.years(1)" }),
      P("rand_seed", "int", "none", "Seed for the per-agent random streams (common random numbers). Use the same seed for every scenario you compare.", { default: "0" }),
      P("diseases", "list", "none", "Disease modules."), P("networks", "list", "none", "Network modules."),
      P("demographics", "list", "none", "Births, deaths, pregnancy."), P("interventions", "list", "none", "Interventions."),
      P("connectors", "list", "none", "Interactions between diseases."), P("analyzers", "list", "none", "Custom result collection."),
      P("label", "str", "none", "Name for this scenario in plots."),
    ] },
  // ---------------------------------------------------------------- diseases
  { name: "SIR", kind: "disease", signature: "el.SIR(beta, dur_inf, init_prev=0.01, p_death=0.0)", desc: "Susceptible-infected-recovered infection with lasting immunity.",
    params: [P("beta", "rate | dict", "rate", "Transmission rate per contact, e.g. el.peryear(0.5). On sexual networks, a dict by network: {'mf': [m_to_f, f_to_m]}.", { required: true }), P("dur_inf", "duration", "duration", "Mean duration of infection.", { required: true }), P("init_prev", "float", "probability", "Share infected at the start.", { default: "0.01" }), P("p_death", "float", "probability", "Probability an infection ends in death.", { default: "0.0" })] },
  { name: "SIS", kind: "disease", signature: "el.SIS(beta, dur_inf, init_prev=0.01)", desc: "Susceptible-infected-susceptible infection: no lasting immunity.",
    params: [P("beta", "rate | dict", "rate", "Transmission rate per contact.", { required: true }), P("dur_inf", "duration", "duration", "Mean duration of infection.", { required: true }), P("init_prev", "float", "probability", "Share infected at the start.", { default: "0.01" })] },
  { name: "SEIR", kind: "disease", signature: "el.SEIR(beta, dur_exp, dur_inf, init_prev=0.01)", desc: "SIR with an exposed (infected, not yet infectious) stage.",
    params: [P("beta", "rate | dict", "rate", "Transmission rate per contact.", { required: true }), P("dur_exp", "duration", "duration", "Mean latent (exposed) period.", { required: true }), P("dur_inf", "duration", "duration", "Mean infectious period.", { required: true }), P("init_prev", "float", "probability", "Share infected at the start.", { default: "0.01" })] },
  { name: "HIV", kind: "disease", signature: "el.HIV(beta, init_prev=0.05, art_coverage=0.0)", desc: "Sexually transmitted HIV with chronic infection; treatment (ART) lowers transmission. Needs a sexual network.",
    params: [P("beta", "dict", "rate", "Per-network, per-direction transmission, e.g. {'mf': [el.peryear(0.05), el.peryear(0.03)]}.", { required: true }), P("init_prev", "float", "probability", "Share infected at the start.", { default: "0.05" }), P("art_coverage", "float", "probability", "Share of people with diagnosed HIV on treatment.", { default: "0.0" })] },
  { name: "Syphilis", kind: "disease", signature: "el.Syphilis(beta, dur_inf, init_prev=0.02, p_congenital=0.0)", desc: "Sexually transmitted syphilis; with a maternal network and pregnancy it can pass to the fetus (congenital syphilis). Curable with treatment.",
    params: [P("beta", "dict", "rate", "Per-network transmission; use {'mf': [...], 'maternal': [...]} for sexual and vertical routes.", { required: true }), P("dur_inf", "duration", "duration", "Mean duration of untreated infectiousness.", { required: true }), P("init_prev", "float", "probability", "Share infected at the start.", { default: "0.02" }), P("p_congenital", "float", "probability", "Probability an untreated infection in pregnancy is transmitted to the baby.", { default: "0.0" })] },
  { name: "NCD", kind: "disease", signature: "el.NCD(incidence, p_death, rel_sus_effect=None)", desc: "A non-communicable condition (no person-to-person spread). Can change risk for an infectious disease via a connector.",
    params: [P("incidence", "rate", "rate", "Onset rate, e.g. el.peryear(0.01).", { required: true }), P("p_death", "float", "probability", "Probability the condition causes death.", { default: "0.0" }), P("rel_sus_effect", "float", "none", "Relative susceptibility multiplier applied by a connector.")] },
  // ---------------------------------------------------------------- networks
  { name: "RandomNet", kind: "network", signature: "el.RandomNet(n_contacts=el.poisson(4))", desc: "Random contacts redrawn each step, like an Erdős–Rényi random graph: any two agents are equally likely to be linked. For general contact infections.",
    params: [P("n_contacts", "int | dist", "count", "Contacts per agent per step.", { default: "el.poisson(4)" })] },
  { name: "MFNet", kind: "network", signature: "el.MFNet(duration, acts, debut=el.years(15), age_assortativity=0.0)", desc: "Male-female sexual partnerships with sexual debut age, partnership duration and acts per year. age_assortativity (0 to 1) makes partners closer in age.",
    params: [P("duration", "duration", "duration", "Mean partnership duration.", { required: true }), P("acts", "rate", "rate", "Sexual acts per year, e.g. el.freqperyear(80).", { required: true }), P("debut", "duration", "duration", "Age at sexual debut.", { default: "el.years(15)" }), P("age_assortativity", "float", "none", "0 = random by age, 1 = strongly age-matched.", { default: "0.0" })] },
  { name: "MSMNet", kind: "network", signature: "el.MSMNet(duration, acts, participation=0.1)", desc: "Partnerships between men who have sex with men.",
    params: [P("duration", "duration", "duration", "Mean partnership duration.", { required: true }), P("acts", "rate", "rate", "Acts per year.", { required: true }), P("participation", "float", "probability", "Share of men who take part.", { default: "0.1" })] },
  { name: "MaternalNet", kind: "network", signature: "el.MaternalNet()", desc: "Links each pregnant agent to her baby so infections can pass mother to child. Requires el.Pregnancy() in demographics; without it no links are made.", params: [] },
  { name: "MixingPool", kind: "network", signature: "el.MixingPool(n_contacts, src=None, dst=None)", desc: "Group-level (well-mixed) transmission between groups instead of individual edges: the metapopulation option.",
    params: [P("n_contacts", "float | matrix", "count", "Contacts from each source group to each destination group.", { required: true }), P("src", "callable", "none", "Source group selector."), P("dst", "callable", "none", "Destination group selector.")] },
  { name: "SexualNet", kind: "network", signature: "el.SexualNet(...)", desc: "Deprecated generic sexual network.", params: [], deprecated: { since: "2.0", use: "el.MFNet or el.MSMNet" } },
  // ---------------------------------------------------------------- demographics
  { name: "Births", kind: "demographics", signature: "el.Births(birth_rate)", desc: "Crude births, e.g. el.peryear(20) per 1,000 people. Use Pregnancy instead when you need mother-child links.",
    params: [P("birth_rate", "rate", "rate", "Births per 1,000 people per year.", { required: true })] },
  { name: "Deaths", kind: "demographics", signature: "el.Deaths(death_rate)", desc: "Background (non-disease) deaths per 1,000 people per year.",
    params: [P("death_rate", "rate", "rate", "Deaths per 1,000 people per year.", { required: true })] },
  { name: "Pregnancy", kind: "demographics", signature: "el.Pregnancy(fertility_rate, min_age=el.years(15), max_age=el.years(50))", desc: "Models conception, pregnancy and birth, creating mother-child links for MaternalNet.",
    params: [P("fertility_rate", "rate", "rate", "Births per 1,000 women of reproductive age per year.", { required: true }), P("min_age", "duration", "duration", "Youngest age of pregnancy.", { default: "el.years(15)" }), P("max_age", "duration", "duration", "Oldest age of pregnancy.", { default: "el.years(50)" })] },
  // ---------------------------------------------------------------- products + interventions
  { name: "Treatment", kind: "product", signature: "el.Treatment(disease, efficacy)", desc: "A treatment product: cures the named disease with the given probability.",
    params: [P("disease", "str", "none", "Disease module name, e.g. 'syphilis'.", { required: true }), P("efficacy", "float", "probability", "Probability treatment cures.", { required: true })] },
  { name: "Vaccine", kind: "product", signature: "el.Vaccine(disease, efficacy)", desc: "A vaccine product that lowers susceptibility.",
    params: [P("disease", "str", "none", "Disease module name.", { required: true }), P("efficacy", "float", "probability", "Reduction in susceptibility.", { required: true })] },
  { name: "Campaign", kind: "intervention", signature: "el.Campaign(product, years, coverage, eligibility=None, name=None)", desc: "One-off mass delivery in specific years (e.g. a mass treatment campaign). Coverage is the share of eligible people reached in each campaign year.",
    params: [P("product", "product", "none", "The product delivered.", { required: true }), P("years", "list[int]", "year", "Campaign years.", { required: true }), P("coverage", "float", "probability", "Share of eligible people reached per campaign.", { required: true }), P("eligibility", "callable", "none", "fn(sim) -> uids of who can receive it; None means everyone."), P("name", "str", "none", "Unique name; required if two interventions share a class.")] },
  { name: "RoutineDelivery", kind: "intervention", signature: "el.RoutineDelivery(product, start_year, prob, eligibility=None, name=None)", desc: "Continuous delivery from a start year. prob is per timestep, not per year: convert an annual target for monthly steps.",
    params: [P("product", "product", "none", "The product delivered.", { required: true }), P("start_year", "int", "year", "Year delivery starts.", { required: true }), P("prob", "float", "probability", "Per-timestep probability an eligible person is reached.", { required: true }), P("eligibility", "callable", "none", "fn(sim) -> uids; use it for targeted outreach (e.g. a higher-risk group)."), P("name", "str", "none", "Unique name.")] },
  // ---------------------------------------------------------------- connectors, analyzers, calibration
  { name: "Connector", kind: "connector", signature: "class MyConnector(el.Connector): def step(self): ...", desc: "Base class for interactions between diseases (co-infection): subclass it and change one disease's susceptibility or transmissibility based on another's state. Runs after disease updates and before transmission each step.", params: [] },
  { name: "CoinfectionEffect", kind: "connector", signature: "el.CoinfectionEffect(source, target, rel_sus=1.0, rel_trans=1.0)", desc: "Ready-made connector: people with `source` have their susceptibility to (rel_sus) or transmission of (rel_trans) `target` multiplied.",
    params: [P("source", "str", "none", "Disease that modifies risk, e.g. 'hiv'.", { required: true }), P("target", "str", "none", "Disease whose risk changes, e.g. 'syphilis'.", { required: true }), P("rel_sus", "float", "none", "Susceptibility multiplier.", { default: "1.0" }), P("rel_trans", "float", "none", "Transmissibility multiplier.", { default: "1.0" })] },
  { name: "Module", kind: "disease", signature: "class MyModel(el.Module): def step(self): ...", desc: "Base class for custom logic, including compartmental (ODE-style) models with scalar states instead of agents.", params: [] },
  { name: "Analyzer", kind: "analyzer", signature: "class MyAnalyzer(el.Analyzer): def step(self): ...", desc: "Collects custom results at the end of each step without changing the model.", params: [] },
  { name: "Calibration", kind: "calibration", signature: "el.Calibration(sim, calib_pars, components, total_trials=100)", desc: "Fits parameters to data by optimisation, scoring each trial with likelihood components.",
    params: [P("sim", "Sim", "none", "The (un-run) sim to calibrate.", { required: true }), P("calib_pars", "dict", "none", "Parameters with bounds.", { required: true }), P("components", "list", "none", "Likelihood components comparing outputs to data.", { required: true }), P("total_trials", "int", "count", "Number of optimisation trials.", { default: "100" })] },
  { name: "parallel", kind: "sim", signature: "el.parallel(*sims)", desc: "Runs several sims (scenarios) in parallel and returns them together for comparison.", params: [] },
  // ---------------------------------------------------------------- time + distributions
  { name: "peryear", kind: "time", signature: "el.peryear(x)", desc: "A rate per year. Epiloom converts it to the timestep.", params: [] },
  { name: "perday", kind: "time", signature: "el.perday(x)", desc: "A rate per day.", params: [] },
  { name: "freqperyear", kind: "time", signature: "el.freqperyear(x)", desc: "A count of events per year (e.g. sexual acts).", params: [] },
  { name: "years", kind: "time", signature: "el.years(x)", desc: "A duration in years.", params: [] },
  { name: "months", kind: "time", signature: "el.months(x)", desc: "A duration in months (1/12 year).", params: [] },
  { name: "days", kind: "time", signature: "el.days(x)", desc: "A duration in days.", params: [] },
  { name: "poisson", kind: "distribution", signature: "el.poisson(lam)", desc: "Poisson distribution (heterogeneity across agents).", params: [] },
  { name: "lognormal", kind: "distribution", signature: "el.lognormal(mean, std)", desc: "Lognormal distribution.", params: [] },
];
export const SYMBOLS = new Map(API.map(s => [s.name, s]));
export const RATE_HELPERS = ["peryear", "perday", "freqperyear"];
export const DURATION_HELPERS = ["years", "months", "days"];

// ---------------------------------------------------------------- examples library (the code base the agent searches)
export type Feature = "co-transmission" | "mtct" | "sexual-network" | "random-network" | "campaign" | "targeted-delivery" | "routine-delivery" | "crn-scenarios" | "calibration" | "ncd" | "metapopulation" | "compartmental" | "demographics";
export type Level = "agent-based" | "metapopulation" | "compartmental";
export type Example = { id: string; title: string; summary: string; kinds: ModuleKind[]; features: Feature[]; level: Level; code: string; vec: [number, number] };

export const EXAMPLES: Example[] = [
  { id: "EX-01", title: "Measles-like SIR on a random network", summary: "An SIR outbreak on a random (Erdős–Rényi-style) contact network with births and deaths.", kinds: ["sim", "disease", "network", "demographics"], features: ["random-network", "demographics"], level: "agent-based", vec: [0.18, 0.82],
    code: `import epiloom as el\nsim = el.Sim(\n    n_agents=20_000, start=2020, stop=2030, rand_seed=1,\n    diseases=[el.SIR(beta=el.peryear(30), dur_inf=el.days(10))],\n    networks=[el.RandomNet(n_contacts=el.poisson(8))],\n    demographics=[el.Births(birth_rate=el.peryear(20)), el.Deaths(death_rate=el.peryear(8))],\n)\nsim.run()` },
  { id: "EX-02", title: "Syphilis on a heterosexual network", summary: "Syphilis transmitted on an age-assortative male-female network.", kinds: ["sim", "disease", "network"], features: ["sexual-network"], level: "agent-based", vec: [0.62, 0.55],
    code: `import epiloom as el\nsyph = el.Syphilis(beta={'mf': [el.peryear(0.3), el.peryear(0.2)]}, dur_inf=el.years(2))\nmf = el.MFNet(duration=el.years(1), acts=el.freqperyear(80), age_assortativity=0.6)\nsim = el.Sim(n_agents=20_000, start=2025, stop=2035, rand_seed=1, diseases=[syph], networks=[mf])\nsim.run()` },
  { id: "EX-03", title: "Congenital syphilis via mother-to-child transmission", summary: "Syphilis on a sexual network plus a maternal network and pregnancy, so infections in pregnancy can pass to babies.", kinds: ["sim", "disease", "network", "demographics"], features: ["sexual-network", "mtct", "demographics"], level: "agent-based", vec: [0.70, 0.40],
    code: `import epiloom as el\nsyph = el.Syphilis(beta={'mf': [el.peryear(0.3), el.peryear(0.2)], 'maternal': [el.peryear(0.9), el.peryear(0)]}, dur_inf=el.years(2), p_congenital=0.4)\nsim = el.Sim(\n    n_agents=20_000, start=2025, stop=2035, rand_seed=1,\n    diseases=[syph],\n    networks=[el.MFNet(duration=el.years(1), acts=el.freqperyear(80)), el.MaternalNet()],\n    demographics=[el.Pregnancy(fertility_rate=el.peryear(90)), el.Deaths(death_rate=el.peryear(8))],\n)\nsim.run()` },
  { id: "EX-04", title: "HIV and syphilis co-infection with a connector", summary: "Two STIs on the same sexual network; people with HIV are more susceptible to syphilis via a connector.", kinds: ["sim", "disease", "network", "connector"], features: ["co-transmission", "sexual-network"], level: "agent-based", vec: [0.80, 0.62],
    code: `import epiloom as el\nhiv = el.HIV(beta={'mf': [el.peryear(0.05), el.peryear(0.03)]}, init_prev=0.08)\nsyph = el.Syphilis(beta={'mf': [el.peryear(0.3), el.peryear(0.2)]}, dur_inf=el.years(2))\nlink = el.CoinfectionEffect(source='hiv', target='syphilis', rel_sus=2.0)\nsim = el.Sim(n_agents=20_000, start=2025, stop=2035, rand_seed=1,\n    diseases=[hiv, syph], networks=[el.MFNet(duration=el.years(1), acts=el.freqperyear(80))], connectors=[link])\nsim.run()` },
  { id: "EX-05", title: "Mass treatment campaign vs targeted outreach", summary: "Two treatment strategies compared as scenarios with the same seed (common random numbers).", kinds: ["sim", "intervention", "product"], features: ["campaign", "targeted-delivery", "crn-scenarios"], level: "agent-based", vec: [0.52, 0.28],
    code: `import epiloom as el\ntx = el.Treatment(disease='syphilis', efficacy=0.95)\nhigh_risk = lambda sim: sim.people.high_risk.uids\nmass = el.Campaign(product=tx, years=[2027, 2029, 2031], coverage=0.3, name='mass')\ntargeted = el.RoutineDelivery(product=tx, start_year=2027, prob=0.07, eligibility=high_risk, name='targeted')\nbase = dict(n_agents=20_000, start=2025, stop=2035, rand_seed=7)\nsims = [el.Sim(**base, label='baseline'), el.Sim(**base, interventions=[mass], label='mass'), el.Sim(**base, interventions=[targeted], label='targeted')]\nel.parallel(*sims)` },
  { id: "EX-06", title: "Calibrating beta to prevalence data", summary: "Fits a transmission rate to survey prevalence with el.Calibration.", kinds: ["sim", "calibration"], features: ["calibration"], level: "agent-based", vec: [0.35, 0.18],
    code: `import epiloom as el\ncal = el.Calibration(sim=sim, calib_pars={'syphilis.beta': dict(low=0.1, high=0.6)}, components=[prevalence_2024], total_trials=200)\ncal.calibrate()` },
  { id: "EX-07", title: "Diabetes raising TB susceptibility", summary: "A non-communicable condition modifying an infectious disease through a connector.", kinds: ["disease", "connector"], features: ["ncd", "co-transmission"], level: "agent-based", vec: [0.25, 0.48],
    code: `import epiloom as el\ndm = el.NCD(incidence=el.peryear(0.008), p_death=0.0)\ntb = el.SEIR(beta=el.peryear(4), dur_exp=el.years(1), dur_inf=el.years(2))\nsim = el.Sim(diseases=[dm, tb], networks=[el.RandomNet()], connectors=[el.CoinfectionEffect(source='ncd', target='seir', rel_sus=2.5)])` },
  { id: "EX-08", title: "Regions as a metapopulation", summary: "Group-level mixing between regions with a mixing pool instead of individual contacts.", kinds: ["network"], features: ["metapopulation"], level: "metapopulation", vec: [0.12, 0.30],
    code: `import epiloom as el\npools = el.MixingPool(n_contacts=[[4, 0.5], [0.5, 3]], src=regions, dst=regions)\nsim = el.Sim(diseases=[el.SIR(beta=el.peryear(20), dur_inf=el.days(7))], networks=[pools])` },
  { id: "EX-09", title: "A three-compartment SIS model", summary: "An ODE-style compartmental model as a custom module: fast, no individual agents.", kinds: ["disease"], features: ["compartmental"], level: "compartmental", vec: [0.08, 0.60],
    code: `import epiloom as el\nclass CompartmentalSIS(el.Module):\n    ...  # scalar S and I updated each step with el.peryear rates converted to the timestep` },
  { id: "EX-10", title: "STI-like SIS on a random network (look-alike)", summary: "A quick STI-style SIS demo on a random network with a maternal network, written for a workshop. Looks close to the congenital-syphilis setup but uses the wrong network for sexual transmission.", kinds: ["sim", "disease", "network"], features: ["random-network", "mtct"], level: "agent-based", vec: [0.66, 0.46],
    code: `import epiloom as el\nsim = el.Sim(diseases=[el.SIS(beta=el.peryear(0.4), dur_inf=el.years(1))], networks=[el.RandomNet(), el.MaternalNet()])` },
];
