-- CreateEnum
CREATE TYPE "AiDecision" AS ENUM ('REPLIED', 'ESCALATED', 'SKIPPED', 'ERROR');

-- AlterTable
ALTER TABLE "ai_configs" ADD COLUMN     "maxContextMessages" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "summaryEveryN" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "needsAiReply" BOOLEAN NOT NULL DEFAULT false;

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

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_configs_businessProfileId_key" ON "ai_model_configs"("businessProfileId");

-- CreateIndex
CREATE INDEX "conversation_summaries_conversationId_createdAt_idx" ON "conversation_summaries"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_reply_logs_conversationId_createdAt_idx" ON "ai_reply_logs"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_reply_logs_decision_idx" ON "ai_reply_logs"("decision");

-- CreateIndex
CREATE INDEX "conversations_handoverStatus_needsAiReply_idx" ON "conversations"("handoverStatus", "needsAiReply");

-- AddForeignKey
ALTER TABLE "ai_model_configs" ADD CONSTRAINT "ai_model_configs_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_summaries" ADD CONSTRAINT "conversation_summaries_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reply_logs" ADD CONSTRAINT "ai_reply_logs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
