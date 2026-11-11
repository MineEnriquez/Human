// Static checks for Epiloom Python code written by an LLM (the Model Builder agent).
// It doesn't run Python: it finds every `el.X(...)` call and checks it against the API reference (epiloom.ts) and,
// when given one, against the model spec the researcher agreed to. Shared by the labs, the server tool and tests.
import { DURATION_HELPERS, RATE_HELPERS, SYMBOLS, type Param } from "./epiloom.js";
import type { ModelSpec } from "./spec.js";

export type IssueCategory = "hallucinated-api" | "argument" | "unit" | "requirement" | "reliability";
export type Issue = { line: number; category: IssueCategory; rule: string; message: string; severity: "error" | "warning"; symbol?: string };
export type Call = { name: string; line: number; args: { name: string | null; value: string }[]; raw: string };

/** Find every el.X(...) call, with balanced parentheses, its line and its top-level arguments. */
export function findCalls(code: string): Call[] {
  const calls: Call[] = [];
  const re = /\bel\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const open = re.lastIndex - 1;
    let depth = 0, i = open, inStr: string | null = null;
    for (; i < code.length; i++) {
      const ch = code[i];
      if (inStr) { if (ch === inStr && code[i - 1] !== "\\") inStr = null; continue; }
      if (ch === "'" || ch === '"') { inStr = ch; continue; }
      if ("([{".includes(ch)) depth++;
      else if (")]}".includes(ch) && --depth === 0) break;
    }
    const inner = code.slice(open + 1, i);
    calls.push({ name: m[1], line: code.slice(0, m.index).split("\n").length, args: splitArgs(inner), raw: code.slice(m.index, i + 1) });
  }
  return calls;
}

function splitArgs(inner: string): Call["args"] {
  const parts: string[] = [];
  let depth = 0, cur = "", inStr: string | null = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) { cur += ch; if (ch === inStr && inner[i - 1] !== "\\") inStr = null; continue; }
    if (ch === "'" || ch === '"') { inStr = ch; cur += ch; continue; }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map(p => p.trim()).filter(Boolean).map(p => {
    const kw = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)\s*([\s\S]*)$/.exec(p);
    return kw ? { name: kw[1], value: kw[2].trim() } : { name: null, value: p };
  });
}

