import type { App } from "@slack/bolt";
import type { UserResolver } from "@/core/ports";

export function createSlackUserResolver(app: App): UserResolver {
  return {
    async lookupByEmail(email: string) {
      try {
        const result = await app.client.users.lookupByEmail({ email });
        const user = result.user;
        if (!user || !user.id) return null;
        const displayName =
          user.profile?.display_name || user.profile?.real_name || user.name || email;
        return { slackUserId: user.id, displayName };
      } catch {
        return null;
      }
    },
  };
}
