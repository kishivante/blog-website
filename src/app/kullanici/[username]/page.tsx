import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, LinkIcon, MapPin } from "lucide-react";
import { Avatar, EmptyState } from "@/components/ui/primitives";
import { PostCard } from "@/components/content-cards";
import { findProfile } from "@/repositories/profile-repository";
import { getSession } from "@/server/session";
import { createCsrfToken } from "@/server/csrf";
import { blockAction, followAction } from "@/server/actions/profile-actions";
import { SettingsForm } from "@/components/settings-form";
import { createReportAction } from "@/server/actions/report-actions";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const { tab = "latest" } = await searchParams;
  const session = await getSession();
  const result = await findProfile(username, session?.userId);
  if (result && "redirectUsername" in result && result.redirectUsername)
    redirect(`/kullanici/${result.redirectUsername}`);
  if (!result || "redirectUsername" in result) notFound();
  const {
    user,
    visible,
    own,
    blocked,
    following,
    latestPosts,
    popularPosts,
    wiki,
    comments,
    postCount,
    likeCount,
  } = result;
  const accent = /^#[0-9a-fA-F]{6}$/.test(user.profileAccent ?? "")
    ? user.profileAccent!
    : "#ef4056";
  const layout =
    (user.profileLayoutSettings as { layout?: string } | null)?.layout ??
    "STANDARD";
  const csrf = session ? await createCsrfToken() : "";
  return (
    <main
      id="main-content"
      className="profilePage"
      data-layout={layout}
      style={{ "--profile-accent": accent } as React.CSSProperties}
    >
      <div className="profileCover">
        {user.profileCover ? (
          <Image
            src={user.profileCover}
            alt=""
            fill
            sizes="100vw"
            priority
            unoptimized
          />
        ) : null}
      </div>
      <div className="profileContainer">
        <header className="profileHeader">
          <Avatar
            src={user.avatar}
            name={user.displayName ?? user.username}
            size="lg"
          />
          <div className="profileIdentity">
            <h1>{user.displayName ?? user.username}</h1>
            <p>@{user.username}</p>
            <div className="profileBadges">
              {user.roles.map(({ role }) => (
                <span
                  key={role.id}
                  className="dynamicBadge"
                  style={{ "--badge-color": role.color } as React.CSSProperties}
                >
                  {role.icon ? (
                    <span aria-hidden="true">{role.icon}</span>
                  ) : null}
                  {role.name}
                </span>
              ))}
              {user.badges.map(({ badge }) => (
                <span
                  key={badge.id}
                  className="dynamicBadge"
                  style={
                    { "--badge-color": badge.color } as React.CSSProperties
                  }
                >
                  {badge.icon ? (
                    <span aria-hidden="true">{badge.icon}</span>
                  ) : null}
                  {badge.name}
                </span>
              ))}
            </div>
          </div>
          <div className="profileActions">
            {own ? (
              <Link className="uiButton" href="/ayarlar/profil">
                Profili düzenle
              </Link>
            ) : session && !blocked ? (
              <form action={followAction}>
                <input type="hidden" name="_csrf" value={csrf} />
                <input type="hidden" name="targetId" value={user.id} />
                <input
                  type="hidden"
                  name="path"
                  value={`/kullanici/${user.username}`}
                />
                <input
                  type="hidden"
                  name="intent"
                  value={following ? "unfollow" : "follow"}
                />
                <button className="uiButton">
                  {following ? "Takibi bırak" : "Takip et"}
                </button>
              </form>
            ) : null}
            {!own && session ? (
              <form action={blockAction}>
                <input type="hidden" name="_csrf" value={csrf} />
                <input type="hidden" name="targetId" value={user.id} />
                <input
                  type="hidden"
                  name="path"
                  value={`/kullanici/${user.username}`}
                />
                <input
                  type="hidden"
                  name="intent"
                  value={
                    blocked?.blockerId === session.userId ? "unblock" : "block"
                  }
                />
                <button className="quietButton">
                  {blocked?.blockerId === session.userId
                    ? "Engeli kaldır"
                    : "Engelle"}
                </button>
              </form>
            ) : null}
            {!own && session ? (
              <details className="reportDisclosure">
                <summary>Raporla</summary>
                <SettingsForm
                  action={createReportAction}
                  csrf={csrf}
                  submitLabel="Raporu gönder"
                >
                  <input type="hidden" name="targetType" value="USER" />
                  <input type="hidden" name="targetId" value={user.id} />
                  <label>
                    Neden
                    <select name="reason">
                      <option value="HARASSMENT">Taciz</option>
                      <option value="SPAM">Spam</option>
                      <option value="DANGEROUS">Tehlikeli davranış</option>
                      <option value="OTHER">Diğer</option>
                    </select>
                  </label>
                  <label>
                    Açıklama
                    <textarea name="details" maxLength={2000} />
                  </label>
                </SettingsForm>
              </details>
            ) : null}
          </div>
        </header>
        {!visible ? (
          <EmptyState
            title="Bu profil gizli"
            description="Kullanıcı profilini yalnızca izin verdiği kişilere gösteriyor."
          />
        ) : blocked ? (
          <EmptyState
            title="Etkileşim kullanılamıyor"
            description="Engelleme durumu nedeniyle bu profilin içerikleri gösterilmiyor."
          />
        ) : (
          <>
            <section className="profileAbout">
              {user.biography ? (
                <p>{user.biography}</p>
              ) : (
                <p className="muted">Biyografi eklenmemiş.</p>
              )}
              <div className="profileMeta">
                {user.location &&
                user.privacySettings?.showLocation !== false ? (
                  <span>
                    <MapPin />
                    {user.location}
                  </span>
                ) : null}
                {user.website && user.privacySettings?.showWebsite !== false ? (
                  <a href={user.website} rel="nofollow noopener noreferrer">
                    <LinkIcon />
                    Web sitesi
                  </a>
                ) : null}
                <span>
                  <CalendarDays />
                  {user.createdAt.toLocaleDateString("tr-TR", {
                    year: "numeric",
                    month: "long",
                  })}{" "}
                  tarihinde katıldı
                </span>
              </div>
            </section>
            <dl className="profileStats">
              <div>
                <dt>Takipçi</dt>
                <dd>
                  {user.privacySettings?.showFollowers === false && !own
                    ? "—"
                    : user.followerCount}
                </dd>
              </div>
              <div>
                <dt>Takip edilen</dt>
                <dd>
                  {user.privacySettings?.showFollowing === false && !own
                    ? "—"
                    : user.followingCount}
                </dd>
              </div>
              <div>
                <dt>Yayın</dt>
                <dd>{postCount}</dd>
              </div>
              <div>
                <dt>Alınan beğeni</dt>
                <dd>{likeCount}</dd>
              </div>
            </dl>
            <nav className="profileTabs" aria-label="Profil içerikleri">
              <Link
                aria-current={tab === "latest" ? "page" : undefined}
                href="?tab=latest"
              >
                Son yayınlar
              </Link>
              <Link
                aria-current={tab === "popular" ? "page" : undefined}
                href="?tab=popular"
              >
                Popüler
              </Link>
              {user.privacySettings?.showWikiContributions !== false || own ? (
                <Link
                  aria-current={tab === "wiki" ? "page" : undefined}
                  href="?tab=wiki"
                >
                  Wiki katkıları
                </Link>
              ) : null}
              {user.privacySettings?.showCommentHistory !== false || own ? (
                <Link
                  aria-current={tab === "comments" ? "page" : undefined}
                  href="?tab=comments"
                >
                  Yorumlar
                </Link>
              ) : null}
            </nav>
            {tab === "wiki" ? (
              <div className="profileList">
                {wiki.length ? (
                  wiki.map((item) => (
                    <article className="settingsCard" key={item.id}>
                      <h3>
                        <Link href={`/wiki/${item.wikiPage.slug}`}>
                          {item.wikiPage.title}
                        </Link>
                      </h3>
                      <p>
                        {item.changeSummary ??
                          "Wiki içeriğine katkıda bulundu."}
                      </p>
                      <small>
                        {item.createdAt.toLocaleDateString("tr-TR")}
                      </small>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title="Wiki katkısı yok"
                    description="Görüntülenebilir katkılar burada listelenecek."
                  />
                )}
              </div>
            ) : tab === "comments" ? (
              <div className="profileList">
                {comments.length ? (
                  comments.map((item) => (
                    <article className="settingsCard" key={item.id}>
                      <p>{item.content}</p>
                      <Link href={`/haberler/${item.post.slug}`}>
                        {item.post.title}
                      </Link>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title="Yorum yok"
                    description="Görüntülenebilir yorumlar burada listelenecek."
                  />
                )}
              </div>
            ) : (
              <div className="postGrid">
                {(tab === "popular" ? popularPosts : latestPosts).length ? (
                  (tab === "popular" ? popularPosts : latestPosts).map(
                    (post) => <PostCard key={post.id} post={post} />,
                  )
                ) : (
                  <EmptyState
                    title="Henüz yayın yok"
                    description="Yayınlanan içerikler burada görünecek."
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
