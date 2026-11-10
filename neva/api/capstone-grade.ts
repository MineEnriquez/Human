// Vercel function: forwards to the shared handler (the URL path selects the endpoint).
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleApi } from "../server/api.js";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleApi(req, res);
}
