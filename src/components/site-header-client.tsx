"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Languages, Menu, X } from "lucide-react";
import { useState } from "react";
import { Avatar, SearchBox } from "@/components/ui/primitives";
import { Dropdown } from "@/components/ui/interactive";
import { tr } from "@/i18n/messages/tr";

const links = [
  { href: "/", label: tr.nav.home },
  { href: "/haberler", label: tr.nav.news },
  { href: "/konular", label: tr.nav.topics },
  { href: "/wiki", label: tr.nav.wiki },
  { href: "/hakkimizda", label: tr.nav.about },
] as const;

export function HeaderClient({
  appName,
  logo,
  user,
  unread,
}: {
  appName: string;
  logo: string;
  user: {
    username: string;
    displayName: string | null;
    avatar: string | null;
  } | null;
  unread: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="siteHeader">
      <div className="headerInner">
        <Link className="brand" href="/" aria-label={`${appName} ana sayfa`}>
          <Image src={logo} alt="" width={46} height={46} priority unoptimized={logo.startsWith("/api/uploads/")} />
          <span>{appName}</span>
        </Link>
        <nav className="desktopNav" aria-label="Ana menü">
          {links.map((link) => (
            <Link
              key={link.href}
              href={{ pathname: link.href }}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="headerActions">
          <div className="headerSearch">
            <SearchBox />
          </div>
          <Dropdown
            label={
              <>
                <Languages size={18} />
                <span className="srOnly">Dil seç</span>
                <ChevronDown size={13} />
              </>
            }
          >
            <span aria-current="true">
              Türkçe
            </span>
            <span aria-disabled="true">
              English
            </span>
          </Dropdown>
          {user ? (
            <>
              <Link
                className="headerIcon notificationBell"
                href="/bildirimler"
                aria-label={`${unread} okunmamış bildirim`}
              >
                <Bell />
                {unread ? <span>{unread > 99 ? "99+" : unread}</span> : null}
              </Link>
              <Dropdown
                label={
                  <Avatar
                    src={user.avatar}
                    name={user.displayName ?? user.username}
                    size="sm"
                  />
                }
              >
                <Link href={`/kullanici/${user.username}`}>Profil</Link>
                <Link href="/ayarlar">Ayarlar</Link>
                <Link href="/ayarlar/hesap">Oturumlar</Link>
              </Dropdown>
            </>
          ) : (
            <div className="authLinks">
              <Link href="/giris">{tr.nav.login}</Link>
              <Link className="primaryLink" href="/kayit">
                {tr.nav.register}
              </Link>
            </div>
          )}
          <button
            className="mobileToggle"
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X /> : <Menu />}
            <span className="srOnly">Menüyü aç veya kapat</span>
          </button>
        </div>
      </div>
      {open ? (
        <div className="mobileMenu" id="mobile-menu">
          <nav aria-label="Mobil menü">
            {links.map((link) => (
              <Link
                key={link.href}
                href={{ pathname: link.href }}
                onClick={() => setOpen(false)}
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <SearchBox />
          {!user ? (
            <div className="authLinks">
              <Link href="/giris">Giriş</Link>
              <Link className="primaryLink" href="/kayit">
                Kayıt
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
