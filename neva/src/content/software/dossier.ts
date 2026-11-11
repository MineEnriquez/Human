// The case dossier for AI for Software Engineers. Everything here is FICTIONAL: Epiloom, the institute, the
// people and the dates. Epiloom's design is modelled on Starsim (starsim.org, MIT licence); the engineering and
// AI practices described are real.
import type { Dossier } from "../types";

export const DOSSIER: Dossier = {
  headline: "Build the Model Builder: an AI agent that writes disease models you can trust",
  summary:
    "Epiloom (fictional) is an open-source Python framework for modelling how diseases spread through a population of simulated people. " +
    "Its design is modelled on [[t|Starsim]] (starsim.org, MIT licence): a Sim assembles pluggable modules for diseases, contact [[b|networks]], " +
    "births and pregnancy, interventions and [[c|connectors]] between diseases, with [[c|common random numbers]] for fair comparisons. " +
    "Researchers at the Harbor Institute for Population Health (fictional) want to ask questions in plain English and get a working model. " +
    "You are the AI lead building the **Model Builder**, a [[c|generative agent]]: it turns a question into a structured spec, finds the right examples and docs, " +
    "writes Epiloom code grounded in them, checks it with tools over [[t|MCP]], and shows how every requirement is met. Over one week you will use " +
    "every idea in this course to make its output reliable, because a confident but wrong model can mislead a real decision.",
  timeline: [
    { when: "Mon 8 Feb 2027, 10:00", what: "A chat model writes Ama's model in seconds. What did it get right?", lesson: "se-llm" },
    { when: "Tue 9 Feb, 11:00", what: "The agent must find the example that fits, not the one that sounds closest.", lesson: "se-vdb" },
    { when: "Tue 9 Feb, 15:00", what: "Every line must trace back to the docs, with citations.", lesson: "se-rag" },
    { when: "Wed 10 Feb, 14:00", what: "Epiloom becomes an MCP server: which tools may the agent run alone?", lesson: "se-mcp" },
    { when: "Thu 11 Feb, 09:00", what: "Ama's real question. Review the agent's spec and code end to end.", lesson: "se-capstone" },
    { when: "Fri 12 Feb, 10:00", what: "Demo to the Harbor Institute researchers." },
  ],
  cast: [
    { name: "Prof. Helen Okoye", role: "Principal investigator, Harbor Institute (product owner)", needs: "A tool her researchers can trust, that says what it doesn't know" },
    { name: "Dr. Ama Mensah", role: "Epidemiologist, sexual and reproductive health", needs: "A model that answers her actual question, with assumptions she can see" },
    { name: "Rosa Lindqvist", role: "Epiloom maintainer", needs: "The agent to use the real API and the right examples, never invented ones" },
    { name: "Daniel Cho", role: "Research software engineer", needs: "Code that runs, is tested and can be reviewed line by line" },
    { name: "Priya Nair", role: "QA and reliability engineer", needs: "Every requirement traced to code and to a check" },
    { name: "Marcus Feld", role: "Security and infrastructure", needs: "An agent that can read and run sandboxed models, not push code or run shell commands" },
    { name: "You", role: "AI lead, Model Builder", needs: "To use AI to move fast without letting it decide" },
  ],
  facts: [
    { label: "Framework", value: "Epiloom (fictional), Python, `import epiloom as el`; design modelled on Starsim" },
    { label: "Modules", value: "Diseases (SIR, SIS, SEIR, HIV, Syphilis, NCD), networks (RandomNet, MFNet, MSMNet, MaternalNet, MixingPool), Pregnancy/Births/Deaths, Campaign/RoutineDelivery, connectors, Calibration" },
    { label: "Levels of detail", value: "Agent-based by default; metapopulation (mixing pools) and compartmental options" },
    { label: "The agent", value: "Question → spec with unknowns → retrieve docs and examples → grounded code → validate and run via MCP tools → traceability report" },
    { label: "Course engine", value: "The capstone's run_model is a simplified two-group engine for comparing scenarios, not a real agent-based run" },
  ],
  stakes:
    "Researchers will use the Model Builder to inform decisions about real programmes. A model that runs but answers a slightly different question, " +
    "uses the [[w|wrong network]], mixes [[w|rates and durations]] or compares scenarios with [[w|different random seeds]] can look convincing and still be wrong. " +
    "Your job is not to make the agent sound sure; it's to make it capture the researcher's needs, show its assumptions, and prove each requirement is met.",
  deadline: "Demo to the researchers · Fri 12 Feb 2027, 10:00",
};

