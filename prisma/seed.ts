import {
  AccountStatus,
  BadgeType,
  PrismaClient,
  RoleCode,
  WikiStatus,
} from "@prisma/client";
import { getServerEnv } from "../src/lib/env";
import { hashPassword } from "../src/server/password";

const prisma = new PrismaClient();

const roleDefinitions: ReadonlyArray<{
  code: RoleCode;
  name: string;
  description: string;
  color: string;
  priority: number;
}> = [
  {
    code: RoleCode.ADMIN,
    name: "Yönetici",
    description: "Tam sistem yönetimi",
    color: "#ef4056",
    priority: 100,
  },
  {
    code: RoleCode.EDITOR,
    name: "Editör",
    description: "İçerik inceleme ve yayınlama",
    color: "#268bd2",
    priority: 80,
  },
  {
    code: RoleCode.MODERATOR,
    name: "Moderatör",
    description: "Topluluk ve wiki moderasyonu",
    color: "#f59e0b",
    priority: 60,
  },
  {
    code: RoleCode.SUPPORTER,
    name: "Destekçi",
    description: "Projeyi destekleyen üye",
    color: "#a855f7",
    priority: 30,
  },
  {
    code: RoleCode.USER,
    name: "Kullanıcı",
    description: "Standart topluluk üyesi",
    color: "#94a3b8",
    priority: 10,
  },
];

const permissions = [
  ["admin.access", "Yönetim paneline erişebilir"],
  ["users.manage", "Kullanıcıları ve hesap durumlarını yönetebilir"],
  ["roles.manage", "Rolleri ve yetkileri yönetebilir"],
  ["badges.manage", "Rozetleri yönetebilir"],
  ["posts.create", "Blog yazısı oluşturabilir"],
  ["posts.submit", "Kendi yazısını incelemeye gönderebilir"],
  ["posts.review", "İnceleme kuyruğundaki yazıları değerlendirebilir"],
  ["posts.approve", "Başka bir yazarın yazısını onaylayabilir"],
  ["posts.publish", "Onaylanmış yazıları yayınlayabilir"],
  ["posts.admin_self_approve", "Denetim kaydıyla kendi yazısını onaylayabilir"],
  ["comments.moderate", "Yorumları yönetebilir"],
  ["reports.manage", "Raporları inceleyebilir"],
  ["taxonomy.manage", "Kategori ve etiketleri yönetebilir"],
  ["wiki.edit", "Wiki içeriği düzenleyebilir"],
  ["wiki.publish", "Wiki içeriği yayınlayabilir"],
  ["settings.manage", "Site ve tema ayarlarını yönetebilir"],
  ["audit.read", "Denetim kayıtlarını görüntüleyebilir"],
  ["security.manage", "Güvenlik ayarları ve olaylarını yönetebilir"],
] as const;

const rolePermissionKeys: Readonly<Record<RoleCode, readonly string[]>> = {
  ADMIN: permissions.map(([key]) => key),
  EDITOR: [
    "admin.access",
    "posts.create",
    "posts.submit",
    "posts.review",
    "posts.approve",
    "posts.publish",
    "taxonomy.manage",
    "wiki.edit",
    "wiki.publish",
  ],
  MODERATOR: [
    "admin.access",
    "users.manage",
    "posts.create",
    "posts.submit",
    "comments.moderate",
    "reports.manage",
    "wiki.edit",
    "wiki.publish",
  ],
  SUPPORTER: ["posts.create", "posts.submit"],
  USER: ["posts.create", "posts.submit"],
};

function normalizeIdentity(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-US");
}

async function seedRolesAndPermissions() {
  const permissionIds = new Map<string, string>();
  for (const [key, description] of permissions) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
    permissionIds.set(key, permission.id);
  }

  const roleIds = new Map<RoleCode, string>();
  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { code: definition.code },
      update: definition,
      create: definition,
    });
    roleIds.set(definition.code, role.id);
    for (const permissionKey of rolePermissionKeys[definition.code]) {
      const permissionId = permissionIds.get(permissionKey);
      if (!permissionId)
        throw new Error(`Seed permission bulunamadı: ${permissionKey}`);
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }
  return roleIds;
}

