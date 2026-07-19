export const COMMENT_MAX_DEPTH = 3;
export const COMMENT_EDIT_WINDOW_MS = 30 * 60 * 1000;

export function normalizeCommentContent(content: string, maxLinks = 3) {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 3000) {
    throw new Error("Yorum 2–3000 karakter arasında olmalıdır.");
  }
  const linkCount = normalized.match(/https?:\/\/|www\./gi)?.length ?? 0;
  if (linkCount > maxLinks) {
    throw new Error(`Bir yorum en fazla ${maxLinks} bağlantı içerebilir.`);
  }
  return normalized;
}
