-- CreateEnum
CREATE TYPE "PayerRole" AS ENUM ('PARTNER_1', 'PARTNER_2', 'BOTH', 'PARTNER_1_FAMILY', 'PARTNER_2_FAMILY', 'OTHER');

-- CreateTable
CREATE TABLE "TaskPayment" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payer" "PayerRole" NOT NULL,
    "payerLabel" TEXT,
    "paidOn" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskPayment_weddingId_idx" ON "TaskPayment"("weddingId");

-- CreateIndex
CREATE INDEX "TaskPayment_taskId_idx" ON "TaskPayment"("taskId");

-- AddForeignKey
ALTER TABLE "TaskPayment" ADD CONSTRAINT "TaskPayment_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPayment" ADD CONSTRAINT "TaskPayment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing Task.amountPaid becomes one imported payment (payer OTHER).
INSERT INTO "TaskPayment" ("id", "weddingId", "taskId", "amount", "payer", "note", "paidOn", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, t."weddingId", t."id", t."amountPaid", 'OTHER', 'imported',
  COALESCE(t."completedAt", NOW()), NOW(), NOW()
FROM "Task" t
WHERE t."amountPaid" IS NOT NULL AND t."amountPaid" > 0;
