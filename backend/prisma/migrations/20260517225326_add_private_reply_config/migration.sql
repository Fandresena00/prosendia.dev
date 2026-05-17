-- AlterTable
ALTER TABLE "post_ai_configs" ADD COLUMN     "privateReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privateReplyMessage" TEXT;
