-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'FACEBOOK');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'STARTER', 'PRO', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('HAIR_SALON', 'RESTAURANT', 'FREELANCER', 'SHOP', 'SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('FRIENDLY', 'PROFESSIONAL', 'FORMAL');

-- CreateEnum
CREATE TYPE "ResponseStyle" AS ENUM ('SHORT', 'DETAILED', 'MIXED');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('USER', 'CLIENT', 'AI', 'PAGE');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('AI', 'HUMAN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY', 'MANUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('SUBSCRIPTION_GRANT', 'AI_REPLY_CONSUME', 'COMMENT_AI_CONSUME', 'ADMIN_ADJUST');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('VALID', 'INVALID', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WebhookEventType" AS ENUM ('MESSAGE', 'FEED_COMMENT', 'FEED_REACTION', 'FEED_CHANGE');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AiDecision" AS ENUM ('REPLIED', 'ESCALATED', 'SKIPPED', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "activePlan" "Plan" NOT NULL DEFAULT 'FREE',
    "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "providerId" TEXT,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "creditAlertSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessType" "BusinessType" NOT NULL,
    "description" TEXT,
    "whatsappNumber" TEXT,
    "websiteUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_configs" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "tone" "Tone" NOT NULL DEFAULT 'FRIENDLY',
    "responseStyle" "ResponseStyle" NOT NULL DEFAULT 'MIXED',
    "autoReply" BOOLEAN NOT NULL DEFAULT true,
    "systemPrompt" TEXT,
    "inboxInstructions" TEXT,
    "commentInstructions" TEXT,
    "replyLanguage" TEXT,
    "maxReplyTokens" INTEGER NOT NULL DEFAULT 300,
    "replyDelaySeconds" INTEGER NOT NULL DEFAULT 0,
    "personalizeGreeting" BOOLEAN NOT NULL DEFAULT true,
    "maxContextMessages" INTEGER NOT NULL DEFAULT 8,
    "summaryEveryN" INTEGER NOT NULL DEFAULT 10,
    "blockedKeywords" JSONB NOT NULL DEFAULT '[]',
    "allowedTopics" JSONB NOT NULL DEFAULT '[]',
    "escalateOnLowConfidence" BOOLEAN NOT NULL DEFAULT true,
    "escalationThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_configs" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "replyModelId" TEXT NOT NULL DEFAULT 'anthropic/claude-3.5-haiku',
    "replyModelName" TEXT NOT NULL DEFAULT 'Claude 3.5 Haiku',
    "replyMaxTokens" INTEGER NOT NULL DEFAULT 400,
    "replyTemperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "summaryModelId" TEXT NOT NULL DEFAULT 'meta-llama/llama-3.1-8b-instruct:free',
    "summaryModelName" TEXT NOT NULL DEFAULT 'Llama 3.1 8B Instruct (free)',
    "summaryMaxTokens" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_summaries" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "upToMessageId" TEXT,
    "messagesCovered" INTEGER NOT NULL DEFAULT 0,
    "modelId" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_reply_logs" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "inboundMessageId" TEXT,
    "decision" "AiDecision" NOT NULL,
    "modelId" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "replyTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "replyText" TEXT,
    "escalationReason" TEXT,
    "confidence" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_reply_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facebook_connections" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "tokenStatus" "TokenStatus" NOT NULL DEFAULT 'UNKNOWN',
    "tokenValidatedAt" TIMESTAMP(3),
    "grantedScopes" JSONB NOT NULL DEFAULT '[]',
    "instagramAccountId" TEXT,
    "webhookSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "facebookConnectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "eventType" "WebhookEventType" NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
    "rawPayload" JSONB NOT NULL,
    "resultEntityId" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "clientPsid" TEXT,
    "clientName" TEXT,
    "clientAvatarUrl" TEXT,
    "lastMessage" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "handoverStatus" "HandoverStatus" NOT NULL DEFAULT 'AI',
    "humanTookOverAt" TIMESTAMP(3),
    "agentNote" TEXT,
    "needsAiReply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" "SenderType" NOT NULL,
    "content" TEXT,
    "imageUrl" TEXT,
    "fileUrl" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "externalId" TEXT,
    "aiModel" TEXT,
    "aiTokensUsed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facebook_posts" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "message" TEXT,
    "imageUrl" TEXT,
    "permalinkUrl" TEXT,
    "reactionsCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "sharesCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorAvatarUrl" TEXT,
    "message" TEXT NOT NULL,
    "commentedAt" TIMESTAMP(3) NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "isReplied" BOOLEAN NOT NULL DEFAULT false,
    "replyContent" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedByAi" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_ai_configs" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "autoReply" BOOLEAN NOT NULL DEFAULT true,
    "tone" "Tone",
    "responseStyle" "ResponseStyle",
    "customInstructions" TEXT,
    "replyLanguage" TEXT,
    "maxReplyTokens" INTEGER,
    "privateReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "privateReplyMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_resources" (
    "id" TEXT NOT NULL,
    "businessProfileId" TEXT NOT NULL,
    "conversationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_resource_images" (
    "id" TEXT NOT NULL,
    "chatResourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_resource_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "creditsGranted" INTEGER NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "renewedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MGA',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL,
    "papiReference" TEXT,
    "papiPaymentLink" TEXT,
    "papiNotificationToken" TEXT,
    "papiPayerPhone" TEXT,
    "papiPayerName" TEXT,
    "papiTransactionRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "type" "CreditTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "tokensUsed" INTEGER,
    "modelId" TEXT,
    "conversationId" TEXT,
    "commentId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "business_profiles_userId_idx" ON "business_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_configs_businessProfileId_key" ON "ai_configs"("businessProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_configs_businessProfileId_key" ON "ai_model_configs"("businessProfileId");

-- CreateIndex
CREATE INDEX "conversation_summaries_conversationId_createdAt_idx" ON "conversation_summaries"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_reply_logs_conversationId_createdAt_idx" ON "ai_reply_logs"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_reply_logs_decision_idx" ON "ai_reply_logs"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_connections_businessProfileId_key" ON "facebook_connections"("businessProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_connections_pageId_key" ON "facebook_connections"("pageId");

-- CreateIndex
CREATE INDEX "facebook_connections_tokenStatus_isActive_idx" ON "facebook_connections"("tokenStatus", "isActive");

-- CreateIndex
CREATE INDEX "webhook_events_facebookConnectionId_status_idx" ON "webhook_events"("facebookConnectionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_externalId_eventType_key" ON "webhook_events"("externalId", "eventType");

-- CreateIndex
CREATE INDEX "conversations_businessProfileId_lastMessageAt_idx" ON "conversations"("businessProfileId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "conversations_handoverStatus_needsAiReply_idx" ON "conversations"("handoverStatus", "needsAiReply");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_businessProfileId_externalId_key" ON "conversations"("businessProfileId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_businessProfileId_clientPsid_key" ON "conversations"("businessProfileId", "clientPsid");

-- CreateIndex
CREATE UNIQUE INDEX "messages_externalId_key" ON "messages"("externalId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "facebook_posts_externalId_key" ON "facebook_posts"("externalId");

-- CreateIndex
CREATE INDEX "facebook_posts_businessProfileId_publishedAt_idx" ON "facebook_posts"("businessProfileId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "post_comments_externalId_key" ON "post_comments"("externalId");

-- CreateIndex
CREATE INDEX "post_comments_postId_isReplied_idx" ON "post_comments"("postId", "isReplied");

-- CreateIndex
CREATE UNIQUE INDEX "post_ai_configs_postId_key" ON "post_ai_configs"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_resources_conversationId_key" ON "chat_resources"("conversationId");

-- CreateIndex
CREATE INDEX "chat_resources_businessProfileId_idx" ON "chat_resources"("businessProfileId");

-- CreateIndex
CREATE INDEX "chat_resource_images_chatResourceId_idx" ON "chat_resource_images"("chatResourceId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_status_idx" ON "subscriptions"("userId", "status");

-- CreateIndex
CREATE INDEX "subscriptions_periodEnd_idx" ON "subscriptions"("periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "payments_papiReference_key" ON "payments"("papiReference");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_papiReference_idx" ON "payments"("papiReference");

-- CreateIndex
CREATE INDEX "payments_subscriptionId_idx" ON "payments"("subscriptionId");

-- CreateIndex
CREATE INDEX "credit_ledger_userId_createdAt_idx" ON "credit_ledger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "credit_ledger_userId_type_idx" ON "credit_ledger"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_jti_key" ON "refresh_tokens"("jti");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_jti_idx" ON "refresh_tokens"("userId", "jti");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_configs" ADD CONSTRAINT "ai_configs_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_configs" ADD CONSTRAINT "ai_model_configs_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reply_logs" ADD CONSTRAINT "ai_reply_logs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_connections" ADD CONSTRAINT "facebook_connections_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_facebookConnectionId_fkey" FOREIGN KEY ("facebookConnectionId") REFERENCES "facebook_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facebook_posts" ADD CONSTRAINT "facebook_posts_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "facebook_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_ai_configs" ADD CONSTRAINT "post_ai_configs_postId_fkey" FOREIGN KEY ("postId") REFERENCES "facebook_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_resources" ADD CONSTRAINT "chat_resources_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_resources" ADD CONSTRAINT "chat_resources_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_resource_images" ADD CONSTRAINT "chat_resource_images_chatResourceId_fkey" FOREIGN KEY ("chatResourceId") REFERENCES "chat_resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
