import { beforeAll, describe, expect, it, vi } from "vitest";
import { generate } from "otplib";

vi.mock("server-only", () => ({}));

const integration = process.env.RUN_INTEGRATION === "1";
const suite = integration ? describe : describe.skip;

suite("production service flows with PostgreSQL and Redis", () => {
  let db: typeof import("@/server/db").db;
  let context: { ip: string; userAgent: string };
  let adminId: string;
  let authorId: string;
  let readerId: string;

  beforeAll(async () => {
    ({ db } = await import("@/server/db"));
    context = { ip: "127.0.0.2", userAgent: "vitest-integration" };
    const admin = await db.user.findUniqueOrThrow({
      where: { normalizedEmail: "admin@example.com" },
    });
    adminId = admin.id;
    const suffix = Date.now().toString(36);
    const userRole = await db.role.findUniqueOrThrow({ where: { code: "USER" } });
    const createUser = (name: string) =>
      db.user.create({
        data: {
          username: `${name}_${suffix}`,
          normalizedUsername: `${name}_${suffix}`,
          email: `${name}_${suffix}@example.com`,
          normalizedEmail: `${name}_${suffix}@example.com`,
          accountStatus: "ACTIVE",
          emailVerifiedAt: new Date(),
          privacySettings: { create: {} },
          notificationSettings: { create: {} },
          roles: { create: { roleId: userRole.id } },
        },
      });
    authorId = (await createUser("author")).id;
    readerId = (await createUser("reader")).id;
  });

  it("parola, e-posta tokeni, 2FA ve recovery code akışlarını çalıştırır", async () => {
    const { hashPassword, verifyPassword } = await import("@/server/password");
    const { sha256 } = await import("@/lib/crypto");
    const { consumeVerificationToken } = await import("@/services/token-service");
    const {
      beginTwoFactorSetup,
      enableTwoFactor,
      consumeRecoveryCode,
    } = await import("@/services/two-factor-service");
    const hash = await hashPassword("correct horse battery staple");
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
    await db.user.update({ where: { id: authorId }, data: { passwordHash: hash, emailVerifiedAt: null } });
    const raw = `verify-${Date.now()}`;
    await db.emailVerificationToken.create({
      data: { userId: authorId, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + 60_000) },
    });
    expect(await consumeVerificationToken(raw)).toBe(true);
    const user = await db.user.findUniqueOrThrow({ where: { id: authorId } });
    const setup = await beginTwoFactorSetup(authorId, user.email);
    const code = await generate({ secret: setup.secret });
    const recovery = await enableTwoFactor(authorId, code);
    expect(recovery).toHaveLength(10);
    expect(await consumeRecoveryCode(authorId, recovery[0]!)).toBe(true);
    expect(await consumeRecoveryCode(authorId, recovery[0]!)).toBe(false);
  });

  it("OAuth bağlantısı, profil, takip ve bildirim akışlarını çalıştırır", async () => {
    const { linkOAuthProfile, unlinkOAuthAccount } = await import("@/services/oauth-service");
    const { updateProfile, setFollow } = await import("@/services/profile-service");
    await linkOAuthProfile(authorId, "google", {
      providerAccountId: `google-${Date.now()}`,
      email: "verified@example.com",
      emailVerified: true,
    });
    expect(await db.oAuthAccount.count({ where: { userId: authorId, provider: "google" } })).toBe(1);
    await updateProfile(authorId, {
      displayName: "Entegrasyon Yazarı",
      biography: "Üretim akışlarını doğrulayan kullanıcı.",
      location: "İstanbul",
      website: "https://example.com",
      locale: "tr",
      timezone: "Europe/Istanbul",
    }, context);
    await setFollow(readerId, authorId, true, context);
    expect(await db.userFollow.count({ where: { followerId: readerId, followingId: authorId } })).toBe(1);
    expect(await db.notification.count({ where: { recipientId: authorId, type: "FOLLOW" } })).toBeGreaterThan(0);
    await unlinkOAuthAccount(authorId, "google");
  });

  it("taslak, rich text, inceleme, onay, yayın ve etkileşim akışlarını çalıştırır", async () => {
    const { savePost, reviewPost } = await import("@/services/post-service");
    const { createComment, toggleCommentLike } = await import("@/services/comment-service");
    const content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Gerçek entegrasyon içeriği." }] }],
    };
    const post = await savePost(authorId, {
      title: "Entegrasyon yayını",
      slug: `entegrasyon-yayini-${Date.now()}`,
      excerpt: "Üretim yayın iş akışını doğrulayan içerik.",
      content,
      categoryId: "",
      tagIds: [],
      seriesId: "",
      coverImage: "",
      allowComments: true,
      seoTitle: "",
      seoDescription: "",
      canonicalUrl: "",
      version: 1,
      intent: "submit",
    }, context);
    await reviewPost({ postId: post.id, reviewerId: adminId, decision: "APPROVED", note: "İçerik uygun.", allowSelfApprove: false, context });
    await reviewPost({ postId: post.id, reviewerId: adminId, decision: "PUBLISHED", note: "Yayınlandı.", allowSelfApprove: false, context });
    const published = await db.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(published.status).toBe("PUBLISHED");
    expect(published.renderedContent).toContain("Gerçek entegrasyon");
    await db.postLike.create({ data: { postId: post.id, userId: readerId } });
    await db.postBookmark.create({ data: { postId: post.id, userId: readerId } });
    const { comment } = await createComment({ postId: post.id, authorId: readerId, content: "Yararlı bir yayın.", context });
    await toggleCommentLike(comment.id, authorId);
    expect(await db.postBookmark.count({ where: { postId: post.id, userId: readerId } })).toBe(1);
  });

  it("rapor moderasyonu, Wiki revizyonu ve tema ayarını kalıcılaştırır", async () => {
    const comment = await db.comment.findFirstOrThrow({ where: { authorId: readerId } });
    const { createReport, resolveReport } = await import("@/services/report-service");
    const report = await createReport({
      reporterId: authorId,
      targetType: "COMMENT",
      targetId: comment.id,
      reason: "SPAM",
      details: "Moderasyon entegrasyon kontrolü.",
      context,
    });
    await resolveReport({
      reportId: report.id,
      moderatorId: adminId,
      status: "RESOLVED",
      action: "HIDE",
      resolution: "İçerik politika nedeniyle gizlendi.",
      context,
    });
    expect((await db.comment.findUniqueOrThrow({ where: { id: comment.id } })).status).toBe("HIDDEN");
    const { saveWikiPage, restoreWikiRevision } = await import("@/services/wiki-service");
    const contentA = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "İlk güvenli sürüm." }] }] };
    const pageId = await saveWikiPage(adminId, {
      title: "Entegrasyon Wiki Rehberi",
      slug: `entegrasyon-wiki-${Date.now()}`,
      summary: "Wiki revizyon geri yükleme akışını doğrulayan gerçek test içeriği.",
      content: contentA,
      categoryId: "",
      tagIds: [],
      linkedPageIds: [],
      changeSummary: "İlk sürüm oluşturuldu.",
      status: "DRAFT",
      locked: false,
      lockedReason: "",
      version: 1,
    }, context);
    const firstRevision = await db.wikiRevision.findFirstOrThrow({ where: { wikiPageId: pageId, revisionNumber: 1 } });
    await saveWikiPage(adminId, {
      id: pageId,
      title: "Entegrasyon Wiki Rehberi Güncel",
      slug: (await db.wikiPage.findUniqueOrThrow({ where: { id: pageId } })).slug,
      summary: "Wiki revizyon geri yükleme akışını doğrulayan güncellenmiş içerik.",
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "İkinci sürüm." }] }] },
      categoryId: "",
      tagIds: [],
      linkedPageIds: [],
      changeSummary: "İkinci sürüm oluşturuldu.",
      status: "DRAFT",
      locked: false,
      lockedReason: "",
      version: 1,
    }, context);
    await restoreWikiRevision({ pageId, revisionId: firstRevision.id, actorId: adminId, expectedVersion: 2, context });
    expect((await db.wikiPage.findUniqueOrThrow({ where: { id: pageId } })).title).toBe("Entegrasyon Wiki Rehberi");
    await db.themeSetting.update({ where: { id: "default" }, data: { scarletAccent: "#d91f3d" } });
    expect((await db.themeSetting.findUniqueOrThrow({ where: { id: "default" } })).scarletAccent).toBe("#d91f3d");
  });

  it("bekleme süresi dolan hesap silme talebini geçmiş içeriği bozmadan anonimleştirir", async () => {
    const { processDueAccountDeletions } = await import("@/services/profile-service");
    await db.accountDeletionRequest.create({
      data: {
        userId: readerId,
        executeAt: new Date(Date.now() - 1_000),
      },
    });
    expect(await processDueAccountDeletions()).toBeGreaterThan(0);
    const deleted = await db.user.findUniqueOrThrow({ where: { id: readerId } });
    expect(deleted.accountStatus).toBe("DELETED");
    expect(deleted.email.endsWith("@deleted.invalid")).toBe(true);
    expect(await db.comment.count({ where: { authorId: readerId } })).toBeGreaterThan(0);
  });
});
