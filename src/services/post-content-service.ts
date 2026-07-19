import "server-only";
import { generateText, type JSONContent } from "@tiptap/core";
import { generateHTML } from "@tiptap/html/server";
import sanitizeHtml from "sanitize-html";
import { postEditorExtensions } from "@/lib/post-editor";

const allowedProtocols = ["http", "https", "mailto"];
export function isSafeRichTextImageUrl(value: string) {
  if (/^\/api\/uploads\/[a-zA-Z0-9._~!$&'()*+,;=:@%/-]+$/.test(value))
    return true;
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function renderPostContent(content: JSONContent) {
  const generated = generateHTML(content, postEditorExtensions);
  let headingIndex = 0;
  const renderedContent = sanitizeHtml(generated, {
    allowedTags: [
      "p",
      "h2",
      "h3",
      "h4",
      "strong",
      "em",
      "u",
      "s",
      "a",
      "ol",
      "ul",
      "li",
      "blockquote",
      "pre",
      "code",
      "hr",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "img",
      "br",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt", "title", "loading", "decoding"],
      h2: ["id"],
      h3: ["id"],
      h4: ["id"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: allowedProtocols,
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    nonTextTags: [
      "script",
      "style",
      "textarea",
      "option",
      "noscript",
      "iframe",
      "object",
      "embed",
    ],
    transformTags: {
      h2: () => ({
        tagName: "h2",
        attribs: { id: `baslik-${++headingIndex}` },
      }),
      h3: () => ({
        tagName: "h3",
        attribs: { id: `baslik-${++headingIndex}` },
      }),
      h4: () => ({
        tagName: "h4",
        attribs: { id: `baslik-${++headingIndex}` },
      }),
      a: (_tag, attributes) => ({
        tagName: "a",
        attribs: {
          href: attributes.href ?? "",
          rel: "nofollow noopener noreferrer",
        },
      }),
      img: (_tag, attributes) => ({
        tagName: "img",
        attribs: {
          src: isSafeRichTextImageUrl(attributes.src ?? "")
            ? (attributes.src ?? "")
            : "",
          alt: attributes.alt ?? "",
          title: attributes.title ?? "",
          loading: "lazy",
          decoding: "async",
        },
      }),
    },
  });
  const text = generateText(content, postEditorExtensions, {
    blockSeparator: "\n",
  }).trim();
  const wordCount = text ? text.split(/\s+/u).length : 0;
  return {
    renderedContent,
    text,
    wordCount,
    readingTimeMinutes: Math.max(1, Math.ceil(wordCount / 220)),
  };
}

export function extractHeadings(
  content: JSONContent,
): Array<{ id: string; text: string; level: number }> {
  const headings: Array<{ id: string; text: string; level: number }> = [];
  function walk(node: JSONContent) {
    if (node.type === "heading" && typeof node.attrs?.level === "number") {
      const text = (node.content ?? [])
        .map((child) => child.text ?? "")
        .join("")
        .trim();
      if (text)
        headings.push({
          id: `baslik-${headings.length + 1}`,
          text,
          level: node.attrs.level,
        });
    }
    node.content?.forEach(walk);
  }
  walk(content);
  return headings;
}
