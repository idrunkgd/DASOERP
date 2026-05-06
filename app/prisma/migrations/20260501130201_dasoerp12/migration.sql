-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessGroupId" TEXT;

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE INDEX "Skill_category_name_idx" ON "Skill"("category", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGroup_name_key" ON "AccessGroup"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_accessGroupId_fkey" FOREIGN KEY ("accessGroupId") REFERENCES "AccessGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
