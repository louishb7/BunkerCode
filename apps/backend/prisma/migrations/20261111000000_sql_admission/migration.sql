CREATE TABLE "SqlQuota" (
  "key" CHAR(64) NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "SqlQuota_expiresAt_idx" ON "SqlQuota"("expiresAt");
CREATE TABLE "SqlRunnerSlot" (
  "id" INTEGER NOT NULL PRIMARY KEY CHECK ("id" = 1),
  "owner" UUID,
  "claimedAt" TIMESTAMP(3),
  "suspended" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "SqlRunnerSlot_claim" CHECK (("owner" IS NULL) = ("claimedAt" IS NULL))
);
INSERT INTO "SqlRunnerSlot" ("id") VALUES (1);
