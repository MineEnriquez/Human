// FICTIONAL evidence library of the Kestrel Valley District TB programme, already chunked.
// District studies, pilots, people and numbers are invented for teaching; general background notes describe real TB
// biology and programme concepts. Model values are illustrative. Used by the RAG lab and the capstone's search_evidence tool.
import { makeSearch, type Chunk } from "../search.js";
import { PREVALENCE_SURVEY } from "./model.js";

export const CHUNKS: Chunk[] = [
  // BG: background notes (real concepts, stated generally)
  { id: "BG-1", doc: "Background", title: "Background: how TB spreads", text: "Tuberculosis is caused by the bacterium Mycobacterium tuberculosis. It spreads through the air when a person with active TB of the lungs coughs or speaks. People with latent infection have no symptoms and are not infectious." },
  { id: "BG-2", doc: "Background", title: "Background: infection is not disease", text: "Most people infected with M. tuberculosis never develop active TB. A commonly cited estimate is a lifetime risk of roughly 5-10% for people without HIV, with much of that risk in the first two years after infection. HIV, malnutrition, diabetes and some other conditions raise the risk." },
  { id: "BG-3", doc: "Background", title: "Background: notifications are not incidence", text: "Notifications count people diagnosed with TB and reported to the programme. Incidence is the number of new cases of active TB that occur, detected or not. The gap between them is made up of people who are never diagnosed, diagnosed late, or diagnosed but not reported." },
  { id: "BG-4", doc: "Background", title: "Background: treatment and drug resistance", text: "Drug-susceptible TB is treated with a combination of antibiotics, usually for about six months; shorter regimens are recommended for some groups. Stopping treatment early risks relapse and drug resistance. Drug-resistant TB needs different regimens and is not separated in the district's model." },

  // KCC: fictional household contact cohort
  { id: "KCC-1", doc: "KCC", title: "Kestrel Contact Cohort (fictional): design", text: "The Kestrel Contact Cohort followed 1,840 household contacts of people with pulmonary TB in the district for five years, screening them every six months." },
  { id: "KCC-2", doc: "KCC", title: "KCC: progression after recent infection", text: "Among contacts who were newly infected, about 7% developed active TB, most of them within two years of infection. For its model the programme uses a progression rate of 0.07 per year from recent infection and a rate of 0.93 per year for moving from recent to remote (stable) latent infection, so people spend about one year, on average, in the recent-infection stage." },
  { id: "KCC-3", doc: "KCC", title: "KCC: reactivation of remote infection", text: "After the first few years, the risk of progressing from latent infection is much lower. The model uses a reactivation rate of 0.0006 per year for remote latent infection, about a 2-3% risk over 40 years at a constant rate (illustrative)." },
  { id: "KCC-4", doc: "KCC", title: "Model note: untreated active TB", text: "In the programme's model, untreated active TB ends through self-cure or TB death at about 0.2 per year each (illustrative values), and people are diagnosed and start treatment at the detection rate δ (per year). This rate is not the same as notifications ÷ incidence, which WHO calls treatment coverage." },

  // PREV: fictional prevalence survey
  { id: "PREV-1", doc: "PREV", title: `District TB prevalence survey ${PREVALENCE_SURVEY.year} (fictional)`, text: `The ${PREVALENCE_SURVEY.year} household survey screened a random sample of adults with symptom questions, chest X-ray and molecular testing. Extrapolated to the whole population, it estimated about ${PREVALENCE_SURVEY.perHundredK} people with active TB per 100,000 population who were not on treatment (real surveys usually report per 100,000 adults and measure bacteriologically confirmed pulmonary TB) (95% interval ${Math.round(PREVALENCE_SURVEY.perHundredK * 0.8)}-${Math.round(PREVALENCE_SURVEY.perHundredK * 1.2)}).` },
  { id: "PREV-2", doc: "PREV", title: "Method note: why the survey matters", text: "Notifications alone cannot tell the model whether there is a lot of TB with poor detection or less TB with good detection: both produce similar notification counts. The prevalence survey measures how many undetected cases there are, which separates transmission from detection when the model is fitted." },

  // PILOT: fictional programme pilots and costs
  { id: "ACF-1", doc: "PILOT", title: "Active case finding pilot (fictional)", text: "A 2023 pilot screened communities with mobile chest X-ray and molecular testing. Scaled up district-wide, the programme estimates it would raise the detection rate from 0.70 to 1.10 per year, at about 1.2 million dollars per year. In other districts, notifications first rose as undetected cases were found, then fell." },
  { id: "TPT-1", doc: "PILOT", title: "TB preventive treatment for household contacts (fictional pilot)", text: "Offering TB preventive treatment to household contacts of notified patients is estimated to prevent about 20% of progression from recent infection across the district, allowing for coverage and completion. Cost: about 600,000 dollars per year." },
  { id: "TX-1", doc: "PILOT", title: "Treatment adherence support (fictional pilot)", text: "In 2025, 80% of people who started treatment completed it successfully; most of the rest were lost to follow-up. Adherence support with transport vouchers and community follow-up raised success to about 90% in the pilot clinics, at about 500,000 dollars per year district-wide." },
  { id: "BUD-1", doc: "BUDGET", title: "District budget note (fictional)", text: "From 2027 the district can fund new TB strategies up to 1.2 million dollars per year. Options can be combined if their total cost stays within the budget." },

  // SOP
  { id: "SOP-1", doc: "SOP", title: "Projection SOP: release rules", text: "No projection leaves the programme without review by a second modeller and sign-off by the District Health Director. Every published projection shows scenarios, states its key assumptions and uncertainties, and is labelled as a projection, not a prediction." },
];

export const search = makeSearch(CHUNKS);

/** Questions offered in the RAG lab, with the chunks a good answer needs (checked by the tests). */
export const RAG_QUESTIONS: { q: string; needs: string[] }[] = [
  { q: "What did the district's prevalence survey find about undetected active TB?", needs: ["PREV-1"] },
  { q: "How much progression would preventive treatment for household contacts prevent, and at what cost?", needs: ["TPT-1"] },
  { q: "What share of newly infected household contacts developed active TB, and how quickly?", needs: ["KCC-2"] },
];
