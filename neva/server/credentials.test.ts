// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { credentialSource, hasLoginProfile } from "./credentials";
import { handleApi } from "./api";

let dir = "";
const env = { ...process.env };
const profile = (name: string) => { mkdirSync(join(dir, "credentials"), { recursive: true }); writeFileSync(join(dir, "credentials", `${name}.json`), "{}"); };
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "neva-ant-"));
  process.env.ANTHROPIC_CONFIG_DIR = dir;
  process.env.ANTHROPIC_API_KEY = "";
  process.env.ANTHROPIC_AUTH_TOKEN = "";
  delete process.env.ANTHROPIC_PROFILE;
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); process.env = { ...env }; });

describe("ant auth login detection", () => {
  it("finds no credentials in an empty config dir", () => {
    expect(hasLoginProfile()).toBe(false);
    expect(credentialSource()).toBeNull();
  });
  it("uses the default profile written by `ant auth login`", () => {
    profile("default");
    expect(credentialSource()).toBe("ant-login");
  });
  it("follows active_config and ANTHROPIC_PROFILE", () => {
    profile("work");
    writeFileSync(join(dir, "active_config"), "work\n");
    expect(hasLoginProfile()).toBe(true);
    process.env.ANTHROPIC_PROFILE = "missing";
    expect(hasLoginProfile()).toBe(false);
  });
  it("lets an API key or auth token win, and treats empty ones as unset", () => {
    profile("default");
    process.env.ANTHROPIC_AUTH_TOKEN = "tok";
    expect(credentialSource()).toBe("auth-token");
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    expect(credentialSource()).toBe("api-key");
    process.env.ANTHROPIC_API_KEY = "  ";
    process.env.ANTHROPIC_AUTH_TOKEN = "";
    expect(credentialSource()).toBe("ant-login");
  });
  it("makes /api/status report AI on with only a login profile", async () => {
    profile("default");
    const req = Object.assign(new EventEmitter(), { method: "GET", url: "/api/status", headers: {}, socket: {} }) as unknown as IncomingMessage;
    let out = "";
    const res = { writeHead() { return this; }, end(c?: string) { out += c || ""; } } as unknown as ServerResponse;
    await handleApi(req, res);
    expect(JSON.parse(out)).toMatchObject({ ai: true, source: "ant-login" });
  });
});