/** Unit check for one value: rates need rate helpers, durations need duration helpers; bare numbers are flagged. */
function unitProblems(value: string, unit: Param["unit"]): string[] {
  if (unit !== "rate" && unit !== "duration") return [];
  if (/^(el\.)?(poisson|lognormal)\(/.test(value) || /^[A-Za-z_]\w*$/.test(value)) return []; // distributions and variables are not checked
  const out: string[] = [];
  const want = unit === "rate" ? RATE_HELPERS : DURATION_HELPERS, wrong = unit === "rate" ? DURATION_HELPERS : RATE_HELPERS;
  for (const h of value.matchAll(/el\.([a-z]+)\s*\(/g)) if (wrong.includes(h[1])) out.push(`el.${h[1]}() is a ${unit === "rate" ? "duration" : "rate"}, but this parameter is a ${unit}`);
  const stripped = value.replace(/el\.[a-z]+\s*\([^()]*\)/g, "H").replace(/'[^']*'|"[^"]*"/g, "S");
  if (/(^|[^\w.])\d+(\.\d+)?(?![\w.])/.test(stripped)) out.push(`bare number for a ${unit}: wrap it in ${want.map(w => `el.${w}()`).join(" or ")}`);
  return out;
}

const num = (v?: string) => (v == null ? NaN : Number(v.replace(/_/g, "")));
const argOf = (c: Call, name: string, pos = -1) => c.args.find(a => a.name === name)?.value ?? (pos >= 0 ? c.args.filter(a => !a.name)[pos]?.value : undefined);

export function validateCode(code: string, spec?: ModelSpec | null): Issue[] {
  const issues: Issue[] = [];
  const calls = findCalls(code);
  const add = (i: Issue) => issues.push(i);

  // Subclassing: class X(el.Connector)
  for (const m of code.matchAll(/class\s+\w+\s*\(\s*el\.(\w+)\s*\)/g)) {
    const line = code.slice(0, m.index).split("\n").length;
    if (!SYMBOLS.has(m[1])) add({ line, category: "hallucinated-api", rule: "unknown-symbol", severity: "error", symbol: m[1], message: `el.${m[1]} does not exist in Epiloom.` });
  }

  for (const c of calls) {
    const sym = SYMBOLS.get(c.name);
    if (!sym) { add({ line: c.line, category: "hallucinated-api", rule: "unknown-symbol", severity: "error", symbol: c.name, message: `el.${c.name}() does not exist in Epiloom. Look it up with get_api before using it.` }); continue; }
    if (sym.deprecated) add({ line: c.line, category: "reliability", rule: "deprecated", severity: "warning", symbol: c.name, message: `el.${c.name}() is deprecated since ${sym.deprecated.since}; use ${sym.deprecated.use}.` });
    if (!sym.params.length) continue;
    const positional = c.args.filter(a => !a.name);
    const given = new Map<string, string>();
    positional.forEach((a, i) => { if (sym.params[i]) given.set(sym.params[i].name, a.value); });
    for (const a of c.args.filter(a => a.name)) {
      const p = sym.params.find(x => x.name === a.name);
      if (!p) { add({ line: c.line, category: "argument", rule: "unknown-arg", severity: "error", symbol: c.name, message: `el.${c.name}() has no parameter "${a.name}". Valid: ${sym.params.map(x => x.name).join(", ")}.` }); continue; }
      given.set(a.name!, a.value);
    }
    for (const p of sym.params) {
      const v = given.get(p.name);
      if (v == null) { if (p.required) add({ line: c.line, category: "argument", rule: "missing-arg", severity: "error", symbol: c.name, message: `el.${c.name}() needs "${p.name}" (${p.desc})` }); continue; }
      for (const u of unitProblems(v, p.unit)) add({ line: c.line, category: "unit", rule: "unit", severity: "error", symbol: c.name, message: `el.${c.name}(${p.name}=…): ${u}.` });
      if (p.unit === "probability" && num(v) > 1) add({ line: c.line, category: "unit", rule: "probability-range", severity: "error", symbol: c.name, message: `el.${c.name}(${p.name}=${v}): a probability must be between 0 and 1.` });
    }
  }

  const has = (n: string) => calls.some(c => c.name === n);
  const first = (n: string) => calls.find(c => c.name === n);
  const lineOf = (n: string) => first(n)?.line ?? 1;

  // Structural rules that hold for any model.
  if (has("MaternalNet") && !has("Pregnancy")) add({ line: lineOf("MaternalNet"), category: "requirement", rule: "maternal-needs-pregnancy", severity: "error", message: "el.MaternalNet() makes no mother-child links without el.Pregnancy() in demographics." });
  if (/single_rng\s*=\s*True/.test(code)) add({ line: code.split("\n").findIndex(l => /single_rng\s*=\s*True/.test(l)) + 1, category: "reliability", rule: "crn-off", severity: "error", message: "single_rng=True turns off common random numbers: scenario differences will include random noise." });

  if (!spec) return issues;

  // Spec rules: did the code capture what the researcher asked for?
  const sexual = spec.diseases.some(d => d.transmission === "sexual");
  if (sexual && !has("MFNet") && !has("MSMNet")) add({ line: lineOf(has("RandomNet") ? "RandomNet" : "Sim"), category: "requirement", rule: "sexual-network", severity: "error", message: "The spec has a sexually transmitted disease, but the code has no sexual network (el.MFNet or el.MSMNet)." });
  if (spec.age_assortative) {
    const mf = first("MFNet");
    if (mf && !(num(argOf(mf, "age_assortativity")) > 0)) add({ line: mf.line, category: "requirement", rule: "age-assortative", severity: "error", message: "The spec asks for age-assortative partnerships, but el.MFNet(age_assortativity=…) is missing or 0." });
  }
  for (const d of spec.diseases) {
    const cls = d.name === "hiv" ? "HIV" : d.name === "syphilis" ? "Syphilis" : null;
    if (cls && !has(cls)) add({ line: 1, category: "requirement", rule: "missing-disease", severity: "error", message: `The spec includes ${d.name}, but the code never creates el.${cls}().` });
  }
  if (spec.mtct) {
    if (!has("MaternalNet")) add({ line: lineOf("Sim"), category: "requirement", rule: "mtct-network", severity: "error", message: "The spec includes mother-to-child transmission, but there is no el.MaternalNet()." });
    if (!has("Pregnancy")) add({ line: lineOf("Sim"), category: "requirement", rule: "mtct-pregnancy", severity: "error", message: "Mother-to-child transmission needs el.Pregnancy() (el.Births() makes no mother-child links)." });
    const sy = first("Syphilis");
    if (sy) {
      if (!(num(argOf(sy, "p_congenital", 2)) > 0)) add({ line: sy.line, category: "requirement", rule: "mtct-probability", severity: "error", message: "el.Syphilis(p_congenital=…) is missing or 0, so no congenital cases can occur." });
      if (!/['"]maternal['"]/.test(argOf(sy, "beta", 0) || "")) add({ line: sy.line, category: "requirement", rule: "mtct-beta", severity: "error", message: "el.Syphilis(beta=…) has no 'maternal' route." });
    }
  }
  if (spec.coinfection) {
    const ce = calls.find(c => c.name === "CoinfectionEffect");
    const subclass = /class\s+\w+\s*\(\s*el\.Connector\s*\)/.test(code);
    if (!ce && !subclass) add({ line: lineOf("Sim"), category: "requirement", rule: "coinfection", severity: "error", message: `The spec says ${spec.coinfection.source} changes ${spec.coinfection.target} risk, but there is no connector.` });
    if (ce && !(new RegExp(`['"]${spec.coinfection.source}['"]`).test(argOf(ce, "source") || "") && new RegExp(`['"]${spec.coinfection.target}['"]`).test(argOf(ce, "target") || "")))
      add({ line: ce.line, category: "requirement", rule: "coinfection-direction", severity: "error", message: `el.CoinfectionEffect should have source='${spec.coinfection.source}', target='${spec.coinfection.target}'.` });
  }
  for (const iv of spec.interventions) {
    const named = calls.find(c => ["Campaign", "RoutineDelivery"].includes(c.name) && new RegExp(`['"]${iv.name}['"]`).test(argOf(c, "name") || ""));
    if (!named) { add({ line: lineOf("Sim"), category: "requirement", rule: "missing-intervention", severity: "error", message: `The spec includes the "${iv.name}" intervention, but no el.Campaign / el.RoutineDelivery has name='${iv.name}'.` }); continue; }
    if (iv.delivery === "targeted" && !argOf(named, "eligibility")) add({ line: named.line, category: "requirement", rule: "targeted-eligibility", severity: "error", message: `"${iv.name}" is targeted outreach, but has no eligibility rule, so it reaches everyone.` });
    if (iv.delivery === "campaign" && named.name !== "Campaign") add({ line: named.line, category: "requirement", rule: "delivery-type", severity: "error", message: `"${iv.name}" is a mass campaign; use el.Campaign(years=…).` });
  }
  if (spec.scenarios.length >= 2) {
    // Literal seeds, plus seeds passed through a variable (rand_seed=seed ... seed=3).
    const seeds = [...code.matchAll(/rand_seed\s*=\s*(\d+)/g)].map(m => m[1]);
    for (const v of code.matchAll(/rand_seed\s*=\s*([A-Za-z_]\w*)/g)) seeds.push(...[...code.matchAll(new RegExp(`\\b${v[1]}\\s*=\\s*(\\d+)`, "g"))].map(m => m[1]));
    const distinct = new Set(seeds);
    if (!seeds.length) add({ line: lineOf("Sim"), category: "reliability", rule: "crn-seed", severity: "error", message: "Scenarios are compared, but no rand_seed is set: runs can't be reproduced or compared with common random numbers." });
    else if (distinct.size > 1) add({ line: code.split("\n").findIndex(l => /rand_seed/.test(l)) + 1, category: "reliability", rule: "crn-seed", severity: "error", message: `Scenarios use different seeds (${[...distinct].join(", ")}): the difference between them mixes the intervention effect with random noise. Use one seed for all.` });
  }
  if (spec.scenarios.length) {
    // Every scenario in the spec, including the "doing nothing" baseline, needs its own labelled sim.
    const labels = new Set([...code.matchAll(/(?:\blabel\s*=\s*|make_sim\(\s*)['"]([\w-]+)['"]/g)].map(m => m[1]));
    const wantsBaseline = spec.scenarios.includes("baseline");
    if (!labels.size) add({ line: lineOf("Sim"), category: "requirement", rule: "missing-scenario", severity: "error", message: `The spec compares ${spec.scenarios.join(", ")}, but no sim is labelled with a scenario name${wantsBaseline ? ", and there is no baseline (doing nothing) to compare against" : ""}.` });
    else for (const sc of spec.scenarios) if (!labels.has(sc)) add({ line: lineOf("Sim"), category: "requirement", rule: "missing-scenario", severity: "error", message: sc === "baseline" ? "There is no baseline (doing nothing) sim, so neither strategy can be compared against doing nothing." : `No sim is labelled '${sc}', so that scenario isn't run.` });
  }
  if (spec.horizon) {
    const start = num(/\bstart\s*=\s*(\d{4})/.exec(code)?.[1]), stop = num(/\bstop\s*=\s*(\d{4})/.exec(code)?.[1]);
    if (start !== spec.horizon.start || stop !== spec.horizon.stop) add({ line: lineOf("Sim"), category: "requirement", rule: "horizon", severity: "error", message: `The spec runs ${spec.horizon.start}-${spec.horizon.stop}; the code runs ${isNaN(start) ? "?" : start}-${isNaN(stop) ? "?" : stop}.` });
  }
  return issues.sort((a, b) => a.line - b.line);
}
