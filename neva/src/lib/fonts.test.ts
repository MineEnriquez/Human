import { describe, expect, it } from "vitest";
import { registerLicensedFonts } from "./fonts";

describe("licensed fonts", () => {
  it("registers nothing (and requests nothing) when no font files are present", () => {
    expect(registerLicensedFonts()).toBe(0);
    expect(document.querySelector('style[data-fonts="licensed"]')).toBeNull();
  });
});
