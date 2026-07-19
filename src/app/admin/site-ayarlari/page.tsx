import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/components/settings-form";
import { saveSiteSettingsAction } from "@/server/actions/admin-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
import {
  MAX_BASE_FONT_SIZE,
  MIN_BASE_FONT_SIZE,
  SITE_FONT_FAMILIES,
} from "@/lib/site-typography";

export default async function SiteSettingsPage() {
  await requirePermission("settings.manage");
  const [site, theme, csrf] = await Promise.all([
    db.siteSetting.findUnique({ where: { id: "default" } }),
    db.themeSetting.findUnique({ where: { id: "default" } }),
    createCsrfToken(),
  ]);
  if (!site) throw new Error("Site ayarları bulunamadı.");
  if (!theme) throw new Error("Tema ayarları bulunamadı.");
  const social =
    site.socialLinks &&
    typeof site.socialLinks === "object" &&
    !Array.isArray(site.socialLinks)
      ? (site.socialLinks as Record<string, unknown>)
      : {};
  const rules =
    site.contentRules &&
    typeof site.contentRules === "object" &&
    !Array.isArray(site.contentRules)
      ? (site.contentRules as Record<string, unknown>)
      : {};
  return (
    <PageShell
      title="Site ayarları"
      description="Secret değerler yalnızca ortam değişkenlerinden okunur; burada genel yayın ayarları yönetilir."
    >
      <SettingsForm
        action={saveSiteSettingsAction}
        csrf={csrf}
        submitLabel="Site ayarlarını kaydet"
        encType="multipart/form-data"
      >
        <fieldset>
          <legend>Tipografi</legend>
          <label>
            Site yazı tipi
            <select name="siteFont" defaultValue={theme.bodyFont}>
              {SITE_FONT_FAMILIES.map((font) => (
                <option key={font} value={font}>
                  {font.startsWith("Arial")
                    ? "Arial"
                    : font.startsWith("Inter")
                      ? "Inter"
                      : "Georgia"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Temel yazı boyutu (px)
            <input
              name="baseFontSize"
              type="number"
              min={MIN_BASE_FONT_SIZE}
              max={MAX_BASE_FONT_SIZE}
              defaultValue={theme.baseFontSize}
              required
            />
          </label>
        </fieldset>
        <label>
          Marka adı
          <input name="brandName" defaultValue={site.brandName} required />
        </label>
        <label>
          Kısa ad
          <input
            name="shortName"
            defaultValue={site.shortName ?? site.brandName}
            required
          />
        </label>
        <label>
          Site başlığı
          <input name="siteTitle" defaultValue={site.siteTitle} required />
        </label>
        <label>
          Açıklama
          <textarea
            name="siteDescription"
            defaultValue={site.siteDescription}
            minLength={20}
            maxLength={500}
            required
          />
        </label>
        <label>
          Domain
          <input name="domain" defaultValue={site.domain} required />
        </label>
        <label>
          Canonical URL
          <input
            name="canonicalUrl"
            type="url"
            defaultValue={site.canonicalUrl}
            required
          />
        </label>
        <label>
          İletişim e-postası
          <input
            name="contactEmail"
            type="email"
            defaultValue={site.contactEmail}
            required
          />
        </label>
        <label>
          Logo
          <input name="logo" defaultValue={site.logo ?? ""} />
        </label>
        <label>
          Yeni logo
          <input
            name="logoFile"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
        <label>
          Favicon
          <input name="favicon" defaultValue={site.favicon ?? ""} />
        </label>
        <label>
          Yeni favicon
          <input
            name="faviconFile"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
        <label>
          Footer
          <textarea name="footerText" defaultValue={site.footerText ?? ""} />
        </label>
        {["github", "x", "linkedin", "youtube"].map((key) => (
          <label key={key}>
            {key}
            <input
              type="url"
              name={`social_${key}`}
              defaultValue={typeof social[key] === "string" ? social[key] : ""}
            />
          </label>
        ))}
        <label>
          Varsayılan dil
          <input name="defaultLocale" defaultValue={site.defaultLocale} />
        </label>
        <label>
          İzin verilen diller
          <input
            name="allowedLocales"
            defaultValue={site.allowedLocales.join(",")}
          />
        </label>
        <label>
          Upload limiti (byte)
          <input
            name="maxUploadBytes"
            type="number"
            min={1048576}
            max={104857600}
            defaultValue={site.maxUploadBytes}
          />
        </label>
        <label>
          Yorum link limiti
          <input
            name="maxCommentLinks"
            type="number"
            min={0}
            max={10}
            defaultValue={
              typeof rules.maxCommentLinks === "number"
                ? rules.maxCommentLinks
                : 3
            }
          />
        </label>
        <label>
          Yorum düzenleme süresi (dk)
          <input
            name="commentEditWindowMinutes"
            type="number"
            min={5}
            max={1440}
            defaultValue={
              typeof rules.commentEditWindowMinutes === "number"
                ? rules.commentEditWindowMinutes
                : 30
            }
          />
        </label>
        <label>
          En fazla görsel pikseli
          <input
            name="maxUploadPixels"
            type="number"
            min={1000000}
            max={100000000}
            defaultValue={
              typeof rules.maxUploadPixels === "number"
                ? rules.maxUploadPixels
                : 40000000
            }
          />
        </label>
        <label>
          Aylık kullanıcı kotası (byte)
          <input
            name="monthlyUploadQuotaBytes"
            type="number"
            min={1048576}
            max={2147000000}
            defaultValue={
              typeof rules.monthlyUploadQuotaBytes === "number"
                ? rules.monthlyUploadQuotaBytes
                : 524288000
            }
          />
        </label>
        <label>
          <input
            name="registrationEnabled"
            type="checkbox"
            defaultChecked={site.registrationEnabled}
          />
          Kayıt açık
        </label>
        <label>
          <input
            name="maintenanceMode"
            type="checkbox"
            defaultChecked={site.maintenanceMode}
          />
          Bakım modu
        </label>
      </SettingsForm>
    </PageShell>
  );
}
