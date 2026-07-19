import type { Metadata } from "next";
import { PostEditorForm } from "@/components/post-editor-form";
import { requireUser } from "@/server/authorization";
import { createCsrfToken } from "@/server/csrf";
import { db } from "@/server/db";
import { savePostAction } from "@/server/actions/post-actions";

export const metadata: Metadata = {
  title: "Yeni yazı",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireUser();
  const [categories, tags, series] = await Promise.all([
    db.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.tag.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.series.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return (
    <main id="main-content" className="composerPage">
      <PostEditorForm
        action={savePostAction}
        csrf={await createCsrfToken()}
        categories={categories}
        tags={tags}
        series={series}
        value={{
          title: "",
          slug: "",
          excerpt: "",
          content: { type: "doc", content: [{ type: "paragraph" }] },
          tagIds: [],
          allowComments: true,
          version: 1,
        }}
      />
    </main>
  );
}