async function seedBadges() {
  for (const role of roleDefinitions) {
    await prisma.badge.upsert({
      where: { code: `ROLE_${role.code}` },
      update: {
        name: role.name,
        description: `${role.name} rolünü gösteren standart sistem rozeti`,
        color: role.color,
        sortOrder: role.priority,
      },
      create: {
        code: `ROLE_${role.code}`,
        name: role.name,
        description: `${role.name} rolünü gösteren standart sistem rozeti`,
        type: BadgeType.SYSTEM,
        color: role.color,
        icon: role.code.toLocaleLowerCase("en-US"),
        sortOrder: role.priority,
      },
    });
  }
}

async function seedSettings() {
  const env = getServerEnv();
  await prisma.siteSetting.upsert({
    where: { id: "default" },
    update: {
      brandName: env.APP_NAME,
      shortName: env.APP_NAME.slice(0, 40),
      siteTitle: env.APP_NAME,
      domain: env.APP_DOMAIN,
      canonicalUrl: env.APP_URL,
      contactEmail: env.CERTBOT_EMAIL,
    },
    create: {
      id: "default",
      brandName: env.APP_NAME,
      shortName: env.APP_NAME.slice(0, 40),
      siteTitle: env.APP_NAME,
      siteDescription: "Teknoloji, bilim ve gelecek üzerine bağımsız yayın.",
      domain: env.APP_DOMAIN,
      canonicalUrl: env.APP_URL,
      contactEmail: env.CERTBOT_EMAIL,
      logo: "/brand/logo.png",
      favicon: "/favicon.ico",
      footerText: `© ${new Date().getUTCFullYear()} ${env.APP_NAME}`,
      socialLinks: {},
      defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "tr",
      allowedLocales: ["tr"],
      securityOptions: {
        requireEmailVerification: true,
        allowTwoFactorAuthentication: true,
        sessionIdleTimeoutMinutes: 10080,
      },
      contentRules: {
        maxCommentLinks: 3,
        commentEditWindowMinutes: 30,
        maxUploadPixels: 40000000,
        monthlyUploadQuotaBytes: 524288000,
      },
    },
  });

  await prisma.themeSetting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      primaryBackground: "#090b10",
      secondaryBackground: "#10141c",
      cardBackground: "#141821",
      borderColor: "#29303d",
      textColor: "#f5f7fb",
      mutedTextColor: "#a8b0be",
      linkColor: "#268bd2",
      scarletAccent: "#ef4056",
      azureAccent: "#268bd2",
      amberAccent: "#f59e0b",
      adminColor: "#ef4056",
      editorColor: "#268bd2",
      moderatorColor: "#f59e0b",
      supporterColor: "#a855f7",
      userColor: "#94a3b8",
      borderRadius: 14,
      shadowIntensity: 24,
      headingFont: "Arial, Helvetica, sans-serif",
      bodyFont: "Arial, Helvetica, sans-serif",
    },
  });
}

