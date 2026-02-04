import type { WebClient } from "@slack/web-api";
import type { UserResolver } from "@/core/ports";

export function createSlackUserResolver(client: WebClient): UserResolver {
  return {
    async lookupByEmail(email: string) {
      try {
        const result = await client.users.lookupByEmail({ email });
        const user = result.user;
        if (!user || !user.id) return null;
        const displayName =
          user.profile?.display_name || user.profile?.real_name || user.name || email;
        return { slackUserId: user.id, displayName };
      } catch {
        return null;
      }
    },

    async lookupByUserId(userId: string) {
      try {
        const result = await client.users.info({ user: userId });
        const user = result.user;
        if (!user) return null;
        const displayName =
          user.profile?.display_name || user.profile?.real_name || user.name || userId;
        return { displayName };
      } catch {
        return null;
      }
    },
  };
}
