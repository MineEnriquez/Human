// Case data for the AI for Software Engineers path (all FICTIONAL): the Model Builder agent turns a researcher's
// question into a spec and Epiloom code. Shared by labs, server tools and tests.
import { EXAMPLES, type Example, type Feature, type Level, type ModuleKind } from "./epiloom.js";

// ------------------------------------------------------------------ Case 1: an LLM's first attempt
export const LLM_QUESTION = "Model syphilis in Harbor District from 2027 to 2037, including babies born with congenital syphilis, and compare a mass treatment campaign with doing nothing.";

/** Spec fields an LLM extracted from LLM_QUESTION; the learner sorts them. */
export const SPEC_FIELDS = [
  { id: "s1", label: "disease: syphilis, sexually transmitted", bucket: "ok", why: "Stated in the question." },
  { id: "s2", label: "horizon: 2027-2037", bucket: "ok", why: "Stated in the question." },
  { id: "s3", label: "outcome: congenital syphilis cases", bucket: "ok", why: "'babies born with congenital syphilis' is the outcome." },
  { id: "s4", label: "scenarios: mass campaign vs doing nothing", bucket: "ok", why: "Both are named." },
  { id: "s5", label: "horizon: 2027-2047", bucket: "wrong", why: "A digit slipped: the question says 2037." },
  { id: "s6", label: "network: random contacts", bucket: "wrong", why: "Syphilis spreads through sexual partnerships; a random contact network is the wrong route." },
  { id: "s7", label: "campaign coverage: 60%", bucket: "ask", why: "The question never says; the model filled in a plausible number. Ask the researcher." },
  { id: "s8", label: "transmission rate: 0.3 per year", bucket: "ask", why: "Not in the question: it must come from evidence or calibration, and its unit must be explicit." },
  { id: "s9", label: "campaign years", bucket: "ask", why: "Unknown: needs a clarifying question, not a guess." },
];

/** The LLM's first code for LLM_QUESTION: plausible-looking, with planted problems the validator finds. */
export const LLM_SNIPPET = `import epiloom as el

syph = el.Syphilis(beta={'mf': [0.3, 0.2]}, dur_inf=2, init_prev=0.02)
net = el.SexualNet(acts=80)
tx = el.Treatment(disease='syphilis', efficacy=0.95)
campaign = el.MassTreatment(product=tx, years=[2028, 2030], coverage=0.6)

sim = el.Sim(n_agents=20_000, start=2027, stop=2037, rand_seed=3,
             diseases=[syph], networks=[net, el.MaternalNet()],
             demographics=[el.Births(birth_rate=el.years(20))],
             interventions=[campaign])
sim.run()`;

export const LLM_SPEC = { question: LLM_QUESTION, diseases: [{ name: "syphilis", transmission: "sexual" as const }], age_assortative: false, mtct: true, coinfection: null, interventions: [], scenarios: ["baseline", "campaign"], horizon: { start: 2027, stop: 2037 }, outcomes: ["congenital syphilis cases"], needs_clarification: [] };

// ------------------------------------------------------------------ Case 2: finding the right example
export type { Example, Feature, Level, ModuleKind };
/** The query: the same need as the capstone, embedded with the same model as the examples (toy 2-D vectors). */
export const EXAMPLE_QUERY = { text: "congenital syphilis on a sexual network with pregnancy", vec: [0.67, 0.45] as [number, number] };
/** The example that actually fits (sexual network + MaternalNet + Pregnancy); EX-10 looks closer but is wrong. */
export const RIGHT_EXAMPLE = "EX-03";

export const similarity = (a: [number, number], b: [number, number]) => 1 / (1 + 10 * Math.hypot(a[0] - b[0], a[1] - b[1]));
export function topExamples(q: [number, number], k: number, keep: (e: Example) => boolean = () => true) {
  return EXAMPLES.filter(keep).map(e => ({ e, s: similarity(q, e.vec) })).sort((x, y) => y.s - x.s).slice(0, k);
}

