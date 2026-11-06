-- Additive security state only. Existing users, hashes and sessions remain untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE "AuthThrottle" (
  "key" CHAR(64) PRIMARY KEY,
  "count" INTEGER NOT NULL CHECK ("count" > 0),
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AuthThrottle_expiresAt_idx" ON "AuthThrottle"("expiresAt");
COMMIT;
