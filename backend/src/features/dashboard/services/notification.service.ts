/**
 * @file features/dashboard/services/notification.service.ts
 *
 * CHANGES:
 *   - notifySubscriptionActivated() — notification après activation d'abonnement
 *   - notifyPaymentFailed()         — notification après échec de paiement
 *   - Garde les méthodes existantes intactes
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as webPush from 'web-push';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service.js';
import { InboxEventEmitter } from '../../inbox/gateways/inbox-sse.gateway.js';
import type { NotificationDto } from '../dto/dashboard.dto.js';

// ─── Keyword detection ────────────────────────────────────────────────────────

const ESCALATION_KEYWORDS = [
  'responsable', 'manager', 'directeur', 'remboursement', 'rembourser',
  'arnaque', 'escroquerie', 'plainte', 'insatisfait', 'mécontent', 'scandale',
  'avocat', 'tribunal', 'procès', 'signaler', 'dénoncé',
  'tompon-draharaha', 'fitarainana', 'tsisy tsara', 'mampahazo',
];

const HOT_PROSPECT_KEYWORDS = [
  'commander', 'commande', 'acheter', 'achat', 'payer', 'paiement',
  'je prends', 'je veux', 'comment acheter',
  'hividiana', 'mividy', 'mandoa', 'vidiko',
  'disponible maintenant', 'livrer maintenant',
];

const DEDUP_WINDOW_MS = 2 * 60 * 60 * 1000;

const PLAN_CHANNELS: Record<string, string[]> = {
  FREE:    ['IN_APP'],
  STARTER: ['IN_APP', 'WEB_PUSH'],
  PRO:     ['IN_APP', 'WEB_PUSH', 'EMAIL'],
  CUSTOM:  ['IN_APP', 'WEB_PUSH', 'EMAIL'],
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly sseEmitter: InboxEventEmitter,
    private readonly config:     ConfigService,
  ) {
    const vapidPublic  = config.get<string>('vapidPublicKey');
    const vapidPrivate = config.get<string>('vapidPrivateKey');
    const vapidEmail   = config.get<string>('vapidEmail', 'mailto:contact@vendeoai.com');

    if (vapidPublic && vapidPrivate) {
      webPush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
    }
  }

  // ─── Billing notifications ────────────────────────────────────────────────

  /** Appelé depuis SubscriptionService.activateSubscription() */
  async notifySubscriptionActivated(
    userId:        string,
    planName:      string,
    credits:       number,
    amount:        number,
    periodEndDate: Date,
  ): Promise<void> {
    const expiryStr = periodEndDate.toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    await this.create({
      userId,
      type:        'PAYMENT_CONFIRMED',
      severity:    'SUCCESS',
      title:       '✅ Abonnement activé',
      message:
        `Plan ${planName} actif — ${credits.toLocaleString('fr-FR')} crédits ajoutés. ` +
        `Expire le ${expiryStr}.`,
      actionLabel: 'Voir la facturation',
      actionUrl:   '/billing',
    });

    this.logger.log(
      `[NOTIFICATION_SENT] PAYMENT_CONFIRMED — user=${userId} ` +
      `plan="${planName}" credits=${credits}`,
    );
  }

  async notifyPaymentFailed(userId: string, planName: string, reason: string): Promise<void> {
    await this.create({
      userId,
      type:        'PAYMENT_CONFIRMED',
      severity:    'CRITICAL',
      title:       '❌ Paiement échoué',
      message:     `Le paiement pour le plan ${planName} a échoué : ${reason}`,
      actionLabel: 'Réessayer',
      actionUrl:   '/billing',
    });
  }

  async notifyPaymentConfirmed(userId: string, planName: string, amount: number): Promise<void> {
    await this.create({
      userId,
      type:     'PAYMENT_CONFIRMED',
      severity: 'SUCCESS',
      title:    '✅ Paiement confirmé',
      message:  `Abonnement ${planName} activé — ${amount.toLocaleString('fr-MG')} Ar`,
    });
  }

  async notifySubscriptionExpiring(
    userId:   string,
    daysLeft: number,
    planName: string,
  ): Promise<void> {
    await this.create({
      userId,
      type:        'SUBSCRIPTION_EXPIRING',
      severity:    'WARNING',
      title:       '⏰ Abonnement expire bientôt',
      message:     `Votre plan ${planName} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.`,
      actionLabel: 'Renouveler',
      actionUrl:   '/billing',
    });
  }

  async notifyCreditsLow(userId: string, balance: number, total: number): Promise<void> {
    const pct = Math.round((balance / total) * 100);
    await this.create({
      userId,
      type:        'CREDITS_LOW',
      severity:    'WARNING',
      title:       '⚠️ Crédits presque épuisés',
      message:     `Il vous reste ${balance.toLocaleString('fr-FR')} crédits (${pct}%).`,
      actionLabel: 'Recharger',
      actionUrl:   '/billing',
    });
  }

  async notifyCreditsCritical(userId: string, balance: number): Promise<void> {
    await this.create({
      userId,
      type:        'CREDITS_CRITICAL',
      severity:    'CRITICAL',
      title:       '🚨 Crédits critiques',
      message:     `Moins de ${balance} crédits restants. L'IA va s'arrêter.`,
      actionLabel: 'Recharger maintenant',
      actionUrl:   '/billing',
    });
  }

  async notifyCredentialsDepleted(userId: string): Promise<void> {
    await this.create({
      userId,
      type:        'CREDITS_DEPLETED',
      severity:    'CRITICAL',
      title:       '❌ Crédits épuisés — IA désactivée',
      message:     "Vos crédits sont épuisés. L'IA ne répond plus.",
      actionLabel: 'Réactiver',
      actionUrl:   '/billing',
    });
  }

  async notifyFacebookTokenExpired(userId: string, pageName: string): Promise<void> {
    await this.create({
      userId,
      type:        'FACEBOOK_TOKEN_EXPIRED',
      severity:    'CRITICAL',
      title:       '🔌 Page Facebook déconnectée',
      message:     `La connexion avec "${pageName}" a expiré.`,
      actionLabel: 'Reconnecter',
      actionUrl:   '/settings/facebook',
    });
  }

  async notifySyncFailed(userId: string, pageName: string, reason: string): Promise<void> {
    await this.create({
      userId,
      type:     'SYNC_FAILED',
      severity: 'WARNING',
      title:    '⚠️ Synchronisation échouée',
      message:  `Synchronisation de "${pageName}" échouée: ${reason}`,
    });
  }

  async notifyPostLimitReached(
    userId:     string,
    postsUsed:  number,
    postsLimit: number,
  ): Promise<void> {
    await this.create({
      userId,
      type:        'POST_LIMIT_REACHED',
      severity:    'WARNING',
      title:       '📌 Limite de posts atteinte',
      message:     `${postsUsed}/${postsLimit} posts gérés. Passez au plan supérieur.`,
      actionLabel: 'Mettre à niveau',
      actionUrl:   '/billing',
    });
  }

  // ─── Business alerts ─────────────────────────────────────────────────────

  async analyzeInboundMessage(
    userId:         string,
    conversationId: string,
    clientName:     string | null,
    clientPsid:     string | null,
    pageId:         string | null,
    messageText:    string,
  ): Promise<void> {
    const lower = messageText.toLowerCase();

    if (ESCALATION_KEYWORDS.some((kw) => lower.includes(kw))) {
      await this.createConversationAlert({
        userId, conversationId, clientName, clientPsid, pageId,
        type:        'HUMAN_TAKEOVER_REQUIRED',
        severity:    'CRITICAL',
        title:       '🚨 Intervention humaine requise',
        message:     `${clientName ?? 'Un client'} nécessite une attention urgente.`,
        actionLabel: 'Voir la conversation',
        actionUrl:   `/inbox?conv=${conversationId}`,
      });
    }

    if (HOT_PROSPECT_KEYWORDS.some((kw) => lower.includes(kw))) {
      await this.createConversationAlert({
        userId, conversationId, clientName, clientPsid, pageId,
        type:        'HOT_PROSPECT',
        severity:    'CRITICAL',
        title:       '🔥 Prospect chaud détecté',
        message:     `${clientName ?? 'Un client'} semble prêt à acheter.`,
        actionLabel: "Saisir l'opportunité",
        actionUrl:   `/inbox?conv=${conversationId}`,
      });
    }

    await this.checkAiLoop(userId, conversationId, clientName, clientPsid, pageId);
  }

  private async checkAiLoop(
    userId: string, conversationId: string,
    clientName: string | null, clientPsid: string | null, pageId: string | null,
  ): Promise<void> {
    const recentMessages = await this.prisma.message.findMany({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
      take:    10,
      select:  { sender: true },
    });

    let exchanges   = 0;
    let lastSender: string | null = null;
    for (const msg of recentMessages) {
      if (msg.sender === 'PAGE' || msg.sender === 'HUMAN') break;
      if (msg.sender !== lastSender) { exchanges++; lastSender = msg.sender; }
    }

    if (exchanges >= 8) {
      await this.createConversationAlert({
        userId, conversationId, clientName, clientPsid, pageId,
        type:        'AI_STUCK_LOOP',
        severity:    'WARNING',
        title:       "⚠️ L'IA n'arrive pas à résoudre",
        message:     `${clientName ?? 'Un client'} échange sans résolution depuis plusieurs messages.`,
        actionLabel: 'Intervenir',
        actionUrl:   `/inbox?conv=${conversationId}`,
      });
    }
  }

  // ─── Scheduled checks ────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkUnansweredAndExpired(): Promise<void> {
    const twoHoursAgo   = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const twentyFourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const unansweredHuman = await this.prisma.conversation.findMany({
      where: {
        handoverStatus: 'HUMAN',
        lastMessageAt:  { lt: twoHoursAgo, gt: twentyFourAgo },
      },
      include: {
        businessProfile: { select: { userId: true } },
        messages: {
          where: { sender: 'CLIENT' }, orderBy: { createdAt: 'desc' },
          take: 1, select: { createdAt: true },
        },
      },
    });

    for (const conv of unansweredHuman) {
      const lastMsg      = conv.messages[0];
      if (!lastMsg) continue;
      const hoursWaiting = Math.floor((Date.now() - lastMsg.createdAt.getTime()) / 3_600_000);

      await this.createConversationAlert({
        userId:         conv.businessProfile.userId,
        conversationId: conv.id,
        clientName:     conv.clientName,
        clientPsid:     conv.clientPsid,
        pageId:         null,
        type:           'UNANSWERED_HUMAN',
        severity:       'WARNING',
        title:          '⚠️ Client en attente',
        message:        `${conv.clientName ?? 'Un client'} attend depuis ${hoursWaiting}h.`,
        actionLabel:    'Répondre',
        actionUrl:      `/inbox?conv=${conv.id}`,
      });
    }

    const expiredWindow = await this.prisma.conversation.findMany({
      where: { handoverStatus: 'AI', needsAiReply: true, lastMessageAt: { lt: twentyFourAgo } },
      include: { businessProfile: { select: { userId: true } } },
    });

    for (const conv of expiredWindow) {
      const hoursWaiting = Math.floor(
        (Date.now() - (conv.lastMessageAt?.getTime() ?? 0)) / 3_600_000,
      );
      await this.prisma.conversation.update({
        where: { id: conv.id }, data: { needsAiReply: false },
      });
      await this.createConversationAlert({
        userId:         conv.businessProfile.userId,
        conversationId: conv.id,
        clientName:     conv.clientName,
        clientPsid:     conv.clientPsid,
        pageId:         null,
        type:           'MESSENGER_WINDOW_EXPIRED',
        severity:       'WARNING',
        title:          '🕐 Fenêtre Messenger expirée',
        message:        `${conv.clientName ?? 'Un client'} sans réponse depuis ${hoursWaiting}h.`,
        actionLabel:    'Voir la conversation',
        actionUrl:      `/inbox?conv=${conv.id}`,
      });
    }
  }

  // ─── Read management ─────────────────────────────────────────────────────

  async markRead(userId: string, ids?: string[], all?: boolean): Promise<void> {
    if (all) {
      await this.prisma.notification.updateMany({
        where: { userId, isRead: false },
        data:  { isRead: true, readAt: new Date() },
      });
      return;
    }
    if (ids?.length) {
      await this.prisma.notification.updateMany({
        where: { userId, id: { in: ids } },
        data:  { isRead: true, readAt: new Date() },
      });
    }
  }

  async getNotifications(
    userId:   string,
    page    = 1,
    pageSize = 20,
    filters?: { severity?: string; type?: string; unreadOnly?: boolean; search?: string },
  ) {
    const where: Record<string, unknown> = { userId };
    if (filters?.severity)   where['severity'] = filters.severity;
    if (filters?.type)       where['type']     = filters.type;
    if (filters?.unreadOnly) where['isRead']   = false;
    if (filters?.search?.trim()) {
      where['OR'] = [
        { title:      { contains: filters.search, mode: 'insensitive' } },
        { message:    { contains: filters.search, mode: 'insensitive' } },
        { clientName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where, orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data:        notifications.map((n) => this.toDto(n)),
      unreadCount,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async saveWebPushSubscription(
    userId: string, endpoint: string, p256dh: string,
    auth: string, userAgent?: string,
  ): Promise<void> {
    await this.prisma.webPushSubscription.upsert({
      where:  { endpoint },
      create: { userId, endpoint, p256dh, auth, userAgent, isActive: true },
      update: { isActive: true, lastUsed: new Date() },
    });
  }

  async removeWebPushSubscription(userId: string, endpoint: string): Promise<void> {
    await this.prisma.webPushSubscription.updateMany({
      where: { userId, endpoint }, data: { isActive: false },
    });
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async create(data: {
    userId: string; type: string; severity: string;
    title: string; message: string;
    conversationId?: string; postId?: string; commentId?: string;
    clientName?: string | null; clientFbPsid?: string | null;
    clientFbPageId?: string | null; dedupeKey?: string;
    actionLabel?: string; actionUrl?: string;
  }): Promise<void> {
    if (data.dedupeKey) {
      const cutoff   = new Date(Date.now() - DEDUP_WINDOW_MS);
      const existing = await this.prisma.notification.findFirst({
        where: { dedupeKey: data.dedupeKey, createdAt: { gt: cutoff } },
        select: { id: true },
      });
      if (existing) {
        this.logger.debug(`[NOTIFICATION_DEDUP] ${data.dedupeKey}`);
        return;
      }
    }

    const notif = await this.prisma.notification.create({
      data: {
        userId:         data.userId,
        type:           data.type as any,
        severity:       data.severity as any,
        title:          data.title,
        message:        data.message,
        conversationId: data.conversationId ?? null,
        postId:         data.postId ?? null,
        commentId:      data.commentId ?? null,
        clientName:     data.clientName ?? null,
        clientFbPsid:   data.clientFbPsid ?? null,
        clientFbPageId: data.clientFbPageId ?? null,
        dedupeKey:      data.dedupeKey ?? null,
        actionLabel:    data.actionLabel ?? null,
        actionUrl:      data.actionUrl ?? null,
      },
    });

    // SSE temps réel
    this.sseEmitter.emit(data.userId, 'notification', this.toDto(notif));

    // Web Push pour sévérités importantes
    const user = await this.prisma.user.findUnique({
      where:  { id: data.userId },
      select: { activePlan: true, pushNotifications: true },
    });
    const channels   = PLAN_CHANNELS[user?.activePlan ?? 'FREE'] ?? ['IN_APP'];
    const shouldPush = channels.includes('WEB_PUSH') && user?.pushNotifications !== false;

    if (shouldPush && ['CRITICAL', 'WARNING', 'SUCCESS'].includes(data.severity)) {
      await this.sendWebPush(data.userId, data.title, data.message, data.actionUrl);
    }
  }

  private async createConversationAlert(data: {
    userId: string; conversationId: string;
    clientName: string | null; clientPsid: string | null; pageId: string | null;
    type: string; severity: string; title: string; message: string;
    actionLabel?: string; actionUrl?: string;
  }): Promise<void> {
    await this.create({
      ...data,
      clientFbPsid:   data.clientPsid,
      clientFbPageId: data.pageId,
      dedupeKey:      `${data.type}:${data.conversationId}`,
    });
  }

  private async sendWebPush(
    userId: string, title: string, body: string, url?: string,
  ): Promise<void> {
    const subs = await this.prisma.webPushSubscription.findMany({
      where:  { userId, isActive: true },
      select: { endpoint: true, p256dh: true, auth: true },
    });

    for (const sub of subs) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title, body,
            icon:  '/icon-192.png',
            badge: '/badge-72.png',
            data:  { url: url ?? '/dashboard' },
          }),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('410') || msg.includes('404')) {
          await this.prisma.webPushSubscription.updateMany({
            where: { endpoint: sub.endpoint }, data: { isActive: false },
          });
        }
        this.logger.warn(`[WEB_PUSH_FAILED] user=${userId}: ${msg}`);
      }
    }
  }

  private toDto(n: any): NotificationDto {
    return {
      id:                 n.id,
      type:               n.type,
      severity:           n.severity,
      title:              n.title,
      message:            n.message,
      isRead:             n.isRead,
      createdAt:          n.createdAt,
      conversationId:     n.conversationId,
      postId:             n.postId,
      commentId:          n.commentId,
      clientName:         n.clientName,
      conversationUrl:    n.conversationId ? `/inbox?conv=${n.conversationId}` : null,
      facebookProfileUrl: n.clientFbPsid ? `https://www.facebook.com/${n.clientFbPsid}` : null,
      postUrl:            n.postId ? `/facebook/posts?highlight=${n.postId}` : null,
      commentUrl:         n.postId && n.commentId
        ? `/facebook/posts?post=${n.postId}&comment=${n.commentId}` : null,
      actionLabel:        n.actionLabel,
      actionUrl:          n.actionUrl ?? (n.conversationId ? `/inbox?conv=${n.conversationId}` : null),
    };
  }
}