// ------------------------------------------------------------------ Case 5: the code versions the learner chooses between
export const CODE_V1 = `import epiloom as el
# v1: first draft from the agent's draft spec
hiv = el.HIV(beta={'mf': [el.peryear(0.05), el.peryear(0.03)]}, init_prev=0.08)
syph = el.Syphilis(beta={'mf': [el.peryear(0.3), el.peryear(0.2)]}, dur_inf=el.years(2))
link = el.CoinfectionEffect(source='syphilis', target='hiv', rel_sus=2.0)
tx = el.Treatment(disease='syphilis', efficacy=0.95)
mass = el.Campaign(product=tx, years=[2028, 2030, 2032], coverage=0.3, name='mass')
targeted = el.RoutineDelivery(product=tx, start_year=2028, prob=0.07, name='targeted')
nets = [el.MFNet(duration=el.years(1), acts=el.freqperyear(80)), el.MaternalNet()]
sim_mass = el.Sim(n_agents=20_000, start=2027, stop=2037, rand_seed=1, diseases=[hiv, syph], networks=nets, connectors=[link], interventions=[mass])
sim_targeted = el.Sim(n_agents=20_000, start=2027, stop=2037, rand_seed=2, diseases=[hiv, syph], networks=nets, connectors=[link], interventions=[targeted])
el.parallel(sim_mass, sim_targeted)`;

export const CODE_V2 = `import epiloom as el
# v2: revised against the reviewed spec; every requirement traced to a line
def make_sim(label, interventions):
    hiv = el.HIV(beta={'mf': [el.peryear(0.05), el.peryear(0.03)]}, init_prev=0.08)
    syph = el.Syphilis(beta={'mf': [el.peryear(0.3), el.peryear(0.2)], 'maternal': [el.peryear(0.9), el.peryear(0)]},
                       dur_inf=el.years(2), p_congenital=0.4)
    return el.Sim(n_agents=20_000, start=2027, stop=2037, rand_seed=7, label=label,
        diseases=[hiv, syph],
        networks=[el.MFNet(duration=el.years(1), acts=el.freqperyear(80), age_assortativity=0.6), el.MaternalNet()],
        demographics=[el.Pregnancy(fertility_rate=el.peryear(90)), el.Deaths(death_rate=el.peryear(8))],
        connectors=[el.CoinfectionEffect(source='hiv', target='syphilis', rel_sus=2.0)],
        interventions=interventions)

tx = el.Treatment(disease='syphilis', efficacy=0.95)
higher_risk = lambda sim: sim.people.higher_risk.uids  # definition to confirm with the researcher
mass = el.Campaign(product=tx, years=[2028, 2030, 2032], coverage=0.3, name='mass')
targeted = el.RoutineDelivery(product=tx, start_year=2028, prob=0.07, eligibility=higher_risk, name='targeted')
el.parallel(make_sim('baseline', []), make_sim('mass', [mass]), make_sim('targeted', [targeted]))`;

export const CODE_V3 = `import epiloom as el
# v3: "cleaned up" by a second model pass
def make_sim(label, interventions, seed):
    hiv = el.HIV(beta={'mf': [el.peryear(0.05), el.peryear(0.03)]}, init_prev=0.08)
    syph = el.Syphilis(beta={'mf': [el.peryear(0.3), el.peryear(0.2)], 'maternal': [el.peryear(0.9), el.peryear(0)]},
                       dur_inf=el.years(2), p_congenital=0.4)
    return el.Sim(n_agents=20_000, start=2027, stop=2037, rand_seed=seed, label=label,
        diseases=[hiv, syph],
        networks=[el.MFNet(duration=el.years(1), acts=el.freqperyear(80), age_assortativity=0.6), el.MaternalNet()],
        demographics=[el.Pregnancy(fertility_rate=el.peryear(90)), el.Deaths(death_rate=el.peryear(8))],
        connectors=[el.CoinfectionEffect(source='hiv', target='syphilis', rel_sus=2.0)],
        interventions=interventions)

tx = el.Treatment(disease='syphilis', efficacy=0.95)
mass = el.Campaign(product=tx, years=[2028, 2030, 2032], coverage=0.3, name='mass')
targeted = el.RoutineDelivery(product=tx, start_year=2028, prob=0.07, name='targeted')
el.parallel(make_sim('baseline', [], seed=1), make_sim('mass', [mass], seed=2), make_sim('targeted', [targeted], seed=3))`;

export const CODE_VERSIONS = [
  { id: "v1", label: "v1: first draft", code: CODE_V1 },
  { id: "v2", label: "v2: revised against the reviewed spec", code: CODE_V2 },
  { id: "v3", label: "v3: 'cleaned up' by a second model pass", code: CODE_V3 },
];
/** The version that passes every check against the reference spec. */
export const SHIP_VERSION = "v2";
