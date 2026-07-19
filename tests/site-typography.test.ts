import { describe, expect, it } from "vitest";
import {
  MAX_BASE_FONT_SIZE,
  MIN_BASE_FONT_SIZE,
  SITE_FONT_FAMILIES,
} from "@/lib/site-typography";

describe("site tipografi sınırları", () => {
  it("yalnızca güvenli ve önceden tanımlanmış font yığınlarını sunar", () => {
    expect(SITE_FONT_FAMILIES).toEqual([
      "Arial, Helvetica, sans-serif",
      "Inter, Arial, sans-serif",
      "Georgia, serif",
    ]);
    expect(SITE_FONT_FAMILIES).not.toContain("url(evil-font)");
  });

  it("erişilebilir temel yazı boyutu aralığını sınırlar", () => {
    expect(MIN_BASE_FONT_SIZE).toBe(14);
    expect(MAX_BASE_FONT_SIZE).toBe(20);
  });
});
