// Production server: serves the built site from dist/ and the /api routes. Run `npm run build` first.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { handleApi } from "./api";

const DIST = join(process.cwd(), "dist");
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json" };
const PORT = Number(process.env.PORT || 8787);

createServer(async (req, res) => {
  const url = (req.url || "/").split("?")[0];
  if (url.startsWith("/api/")) return handleApi(req, res).catch(e => { console.error(e); res.writeHead(500).end(); });
  const file = normalize(join(DIST, url)).startsWith(DIST) ? join(DIST, url) : join(DIST, "index.html");
  try {
    const data = await readFile(extname(file) ? file : join(DIST, "index.html"));
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "text/html; charset=utf-8" }).end(data);
  } catch {
    // Client-side routes (/paths/..., /lesson/...) fall back to the app shell.
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(await readFile(join(DIST, "index.html")));
  }
}).listen(PORT, () => console.log(`Neva on http://localhost:${PORT}`));