/** Scene details for each case: who brings it, when, what you hand over, and how it's judged. */
export const SCENES: Record<string, { from: { name: string; role: string; ask: string }; when: string; deliverable: string; success: string[]; hook: string }> = {
  "se-llm": {
    from: { name: "Daniel Cho", role: "Research software engineer", ask: "I asked a chat model to set up Ama's syphilis model and it wrote everything in seconds. Before anyone runs it: what did it actually get right?" },
    when: "Mon 8 Feb 2027, 10:00",
    deliverable: "A reviewed spec (captured, wrong, or a question to ask) and the validator's findings on the generated code, sorted by kind.",
    success: ["Separate what the question said from what the model filled in", "Explain why fluent code invents APIs and slips units", "Propose a spec-first, validated workflow"],
    hook: "Code that runs is not code that answers the question. Today you'll see how a model fills the gaps, and how to make it ask instead.",
  },
  "se-vdb": {
    from: { name: "Rosa Lindqvist", role: "Epiloom maintainer", ask: "The agent copies patterns from our examples library. Make sure it finds the example that fits the question, not just the one that sounds closest." },
    when: "Tue 9 Feb, 11:00",
    deliverable: "A search setup that finds the right example for congenital syphilis on a sexual network, and an explanation of why the closest match is wrong.",
    success: ["Read a similarity search and its scores", "Use metadata filters to narrow by module kind, feature and level of detail", "Pick the example that fits the spec, not the closest one"],
    hook: "Similar is cheap to find. Right takes a spec.",
  },
  "se-rag": {
    from: { name: "Priya Nair", role: "QA and reliability engineer", ask: "Every line the agent writes should trace back to a doc page. Show me three API answers from our docs only, with citations." },
    when: "Tue 9 Feb, 15:00",
    deliverable: "Three answers about Epiloom grounded only in its docs, every claim cited, and an honest 'the docs don't say' where they don't.",
    success: ["Build the retrieval pipeline in the right order", "Pack the context with the chunks that matter (not the deprecated page)", "Check that each citation supports its claim"],
    hook: "If you can't point to the page, you don't know it. Neither does the model.",
  },
  "se-mcp": {
    from: { name: "Marcus Feld", role: "Security and infrastructure", ask: "We're exposing Epiloom to the agent as an MCP server. Tell me which tools it can run on its own, and which need a person." },
    when: "Wed 10 Feb, 14:00",
    deliverable: "A tool policy for the Epiloom MCP server (auto-run, ask first, don't expose) and a reviewed trace of a live session.",
    success: ["Order a full MCP session from initialize to the model's answer", "Sort every tool by the approval it needs", "Spot an instruction hidden in a README and refuse it"],
    hook: "Tools turn an agent from a talker into an actor. Decide what it may do before it decides for you.",
  },
  "se-capstone": {
    from: { name: "Dr. Ama Mensah", role: "Epidemiologist, Harbor Institute", ask: "Would a mass syphilis treatment campaign or year-round targeted outreach prevent more congenital syphilis over the next ten years? People with HIV are more susceptible, partners tend to be similar in age. Compare fairly, and tell me what the model can't say." },
    when: "Thu 11 Feb, 09:00",
    deliverable: "A reviewed spec, the code version you'd ship (or the issues blocking it), and a report: what the model can and can't answer, clarifying questions, reliability checks and traceability.",
    success: ["Sort every requirement into captured, wrong or missing (checked exactly)", "Ship only code that passes every check against the reviewed spec (checked exactly)", "Ask the researcher what only she can decide", "Show how each requirement is met and verified"],
    hook: "The agent can write the model in a minute. Your job is the next hour: making sure it's the right model.",
  },
};
