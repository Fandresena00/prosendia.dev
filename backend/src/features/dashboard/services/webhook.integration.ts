/**
 * @file features/facebook/services/webhook.service.ts
 *
 * CHANGE: Added NotificationService.analyzeInboundMessage() call
 * after each inbound CLIENT message to trigger business alerts
 * (HOT_PROSPECT, HUMAN_TAKEOVER_REQUIRED, AI_STUCK_LOOP).
 *
 * This is the only change vs the original file — add the injection
 * and the analyzeInboundMessage call after message creation.
 *
 * ─── HOW TO APPLY ────────────────────────────────────────────────────────────
 *
 * 1. Import NotificationService:
 *
 *    import { NotificationService } from '../../dashboard/services/notification.service.js';
 *
 * 2. Inject in constructor:
 *
 *    private readonly notificationService: NotificationService,
 *
 * 3. After every inbound CLIENT message is saved to DB, add:
 *
 *    // Fire-and-forget — never block the webhook response
 *    if (savedMessage.sender === 'CLIENT' && savedMessage.content) {
 *      void this.notificationService.analyzeInboundMessage(
 *        userId,
 *        conversationId,
 *        clientName,
 *        clientPsid,
 *        pageId,
 *        savedMessage.content,
 *      ).catch((err) =>
 *        this.logger.warn(`Notification analysis failed: ${err.message}`)
 *      );
 *    }
 *
 * 4. In facebook.module.ts, add DashboardModule to imports:
 *
 *    import { DashboardModule } from '../../dashboard/dashboard.module.js';
 *    // ...
 *    imports: [
 *      PrismaModule, QueueModule, InboxEventsModule,
 *      PostsEventsModule,
 *      DashboardModule,                // ← ADD
 *      forwardRef(() => InboxSyncModule),
 *    ],
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The full webhook.service.ts file is not rewritten here because it is large
 * and only 3 targeted changes are needed. All other logic stays identical.
 */

export const WEBHOOK_INTEGRATION_GUIDE = {
  import:  "import { NotificationService } from '../../dashboard/services/notification.service.js';",
  inject:  "private readonly notificationService: NotificationService,",
  callsite: `
// After saving the inbound message to DB:
if (savedMessage.sender === 'CLIENT' && savedMessage.content) {
  void this.notificationService.analyzeInboundMessage(
    userId,
    conversationId,
    clientName ?? null,
    clientPsid ?? null,
    pageId ?? null,
    savedMessage.content,
  ).catch((err: Error) =>
    this.logger.warn(\`Notification analysis failed: \${err.message}\`)
  );
}
  `,
};
