-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('VENUE', 'CATERING', 'PHOTOGRAPHY', 'MUSIC', 'ATTIRE', 'DESIGN', 'FLOWERS', 'GUESTS', 'CEREMONY', 'PLANNING', 'BUDGET', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "TitleLocale" AS ENUM ('AUTO', 'EN', 'HE');

-- AlterTable
ALTER TABLE "Wedding" ADD COLUMN     "tasksSeededAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_he" TEXT NOT NULL,
    "titleLocale" "TitleLocale" NOT NULL DEFAULT 'AUTO',
    "category" "TaskCategory" NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueOffsetDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_he" TEXT NOT NULL,
    "titleLocale" "TitleLocale" NOT NULL DEFAULT 'AUTO',
    "category" "TaskCategory" NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueOffsetDays" INTEGER,
    "dueDate" TIMESTAMP(3),
    "dueDateOverridden" BOOLEAN NOT NULL DEFAULT false,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "sourceTemplateId" TEXT,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "remindAt" TIMESTAMP(3),
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_weddingId_deletedAt_idx" ON "Task"("weddingId", "deletedAt");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
