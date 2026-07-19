import { PageShell } from "@/components/page-shell";
import { SettingsForm } from "@/components/settings-form";
import { saveTaxonomyAction } from "@/server/actions/admin-actions";
import { requirePermission } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";

export default async function CategoriesPage() {
  await requirePermission("taxonomy.manage");
  const [items, csrf] = await Promise.all([
    db.category.findMany({
      include: {
        parent: true,
        _count: { select: { posts: true, wikiPages: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    createCsrfToken(),
  ]);
  return (
    <PageShell title="Kategori yönetimi">
      <SettingsForm
        action={saveTaxonomyAction}
        csrf={csrf}
        submitLabel="Yeni kategori oluştur"
      >
        <input type="hidden" name="kind" value="category" />
        <label>
          Ad
          <input name="name" required />
        </label>
        <label>
          Slug
          <input name="slug" pattern="[a-z0-9-]+" required />
        </label>
        <label>
          Açıklama
          <textarea name="description" maxLength={500} />
        </label>
        <label>
          Üst kategori
          <select name="parentId">
            <option value="">Yok</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Renk
          <input name="color" type="color" defaultValue="#3a8dde" />
        </label>
        <label>
          İkon
          <input name="icon" maxLength={50} />
        </label>
        <label>
          Sıra
          <input name="sortOrder" type="number" min={0} defaultValue={0} />
        </label>
        <label>
          <input name="active" type="checkbox" defaultChecked />
          Aktif
        </label>
      </SettingsForm>
      <div className="adminTable">
        {items.map((item) => (
          <SettingsForm
            key={item.id}
            action={saveTaxonomyAction}
            csrf={csrf}
            submitLabel="Güncelle"
          >
            <input type="hidden" name="kind" value="category" />
            <input type="hidden" name="id" value={item.id} />
            <label>
              Ad
              <input name="name" defaultValue={item.name} required />
            </label>
            <label>
              Slug
              <input name="slug" defaultValue={item.slug} required />
            </label>
            <label>
              Açıklama
              <textarea
                name="description"
                defaultValue={item.description ?? ""}
              />
            </label>
            <label>
              Üst kategori
              <select name="parentId" defaultValue={item.parentId ?? ""}>
                <option value="">Yok</option>
                {items
                  .filter((parent) => parent.id !== item.id)
                  .map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name}
                    </option>
                  ))}
              </select>
            </label>
            <input
              name="color"
              type="color"
              defaultValue={item.color ?? "#3a8dde"}
            />
            <input name="icon" defaultValue={item.icon ?? ""} />
            <input
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={item.sortOrder}
            />
            <label>
              <input
                name="active"
                type="checkbox"
                defaultChecked={item.active}
              />
              Aktif
            </label>
            <small>
              {item._count.posts} yazı · {item._count.wikiPages} Wiki
            </small>
          </SettingsForm>
        ))}
      </div>
    </PageShell>
  );
}
