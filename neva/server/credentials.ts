// Does this machine have Anthropic credentials the SDK will pick up on its own?
// Either an environment variable (ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN), or an `ant auth login` profile on
// disk. The profile lookup mirrors the SDK's (@anthropic-ai/sdk core/credentials): config dir from
// ANTHROPIC_CONFIG_DIR, else $XDG_CONFIG_HOME/anthropic, else ~/.config/anthropic (Windows: %APPDATA%\Anthropic);
// profile from ANTHROPIC_PROFILE, else <config dir>/active_config, else "default".
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const env = (k: string) => process.env[k]?.trim() || "";

export function configDir(): string | null {
  if (env("ANTHROPIC_CONFIG_DIR")) return env("ANTHROPIC_CONFIG_DIR");
  if (process.platform === "win32") return env("APPDATA") ? join(env("APPDATA"), "Anthropic") : env("USERPROFILE") ? join(env("USERPROFILE"), "AppData", "Roaming", "Anthropic") : null;
  if (env("XDG_CONFIG_HOME")) return join(env("XDG_CONFIG_HOME"), "anthropic");
  return env("HOME") ? join(env("HOME"), ".config", "anthropic") : null;
}

function activeProfile(dir: string): string {
  if (env("ANTHROPIC_PROFILE")) return env("ANTHROPIC_PROFILE");
  try { return readFileSync(join(dir, "active_config"), "utf8").trim() || "default"; } catch { return "default"; }
}

/** An `ant auth login` profile with stored credentials (checked on each call, so logging in needs no restart). */
export function hasLoginProfile(): boolean {
  const dir = configDir();
  return Boolean(dir && existsSync(join(dir, "credentials", `${activeProfile(dir)}.json`)));
}

export type CredentialSource = "api-key" | "auth-token" | "ant-login" | null;

/** Which owner credential the server will use, in the SDK's precedence order. Empty variables count as unset. */
export function credentialSource(): CredentialSource {
  if (env("ANTHROPIC_API_KEY")) return "api-key";
  if (env("ANTHROPIC_AUTH_TOKEN")) return "auth-token";
  return hasLoginProfile() ? "ant-login" : null;
}
