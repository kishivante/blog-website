import { describe, expect, it } from "vitest";
import {
  COMMENT_EDIT_WINDOW_MS,
  COMMENT_MAX_DEPTH,
  normalizeCommentContent,
} from "@/validators/comment";
import { reportSchema } from "@/validators/report";

describe("yorum güvenlik kuralları", () => {
  it("boşlukları normalize eder ve makul metni kabul eder", () => {
    expect(normalizeCommentContent("  Güzel   bir yazı.  ")).toBe(
      "Güzel bir yazı.",
    );
  });

  it("üçten fazla bağlantıyı ve aşırı uzun içeriği reddeder", () => {
    expect(() =>
      normalizeCommentContent(
        "https://a.test https://b.test https://c.test https://d.test",
      ),
    ).toThrow("en fazla 3 bağlantı");
    expect(() => normalizeCommentContent("a".repeat(3001))).toThrow("2–3000");
  });

  it("derinlik ve düzenleme penceresini sabit tutar", () => {
    expect(COMMENT_MAX_DEPTH).toBe(3);
    expect(COMMENT_EDIT_WINDOW_MS).toBe(30 * 60 * 1000);
  });
});

describe("rapor doğrulaması", () => {
  it("desteklenen hedef ve nedenleri kabul eder", () => {
    expect(
      reportSchema.parse({
        targetType: "COMMENT",
        targetId: "comment-id",
        reason: "SPAM",
        details: "Tekrarlanan içerik",
      }),
    ).toMatchObject({ targetType: "COMMENT", reason: "SPAM" });
  });

  it("bilinmeyen hedefi ve uzun açıklamayı reddeder", () => {
    expect(
      reportSchema.safeParse({
        targetType: "WIKI",
        targetId: "id",
        reason: "SPAM",
        details: "",
      }).success,
    ).toBe(false);
    expect(
      reportSchema.safeParse({
        targetType: "POST",
        targetId: "id",
        reason: "OTHER",
        details: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });
});
