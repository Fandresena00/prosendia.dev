/**
 * @file features/inbox/utils/messaging-window.util.ts
 *
 * Shared helpers for the Facebook Messenger "standard messaging window":
 * a Page can only send free-form messages within 24h of the last message
 * IT RECEIVED FROM THE CLIENT. Outside that window, Facebook rejects the
 * send — the frontend must instead point the agent to Messenger itself.
 *
 * Used by both ConversationService (REST responses) and InboxSyncService
 * (realtime `conversation_updated` events) so the two never drift apart.
 */

export const MESSENGER_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface MessagingWindowInfo {
  messagingWindowExpiresAt: Date | null;
  canSendFreeform: boolean;
}

/**
 * @param lastClientMessageAt  Conversation.lastClientMessageAt from the DB.
 *                             Null when the client has never messaged (should
 *                             not normally happen — conversations are always
 *                             created from an inbound message — but handled
 *                             defensively: treated as "window closed").
 */
export function computeMessagingWindow(
  lastClientMessageAt: Date | null | undefined,
): MessagingWindowInfo {
  if (!lastClientMessageAt) {
    return { messagingWindowExpiresAt: null, canSendFreeform: false };
  }
  const expiresAt = new Date(lastClientMessageAt.getTime() + MESSENGER_WINDOW_MS);
  return {
    messagingWindowExpiresAt: expiresAt,
    canSendFreeform: expiresAt.getTime() > Date.now(),
  };
}

/**
 * Facebook does not offer a public, officially documented way to deep-link
 * a Page admin directly into ONE specific customer thread from outside the
 * Messenger/Business Suite app — m.me links are for the customer's side only.
 * This links into the Page's own Messenger inbox in Meta Business Suite,
 * which is the closest reliable, always-working target; the frontend banner
 * pairs it with the client's name so the agent can find the thread in one
 * search.
 */
export function buildMessengerDeepLink(pageId: string | null | undefined): string | null {
  if (!pageId) return null;
  return `https://www.facebook.com/latest/inbox/messenger?asset_id=${encodeURIComponent(pageId)}`;
}
