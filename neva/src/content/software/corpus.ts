// FICTIONAL internal docs of Lumenrail's engineering team (runbooks, policies, ADRs), already chunked by heading.
// The practices they describe (canary deploys, rollback first for deploy-correlated incidents, severity levels,
// error budgets, blameless postmortems, idempotency keys) are real industry practice; the documents, numbers and
// thresholds are invented for the case.
// Used by the RAG lab and by the capstone agent's search_runbooks tool.
import { makeSearch, type Chunk } from "../search.js";

export const CHUNKS: Chunk[] = [
  // Deploy policy
  { id: "DEP-1", doc: "Deploy policy", title: "Deploy policy: launch freeze", text: "No deploys to payments services in the 24 hours before a launch, except fixes for a Sev1 incident approved by the engineering manager. During the freeze, merge to main but do not ship." },
  { id: "DEP-2", doc: "Deploy policy", title: "Deploy policy: canary", text: "Every deploy goes through the pipeline: 5% of traffic for 10 minutes, then 50%, then 100%. The canary stops automatically if the error rate rises above 1%. Config changes count as deploys." },
  { id: "DEP-3", doc: "Deploy policy", title: "Deploy policy: rolling back", text: "If an incident starts within an hour of a deploy to the affected service, roll that deploy back first and investigate after. Rollback is a one-click pipeline action and needs no approval during an incident." },

  // Severity definitions
  { id: "SEV-1", doc: "Severity levels", title: "Severity levels: Sev1", text: "Sev1: a customer-facing outage, or more than 5% of payment or payout requests failing. Page the primary on-call, name an incident commander, and post a status page update within 15 minutes." },
  { id: "SEV-2", doc: "Severity levels", title: "Severity levels: Sev2 and Sev3", text: "Sev2: degraded service or one feature broken for some customers; fix within one business day. Sev3: minor issue with a workaround; schedule normally." },

  // On-call
  { id: "ONC-1", doc: "On-call policy", title: "On-call policy: paging and escalation", text: "The primary on-call acknowledges a page within 5 minutes. If a page is not acknowledged in 15 minutes it escalates to the secondary. For Sev1, the incident commander coordinates; the on-call engineer focuses on mitigation." },

  // Runbooks
  { id: "RB-POOL-1", doc: "Runbook: database connection pool", title: "Runbook: pool exhausted, symptoms", text: "Symptoms: 'timed out acquiring a connection from the pool', HTTP 503s, p99 latency near the 3-second acquire timeout. Compare db_pool_in_use with db_pool_max: if they are equal, the pool is exhausted." },
  { id: "RB-POOL-2", doc: "Runbook: database connection pool", title: "Runbook: pool exhausted, what to do", text: "Check for a recent deploy or config change to the pool size first; if one exists, roll it back. Do not restart the database. If no change explains it, look for slow queries holding connections. The pool size per pod times the number of pods must stay below the database's max_connections." },
  { id: "RB-5XX-1", doc: "Runbook: 5xx spike", title: "Runbook: 5xx spike on an API", text: "Line up the error onset with the deploy history before anything else. A traffic increase that started earlier without errors is unlikely to be the cause. Check the service's own dependencies (database, queues) before other services." },

  // Reliability
  { id: "SLO-1", doc: "Service level objectives", title: "SLOs: payouts API", text: "The payouts API has an availability SLO of 99.9% of requests per 30 days. The error budget is the remaining 0.1%. If the budget is spent, feature launches for the service pause until reliability work brings it back." },
  { id: "PM-1", doc: "Postmortem template", title: "Postmortems: blameless format", text: "Every Sev1 gets a blameless postmortem within five business days: timeline, customer impact, root cause, contributing factors, what went well, and action items with owners and dates. Describe what the system allowed, not who to blame." },

  // ADRs
  { id: "ADR-014", doc: "ADR-014", title: "ADR-014: idempotency keys for ledger writes", text: "Every ledger write carries an idempotency key. Clients retry failed writes with the same key, so a retried request is applied at most once." },
  { id: "ADR-021", doc: "ADR-021", title: "ADR-021 (superseded by ADR-027): feature flags default on", text: "Status: superseded. New feature flags default to on in staging and production." },
  { id: "ADR-027", doc: "ADR-027", title: "ADR-027: feature flags default off", text: "Status: accepted, replaces ADR-021. New feature flags default to off. Launch flags ramp 1%, 10%, 50%, 100%, with a check of error rates between steps." },
];

export const search = makeSearch(CHUNKS);

/** The three RAG lab questions, with the chunk each one needs. */
export const RAG_QUESTIONS: { q: string; needs: string }[] = [
  { q: "Can we deploy a fix to payouts on Thursday evening, the day before the launch?", needs: "DEP-1" },
  { q: "Payout requests are failing at 8%. What severity is this and what must happen in the first 15 minutes?", needs: "SEV-1" },
  { q: "Errors spiked right after a deploy. What should on-call do first?", needs: "DEP-3" },
];
