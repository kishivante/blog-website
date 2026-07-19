import { describe, expect, it } from "vitest";
import { assertLastAdminSafety, canAccessAdmin } from "@/lib/admin-policy";

describe("admin erişim politikası", () => {
  it("yalnızca yönetim rolleri için panel erişimi tanımlar", () => {
    expect(canAccessAdmin(["ADMIN"])).toBe(true);
    expect(canAccessAdmin(["EDITOR"])).toBe(true);
    expect(canAccessAdmin(["MODERATOR"])).toBe(true);
    expect(canAccessAdmin(["SUPPORTER", "USER"])).toBe(false);
  });

  it("son aktif adminin rolünün kaldırılmasını engeller", () => {
    expect(() =>
      assertLastAdminSafety({
        wasAdmin: true,
        remainsActiveAdmin: false,
        activeAdminCount: 1,
      }),
    ).toThrow("Son aktif ADMIN");
  });

  it("birden fazla aktif admin varsa değişikliğe izin verir", () => {
    expect(() =>
      assertLastAdminSafety({
        wasAdmin: true,
        remainsActiveAdmin: false,
        activeAdminCount: 2,
      }),
    ).not.toThrow();
  });
});
