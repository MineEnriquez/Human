import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Rich, RichInline } from "./Rich";

const html = (t: string) => renderToStaticMarkup(<Rich text={t} />);

describe("Rich markup renderer", () => {
  it("renders the four keyword colours", () => {
    const h = html("[[c|embedding]] [[b|ST258]] [[t|MCP server]] [[w|hallucination]]");
    for (const k of ["k-c", "k-b", "k-t", "k-w"]) expect(h).toContain(`class="k ${k}"`);
    expect(h).toContain(">embedding</span>");
  });
  it("renders bold, code, nested keywords in bold, lists and headings", () => {
    expect(html("**bold [[c|x]]**")).toContain('<strong>bold <span class="k k-c"');
    expect(html("use `tools/call`")).toContain("<code>tools/call</code>");
    expect(html("- a\n- b")).toBe('<div class="read"><ul><li>a</li><li>b</li></ul></div>');
    expect(html("1. a\n2. b")).toContain("<ol><li>a</li><li>b</li></ol>");
    expect(html("#### Title\nbody")).toContain("<h4>Title</h4><p>body</p>");
  });
  it("renders Markdown tables", () => {
    const h = html("| Pair | SNPs |\n|---|---|\n| KP-01 ↔ KP-03 | **7** |");
    expect(h).toContain("<th>Pair</th>");
    expect(h).toContain("<td><strong>7</strong></td>");
  });
  it("never injects HTML from model output", () => {
    const h = html('<script>alert(1)</script> [[w|<img src=x onerror=alert(1)>]]');
    expect(h).not.toContain("<script>");
    expect(h).not.toContain("<img");
    expect(h).toContain("&lt;script&gt;");
  });
  it("leaves unknown markup kinds as text", () => {
    expect(renderToStaticMarkup(<RichInline text="[[x|nope]]" />)).toBe("[[x|nope]]");
  });
});
