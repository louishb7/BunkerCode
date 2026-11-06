-- Existing accounts retain NULL; do not invent usernames or touch credentials/sessions.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "User" ADD COLUMN "username" VARCHAR(30);
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
-- Canonical lowercase storage makes duplicate handling consistent even for direct writes.
ALTER TABLE "User" ADD CONSTRAINT "User_username_normalized"
  CHECK ("username" IS NULL OR ("username" = lower(btrim("username")) AND "username" ~ '^[a-z0-9_]{3,30}$'));
COMMIT;
