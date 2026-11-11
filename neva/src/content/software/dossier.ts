// The case dossier for AI for Software Engineers. Everything here is FICTIONAL: the company, the people,
// the product and the dates. The engineering practices described are real.
import type { Dossier } from "../types";

export const DOSSIER: Dossier = {
  headline: "Lumenrail: launch Instant Payouts on Friday, with AI in the loop",
  summary:
    "Lumenrail (fictional) runs an online booking and payments platform for small businesses. On Friday it launches **Instant Payouts**, " +
    "which sends a business its money minutes after a booking instead of days later. The engineering team already uses an AI [[t|coding assistant]] " +
    "and wants AI in triage, docs and on-call too. You have just joined as the team's AI lead. Over one week you will use " +
    "[[c|large language models]], a [[t|vector database]], [[c|retrieval-augmented generation]] and the [[t|Model Context Protocol]] on real work: " +
    "reviewing the assistant's pull request, de-duplicating support tickets, answering policy questions from the team's own docs, " +
    "connecting the assistant to production tools, and finally leading a 3 a.m. incident. Each time, the AI speeds you up and you are the one who checks it.",
  timeline: [
    { when: "Mon 7 Dec, 10:00", what: "The coding assistant opens PR #482 for the payouts ledger writes.", lesson: "se-llm" },
    { when: "Tue 8 Dec, 14:00", what: "Support asks whether a new payouts ticket is a known bug.", lesson: "se-vdb" },
    { when: "Wed 9 Dec, 11:00", what: "Product asks launch-week policy questions; answers must cite the docs.", lesson: "se-rag" },
    { when: "Wed 9 Dec, 16:30", what: "Security reviews which production tools the assistant may use.", lesson: "se-mcp" },
    { when: "Thu 10 Dec, 03:25", what: "Paged: payouts are failing. You lead the incident.", lesson: "se-capstone" },
    { when: "Fri 11 Dec, 10:00", what: "Instant Payouts launch, if the team can stand behind it." },
  ],
  cast: [
    { name: "Elizabeth Cu", role: "Engineering manager, Payments", needs: "A launch she can defend: no surprises in the code, the docs or on-call" },
    { name: "Tomás Reyes", role: "Staff engineer", needs: "To know which parts of the assistant's PR are real before he approves it" },
    { name: "Leo Brandt", role: "Support lead", needs: "Duplicate tickets linked to the right bug, confirmed as the same bug and not just a similar-sounding one" },
    { name: "Sam Adeyemi", role: "Product manager, Instant Payouts", needs: "Policy answers he can quote, with the sentence they come from" },
    { name: "Kevin Quenka", role: "Security engineer", needs: "An assistant that can read production, not one that can break it" },
    { name: "Hana Okafor", role: "Site reliability engineer, primary on-call this week", needs: "A root cause and a mitigation she can trust at 3 a.m." },
    { name: "You", role: "AI lead, Lumenrail engineering", needs: "To use AI to move fast without letting it decide" },
  ],
  facts: [
    { label: "Product", value: "Instant Payouts, launching Fri 11 Dec 2026, 10:00 (behind the flag `instant_payouts_v2`)" },
    { label: "Services", value: "checkout-web · payouts-api · payouts-worker · auth-service · api-gateway" },
    { label: "Reliability", value: "Payouts API SLO: 99.9% of requests per 30 days" },
    { label: "Team docs", value: "Deploy policy, severity levels, on-call policy, runbooks, SLOs, postmortem template, ADRs" },
    { label: "AI in use", value: "A coding assistant, an embedding model for tickets, a docs Q&A bot, an on-call assistant with tool access" },
  ],
  stakes:
    "If Instant Payouts breaks, small businesses don't get paid, and they notice fast. A [[w|hallucinated API]] in a payments PR, a ticket merged into " +
    "the wrong bug, a policy answer nobody can trace, or an assistant with permission to change production can each turn into an outage or a " +
    "trust problem. The team doesn't want less AI; it wants AI it can check.",
  deadline: "Instant Payouts launch · Fri 11 Dec 2026, 10:00",
};

