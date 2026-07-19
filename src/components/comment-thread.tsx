import { Avatar } from "@/components/ui/primitives";
import {
  createCommentAction,
  deleteCommentAction,
  editCommentAction,
  moderateCommentAction,
  toggleCommentLikeAction,
} from "@/server/actions/post-interaction-actions";
import { createReportDirectAction } from "@/server/actions/report-actions";
import type { CommentStatus } from "@prisma/client";

type CommentItem = {
  id: string;
  parentId: string | null;
  depth: number;
  status: CommentStatus;
  content: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
  };
  _count: { likes: number };
};
type Node = CommentItem & { children: Node[] };

function tree(items: CommentItem[]) {
  const nodes = new Map(
    items.map((item) => [item.id, { ...item, children: [] as Node[] }]),
  );
  const roots: Node[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent && node.depth <= 3) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function CommentNode({
  item,
  postId,
  csrf,
  viewerId,
  canModerate,
}: {
  item: Node;
  postId: string;
  csrf: string;
  viewerId?: string;
  canModerate: boolean;
}) {
  const own = viewerId === item.author.id;
  const hidden = item.status === "HIDDEN";
  return (
    <article
      className="commentNode"
      style={{ "--comment-depth": item.depth } as React.CSSProperties}
    >
      <header>
        <Avatar
          src={item.author.avatar}
          name={item.author.displayName ?? item.author.username}
          size="sm"
        />
        <strong>{item.author.displayName ?? item.author.username}</strong>
        <time>{item.createdAt.toLocaleString("tr-TR")}</time>
        {item.editedAt ? <small>Düzenlendi</small> : null}
      </header>
      <p>
        {hidden
          ? "Bu yorum moderasyon tarafından gizlendi."
          : item.deletedAt
            ? "Bu yorum kullanıcı tarafından silindi."
            : item.content}
      </p>
      {!item.deletedAt && !hidden && viewerId ? (
        <div className="commentControls">
          <form action={toggleCommentLikeAction}>
            <input type="hidden" name="_csrf" value={csrf} />
            <input type="hidden" name="commentId" value={item.id} />
            <button className="quietButton">Beğen · {item._count.likes}</button>
          </form>
          {item.depth < 3 ? (
            <details>
              <summary>Yanıtla</summary>
              <form className="replyForm" action={createCommentAction}>
                <input type="hidden" name="_csrf" value={csrf} />
                <input type="hidden" name="postId" value={postId} />
                <input type="hidden" name="parentId" value={item.id} />
                <input name="content" minLength={2} maxLength={3000} required />
                <button className="quietButton">Gönder</button>
              </form>
            </details>
          ) : null}
          {own ? (
            <>
              <details>
                <summary>Düzenle</summary>
                <form className="replyForm" action={editCommentAction}>
                  <input type="hidden" name="_csrf" value={csrf} />
                  <input type="hidden" name="commentId" value={item.id} />
                  <input
                    name="content"
                    defaultValue={item.content}
                    minLength={2}
                    maxLength={3000}
                    required
                  />
                  <button className="quietButton">Kaydet</button>
                </form>
              </details>
              <form action={deleteCommentAction}>
                <input type="hidden" name="_csrf" value={csrf} />
                <input type="hidden" name="commentId" value={item.id} />
                <button className="quietButton">Sil</button>
              </form>
            </>
          ) : null}
          <details>
            <summary>Raporla</summary>
            <form className="reportForm" action={createReportDirectAction}>
              <input type="hidden" name="_csrf" value={csrf} />
              <input type="hidden" name="targetType" value="COMMENT" />
              <input type="hidden" name="targetId" value={item.id} />
              <select name="reason" defaultValue="SPAM">
                <option value="SPAM">Spam</option>
                <option value="HARASSMENT">Taciz</option>
                <option value="MISINFORMATION">Yanlış bilgi</option>
                <option value="OTHER">Diğer</option>
              </select>
              <input name="details" maxLength={2000} placeholder="Açıklama" />
              <button className="quietButton">Gönder</button>
            </form>
          </details>
          {canModerate ? (
            <details>
              <summary>Moderasyon</summary>
              <form className="replyForm" action={moderateCommentAction}>
                <input type="hidden" name="_csrf" value={csrf} />
                <input type="hidden" name="commentId" value={item.id} />
                <input
                  name="reason"
                  minLength={5}
                  placeholder="Moderasyon nedeni"
                  required
                />
                <button className="quietButton" name="intent" value="hide">
                  Gizle
                </button>
              </form>
            </details>
          ) : null}
        </div>
      ) : null}
      {hidden && viewerId && canModerate ? (
        <form className="replyForm" action={moderateCommentAction}>
          <input type="hidden" name="_csrf" value={csrf} />
          <input type="hidden" name="commentId" value={item.id} />
          <input
            type="hidden"
            name="reason"
            value="Moderasyon kararı geri alındı"
          />
          <button className="quietButton" name="intent" value="restore">
            Yorumu geri getir
          </button>
        </form>
      ) : null}
      {item.children.length ? (
        <div className="commentChildren">
          {item.children.map((child) => (
            <CommentNode
              key={child.id}
              item={child}
              postId={postId}
              csrf={csrf}
              viewerId={viewerId}
              canModerate={canModerate}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function CommentThread(props: {
  items: CommentItem[];
  postId: string;
  csrf: string;
  viewerId?: string;
  canModerate: boolean;
}) {
  return (
    <div className="commentList">
      {tree(props.items).map((item) => (
        <CommentNode key={item.id} item={item} {...props} />
      ))}
    </div>
  );
}
