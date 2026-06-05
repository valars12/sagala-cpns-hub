-- AlterTable
ALTER TABLE "Package"
ADD COLUMN "latihanDurationMinutes" INTEGER NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE "Module" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "content" TEXT NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserModuleAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserModuleAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserModuleAccess_userId_moduleId_key" ON "UserModuleAccess"("userId", "moduleId");

-- CreateIndex
CREATE INDEX "UserModuleAccess_userId_idx" ON "UserModuleAccess"("userId");

-- CreateIndex
CREATE INDEX "UserModuleAccess_moduleId_idx" ON "UserModuleAccess"("moduleId");

-- AddForeignKey
ALTER TABLE "Module"
ADD CONSTRAINT "Module_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModuleAccess"
ADD CONSTRAINT "UserModuleAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModuleAccess"
ADD CONSTRAINT "UserModuleAccess_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModuleAccess"
ADD CONSTRAINT "UserModuleAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
