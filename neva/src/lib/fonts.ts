// Licensed webfonts, if present. Drop the WOFF2 files from your Graphik (Commercial Type) and Tiempos (Klim)
// webfont licenses into src/assets/fonts/ using the names listed in src/assets/fonts/README.md, and they are
// bundled and registered automatically. With no files, nothing is registered and the free stand-ins are used
// (no 404s, no console errors).
const files = import.meta.glob("../assets/fonts/*.woff2", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

type Face = { family: string; weight: number; style: "normal" | "italic" };
const FACES: Record<string, Face> = {
  "Graphik-Regular": { family: "Graphik Web", weight: 400, style: "normal" },
  "Graphik-RegularItalic": { family: "Graphik Web", weight: 400, style: "italic" },
  "Graphik-Medium": { family: "Graphik Web", weight: 500, style: "normal" },
  "Graphik-Semibold": { family: "Graphik Web", weight: 600, style: "normal" },
  "Graphik-Bold": { family: "Graphik Web", weight: 700, style: "normal" },
  "Graphik-BoldItalic": { family: "Graphik Web", weight: 700, style: "italic" },
  "Graphik-Black": { family: "Graphik Web", weight: 900, style: "normal" },
  "TiemposText-Regular": { family: "TiemposText", weight: 400, style: "normal" },
  "TiemposText-RegularItalic": { family: "TiemposText", weight: 400, style: "italic" },
  "TiemposText-Semibold": { family: "TiemposText", weight: 600, style: "normal" },
  "TiemposText-SemiboldItalic": { family: "TiemposText", weight: 600, style: "italic" },
  "TiemposFine-Light": { family: "TiemposFine", weight: 300, style: "normal" },
  "TiemposFine-LightItalic": { family: "TiemposFine", weight: 300, style: "italic" },
};

export function registerLicensedFonts() {
  const rules = Object.entries(files).flatMap(([path, url]) => {
    const name = path.split("/").pop()!.replace(/\.woff2$/, "");
    const f = FACES[name];
    return f ? [`@font-face{font-family:"${f.family}";src:url("${url}") format("woff2");font-weight:${f.weight};font-style:${f.style};font-display:swap}`] : [];
  });
  if (!rules.length) return 0;
  const el = document.createElement("style");
  el.dataset.fonts = "licensed";
  el.textContent = rules.join("\n");
  document.head.append(el);
  return rules.length;
}
