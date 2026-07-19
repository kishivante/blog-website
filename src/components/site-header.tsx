import { getSession } from "@/server/session";
import { HeaderClient } from "@/components/site-header-client";
import { getPublicConfig } from "@/lib/env";
import { unreadNotificationCount } from "@/services/notification-service";
import { getSitePresentation } from "@/services/site-service";
import { canAccessAdmin } from "@/lib/admin-policy";

export async function SiteHeader() {
  const [session, presentation] = await Promise.all([
    getSession(),
    getSitePresentation(),
  ]);
  const unread = session ? await unreadNotificationCount(session.userId) : 0;
  return (
    <HeaderClient
      appName={presentation.site?.brandName ?? getPublicConfig().appName}
      logo={presentation.site?.logo ?? "/brand/logo.png"}
      user={
        session
          ? {
              username: session.user.username,
              displayName: session.user.displayName,
              avatar: session.user.avatar,
              canAccessAdmin: canAccessAdmin(
                session.user.roles.map(({ role }) => role.code),
              ),
            }
          : null
      }
      unread={unread}
    />
  );
}
