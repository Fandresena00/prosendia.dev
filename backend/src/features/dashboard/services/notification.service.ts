/**
 * @file features/dashboard/services/notification.service.ts
 *
 * Service central des notifications VendeoAI.
 *
 * Responsabilités :
 *   - Créer des notifications avec déduplication (une seule notif par conversation
 *     dans une fenêtre glissante de 2h pour les notifs client)
 *   - Dispatcher via Web Push (Starter/Pro) et Email (Pro)
 *   - Émettre via SSE (InboxEventEmitter) pour affichage en temps réel
 *   - Analyser les messages entrants pour déclencher les alertes métier
 *
 * Alertes métier déclenchées ici (pas dans le webhook) :
 *   HOT_PROSPECT             → intention d'achat détectée
 *   HUMAN_TAKEOVER_REQUIRED  → mot-clé sensible détecté
 *   AI_STUCK_LOOP            → ≥4 échanges sans résolution
 *   UNANSWERED_HUMAN         → conversation HUMAN, dernier msg client > 2h
 *   MESSENGER_WINDOW_EXPIRED → dernier msg client > 24h
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
  // Malagasy
  'tompon-draharaha', 'fitarainana', 'tsisy tsara', 'mampahazo',
];

const HOT_PROSPECT_KEYWORDS = [
  'commander', 'commande', 'acheter', 'achat', 'payer', 'paiement',
  'je prends', 'je veux', 'je veux commander', 'comment acheter',
  'hividiana', 'mividy', 'mandoa', 'vidiko', 'vidiny',
  'disponible maintenant', 'livrer maintenant',
];

/** Fenêtre de déduplication (ms) — évite les doublons pour la même conversation */
const DEDUP_WINDOW_MS = 2 * 60 * 60 * 1000; // 2h

