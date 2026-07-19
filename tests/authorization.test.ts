import { describe, expect, it } from "vitest";
import { hasPermission } from "@/server/authorization";

describe("authorization", () => {
  it("izin adını merkezi listeden denetler", () => {
    const editor = [
      "posts.create",
      "posts.review",
      "posts.approve",
      "posts.publish",
      "wiki.edit",
    ];
    const moderator = ["comments.moderate", "reports.manage", "wiki.edit"];
    expect(hasPermission(editor, "posts.publish")).toBe(true);
    expect(hasPermission(moderator, "posts.publish")).toBe(false);
    expect(hasPermission(moderator, "wiki.edit")).toBe(true);
  });
});
