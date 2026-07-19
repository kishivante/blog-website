import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import { getHomeContent } from "@/repositories/home-repository";
import { PostCard, TopicCard, WikiCard } from "@/components/content-cards";
import { Avatar, EmptyState, RoleBadge } from "@/components/ui/primitives";
import { tr } from "@/i18n/messages/tr";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = await getHomeContent();
  return (
    <main id="main-content">
      <section className="homeHero">
        <div className="heroGrid">
          <div className="heroCopy">
            <span className="eyebrow">
              <Radio size={14} />
              {tr.home.eyebrow}
            </span>
            <h1>{tr.home.title}</h1>
            <p>{tr.home.description}</p>
            <div className="heroActions">
              <Link className="primaryLink primaryLink--large" href="/haberler">
                Son haberleri keşfet <ArrowRight />
              </Link>
              <Link href="/wiki">Bilgi bankasına git</Link>
            </div>
          </div>
          <div className="heroVisual" aria-hidden="true">
            <span className="planet" />
            <span className="orbit orbit--one" />
            <span className="orbit orbit--two" />
            <span className="signal signal--scarlet" />
            <span className="signal signal--azure" />
            <span className="signal signal--amber" />
          </div>
        </div>
      </section>

      <section className="announcementBar" aria-label={tr.home.announcement}>
        <span>
          <Radio size={15} />
          {tr.home.announcement}
        </span>
        <p>Scarlet Satellite Blog yayın altyapısı geliştirme sürecindedir.</p>
        <Link href={{ pathname: "/hakkimizda" }}>
          Ayrıntılar <ArrowRight />
        </Link>
      </section>

      <div className="homeContainer">
        <section className="homeSection">
          <div className="sectionHeading">
            <div>
              <span className="sectionIndex">01</span>
              <h2>Öne Çıkan</h2>
            </div>
            <Link href="/haberler">
              Tüm haberler <ArrowRight />
            </Link>
          </div>
          {content.featured ? (
            <PostCard post={content.featured} featured />
          ) : (
            <EmptyState
              title="Öne çıkarılmış haber yok"
              description="Editörler bir içeriği öne çıkardığında burada görünecek."
            />
          )}
        </section>

        <section className="homeSection">
          <div className="sectionHeading">
            <div>
              <span className="sectionIndex">02</span>
              <h2>{tr.home.latest}</h2>
            </div>
            <Link href="/haberler">
              Tümünü gör <ArrowRight />
            </Link>
          </div>
          {content.latest.length ? (
            <div className="postGridNew">
              {content.latest.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Henüz haber yok"
              description="İlk yayınlanan içerikler bu bölümde listelenecek."
            />
          )}
        </section>

        <div className="splitSections">
          <section className="homeSection">
            <div className="sectionHeading">
              <div>
                <span className="sectionIndex">03</span>
                <h2>{tr.home.topics}</h2>
              </div>
            </div>
            {content.categories.length ? (
              <div className="topicList">
                {content.categories.map((category) => (
                  <TopicCard
                    key={category.id}
                    name={category.name}
                    slug={category.slug}
                    count={category._count.posts}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Henüz konu yok"
                description="Aktif kategoriler oluşturulduğunda burada görünecek."
              />
            )}
          </section>
          <section className="homeSection">
            <div className="sectionHeading">
              <div>
                <span className="sectionIndex">04</span>
                <h2>{tr.home.wiki}</h2>
              </div>
              <Link href="/wiki">
                Wiki’ye git <ArrowRight />
              </Link>
            </div>
            {content.wiki.length ? (
              <div className="wikiList">
                {content.wiki.map((page) => (
                  <WikiCard
                    key={page.id}
                    title={page.title}
                    slug={page.slug}
                    summary={page.summary}
                    editor={
                      page.lastEditor.displayName ?? page.lastEditor.username
                    }
                    updatedAt={page.updatedAt}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Wiki içeriği yok"
                description="Yayınlanan bilgi bankası sayfaları burada gösterilecek."
              />
            )}
          </section>
        </div>

        <section className="homeSection">
          <div className="sectionHeading">
            <div>
              <span className="sectionIndex">05</span>
              <h2>{tr.home.authors}</h2>
            </div>
          </div>
          {content.authors.length ? (
            <div className="authorGrid">
              {content.authors.map((author) => {
                const role = author.roles[0]?.role.code ?? "USER";
                return (
                  <Link
                    className="authorCard"
                    href={`/kullanici/${author.username}`}
                    key={author.id}
                  >
                    <Avatar
                      src={author.avatar}
                      name={author.displayName ?? author.username}
                      size="lg"
                    />
                    <div>
                      <strong>{author.displayName ?? author.username}</strong>
                      <span>@{author.username}</span>
                      <small>{author._count.authoredPosts} yayın</small>
                    </div>
                    <RoleBadge role={role} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="Öne çıkan yazar yok"
              description="Yayın yapan yazarlar burada yer alacak."
            />
          )}
        </section>
      </div>
    </main>
  );
}
