// Renders the course's lightweight markup to React elements (no innerHTML, so model output is safe):
//   [[c|concept]] [[b|biology]] [[t|tool]] [[w|warning]]  -> coloured keyword highlights
//   **bold**  `code`  paragraphs, "- " bullet lists, "1. " numbered lists, "#### " sub-headings
import { Fragment, type ReactNode } from "react";

const KIND: Record<string, string> = { c: "Core AI concept", b: "Biology / data", t: "Tool or system", w: "Pitfall" };

function inline(s: string, key = ""): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[\[([cbtw])\|([^\]]+)\]\]|\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0, m: RegExpExecArray | null, n = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const k = key + n++;
    if (m[1]) out.push(<span key={k} className={`k k-${m[1]}`} title={KIND[m[1]]}>{m[2]}</span>);
    else if (m[3]) out.push(<strong key={k}>{inline(m[3], k + ".")}</strong>);
    else out.push(<code key={k}>{m[4]}</code>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function Rich({ text, className = "read" }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(l => l.trim());
        if (!lines.length) return null;
        if (lines.length >= 2 && lines.every(l => /^\s*\|.*\|\s*$/.test(l))) {
          const rows = lines.filter(l => !/^\s*\|[\s:|-]+\|\s*$/.test(l)).map(l => l.trim().slice(1, -1).split("|").map(c => c.trim()));
          return <div key={i} className="scroll-x"><table className="t" style={{ margin: "0 0 .9em" }}><thead><tr>{rows[0].map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead><tbody>{rows.slice(1).map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c, `${i}.${j}.${k}.`)}</td>)}</tr>)}</tbody></table></div>;
        }
        if (lines.every(l => /^\s*[-*] /.test(l))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*] /, ""), `${i}.${j}.`)}</li>)}</ul>;
        if (lines.every(l => /^\s*\d+[.)] /.test(l))) return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)] /, ""), `${i}.${j}.`)}</li>)}</ol>;
        if (/^#{2,4} /.test(lines[0])) return <Fragment key={i}><h4>{inline(lines[0].replace(/^#+ /, ""))}</h4>{lines.length > 1 && <p>{inline(lines.slice(1).join(" "))}</p>}</Fragment>;
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, `${i}.${j}.`)}</Fragment>)}</p>;
      })}
    </div>
  );
}

/** Inline-only variant for short strings (buttons, options, table cells). */
export const RichInline = ({ text }: { text: string }) => <>{inline(text)}</>;

export function Legend() {
  return (
    <div className="legend" aria-label="Colour key">
      <span>Colour key:</span>
      <span className="k k-c">concept</span>
      <span className="k k-b">biology / data</span>
      <span className="k k-t">tool / system</span>
      <span className="k k-w">pitfall</span>
    </div>
  );
}