// ─── Plan → channels map ─────────────────────────────────────────────────────

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
    private readonly prisma:      PrismaService,
    private readonly sseEmitter:  InboxEventEmitter,
    private readonly config:      ConfigService,
  ) {
    const vapidPublic  = config.get<string>('vapidPublicKey');
    const vapidPrivate = config.get<string>('vapidPrivateKey');
    const vapidEmail   = config.get<string>('vapidEmail', 'mailto:contact@vendeoai.com');

    if (vapidPublic && vapidPrivate) {
      webPush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
    }
  }

  // ─── Public factory methods ───────────────────────────────────────────────

  async notifyPaymentConfirmed(userId: string, planName: string, amount: number): Promise<void> {
    await this.create({
      userId,
      type:     'PAYMENT_CONFIRMED',
      severity: 'SUCCESS',
      title:    '✅ Paiement confirmé',
      message:  `Abonnement ${planName} activé — ${amount.toLocaleString('fr-MG')} Ar`,
    });
  }

  async notifySubscriptionExpiring(userId: string, daysLeft: number, planName: string): Promise<void> {
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
      message:     `Il vous reste ${balance.toLocaleString('fr-FR')} crédits (${pct}%). Pensez à renouveler.`,
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
      message:     `Moins de ${balance} crédits restants. L'IA va bientôt s'arrêter.`,
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
      message:     "Vos crédits IA sont épuisés. L'IA ne répond plus. Souscrivez un abonnement.",
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
      message:     `La connexion avec "${pageName}" a expiré. Reconnectez pour continuer.`,
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

  async notifyPostLimitReached(userId: string, postsUsed: number, postsLimit: number): Promise<void> {
    await this.create({
      userId,
      type:        'POST_LIMIT_REACHED',
      severity:    'WARNING',
      title:       '📌 Limite de posts atteinte',
      message:     `${postsUsed}/${postsLimit} posts gérés. Passez au plan supérieur pour en ajouter.`,
      actionLabel: 'Mettre à niveau',
      actionUrl:   '/billing',
    });
  }

  // ─── Analyse des messages entrants ───────────────────────────────────────

  /**
   * Analyse un message client entrant et crée les alertes métier appropriées.
   * Appelé depuis WebhookService après insertion du message.
   */
  async analyzeInboundMessage(
    userId:         string,
    conversationId: string,
    clientName:     string | null,
    clientPsid:     string | null,
    pageId:         string | null,
    messageText:    string,
  ): Promise<void> {
    const lower = messageText.toLowerCase();

    // 1. Escalation keywords → intervention humaine requise
    if (ESCALATION_KEYWORDS.some((kw) => lower.includes(kw))) {
      await this.createConversationAlert({
        userId,
        conversationId,
        clientName,
        clientPsid,
        pageId,
        type:        'HUMAN_TAKEOVER_REQUIRED',
        severity:    'CRITICAL',
        title:       '🚨 Intervention humaine requise',
        message:     `${clientName ?? 'Un client'} nécessite une attention urgente.`,
        actionLabel: 'Voir la conversation',
        actionUrl:   `/inbox?conv=${conversationId}`,
      });
    }

    // 2. Hot prospect → intention d'achat
    if (HOT_PROSPECT_KEYWORDS.some((kw) => lower.includes(kw))) {
      await this.createConversationAlert({
        userId,
        conversationId,
        clientName,
        clientPsid,
        pageId,
        type:        'HOT_PROSPECT',
        severity:    'CRITICAL',
        title:       '🔥 Prospect chaud détecté',
        message:     `${clientName ?? 'Un client'} semble prêt à acheter.`,
        actionLabel: 'Saisir l\'opportunité',
        actionUrl:   `/inbox?conv=${conversationId}`,
      });
    }

    // 3. Vérifier la boucle IA (≥4 échanges sans résolution)
    await this.checkAiLoop(userId, conversationId, clientName, clientPsid, pageId);
  }

  // ─── AI loop detection ────────────────────────────────────────────────────

  private async checkAiLoop(
    userId:         string,
    conversationId: string,
    clientName:     string | null,
    clientPsid:     string | null,
    pageId:         string | null,
  ): Promise<void> {
    // Compter les échanges récents (depuis la dernière résolution)
    const recentMessages = await this.prisma.message.findMany({
      where:   { conversationId },
      orderBy: { createdAt: 'desc' },
      take:    10,
      select:  { sender: true },
    });

    // Compter les allers-retours CLIENT→AI consécutifs
    let exchanges = 0;
    let lastSender: string | null = null;
    for (const msg of recentMessages) {
      if (msg.sender === 'PAGE' || msg.sender === 'HUMAN') break; // résolution humaine
      if (msg.sender !== lastSender) {
        exchanges++;
        lastSender = msg.sender;
      }
    }

    if (exchanges >= 8) { // 4 allers-retours = 8 messages
      await this.createConversationAlert({
        userId,
        conversationId,
        clientName,
        clientPsid,
        pageId,
        type:        'AI_STUCK_LOOP',
        severity:    'WARNING',
        title:       '⚠️ L\'IA n\'arrive pas à résoudre',
        message:     `${clientName ?? 'Un client'} échange avec l'IA depuis plusieurs messages sans résolution.`,
        actionLabel: 'Intervenir',
        actionUrl:   `/inbox?conv=${conversationId}`,
      });
    }
  }

  // ─── Scheduled: unanswered human + messenger window expired ──────────────

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkUnansweredAndExpired(): Promise<void> {
    const twoHoursAgo    = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const twentyFourAgo  = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Conversations HUMAN avec dernier message client > 2h
    const unansweredHuman = await this.prisma.conversation.findMany({
      where: {
        handoverStatus: 'HUMAN',
        lastMessageAt:  { lt: twoHoursAgo, gt: twentyFourAgo },
      },
      include: {
        businessProfile: { select: { userId: true } },
        messages: {
          where:   { sender: 'CLIENT' },
          orderBy: { createdAt: 'desc' },
          take:    1,
          select:  { createdAt: true },
        },
      },
    });

    for (const conv of unansweredHuman) {
      const lastClientMsg = conv.messages[0];
      if (!lastClientMsg) continue;

      const hoursWaiting = Math.floor(
        (Date.now() - lastClientMsg.createdAt.getTime()) / 3_600_000,
      );

      await this.createConversationAlert({
        userId:         conv.businessProfile.userId,
        conversationId: conv.id,
        clientName:     conv.clientName,
        clientPsid:     conv.clientPsid,
        pageId:         null,
        type:           'UNANSWERED_HUMAN',
        severity:       'WARNING',
        title:          '⚠️ Client en attente',
        message:        `${conv.clientName ?? 'Un client'} attend depuis ${hoursWaiting}h sans réponse.`,
        actionLabel:    'Répondre',
        actionUrl:      `/inbox?conv=${conv.id}`,
      });
    }

    // Messenger window expired: dernier msg client > 24h, conv IA
    const expiredWindow = await this.prisma.conversation.findMany({
      where: {
        handoverStatus: 'AI',
        needsAiReply:   true,
        lastMessageAt:  { lt: twentyFourAgo },
      },
      include: {
        businessProfile: { select: { userId: true } },
      },
    });

    for (const conv of expiredWindow) {
      const hoursWaiting = Math.floor(
        (Date.now() - (conv.lastMessageAt?.getTime() ?? 0)) / 3_600_000,
      );

      // Stopper les tentatives de réponse IA
      await this.prisma.conversation.update({
        where: { id: conv.id },
        data:  { needsAiReply: false },
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
        message:        `${conv.clientName ?? 'Un client'} n'a pas reçu de réponse depuis ${hoursWaiting}h. Fenêtre Facebook expirée.`,
        actionLabel:    'Voir la conversation',
        actionUrl:      `/inbox?conv=${conv.id}`,
      });
    }
  }

  // ─── Scheduled: subscription expiring check ──────────────────────────────

  @Cron('0 9 * * *') // 09:00 chaque jour
  async checkSubscriptionExpiring(): Promise<void> {
    const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now              = new Date();

    const expiringSubs = await this.prisma.subscription.findMany({
      where:   { status: 'ACTIVE', periodEnd: { gt: now, lt: sevenDaysFromNow } },
      include: { user: { select: { id: true, activePlan: true } } },
    });

    for (const sub of expiringSubs) {
      const daysLeft = Math.ceil(
        (sub.periodEnd.getTime() - Date.now()) / 86_400_000,
      );

      // Notifier seulement à 7j et à 3j (pas à chaque cron)
      if (daysLeft !== 7 && daysLeft !== 3 && daysLeft !== 1) continue;

      const planName = sub.plan;
      await this.notifySubscriptionExpiring(sub.user.id, daysLeft, planName);
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

  // ─── Query notifications ──────────────────────────────────────────────────

  async getNotifications(
    userId:   string,
    page    = 1,
    pageSize = 20,
    filters?: {
      severity?:   string;
      type?:       string;
      unreadOnly?: boolean;
      search?:     string;
    },
  ) {
    const where: Record<string, unknown> = { userId };

    if (filters?.severity)   where['severity']  = filters.severity;
    if (filters?.type)       where['type']       = filters.type;
    if (filters?.unreadOnly) where['isRead']     = false;

    if (filters?.search?.trim()) {
      where['OR'] = [
        { title:      { contains: filters.search, mode: 'insensitive' } },
        { message:    { contains: filters.search, mode: 'insensitive' } },
        { clientName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
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

  // ─── Web Push subscription management ────────────────────────────────────

  async saveWebPushSubscription(
    userId:    string,
    endpoint:  string,
    p256dh:    string,
    auth:      string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.webPushSubscription.upsert({
      where:  { endpoint },
      create: { userId, endpoint, p256dh, auth, userAgent, isActive: true },
      update: { isActive: true, lastUsed: new Date() },
    });
  }

  async removeWebPushSubscription(userId: string, endpoint: string): Promise<void> {
    await this.prisma.webPushSubscription.updateMany({
      where: { userId, endpoint },
      data:  { isActive: false },
    });
  }

  // ─── Private: create notification ────────────────────────────────────────

  private async create(data: {
    userId:         string;
    type:           string;
    severity:       string;
    title:          string;
    message:        string;
    conversationId?: string;
    postId?:         string;
    commentId?:      string;
    clientName?:     string | null;
    clientFbPsid?:   string | null;
    clientFbPageId?: string | null;
    dedupeKey?:      string;
    actionLabel?:    string;
    actionUrl?:      string;
  }): Promise<void> {
    // Déduplication: ne pas recréer si même dedupeKey dans la fenêtre
    if (data.dedupeKey) {
      const cutoff   = new Date(Date.now() - DEDUP_WINDOW_MS);
      const existing = await this.prisma.notification.findFirst({
        where: {
          dedupeKey: data.dedupeKey,
          createdAt: { gt: cutoff },
        },
        select: { id: true },
      });
      if (existing) {
        this.logger.debug(`Notification deduplicated: ${data.dedupeKey}`);
        return;
      }
    }

    const notif = await this.prisma.notification.create({
      data: {
        userId:          data.userId,
        type:            data.type as any,
        severity:        data.severity as any,
        title:           data.title,
        message:         data.message,
        conversationId:  data.conversationId ?? null,
        postId:          data.postId ?? null,
        commentId:       data.commentId ?? null,
        clientName:      data.clientName ?? null,
        clientFbPsid:    data.clientFbPsid ?? null,
        clientFbPageId:  data.clientFbPageId ?? null,
        dedupeKey:       data.dedupeKey ?? null,
        actionLabel:     data.actionLabel ?? null,
        actionUrl:       data.actionUrl ?? null,
      },
    });

    // SSE push en temps réel
    this.sseEmitter.emit(data.userId, 'notification', this.toDto(notif));

    // Web Push (si activé selon le plan)
    const user = await this.prisma.user.findUnique({
      where:  { id: data.userId },
      select: { activePlan: true, pushNotifications: true },
    });

    const channels = PLAN_CHANNELS[user?.activePlan ?? 'FREE'] ?? ['IN_APP'];
    const shouldPush = channels.includes('WEB_PUSH') && user?.pushNotifications !== false;

    if (shouldPush && ['CRITICAL', 'WARNING'].includes(data.severity)) {
      await this.sendWebPush(data.userId, data.title, data.message, data.actionUrl);
    }

    this.logger.debug(`Notification created: ${data.type} for user=${data.userId}`);
  }

  private async createConversationAlert(data: {
    userId:         string;
    conversationId: string;
    clientName:     string | null;
    clientPsid:     string | null;
    pageId:         string | null;
    type:           string;
    severity:       string;
    title:          string;
    message:        string;
    actionLabel?:   string;
    actionUrl?:     string;
  }): Promise<void> {
    await this.create({
      ...data,
      clientFbPsid:   data.clientPsid,
      clientFbPageId: data.pageId,
      dedupeKey:      `${data.type}:${data.conversationId}`,
    });
  }

  // ─── Web Push dispatch ────────────────────────────────────────────────────

  private async sendWebPush(
    userId:  string,
    title:   string,
    body:    string,
    url?:    string,
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
            title,
            body,
            icon:  '/icon-192.png',
            badge: '/badge-72.png',
            data:  { url: url ?? '/dashboard' },
          }),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('410') || msg.includes('404')) {
          // Subscription expirée — la désactiver
          await this.prisma.webPushSubscription.updateMany({
            where: { endpoint: sub.endpoint },
            data:  { isActive: false },
          });
        }
        this.logger.warn(`Web Push failed for user=${userId}: ${msg}`);
      }
    }
  }

  // ─── DTO mapper ───────────────────────────────────────────────────────────

  private toDto(n: any): NotificationDto {
    const fbProfileUrl = n.clientFbPsid
      ? `https://www.facebook.com/${n.clientFbPsid}`
      : null;

    const postUrl = n.postId
      ? `/facebook/posts?highlight=${n.postId}`
      : null;

    const commentUrl = n.postId && n.commentId
      ? `/facebook/posts?post=${n.postId}&comment=${n.commentId}`
      : null;

    const conversationUrl = n.conversationId
      ? `/inbox?conv=${n.conversationId}`
      : null;

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
      conversationUrl,
      facebookProfileUrl: fbProfileUrl,
      postUrl,
      commentUrl,
      actionLabel:        n.actionLabel,
      actionUrl:          n.actionUrl ?? conversationUrl,
    };
  }
}
