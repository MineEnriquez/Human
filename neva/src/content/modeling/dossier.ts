// The case dossier the whole Disease Modeling path follows. Everything here is FICTIONAL: the district, the people,
// the dates, the studies and the numbers (which are illustrative). The TB biology and modelling concepts are real.
import type { Dossier } from "../types";
import { BUDGET_PER_YEAR, DISTRICT, NOTIFICATIONS, PREVALENCE_SURVEY, START_YEAR } from "./model.js";

const n2025 = NOTIFICATIONS.find(n => n.year === 2025)!.notified;
const usd = (x: number) => "$" + (x / 1e6).toFixed(1) + " million";

export const DOSSIER: Dossier = {
  headline: `${DISTRICT.name}: which TB strategy should we fund?`,
  summary:
    `${DISTRICT.name} (fictional, population ${DISTRICT.population.toLocaleString("en-US")}) has a high burden of [[b|tuberculosis]]. ` +
    `Its TB programme notified ${n2025.toLocaleString("en-US")} people in 2025, and the number has barely moved in a decade. From ${START_YEAR} the district can spend up to ` +
    `${usd(BUDGET_PER_YEAR)} a year on new strategies: [[b|active case finding]] in communities, [[b|TB preventive treatment]] for household contacts, or support to help people finish treatment. ` +
    `The programme's modeller has a [[c|compartmental model]] of TB in the district, a decade of [[b|notifications]], a ${PREVALENCE_SURVEY.year} prevalence survey and the results of three pilots. ` +
    `You are the programme's AI lead: in four days you will use AI to turn that evidence into a projection the District Health Director can act on, and you will be the one who checks the AI.`,
  timeline: [
    { when: "2015-2025", what: `Annual notifications stay around ${Math.round(NOTIFICATIONS[0].notified / 10) * 10}-${Math.round(n2025 / 10) * 10} people a year.` },
    { when: `${PREVALENCE_SURVEY.year}`, what: `District TB prevalence survey: about **${PREVALENCE_SURVEY.perHundredK} per 100,000** with active TB not on treatment.` },
    { when: "2023-2025", what: "Pilots of active case finding, preventive treatment for household contacts, and treatment adherence support." },
    { when: "Oct 2026", what: `Budget note: up to ${usd(BUDGET_PER_YEAR)} a year for new TB strategies from ${START_YEAR}.` },
    { when: "Mon 30 Nov, 09:00", what: "An LLM extracts the model's parameters from the contact cohort report.", lesson: "dm-llm" },
    { when: "Tue 1 Dec, 11:00", what: "Which other districts look like ours, and what did they learn?", lesson: "dm-vdb" },
    { when: "Tue 1 Dec, 15:30", what: "The finance officer's evidence questions for the budget paper.", lesson: "dm-rag" },
    { when: "Wed 2 Dec, 10:00", what: "Programme IT connects the assistant to the model and the surveillance data.", lesson: "dm-mcp" },
    { when: "Thu 3 Dec, 09:00", what: "Strategy meeting. You present the projections and a recommendation.", lesson: "dm-capstone" },
  ],
  cast: [
    { name: "Dr. Amara Osei", role: "District Health Director", needs: "A recommendation she can defend: what to fund, what it buys, and how sure we are" },
    { name: "Joseph Mwale", role: "District TB programme manager", needs: "To know how many people with TB the programme is missing, and which strategy finds or prevents the most" },
    { name: "Dr. Lina Farouk", role: "Programme modeller", needs: "Parameters she can trace to evidence, and a fit that is actually identified" },
    { name: "Grace Tembo", role: "Community health worker lead", needs: "A strategy her teams can deliver in villages and households" },
    { name: "Peter Odhiambo", role: "Laboratory and diagnostics coordinator", needs: "Realistic assumptions about how much more testing case finding would need" },
    { name: "Ruth Banda", role: "Finance officer", needs: "Costs and cases averted per dollar, with the evidence behind each number" },
    { name: "You", role: "AI lead, district TB programme", needs: "To use AI to move fast without letting it decide" },
  ],
  facts: [
    { label: "District", value: `${DISTRICT.name} (fictional), population ${DISTRICT.population.toLocaleString("en-US")}` },
    { label: "Data", value: `Notifications 2015-2025 · prevalence survey ${PREVALENCE_SURVEY.year} · Kestrel Contact Cohort · pilot results` },
    { label: "Model", value: "TB compartments: uninfected, recent and remote latent infection, active TB, on treatment, recovered" },
    { label: "Options", value: `Active case finding · preventive treatment for contacts · adherence support · combinations within ${usd(BUDGET_PER_YEAR)}/year` },
    { label: "Not modelled", value: "Drug-resistant TB, HIV and age structure (stated as limitations)" },
  ],
  stakes:
    "The Director decides where the money goes; that decision belongs to her and the programme. Your job is the evidence it rests on: " +
    "how much TB the district really has, not just how much it [[w|notifies]]; what each strategy would change by 2035, and at what cost per case averted; and how uncertain all of it is. " +
    "A projection that mistakes [[w|notifications for incidence]], or an unidentified fit presented as fact, could send a year's TB budget to the wrong place.",
  deadline: "Strategy meeting · Thu 3 Dec 2026, 09:00",
};

