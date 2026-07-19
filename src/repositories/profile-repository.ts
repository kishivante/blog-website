import { db } from "@/server/db";
import { normalizeIdentity } from "@/lib/identity";

export async function findProfile(username: string, viewerId?: string) {
  const normalizedUsername = normalizeIdentity(username);
  const user = await db.user.findUnique({
    where: { normalizedUsername },
    include: {
      roles: {
        include: { role: true },
        orderBy: { role: { priority: "desc" } },
      },
      badges: {
        where: { visible: true, badge: { visible: true } },
        include: { badge: true },
        orderBy: { badge: { sortOrder: "asc" } },
      },
      privacySettings: true,
    },
  });
  if (!user) {
    const previous = await db.usernameHistory.findUnique({
      where: { normalizedUsername },
    });
    if (previous)
      return {
        redirectUsername: (
          await db.user.findUnique({
            where: { id: previous.userId },
            select: { username: true },
          })
        )?.username,
      };
  }
  if (!user || user.deletedAt || user.accountStatus === "DELETED") return null;
  const own = viewerId === user.id;
  const authenticated = Boolean(viewerId);
  const blocked = viewerId
    ? await db.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: viewerId, blockedId: user.id },
            { blockerId: user.id, blockedId: viewerId },
          ],
        },
        select: { blockerId: true },
      })
    : null;
  const visible =
    own ||
    user.profileVisibility === "PUBLIC" ||
    (user.profileVisibility === "AUTHENTICATED" && authenticated);
  const following = viewerId
    ? Boolean(
        await db.userFollow.findUnique({
          where: {
            followerId_followingId: {
              followerId: viewerId,
              followingId: user.id,
            },
          },
        }),
      )
    : false;
  const privacy = user.privacySettings;
  const [latestPosts, popularPosts, wiki, comments, postCount, likeCount] =
    visible
      ? await Promise.all([
          db.post.findMany({
            where: { authorId: user.id, status: "PUBLISHED", deletedAt: null },
            orderBy: { publishedAt: "desc" },
            take: 6,
            include: {
              categories: { include: { category: true } },
              author: { include: { roles: { include: { role: true } } } },
            },
          }),
          db.post.findMany({
            where: { authorId: user.id, status: "PUBLISHED", deletedAt: null },
            orderBy: [{ likes: { _count: "desc" } }, { publishedAt: "desc" }],
            take: 4,
            include: {
              categories: { include: { category: true } },
              author: { include: { roles: { include: { role: true } } } },
            },
          }),
          privacy?.showWikiContributions === false && !own
            ? Promise.resolve([])
            : db.wikiRevision.findMany({
                where: { editorId: user.id },
                include: { wikiPage: { select: { title: true, slug: true } } },
                orderBy: { createdAt: "desc" },
                take: 6,
              }),
          privacy?.showCommentHistory === false && !own
            ? Promise.resolve([])
            : db.comment.findMany({
                where: {
                  authorId: user.id,
                  status: "VISIBLE",
                  deletedAt: null,
                },
                include: { post: { select: { title: true, slug: true } } },
                orderBy: { createdAt: "desc" },
                take: 8,
              }),
          db.post.count({
            where: { authorId: user.id, status: "PUBLISHED", deletedAt: null },
          }),
          db.postLike.count({
            where: {
              post: { authorId: user.id, status: "PUBLISHED", deletedAt: null },
            },
          }),
        ])
      : [[], [], [], [], 0, 0];
  return {
    user,
    own,
    visible,
    blocked,
    following,
    latestPosts,
    popularPosts,
    wiki,
    comments,
    postCount,
    likeCount,
  };
}
