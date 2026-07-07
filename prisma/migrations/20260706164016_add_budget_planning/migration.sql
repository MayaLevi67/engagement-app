-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "amountPaid" INTEGER,
ADD COLUMN     "estimatedCost" INTEGER;

-- AlterTable
ALTER TABLE "Wedding" ADD COLUMN     "avgGiftPerGuest" INTEGER;

-- CreateTable
CREATE TABLE "BudgetTemplate" (
    "id" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "defaultPercent" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAllocation" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetTemplate_category_key" ON "BudgetTemplate"("category");

-- CreateIndex
CREATE INDEX "BudgetAllocation_weddingId_idx" ON "BudgetAllocation"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetAllocation_weddingId_category_key" ON "BudgetAllocation"("weddingId", "category");

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
