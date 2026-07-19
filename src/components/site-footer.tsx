import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowUpRight } from "lucide-react";

type FooterProps = {
  brandName: string;
  description: string;
  footerText: string | null;
  socialLinks: Record<string, string>;
  contactEmail: string;
  logo: string;
};

export function SiteFooter({
  brandName,
  description,
  footerText,
  socialLinks,
  contactEmail,
  logo,
}: FooterProps) {
  return (
    <footer className="siteFooter">
      <div className="footerGrid">
        <section className="footerBrand">
          <Image src={logo} width={72} height={72} alt="" unoptimized={logo.startsWith("/api/uploads/")} />
          <div>
            <strong>{brandName}</strong>
            <p>{description}</p>
          </div>
        </section>
        <section>
          <h2>Ekosistem</h2>
          <ul>
            <li>
              <span className="dot dot--scarlet" />
              Scarlet — Yazılım Evi
            </li>
            <li>
              <span className="dot dot--azure" />
              Azure — Bulut & Ağ Sistemleri
            </li>
            <li>
              <span className="dot dot--amber" />
              Amber — Siber Güvenlik & Yapay Zeka
            </li>
          </ul>
        </section>
        <section>
          <h2>Navigasyon</h2>
          <ul>
            <li>
              <Link href="/">Ana Sayfa</Link>
            </li>
            <li>
              <Link href={{ pathname: "/hakkimizda" }}>Hakkımızda</Link>
            </li>
            <li>
              <Link href="/konular">Projelerimiz</Link>
            </li>
            <li>
              <Link href="/haberler">Blog</Link>
            </li>
            <li>
              <Link href="/wiki">Wiki</Link>
            </li>
            {contactEmail ? <li><a href={`mailto:${contactEmail}`}>İletişim</a></li> : null}
          </ul>
        </section>
        <section>
          <h2>Bağlantılar</h2>
          <ul>
            {Object.entries(socialLinks).map(([label, url]) => (
              <li key={label}>
                <a href={url} rel="noreferrer" target="_blank">
                  {label}
                  <ArrowUpRight size={14} />
                </a>
              </li>
            ))}
          </ul>
          <p className="systemStatus">
            <Activity size={15} /> <Link href="/health">Sistem durumunu kontrol et</Link>
          </p>
        </section>
      </div>
      <div className="footerBottom">
        <span>
          {footerText ?? `© ${new Date().getFullYear()} ${brandName}`}
        </span>
        <span>
          Next.js ile hazırlandı · {brandName} ekibi tarafından tasarlandı
        </span>
      </div>
    </footer>
  );
}
