-- AlterTable
ALTER TABLE "User"
ADD COLUMN "activeDeviceId" TEXT,
ADD COLUMN "activeDeviceLabel" TEXT,
ADD COLUMN "activeSessionStartedAt" TIMESTAMP(3);