async function seedWiki(adminId: string) {
  const legacyPages = await prisma.wikiPage.findMany({
    where: {
      slug: { in: ["scarlet-satellite-hakkinda", "yayin-ve-kaynak-ilkeleri"] },
    },
    select: { id: true },
  });
  const legacyIds = legacyPages.map(({ id }) => id);
  if (legacyIds.length) {
    await prisma.$transaction([
      prisma.wikiLink.deleteMany({
        where: {
          OR: [
            { sourceId: { in: legacyIds } },
            { targetId: { in: legacyIds } },
          ],
        },
      }),
      prisma.wikiTag.deleteMany({ where: { wikiPageId: { in: legacyIds } } }),
      prisma.wikiRevision.deleteMany({
        where: { wikiPageId: { in: legacyIds } },
      }),
      prisma.wikiPage.deleteMany({ where: { id: { in: legacyIds } } }),
    ]);
  }
  const pages = [
    {
      slug: "scarlet-satellite-platform-kullanim-rehberi",
      title: "Scarlet Satellite Platformu Genel Kullanım Rehberi",
      summary:
        "Haberleri, konuları ve Wiki içeriklerini keşfetme; hesap ve içerik özelliklerini kullanma rehberi.",
      renderedContent:
        '<h2 id="baslik-1">Platformda gezinme</h2><p>Ana sayfa güncel yayınlara, popüler konulara ve son Wiki güncellemelerine erişim sağlar. Haberler sayfasında kategori ve etiket filtreleriyle yayınları daraltabilir, arama alanından başlık ve içerik araması yapabilirsiniz.</p><h2 id="baslik-2">Hesap özellikleri</h2><p>Kayıtlı kullanıcılar yazıları beğenebilir, daha sonra okumak üzere kaydedebilir, yazarları takip edebilir ve yorumlara katılabilir. Profil, gizlilik ve bildirim tercihleri Ayarlar bölümünden yönetilir.</p><h2 id="baslik-3">İçerik oluşturma</h2><p>Doğrulanmış kullanıcılar yeni yazı oluşturabilir ve taslaklarını incelemeye gönderebilir. Yayınlama kararı yetkili editör veya yönetici tarafından verilir. Wiki içeriği ise yönetim panelinden yetkili roller tarafından güncellenir.</p>',
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Platformda gezinme" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Ana sayfa güncel yayınlara, popüler konulara ve son Wiki güncellemelerine erişim sağlar. Haberler sayfasında kategori ve etiket filtreleriyle yayınları daraltabilir, arama alanından başlık ve içerik araması yapabilirsiniz.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Hesap özellikleri" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Kayıtlı kullanıcılar yazıları beğenebilir, daha sonra okumak üzere kaydedebilir, yazarları takip edebilir ve yorumlara katılabilir. Profil, gizlilik ve bildirim tercihleri Ayarlar bölümünden yönetilir.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "İçerik oluşturma" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Doğrulanmış kullanıcılar yeni yazı oluşturabilir ve taslaklarını incelemeye gönderebilir. Yayınlama kararı yetkili editör veya yönetici tarafından verilir. Wiki içeriği ise yönetim panelinden yetkili roller tarafından güncellenir.",
              },
            ],
          },
        ],
      },
    },
    {
      slug: "hesap-guvenligi-ve-iki-asamali-dogrulama",
      title: "Hesap Güvenliği ve İki Aşamalı Doğrulama Rehberi",
      summary:
        "Güçlü parola, aktif oturumlar, güvenilir cihazlar ve TOTP tabanlı iki aşamalı doğrulama yönetimi.",
      renderedContent:
        '<h2 id="baslik-1">Güçlü bir parola kullanın</h2><p>Hesabınız için başka hizmetlerde kullanmadığınız, en az 12 karakterli bir parola veya uzun bir parola cümlesi seçin. Parolanızı kimseyle paylaşmayın.</p><h2 id="baslik-2">İki aşamalı doğrulamayı etkinleştirin</h2><p>Ayarlar bölümündeki Güvenlik sayfasından TOTP tabanlı iki aşamalı doğrulamayı başlatın. QR kodunu doğrulayıcı uygulamanızla tarayın ve oluşturulan kodu girerek kurulumu tamamlayın.</p><h2 id="baslik-3">Kurtarma kodlarını koruyun</h2><p>Kurulum sırasında verilen tek kullanımlık kurtarma kodlarını parola yöneticisi gibi güvenli bir yerde saklayın. Her kod yalnızca bir kez kullanılabilir.</p><h2 id="baslik-4">Oturumları denetleyin</h2><p>Tanımadığınız bir cihaz görürseniz ilgili oturumu kapatın, parolanızı değiştirin ve bağlı Google veya GitHub hesaplarını kontrol edin.</p>',
      content: {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Güçlü bir parola kullanın" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Hesabınız için başka hizmetlerde kullanmadığınız, en az 12 karakterli bir parola veya uzun bir parola cümlesi seçin. Parolanızı kimseyle paylaşmayın.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [
              { type: "text", text: "İki aşamalı doğrulamayı etkinleştirin" },
            ],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Ayarlar bölümündeki Güvenlik sayfasından TOTP tabanlı iki aşamalı doğrulamayı başlatın. QR kodunu doğrulayıcı uygulamanızla tarayın ve oluşturulan kodu girerek kurulumu tamamlayın.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Kurtarma kodlarını koruyun" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Kurulum sırasında verilen tek kullanımlık kurtarma kodlarını parola yöneticisi gibi güvenli bir yerde saklayın. Her kod yalnızca bir kez kullanılabilir.",
              },
            ],
          },
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Oturumları denetleyin" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Tanımadığınız bir cihaz görürseniz ilgili oturumu kapatın, parolanızı değiştirin ve bağlı Google veya GitHub hesaplarını kontrol edin.",
              },
            ],
          },
        ],
      },
    },
  ];

  for (const page of pages) {
    const wikiPage = await prisma.wikiPage.upsert({
      where: { slug: page.slug },
      update: {
        title: page.title,
        summary: page.summary,
        content: page.content,
        renderedContent: page.renderedContent,
        status: WikiStatus.PUBLISHED,
        deletedAt: null,
      },
      create: {
        ...page,
        creatorId: adminId,
        lastEditorId: adminId,
        status: WikiStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    await prisma.wikiRevision.upsert({
      where: {
        wikiPageId_revisionNumber: {
          wikiPageId: wikiPage.id,
          revisionNumber: 1,
        },
      },
      update: {
        title: page.title,
        summary: page.summary,
        content: page.content,
        renderedContent: page.renderedContent,
        changeSummary: "Başlangıç dokümantasyonu oluşturuldu.",
      },
      create: {
        wikiPageId: wikiPage.id,
        revisionNumber: 1,
        editorId: adminId,
        title: page.title,
        summary: page.summary,
        content: page.content,
        renderedContent: page.renderedContent,
        changeSummary: "Başlangıç dokümantasyonu oluşturuldu.",
      },
    });
  }
}

async function main() {
  await prisma.usernameReservation.createMany({
    data: [
      "admin",
      "administrator",
      "moderator",
      "editor",
      "support",
      "supporter",
      "scarlet",
      "scarletsatellite",
      "root",
      "system",
      "security",
    ].map((normalizedUsername) => ({
      normalizedUsername,
      reason: "Sistem ve marka kimliğini korumak için rezerve edildi.",
    })),
    skipDuplicates: true,
  });
  const env = getServerEnv();
  const roleIds = await seedRolesAndPermissions();
  await seedBadges();

  const normalizedEmail = normalizeIdentity(env.INITIAL_ADMIN_EMAIL);
  const normalizedUsername = normalizeIdentity(env.INITIAL_ADMIN_USERNAME);
  const existingAdmin = await prisma.user.findUnique({
    where: { normalizedEmail },
    select: { passwordHash: true },
  });
  const adminPasswordHash = existingAdmin?.passwordHash?.startsWith(
    "$argon2id$",
  )
    ? existingAdmin.passwordHash
    : await hashPassword(env.INITIAL_ADMIN_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { normalizedEmail },
    update: {
      username: env.INITIAL_ADMIN_USERNAME,
      normalizedUsername,
      email: env.INITIAL_ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      accountStatus: AccountStatus.ACTIVE,
    },
    create: {
      username: env.INITIAL_ADMIN_USERNAME,
      normalizedUsername,
      email: env.INITIAL_ADMIN_EMAIL,
      normalizedEmail,
      passwordHash: adminPasswordHash,
      displayName: env.INITIAL_ADMIN_USERNAME,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      privacySettings: { create: {} },
      notificationSettings: { create: {} },
    },
  });

  const adminRoleId = roleIds.get(RoleCode.ADMIN);
  if (!adminRoleId) throw new Error("ADMIN rolü oluşturulamadı.");
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRoleId } },
    update: {},
    create: { userId: admin.id, roleId: adminRoleId },
  });

  await seedSettings();
  await seedWiki(admin.id);
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "database_seed_failed",
        message: error instanceof Error ? error.name : "unknown",
        timestamp: new Date().toISOString(),
      }),
    );
    process.exit(1);
  });
