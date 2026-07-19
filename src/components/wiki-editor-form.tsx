"use client";

import { useActionState, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import {
  Bold,
  Code,
  Heading2,
  ImageIcon,
  Italic,
  LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  UnderlineIcon,
  Undo2,
} from "lucide-react";
import { postEditorExtensions } from "@/lib/post-editor";
import type { FormState } from "@/types/forms";
import { initialFormState } from "@/types/forms";

type Option = { id: string; name: string };
type WikiValue = {
  id?: string;
  title: string;
  slug: string;
  summary: string;
  content: JSONContent;
  categoryId?: string | null;
  tagIds: string[];
  linkedPageIds: string[];
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  locked: boolean;
  lockedReason?: string | null;
  version: number;
};

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160);

export function WikiEditorForm({
  action,
  csrf,
  value,
  categories,
  tags,
  pages,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  csrf: string;
  value: WikiValue;
  categories: Option[];
  tags: Option[];
  pages: Array<{ id: string; title: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [content, setContent] = useState(value.content);
  const [title, setTitle] = useState(value.title);
  const [slug, setSlug] = useState(value.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(value.slug));
  const [message, setMessage] = useState("");
  const editor = useEditor({
    extensions: postEditorExtensions,
    content: value.content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "richText editorSurface",
        "aria-label": "Wiki içeriği",
      },
      transformPastedHTML: (html) =>
        html
          .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
          .replace(/\son\w+=(?:"[^"]*"|'[^']*')/gi, ""),
    },
    onUpdate: ({ editor: current }) => setContent(current.getJSON()),
  });
  if (!editor) return <div className="editorLoading">Editör hazırlanıyor…</div>;

  const addLink = () => {
    const href = window.prompt("Bağlantı adresi (https://)");
    if (href)
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };
  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const form = new FormData();
      form.set("_csrf", csrf);
      form.set("file", file);
      form.set("kind", "content");
      form.set("scope", "wiki");
      const response = await fetch("/api/uploads/post", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.url) {
        setMessage(result.error ?? "Görsel yüklenemedi.");
        return;
      }
      editor
        .chain()
        .focus()
        .setImage({
          src: result.url,
          alt: window.prompt("Alternatif metin") ?? "",
        })
        .run();
    };
    input.click();
  };

  return (
    <form className="postComposer wikiComposer" action={formAction}>
      <input type="hidden" name="_csrf" value={csrf} />
      <input type="hidden" name="id" value={value.id ?? ""} />
      <input type="hidden" name="content" value={JSON.stringify(content)} />
      <input type="hidden" name="version" value={value.version} />
      <div className="composerTop">
        <div>
          <span className="eyebrow">Wiki yönetimi</span>
          <h1>{value.id ? "Wiki sayfasını düzenle" : "Yeni Wiki sayfası"}</h1>
        </div>
        <span>Sürüm {value.version}</span>
      </div>
      {state.error ? (
        <div className="uiAlert" role="alert">
          <strong>{state.error}</strong>
        </div>
      ) : null}
      {state.error?.includes("çakışması") ? (
        <section className="conflictNotice">
          <h2>Mevcut sürüm ile sizin değişikliğiniz</h2>
          <div className="conflictComparison">
            <div>
              <strong>Sunucudaki sürüm: {state.fields?._serverTitle?.[0]}</strong>
              <pre>{state.fields?._serverContent?.[0]}</pre>
            </div>
            <div>
              <strong>Sizin değişikliğiniz</strong>
              <pre>{editor.getText()}</pre>
            </div>
          </div>
          <p>Değişikliklerinizi kopyalayın, sayfayı yenileyin ve güncel sürüme gerekli bölümleri yeniden uygulayın.</p>
        </section>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <div className="composerFields">
        <label>
          Başlık
          <input
            name="title"
            value={title}
            minLength={5}
            maxLength={180}
            required
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
          />
        </label>
        <label>
          Slug
          <input
            name="slug"
            value={slug}
            required
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
          />
        </label>
        <label className="fullField">
          Özet
          <textarea
            name="summary"
            defaultValue={value.summary}
            minLength={20}
            maxLength={500}
            required
          />
        </label>
      </div>
      <div
        className="editorToolbar"
        role="toolbar"
        aria-label="Metin biçimlendirme"
      >
        <button
          type="button"
          title="Geri al"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 />
        </button>
        <button
          type="button"
          title="İleri al"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 />
        </button>
        <button
          type="button"
          title="Başlık"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 />
        </button>
        <button
          type="button"
          title="Kalın"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </button>
        <button
          type="button"
          title="İtalik"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </button>
        <button
          type="button"
          title="Altı çizili"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon />
        </button>
        <button
          type="button"
          title="Üstü çizili"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </button>
        <button type="button" title="Bağlantı" onClick={addLink}>
          <LinkIcon />
        </button>
        <button
          type="button"
          title="Liste"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </button>
        <button
          type="button"
          title="Numaralı liste"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </button>
        <button
          type="button"
          title="Alıntı"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </button>
        <button
          type="button"
          title="Kod"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code />
        </button>
        <button
          type="button"
          title="Çizgi"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus />
        </button>
        <button
          type="button"
          title="Tablo"
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          <Table2 />
        </button>
        <button type="button" title="Görsel" onClick={addImage}>
          <ImageIcon />
        </button>
      </div>
      <EditorContent editor={editor} />
      <div className="composerFields">
        <label>
          Kategori
          <select name="categoryId" defaultValue={value.categoryId ?? ""}>
            <option value="">Kategori yok</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Durum
          <select name="status" defaultValue={value.status}>
            <option value="DRAFT">Taslak</option>
            <option value="PUBLISHED">Yayınlanmış</option>
            <option value="ARCHIVED">Arşivlenmiş</option>
          </select>
        </label>
        <label>
          Etiketler
          <select name="tagIds" multiple defaultValue={value.tagIds}>
            {tags.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bağlantılı sayfalar
          <select
            name="linkedPageIds"
            multiple
            defaultValue={value.linkedPageIds}
          >
            {pages
              .filter((item) => item.id !== value.id)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
          </select>
        </label>
        <label className="fullField">
          Değişiklik özeti
          <input
            name="changeSummary"
            minLength={3}
            maxLength={300}
            required
            placeholder="Bu sürümde ne değişti?"
          />
        </label>
        <label>
          <input type="checkbox" name="locked" defaultChecked={value.locked} />{" "}
          Sayfayı kilitle
        </label>
        <label>
          Kilit nedeni
          <input
            name="lockedReason"
            defaultValue={value.lockedReason ?? ""}
            maxLength={300}
          />
        </label>
      </div>
      <button className="uiButton" disabled={pending}>
        {pending ? "Kaydediliyor…" : "Wiki sayfasını kaydet"}
      </button>
    </form>
  );
}