/** Scene details for each case: who brings it, when, what you hand over, and how it's judged. */
export const SCENES: Record<string, { from: { name: string; role: string; ask: string }; when: string; deliverable: string; success: string[]; hook: string }> = {
  "se-llm": {
    from: { name: "Tomás Reyes", role: "Staff engineer", ask: "The assistant wrote PR #482 and the description sounds great. Before I approve it: which of these claims are actually true?" },
    when: "Mon 7 Dec 2026, 10:00",
    deliverable: "A review of the PR description: every claim marked supported or not by the docs, diff and CI, with the reason.",
    success: ["Catch every invented or contradicted claim", "Explain why an assistant invents plausible APIs and units", "Propose checks that would have caught them automatically"],
    hook: "Code that reads well is not code that runs. Today you'll see why the model can't tell the difference, and how your tests can.",
  },
  "se-vdb": {
    from: { name: "Leo Brandt", role: "Support lead", ask: "A customer changed their bank details and their payout is stuck. Is this a known bug? I don't want to file a fourth duplicate." },
    when: "Tue 8 Dec 2026, 14:00",
    deliverable: "The ticket the new report duplicates, with the similarity evidence and one reason the runner-up is not the same bug.",
    success: ["Run a top-k similarity search and read the scores", "Use metadata filters and show how a wrong filter misleads", "Pick the duplicate and confirm it is the same bug, not just a similar-sounding one"],
    hook: "Similar words, different bugs. A vector database finds look-alikes in milliseconds; deciding which one is the same problem is still your job.",
  },
  "se-rag": {
    from: { name: "Sam Adeyemi", role: "Product manager, Instant Payouts", ask: "Three questions for the launch checklist, and I need the doc sentence behind each answer: can we ship a fix Thursday night, how bad is 8% failures, and what does on-call do first after a bad deploy?" },
    when: "Wed 9 Dec 2026, 11:00",
    deliverable: "Three answers grounded only in the team's docs, every claim with a citation, and an honest 'the docs don't say' where they don't.",
    success: ["Build the retrieval pipeline in the right order", "Pack the context window with the chunks that matter", "Check each citation really supports its claim"],
    hook: "Before you trust an answer, ask where it came from. Before you trust a citation, read it.",
  },
  "se-mcp": {
    from: { name: "Kevin Quenka", role: "Security engineer", ask: "On-call wants the assistant wired to logs, metrics and deploys before the launch. Tell me exactly which tools it gets, and which ones need a human to say yes." },
    when: "Wed 9 Dec 2026, 16:30",
    deliverable: "A tool policy for the on-call MCP server (auto-run, ask first, don't expose) and an audited trace of a live session.",
    success: ["Order a full MCP session from initialize to the model's answer", "Sort every tool by the approval it needs", "Audit a live tool call: what ran, with which arguments, what came back"],
    hook: "Giving a model tools is giving it hands. Decide now which hands need a second person watching.",
  },
  "se-capstone": {
    from: { name: "Hana Okafor", role: "Site reliability engineer, primary on-call", ask: "Payouts are failing and the batch is running. I need the cause, the mitigation, and a postmortem draft we can stand behind." },
    when: "Thu 10 Dec 2026, 03:25",
    deliverable: "An incident report: every event classified, the mitigation chosen, root cause, impact, follow-ups and a blameless postmortem summary.",
    success: ["Classify cause, symptoms and red herrings correctly (checked exactly)", "Choose the right immediate mitigation (checked exactly)", "Explain the root cause from the timeline and metrics, not from guesses", "Write it blameless: what the system allowed, not who to blame"],
    hook: "At 3 a.m. everything looks guilty. Line up the timeline, and let the evidence pick the culprit.",
  },
};
