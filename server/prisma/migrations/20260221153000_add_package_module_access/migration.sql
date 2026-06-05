-- CreateTable
CREATE TABLE "PackageModule" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackageModule_packageId_moduleId_key" ON "PackageModule"("packageId", "moduleId");

-- CreateIndex
CREATE INDEX "PackageModule_packageId_idx" ON "PackageModule"("packageId");

-- CreateIndex
CREATE INDEX "PackageModule_moduleId_idx" ON "PackageModule"("moduleId");

-- AddForeignKey
ALTER TABLE "PackageModule" ADD CONSTRAINT "PackageModule_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageModule" ADD CONSTRAINT "PackageModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
