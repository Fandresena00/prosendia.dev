ALTER TABLE "refresh_tokens"
ADD COLUMN "jti" TEXT;

UPDATE "refresh_tokens"
SET "jti" = "id"
WHERE "jti" IS NULL;

ALTER TABLE "refresh_tokens"
ALTER COLUMN "jti" SET NOT NULL;

CREATE UNIQUE INDEX "refresh_tokens_jti_key" ON "refresh_tokens"("jti");
CREATE INDEX "refresh_tokens_userId_jti_idx" ON "refresh_tokens"("userId", "jti");
