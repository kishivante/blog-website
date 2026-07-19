import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("yazı içeriği", () => {
  it("yapılandırılmış JSON içeriğini güvenli HTML ve okuma süresine dönüştürür", async () => {
    const { renderPostContent } =
      await import("@/services/post-content-service");
    const result = renderPostContent({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Güvenli başlık" }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Scarlet Satellite için güvenli bir içerik.",
            },
          ],
        },
      ],
    });
    expect(result.renderedContent).toContain('id="baslik-1"');
    expect(result.renderedContent).not.toContain("<script");
    expect(result.wordCount).toBeGreaterThan(3);
    expect(result.readingTimeMinutes).toBe(1);
  });

  it("tehlikeli bağlantı protokollerini render sırasında kaldırır", async () => {
    const { renderPostContent } =
      await import("@/services/post-content-service");
    const result = renderPostContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "zararlı",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    });
    expect(result.renderedContent).not.toContain("javascript:");
  });
});
