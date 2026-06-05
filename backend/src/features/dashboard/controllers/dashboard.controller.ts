/**
 * @file features/dashboard/dashboard.controller.ts
 *
 * Routes:
 *   GET  /dashboard                           → données complètes du dashboard
 *   GET  /dashboard/notifications             → liste paginée + filtres + search
 *   POST /dashboard/notifications/read        → marquer comme lu(es)
 *   DELETE /dashboard/notifications/:id       → supprimer une notification
 *   GET  /dashboard/notifications/unread-count → count seul (polling léger)
 *   POST /dashboard/push/subscribe            → enregistrer abonnement Web Push
 *   DELETE /dashboard/push/unsubscribe        → désactiver abonnement Web Push
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.types.js';
import {
  MarkReadDto,
  NotificationsQueryDto,
  WebPushSubscribeDto,
} from './dto/dashboard.dto.js';
import { DashboardStatsService } from './services/dashboard-stats.service.js';
import { NotificationService } from './services/notification.service.js';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly stats:         DashboardStatsService,
    private readonly notifications: NotificationService,
  ) {}

  // ─── Dashboard principal ──────────────────────────────────────────────────

  /**
   * GET /dashboard
   * Retourne toutes les données du dashboard en un seul appel.
   * Les notifications retournées ici = 5 dernières non lues.
   */
  @Get()
  async getDashboard(@CurrentUser() user: AuthenticatedUser) {
    const [dashboard, notifPage] = await Promise.all([
      this.stats.getDashboard(user.sub),
      this.notifications.getNotifications(user.sub, 1, 5, { unreadOnly: false }),
    ]);

    // Compter les critiques
    const criticalCount = notifPage.data.filter(
      (n) => n.severity === 'CRITICAL' && !n.isRead,
    ).length;

    return {
      ...dashboard,
      notifications: notifPage.data,
      unreadCount:   notifPage.unreadCount,
      criticalCount,
    };
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  /**
   * GET /dashboard/notifications
   * Liste paginée avec filtres :
   *   ?page=1&pageSize=20&severity=CRITICAL&type=HOT_PROSPECT&unreadOnly=true&search=Marie
   */
  @Get('notifications')
  getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationsQueryDto,
  ) {
    return this.notifications.getNotifications(
      user.sub,
      query.page      ?? 1,
      query.pageSize  ?? 20,
      {
        severity:   query.severity,
        type:       query.type,
        unreadOnly: query.unreadOnly,
        search:     query.search,
      },
    );
  }

  /**
   * GET /dashboard/notifications/unread-count
   * Polling léger pour le badge dans la sidebar.
   */
  @Get('notifications/unread-count')
  getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.getUnreadCount(user.sub).then((count) => ({ count }));
  }

  /**
   * POST /dashboard/notifications/read
   * { ids: ["uuid1", "uuid2"] } ou { all: true }
   */
  @Post('notifications/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @Body() dto: MarkReadDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.notifications.markRead(user.sub, dto.ids, dto.all);
  }

  /**
   * DELETE /dashboard/notifications/:id
   */
  @Delete('notifications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.notifications['prisma'].notification.deleteMany({
      where: { id, userId: user.sub },
    });
  }

  // ─── Web Push ─────────────────────────────────────────────────────────────

  /**
   * POST /dashboard/push/subscribe
   * Enregistre un abonnement Web Push depuis le service worker.
   */
  @Post('push/subscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  subscribePush(
    @Body() dto: WebPushSubscribeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.notifications.saveWebPushSubscription(
      user.sub,
      dto.endpoint,
      dto.p256dh,
      dto.auth,
      dto.userAgent,
    );
  }

  /**
   * DELETE /dashboard/push/unsubscribe
   * Désactive un abonnement Web Push.
   */
  @Post('push/unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribePush(
    @Body('endpoint') endpoint: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.notifications.removeWebPushSubscription(user.sub, endpoint);
  }
}
