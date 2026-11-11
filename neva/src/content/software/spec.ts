// The structured MODEL SPEC the Model Builder agent writes from a researcher's question, before any code.
// Unknowns are explicit: a good spec says what it doesn't know instead of filling it in.
export type Transmission = "sexual" | "contact" | "none";
export type Delivery = "campaign" | "routine" | "targeted";

export type ModelSpec = {
  question: string;
  diseases: { name: string; transmission: Transmission }[];
  age_assortative: boolean;
  mtct: boolean;
  coinfection: { source: string; target: string } | null;
  interventions: { name: string; delivery: Delivery; target_group: string | null }[];
  scenarios: string[];
  horizon: { start: number; stop: number } | null;
  outcomes: string[];
  /** Things the researcher must decide or the evidence must supply; never invented by the model. */
  needs_clarification: string[];
};

/** The researcher's question for the capstone (fictional). */
export const RESEARCH_QUESTION =
  "Over 2027-2037 in Harbor District (fictional), would a mass syphilis treatment campaign or year-round targeted outreach to a higher-risk group " +
  "prevent more congenital syphilis? Adults have HIV and syphilis; people with HIV are more susceptible to syphilis. Partners tend to be similar in age. " +
  "Compare the strategies fairly against doing nothing, and tell me what the model can and can't say.";

/** The spec that captures the question correctly (the answer key for the capstone review). */
export const REFERENCE_SPEC: ModelSpec = {
  question: RESEARCH_QUESTION,
  diseases: [{ name: "hiv", transmission: "sexual" }, { name: "syphilis", transmission: "sexual" }],
  age_assortative: true,
  mtct: true,
  coinfection: { source: "hiv", target: "syphilis" },
  interventions: [{ name: "mass", delivery: "campaign", target_group: null }, { name: "targeted", delivery: "targeted", target_group: "higher-risk group" }],
  scenarios: ["baseline", "mass", "targeted"],
  horizon: { start: 2027, stop: 2037 },
  outcomes: ["congenital syphilis cases", "syphilis prevalence in adults", "people treated"],
  needs_clarification: ["how the higher-risk group is defined", "campaign coverage and years", "outreach reach per month", "budget: compare at equal cost or equal people treated?"],
};

/** The agent's first draft spec (what the learner reviews in the capstone). It has mistakes on purpose. */
export const DRAFT_SPEC: ModelSpec = {
  question: RESEARCH_QUESTION,
  diseases: [{ name: "hiv", transmission: "sexual" }, { name: "syphilis", transmission: "sexual" }],
  age_assortative: false,
  mtct: true,
  coinfection: { source: "syphilis", target: "hiv" },
  interventions: [{ name: "mass", delivery: "campaign", target_group: null }, { name: "targeted", delivery: "routine", target_group: null }],
  scenarios: ["mass", "targeted"],
  horizon: { start: 2027, stop: 2037 },
  outcomes: ["congenital syphilis cases", "syphilis prevalence in adults"],
  needs_clarification: [],
};

/** Requirements from the question; the learner sorts each into how the draft spec handled it. */
export type ReqClass = "captured" | "wrong" | "missing";
export const REQUIREMENTS: { id: string; label: string; key: ReqClass; why: string }[] = [
  { id: "r1", label: "Two diseases: HIV and syphilis, both sexually transmitted", key: "captured", why: "The draft lists both with sexual transmission." },
  { id: "r2", label: "Congenital syphilis (mother-to-child transmission) is the main outcome", key: "captured", why: "mtct: true and congenital cases are an outcome." },
  { id: "r3", label: "Time horizon 2027-2037", key: "captured", why: "The horizon matches." },
  { id: "r4", label: "People with HIV are more susceptible to syphilis", key: "wrong", why: "The draft reverses the direction: source syphilis, target HIV." },
  { id: "r5", label: "Targeted outreach reaches a higher-risk group year-round", key: "wrong", why: "The draft makes it routine delivery to everyone (no target group): that's a second mass programme." },
  { id: "r6", label: "Partners tend to be similar in age", key: "missing", why: "age_assortative is false; the question asks for it." },
  { id: "r7", label: "Compare against doing nothing (a baseline scenario)", key: "missing", why: "Scenarios list only mass and targeted." },
  { id: "r8", label: "Say what the model can't answer (definitions and budget the researcher must supply)", key: "missing", why: "needs_clarification is empty: the draft silently assumed everything." },
];
