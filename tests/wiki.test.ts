import { describe, expect, it, vi } from "vitest";
import { wikiFormSchema, wikiSearchSchema } from "@/validators/wiki";

vi.mock("server-only", () => ({}));

const content = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Güvenlik" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Hesabınızı güvenli tutun." }],
    },
  ],
};

describe("Wiki doğrulaması", () => {
  it("geçerli yönetim formunu kabul eder", () => {
    const result = wikiFormSchema.parse({
      title: "Hesap güvenliği rehberi",
      slug: "hesap-guvenligi-rehberi",
      summary:
        "Hesap güvenliği özelliklerinin yönetimine ilişkin güncel rehber.",
      content: JSON.stringify(content),
      categoryId: "",
      tagIds: [],
      linkedPageIds: [],
      changeSummary: "Güvenlik bölümü güncellendi.",
      status: "PUBLISHED",
      locked: false,
      lockedReason: "",
      version: 1,
    });
    expect(result.status).toBe("PUBLISHED");
  });

  it("geçersiz slug ve aşırı sayıda bağlantılı sayfayı reddeder", () => {
    const result = wikiFormSchema.safeParse({
      title: "Geçerli bir başlık",
      slug: "Geçersiz Slug",
      summary: "Yeterli uzunlukta Wiki sayfası açıklaması burada bulunur.",
      content: JSON.stringify(content),
      tagIds: [],
      linkedPageIds: Array.from({ length: 31 }, (_, index) => `page-${index}`),
      changeSummary: "Yeni sürüm",
      status: "DRAFT",
      locked: false,
      lockedReason: "",
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it("arama girdisini sınırlar", () => {
    expect(
      wikiSearchSchema.parse({ q: "iki aşamalı doğrulama", page: "2" }).page,
    ).toBe(2);
    expect(
      wikiSearchSchema.safeParse({ q: "x".repeat(121), page: 1 }).success,
    ).toBe(false);
  });
});

describe("Wiki güvenli render altyapısı", () => {
  it("blog ile ortak render katmanında içindekiler kimliği üretir", async () => {
    const { renderPostContent } =
      await import("@/services/post-content-service");
    const result = renderPostContent(content);
    expect(result.renderedContent).toContain('id="baslik-1"');
    expect(result.renderedContent).not.toContain("<script");
  });
});
