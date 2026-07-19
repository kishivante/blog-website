import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("rich text görsel URL güvenliği", () => {
  it("güvenli upload ve HTTPS adreslerini kabul eder", async () => {
    const { isSafeRichTextImageUrl } =
      await import("@/services/post-content-service");
    expect(isSafeRichTextImageUrl("/api/uploads/public/post/file.webp")).toBe(
      true,
    );
    expect(isSafeRichTextImageUrl("https://cdn.example.com/image.webp")).toBe(
      true,
    );
  });

  it("script ve tehlikeli data protokollerini reddeder", async () => {
    const { isSafeRichTextImageUrl } =
      await import("@/services/post-content-service");
    expect(isSafeRichTextImageUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeRichTextImageUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeRichTextImageUrl("vbscript:msgbox(1)")).toBe(false);
  });
});
