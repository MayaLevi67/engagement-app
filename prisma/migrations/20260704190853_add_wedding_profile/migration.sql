-- CreateEnum
CREATE TYPE "VenueSetting" AS ENUM ('INDOOR', 'OUTDOOR', 'MIXED');

-- CreateEnum
CREATE TYPE "CeremonyType" AS ENUM ('RELIGIOUS', 'CIVIL', 'MIXED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('FOOD', 'PARTY', 'PHOTOGRAPHY', 'GUEST_EXPERIENCE', 'DESIGN', 'FASHION');

-- AlterTable
ALTER TABLE "Wedding" ADD COLUMN     "budgetTotal" INTEGER,
ADD COLUMN     "ceremonyType" "CeremonyType",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "dateIsApproximate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "guestCount" INTEGER,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "partner1Name" TEXT,
ADD COLUMN     "partner2Name" TEXT,
ADD COLUMN     "priorities" "Priority"[],
ADD COLUMN     "venueSetting" "VenueSetting",
ADD COLUMN     "weddingDate" TIMESTAMP(3);