/** Scene details for each case: who brings it, when, what you hand over, and how it's judged. */
export const SCENES: Record<string, { from: { name: string; role: string; ask: string }; when: string; deliverable: string; success: string[]; hook: string }> = {
  "dm-llm": {
    from: { name: "Dr. Lina Farouk", role: "Programme modeller", ask: "I had the assistant pull every parameter out of the contact cohort report overnight. Before I load them into the model, can you check each one against the text?" },
    when: "Mon 30 Nov 2026, 09:00",
    deliverable: "A checked parameter table, a hand-fitted model of the notifications, and a reviewed version of the LLM's model code.",
    success: ["Catch every value with a wrong unit, risk-versus-rate mix-up or no source", "Fit the notifications and explain what the fit can and can't tell you", "Find the bugs in the generated model code"],
    hook: "A rate, a risk and a duration can be written with the same number. The model will believe whichever one you give it.",
  },
  "dm-vdb": {
    from: { name: "Joseph Mwale", role: "District TB programme manager", ask: "Other districts must have faced this. Which ones look like us, and what happened when they tried case finding?" },
    when: "Tue 1 Dec 2026, 11:00",
    deliverable: "The best analogue districts, with the metric and filters you used and what their experience can and can't tell us.",
    success: ["Compare shape-based and size-based similarity and explain the difference", "Use metadata filters for what must match", "Separate reasonable lessons from overreach"],
    hook: "Two districts can share a curve and nothing else. Similar numbers are a lead, not a verdict.",
  },
  "dm-rag": {
    from: { name: "Ruth Banda", role: "Finance officer", ask: "For the budget paper I need three answers with the source sentence behind each: what the prevalence survey found, what preventive treatment would buy, and how fast infected contacts get sick." },
    when: "Tue 1 Dec 2026, 15:30",
    deliverable: "Three answers grounded only in the programme's evidence library, every claim cited, and an honest 'the evidence doesn't say' where it doesn't.",
    success: ["Build the retrieval pipeline in the right order", "Pack the context window with the passages that matter", "Check that each citation supports its claim"],
    hook: "Before you trust an answer, ask where it came from. Before you trust a citation, read it.",
  },
  "dm-mcp": {
    from: { name: "Peter Odhiambo", role: "Laboratory and diagnostics coordinator, acting IT lead", ask: "I can connect the assistant to the model and the surveillance database for tomorrow. Tell me which tools it may use alone and which need someone to say yes." },
    when: "Wed 2 Dec 2026, 10:00",
    deliverable: "A tool policy for the programme's MCP server (auto-run, ask first, don't expose) and a reviewed trace of a live session.",
    success: ["Order a full MCP exchange, from discovering the server to the model's answer", "Sort every tool by the approval it needs", "Audit a live tool call: what ran, with which arguments, what came back"],
    hook: "Giving a model tools is giving it hands. Decide now which hands need a second person watching.",
  },
  "dm-capstone": {
    from: { name: "Dr. Amara Osei", role: "District Health Director", ask: "How much TB do we really have, what would each option change by 2035, and what should we fund with the money we have?" },
    when: "Thu 3 Dec 2026, 09:00",
    deliverable: "A strategy briefing: estimated incidence, projections for each option, a recommendation within the budget, and its assumptions.",
    success: ["Estimate 2025 incidence with a method that is identified (checked exactly)", "Name the single strategy with the largest 2035 reduction (checked exactly)", "Recommend within the budget using cases averted and cost per case averted", "State assumptions and uncertainty; label projections as projections"],
    hook: "Notifications tell you how many people you found. The question on the table is how many you didn't.",
  },
};
