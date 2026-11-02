-- The password hash lives in "Account"."password", kept by the authentication library (ADR-009).
-- The seed and the reviews endpoint no longer write the old column, so it can go (US-B2-01, #19).
ALTER TABLE "User" DROP COLUMN "passwordHash";
