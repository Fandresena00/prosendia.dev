-- AlterEnum
ALTER TYPE "CreditTransactionType" ADD VALUE 'AI_SUGGESTION_CONSUME';

-- AlterTable
ALTER TABLE "ai_model_configs" ADD COLUMN     "commentMaxTokens" INTEGER,
ADD COLUMN     "commentModelId" TEXT,
ADD COLUMN     "commentModelName" TEXT,
ADD COLUMN     "commentTemperature" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "post_ai_configs" ADD COLUMN     "keywordRules" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "replyToAllComments" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "post_comments" ADD COLUMN     "aiSkipReason" TEXT,
ADD COLUMN     "aiSkipped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiSpamScore" INTEGER;
