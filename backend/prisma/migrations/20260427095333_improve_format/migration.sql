/*
  Warnings:

  - You are about to drop the column `plan` on the `payments` table. All the data in the column will be lost.
  - You are about to drop the `subscriptions` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `subscriptionPlanId` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "SenderType" ADD VALUE 'PAGE';

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_userId_fkey";

-- DropIndex
DROP INDEX "conversations_businessProfileId_idx";

-- DropIndex
DROP INDEX "conversations_externalId_idx";

-- DropIndex
DROP INDEX "facebook_connections_pageId_idx";

-- DropIndex
DROP INDEX "facebook_posts_businessProfileId_idx";

-- DropIndex
DROP INDEX "messages_conversationId_idx";

-- DropIndex
DROP INDEX "post_comments_postId_idx";

-- DropIndex
DROP INDEX "webhook_events_externalId_idx";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "plan",
ADD COLUMN     "subscriptionPlanId" TEXT NOT NULL;

-- DropTable
DROP TABLE "subscriptions";

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_plans_userId_isActive_idx" ON "subscription_plans"("userId", "isActive");

-- CreateIndex
CREATE INDEX "conversations_businessProfileId_lastMessageAt_idx" ON "conversations"("businessProfileId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "facebook_connections_tokenStatus_isActive_idx" ON "facebook_connections"("tokenStatus", "isActive");

-- CreateIndex
CREATE INDEX "facebook_posts_businessProfileId_publishedAt_idx" ON "facebook_posts"("businessProfileId", "publishedAt");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "payments_subscriptionPlanId_idx" ON "payments"("subscriptionPlanId");

-- CreateIndex
CREATE INDEX "post_comments_postId_isReplied_idx" ON "post_comments"("postId", "isReplied");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- AddForeignKey
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionPlanId_fkey" FOREIGN KEY ("subscriptionPlanId") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
