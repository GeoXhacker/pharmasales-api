-- CreateTable
CREATE TABLE "public"."ShiftSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "totalSales" DECIMAL(10,2) NOT NULL,
    "cashSales" DECIMAL(10,2) NOT NULL,
    "cardSales" DECIMAL(10,2) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftSummary_userId_idx" ON "public"."ShiftSummary"("userId");

-- CreateIndex
CREATE INDEX "ShiftSummary_branchId_idx" ON "public"."ShiftSummary"("branchId");

-- AddForeignKey
ALTER TABLE "public"."ShiftSummary" ADD CONSTRAINT "ShiftSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftSummary" ADD CONSTRAINT "ShiftSummary_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShiftSummary" ADD CONSTRAINT "ShiftSummary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
