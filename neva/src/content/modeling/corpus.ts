// FICTIONAL evidence library of the Port Calder Health Department modeling cell, already chunked.
// Every study, team and number here is invented for teaching. General definitions are real.
// Used by the RAG lab and by the capstone agent's search_evidence tool.
import { makeSearch, type Chunk } from "../search.js";

export const CHUNKS: Chunk[] = [
  // HHS: fictional household transmission study
  { id: "HHS-1", doc: "HHS", title: "Harbourside Household Study (fictional): design", text: "The Harbourside Household Study followed 212 households with a confirmed CRV case in Port Calder. Household contacts were swabbed every day for 14 days and asked to report symptom onset dates." },
  { id: "HHS-2", doc: "HHS", title: "HHS: incubation period", text: "Among 96 contacts with a single known exposure day, the mean incubation period from exposure to symptom onset was 4.1 days (range 2-8 days)." },
  { id: "HHS-3", doc: "HHS", title: "HHS: secondary attack rate", text: "The household secondary attack rate was 18%: 142 of 789 household contacts became infected within 14 days of the first case's symptom onset." },
  { id: "HHS-4", doc: "HHS", title: "HHS: serial interval", text: "The mean serial interval, the time between symptom onset in the first case and symptom onset in the household contact they infected, was 6.8 days. Some pairs had negative serial intervals, which can happen when transmission occurs before the infector develops symptoms and the contact's incubation period is short enough that their symptoms start first." },

  // VCS: fictional viral culture study
  { id: "VCS-1", doc: "VCS", title: "Viral Culture Substudy (fictional): latent period", text: "Daily cultures from 61 newly infected contacts first grew live virus a mean of 3.0 days after exposure. The modeling cell uses this as the mean latent period: the time from infection until a person becomes infectious." },
  { id: "VCS-2", doc: "VCS", title: "VCS: infectious period", text: "Live virus could be cultured for a mean of 4.0 days after it was first detected. The modeling cell uses this as the mean infectious period." },

  // SERO: fictional seroprevalence pilot
  { id: "SERO-1", doc: "SERO", title: "Seroprevalence pilot (fictional): reporting fraction", text: "A blood-donor antibody pilot in week 5 estimated that about 30% of CRV infections in Port Calder appear in the reported case counts. Mild and asymptomatic infections are usually never tested." },

  // CONTACT: fictional contact survey
  { id: "CON-1", doc: "CONTACT", title: "Port Calder contact survey (fictional): who meets whom", text: "In the 2025 contact diary survey, children aged 5-17 reported the most daily contacts, mostly at school. School contacts made up about one third of all reported close contacts in the city." },
  { id: "CON-2", doc: "CONTACT", title: "Contact survey: school closure scenario", text: "Allowing for children meeting more often outside school when schools close, the survey team estimates that a full school closure would cut overall transmission-relevant contacts by 20-30%. The cell uses 25% as its central assumption." },

  // NOTE: modeling cell method notes
  { id: "NOTE-1", doc: "NOTE", title: "Method note: incubation vs latent period", text: "The incubation period runs from infection to symptom onset. The latent period runs from infection to the start of infectiousness. They differ: if the latent period is shorter than the incubation period, people can transmit before they feel ill. SEIR models need the latent period, not the incubation period." },
  { id: "NOTE-2", doc: "NOTE", title: "Method note: serial vs generation interval", text: "The generation interval is the time between infection of an infector and infection of the person they infect. The serial interval is the time between their symptom onsets. Under common assumptions the two have similar means, but the serial interval is more variable and can be negative. For an SEIR model with exponentially distributed periods, the mean generation interval equals the mean latent period plus the mean infectious period." },
  { id: "NOTE-3", doc: "NOTE", title: "Method note: from growth rate to R", text: "Early in an epidemic, cases grow roughly exponentially at rate r per day, and the doubling time is ln(2)/r. For an SEIR model with exponentially distributed latent and infectious periods, R0 = (1 + r × mean latent period) × (1 + r × mean infectious period). Fit r only to the exponential phase, after the first noisy days." },
  { id: "NOTE-4", doc: "NOTE", title: "Method note: R0 and Rt", text: "R0 is the average number of people one case infects in a fully susceptible population. Rt is the effective reproduction number at time t, which falls as people become immune or contacts are reduced. An epidemic grows while Rt is above 1 and shrinks when it falls below 1." },
  { id: "NOTE-5", doc: "NOTE", title: "Method note: reporting does not change growth", text: "A constant reporting fraction scales the case curve down but does not change its growth rate or its timing. It does matter when converting reported cases into infections or hospital demand." },

  // SOP: forecast release policy
  { id: "SOP-1", doc: "SOP", title: "Forecast SOP: release rules", text: "No forecast leaves the modeling cell without review by a second modeler and sign-off by the Director of Public Health. Every published forecast shows a range of scenarios, states its key assumptions, and is labelled as a projection, not a prediction." },
];

export const search = makeSearch(CHUNKS);

/** Questions offered in the RAG lab, with the chunks a good answer needs (checked by the tests). */
export const RAG_QUESTIONS: { q: string; needs: string[] }[] = [
  { q: "How long is CRV's mean latent period and mean infectious period, from the culture data?", needs: ["VCS-1", "VCS-2"] },
  { q: "What fraction of CRV infections end up in the reported case counts?", needs: ["SERO-1"] },
  { q: "How much would closing schools reduce transmission contacts?", needs: ["CON-2"] },
];
