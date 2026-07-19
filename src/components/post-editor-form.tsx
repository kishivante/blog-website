"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
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
  Save,
  Send,
  Strikethrough,
  Table2,
  UnderlineIcon,
  Undo2,
} from "lucide-react";
import { postEditorExtensions } from "@/lib/post-editor";
import type { JSONContent } from "@tiptap/core";
import type { FormState } from "@/types/forms";
import { initialFormState } from "@/types/forms";

type Option = { id: string; name: string };
type PostValue = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: JSONContent;
  categoryId?: string;
  tagIds: string[];
  seriesId?: string;
  seriesOrder?: number | null;
  coverImage?: string | null;
  bannerColor?: string | null;
  allowComments: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
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

export function PostEditorForm({
  action,
  csrf,
  value,
  categories,
  tags,
  series,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  csrf: string;
  value: PostValue;
  categories: Option[];
  tags: Option[];
  series: Option[];
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [content, setContent] = useState<JSONContent>(value.content);
  const [title, setTitle] = useState(value.title);
  const [slug, setSlug] = useState(value.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(value.slug));
  const [preview, setPreview] = useState(false);
  const [autosave, setAutosave] = useState("Hazır");
  const [coverImage, setCoverImage] = useState(value.coverImage ?? "");
  const [currentVersion, setCurrentVersion] = useState(value.version);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef("");
  const editor = useEditor({
    extensions: postEditorExtensions,
    content: value.content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "richText editorSurface",
        "aria-label": "Yazı içeriği",
      },
      transformPastedHTML: (html) =>
        html
          .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
          .replace(/\son\w+=(?:"[^"]*"|'[^']*')/gi, ""),
    },
    onUpdate: ({ editor: current }) => setContent(current.getJSON()),
  });
  const words =
    editor?.getText().trim().split(/\s+/u).filter(Boolean).length ?? 0;
  useEffect(() => {
    const signature = JSON.stringify({ title, slug, content });
    if (signature === lastSaved.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const draft = { ...value, title, slug, content };
      localStorage.setItem(
        `scarlet-post-${value.id ?? "new"}`,
        JSON.stringify(draft),
      );
      if (!value.id) {
        setAutosave("Bu cihazda kaydedildi");
        return;
      }
      setAutosave("Kaydediliyor…");
      const response = await fetch("/api/posts/autosave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _csrf: csrf,
          id: value.id,
          title,
          slug,
          content,
          version: currentVersion,
        }),
      });
      if (response.ok) {
        const result = (await response.json()) as { version: number };
        lastSaved.current = signature;
        setCurrentVersion(result.version);
        setAutosave("Otomatik kaydedildi");
      } else
        setAutosave(
          response.status === 409
            ? "Başka bir düzenleme algılandı"
            : "Otomatik kayıt başarısız",
        );
    }, 2500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [content, csrf, currentVersion, slug, title, value]);
  if (!editor) return <div className="editorLoading">Editör hazırlanıyor…</div>;
  const link = () => {
    const href = window.prompt("Bağlantı adresi (https://)");
    if (href)
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };
  const upload = async (file: File, kind: "content" | "cover") => {
    const form = new FormData();
    form.set("_csrf", csrf);
    form.set("file", file);
    form.set("kind", kind);
    const response = await fetch("/api/uploads/post", {
      method: "POST",
      body: form,
    });
    const result = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !result.url)
      throw new Error(result.error ?? "Görsel yüklenemedi.");
    return result.url;
  };
  const image = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const src = await upload(file, "content");
        const alt = window.prompt("Alternatif metin") ?? "";
        const caption = window.prompt("Görsel alt yazısı") ?? "";
        editor
          .chain()
          .focus()
          .setImage({ src, alt, title: caption })
          .insertContent(caption ? `<p><em>${caption}</em></p>` : "")
          .run();
      } catch (error) {
        setAutosave(
          error instanceof Error ? error.message : "Görsel yüklenemedi",
        );
      }
    };
    input.click();
  };
  return (
    <form className="postComposer" action={formAction}>
      <input type="hidden" name="_csrf" value={csrf} />
      <input type="hidden" name="id" value={value.id ?? ""} />
      <input type="hidden" name="content" value={JSON.stringify(content)} />
      <input type="hidden" name="version" value={currentVersion} />
      <div className="composerTop">
        <div>
          <span className="eyebrow">Yayın stüdyosu</span>
          <h1>{value.id ? "Yazıyı düzenle" : "Yeni yazı"}</h1>
        </div>
        <div className="composerStatus">
          <span>
            {words} kelime · {Math.max(1, Math.ceil(words / 220))} dk
          </span>
          <span>{autosave}</span>
          <button
            type="button"
            className="quietButton"
            onClick={() => setPreview((current) => !current)}
          >
            {preview ? "Editöre dön" : "Önizle"}
          </button>
        </div>
      </div>
      <div className="composerLayout">
        <div className="composerMain">
          <label className="titleField">
            <span>Başlık</span>
            <input
              name="title"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
              maxLength={180}
              required
            />
          </label>
          <label>
            <span>Slug</span>
            <input
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              maxLength={160}
              required
            />
          </label>
          <label>
            <span>Kısa özet</span>
            <textarea
              name="excerpt"
              defaultValue={value.excerpt}
              maxLength={500}
              rows={3}
            />
          </label>
          {preview ? (
            <article
              className="richText editorPreview"
              dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
            />
          ) : (
            <>
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
                <button type="button" title="Bağlantı" onClick={link}>
                  <LinkIcon />
                </button>
                <button
                  type="button"
                  title="Madde listesi"
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                >
                  <List />
                </button>
                <button
                  type="button"
                  title="Numaralı liste"
                  onClick={() =>
                    editor.chain().focus().toggleOrderedList().run()
                  }
                >
                  <ListOrdered />
                </button>
                <button
                  type="button"
                  title="Alıntı"
                  onClick={() =>
                    editor.chain().focus().toggleBlockquote().run()
                  }
                >
                  <Quote />
                </button>
                <button
                  type="button"
                  title="Kod"
                  onClick={() => editor.chain().focus().toggleCode().run()}
                >
                  <Code />
                </button>
                <button
                  type="button"
                  title="Kod bloğu"
                  onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                >
                  <Code />
                </button>
                <button
                  type="button"
                  title="Yatay çizgi"
                  onClick={() =>
                    editor.chain().focus().setHorizontalRule().run()
                  }
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
                <button type="button" title="Görsel" onClick={image}>
                  <ImageIcon />
                </button>
              </div>
              <EditorContent editor={editor} />
            </>
          )}
          <label>
            <span>SEO başlığı</span>
            <input
              name="seoTitle"
              defaultValue={value.seoTitle ?? ""}
              maxLength={70}
            />
          </label>
          <label>
            <span>SEO açıklaması</span>
            <textarea
              name="seoDescription"
              defaultValue={value.seoDescription ?? ""}
              maxLength={170}
              rows={3}
            />
          </label>
          <label>
            <span>Canonical URL</span>
            <input
              name="canonicalUrl"
              type="url"
              defaultValue={value.canonicalUrl ?? ""}
              placeholder="https://"
            />
          </label>
        </div>
        <aside className="composerSidebar">
          <section className="settingsCard">
            <h2>Yayın ayarları</h2>
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
            <fieldset>
              <legend>Etiketler</legend>
              {tags.map((item) => (
                <label className="checkRow" key={item.id}>
                  <input
                    type="checkbox"
                    name="tagIds"
                    value={item.id}
                    defaultChecked={value.tagIds.includes(item.id)}
                  />
                  {item.name}
                </label>
              ))}
            </fieldset>
            <label>
              Konu / seri
              <select name="seriesId" defaultValue={value.seriesId ?? ""}>
                <option value="">Seri yok</option>
                {series.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Seri sırası
              <input
                name="seriesOrder"
                type="number"
                min={1}
                defaultValue={value.seriesOrder ?? ""}
              />
            </label>
            <input name="coverImage" type="hidden" value={coverImage} />
            <label>
              Kapak görseli
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    setAutosave("Kapak yükleniyor…");
                    setCoverImage(await upload(file, "cover"));
                    setAutosave("Kapak yüklendi");
                  } catch (error) {
                    setAutosave(
                      error instanceof Error
                        ? error.message
                        : "Kapak yüklenemedi",
                    );
                  }
                }}
              />
            </label>
            {coverImage ? <small>Kapak görseli hazır.</small> : null}
            <label>
              Banner rengi
              <input
                name="bannerColor"
                type="color"
                defaultValue={value.bannerColor ?? "#ef4056"}
              />
            </label>
            <label className="checkRow">
              <input
                name="allowComments"
                type="checkbox"
                defaultChecked={value.allowComments}
              />
              Yorumlara izin ver
            </label>
          </section>
          {state.error ? (
            <p className="formError" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="formSuccess" role="status">
              {state.success}
            </p>
          ) : null}
          <div className="composerActions">
            <button
              className="uiButton"
              name="intent"
              value="draft"
              disabled={pending}
            >
              <Save />
              Taslak kaydet
            </button>
            <button
              className="uiButton composerSubmit"
              name="intent"
              value="submit"
              disabled={pending}
            >
              <Send />
              İncelemeye gönder
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}
