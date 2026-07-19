import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/components/settings-form";
import { saveTaxonomyAction } from "@/server/actions/admin-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";

export default async function TagsPage() {
  await requirePermission("taxonomy.manage");
  const [items, csrf] = await Promise.all([
    db.tag.findMany({
      include: { _count: { select: { posts: true, wikiPages: true } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    createCsrfToken(),
  ]);
  const fields = (item?: (typeof items)[number]) => (
    <>
      <label>
        Ad
        <input name="name" defaultValue={item?.name} required />
      </label>
      <label>
        Slug
        <input
          name="slug"
          defaultValue={item?.slug}
          pattern="[a-z0-9-]+"
          required
        />
      </label>
      <label>
        Açıklama
        <textarea
          name="description"
          defaultValue={item?.description ?? ""}
          maxLength={500}
        />
      </label>
      <label>
        Renk
        <input
          name="color"
          type="color"
          defaultValue={item?.color ?? "#3a8dde"}
        />
      </label>
      <label>
        İkon
        <input name="icon" defaultValue={item?.icon ?? ""} maxLength={50} />
      </label>
      <label>
        Sıra
        <input
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={item?.sortOrder ?? 0}
        />
      </label>
      <label>
        <input
          name="active"
          type="checkbox"
          defaultChecked={item?.active ?? true}
        />
        Aktif
      </label>
    </>
  );
  return (
    <PageShell title="Etiket yönetimi">
      <SettingsForm
        action={saveTaxonomyAction}
        csrf={csrf}
        submitLabel="Yeni etiket oluştur"
      >
        <input type="hidden" name="kind" value="tag" />
        {fields()}
      </SettingsForm>
      <div className="adminTable">
        {items.map((item) => (
          <SettingsForm
            key={item.id}
            action={saveTaxonomyAction}
            csrf={csrf}
            submitLabel="Güncelle"
          >
            <input type="hidden" name="kind" value="tag" />
            <input type="hidden" name="id" value={item.id} />
            {fields(item)}
            <small>
              {item._count.posts} yazı · {item._count.wikiPages} Wiki
            </small>
          </SettingsForm>
        ))}
      </div>
    </PageShell>
  );
}
