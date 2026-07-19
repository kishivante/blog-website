import { describe, expect, it } from "vitest";
import {
  appearanceSchema,
  privacySchema,
  profileSchema,
} from "@/validators/profile";

describe("profil doğrulaması", () => {
  it("yalnızca http ve https web sitesi adreslerine izin verir", () => {
    const base = {
      displayName: "Ada",
      biography: "",
      location: "",
      locale: "tr",
      timezone: "Europe/Istanbul",
    };
    expect(
      profileSchema.safeParse({ ...base, website: "https://example.com" })
        .success,
    ).toBe(true);
    expect(
      profileSchema.safeParse({ ...base, website: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ ...base, website: "data:text/html,test" })
        .success,
    ).toBe(false);
  });

  it("serbest CSS yerine sınırlı renk ve düzen değerlerini kabul eder", () => {
    expect(
      appearanceSchema.safeParse({
        profileAccent: "#ef4056",
        layout: "EDITORIAL",
      }).success,
    ).toBe(true);
    expect(
      appearanceSchema.safeParse({
        profileAccent: "red;position:fixed",
        layout: "CUSTOM",
      }).success,
    ).toBe(false);
  });

  it("gizlilik görünürlüğünü tanımlı seçeneklerle sınırlar", () => {
    const flags = {
      showFollowers: true,
      showFollowing: true,
      showCommentHistory: false,
      showWikiContributions: true,
      showOnlineStatus: false,
    };
    expect(
      privacySchema.safeParse({ ...flags, profileVisibility: "AUTHENTICATED" })
        .success,
    ).toBe(true);
    expect(
      privacySchema.safeParse({ ...flags, profileVisibility: "EVERYONE" })
        .success,
    ).toBe(false);
  });
});
