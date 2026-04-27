-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('VALID', 'INVALID', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WebhookEventType" AS ENUM ('MESSAGE', 'FEED_COMMENT', 'FEED_REACTION', 'FEED_CHANGE');

-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "facebook_connections" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tokenStatus" "TokenStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "tokenValidatedAt" TIMESTAMP(3);

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

-- CreateIndex
CREATE INDEX "webhook_events_facebookConnectionId_status_idx" ON "webhook_events"("facebookConnectionId", "status");

-- CreateIndex
CREATE INDEX "webhook_events_externalId_idx" ON "webhook_events"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_externalId_eventType_key" ON "webhook_events"("externalId", "eventType");

-- CreateIndex
CREATE INDEX "facebook_connections_pageId_idx" ON "facebook_connections"("pageId");

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_facebookConnectionId_fkey" FOREIGN KEY ("facebookConnectionId") REFERENCES "facebook_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
