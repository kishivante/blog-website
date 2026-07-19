import { beforeEach, describe, expect, it, vi } from "vitest";

const { findBlock } = vi.hoisted(() => ({ findBlock: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({
  db: {
    userBlock: { findFirst: findBlock },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/server/password", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));
vi.mock("@/services/two-factor-service", () => ({ verifyTotp: vi.fn() }));
vi.mock("@/server/mailer", () => ({ sendActionEmail: vi.fn() }));

describe("profil etkileşim kuralları", () => {
  beforeEach(() => findBlock.mockReset());

  it("kullanıcının kendisini takip etmesini engeller", async () => {
    const { setFollow } = await import("@/services/profile-service");
    await expect(
      setFollow("same", "same", true, { ip: "127.0.0.1", userAgent: "test" }),
    ).rejects.toThrow("Kendinizi takip edemezsiniz");
  });

  it("engellenmiş kullanıcılar arasında takip başlatmaz", async () => {
    findBlock.mockResolvedValue({ blockerId: "one" });
    const { setFollow } = await import("@/services/profile-service");
    await expect(
      setFollow("one", "two", true, { ip: "127.0.0.1", userAgent: "test" }),
    ).rejects.toThrow("etkileşim");
  });
});
