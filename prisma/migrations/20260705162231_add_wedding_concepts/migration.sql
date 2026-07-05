-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "sourceConceptElementId" TEXT;

-- AlterTable
ALTER TABLE "Wedding" ADD COLUMN     "selectedConceptId" TEXT;

-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_he" TEXT NOT NULL,
    "titleLocale" "TitleLocale" NOT NULL DEFAULT 'AUTO',
    "tagline_en" TEXT,
    "tagline_he" TEXT,
    "description_en" TEXT,
    "description_he" TEXT,
    "palette" TEXT[],
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptImage" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt_en" TEXT,
    "alt_he" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConceptImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptElement" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_he" TEXT NOT NULL,
    "titleLocale" "TitleLocale" NOT NULL DEFAULT 'AUTO',
    "description_en" TEXT,
    "description_he" TEXT,
    "category" "TaskCategory" NOT NULL,
    "estCostMin" INTEGER,
    "estCostMax" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConceptElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptFavorite" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConceptImage_conceptId_idx" ON "ConceptImage"("conceptId");

-- CreateIndex
CREATE INDEX "ConceptElement_conceptId_idx" ON "ConceptElement"("conceptId");

-- CreateIndex
CREATE INDEX "ConceptFavorite_weddingId_idx" ON "ConceptFavorite"("weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptFavorite_weddingId_conceptId_key" ON "ConceptFavorite"("weddingId", "conceptId");

-- AddForeignKey
ALTER TABLE "Wedding" ADD CONSTRAINT "Wedding_selectedConceptId_fkey" FOREIGN KEY ("selectedConceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptImage" ADD CONSTRAINT "ConceptImage_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptElement" ADD CONSTRAINT "ConceptElement_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptFavorite" ADD CONSTRAINT "ConceptFavorite_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptFavorite" ADD CONSTRAINT "ConceptFavorite_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
