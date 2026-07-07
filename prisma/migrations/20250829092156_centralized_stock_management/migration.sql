/*
  Warnings:

  - You are about to drop the column `stockId` on the `PrescriptionMedication` table. All the data in the column will be lost.
  - You are about to drop the column `stockId` on the `SaleItem` table. All the data in the column will be lost.
  - You are about to drop the column `stockId` on the `StockAdjustment` table. All the data in the column will be lost.
  - You are about to drop the `Stock` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `productId` to the `PrescriptionMedication` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stockBatchId` to the `SaleItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stockBatchId` to the `StockAdjustment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."StockTransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');

-- AlterEnum
ALTER TYPE "public"."StockAdjustmentReason" ADD VALUE 'TRANSFER';

-- DropForeignKey
ALTER TABLE "public"."PrescriptionMedication" DROP CONSTRAINT "PrescriptionMedication_stockId_fkey";

-- DropForeignKey
ALTER TABLE "public"."SaleItem" DROP CONSTRAINT "SaleItem_stockId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Stock" DROP CONSTRAINT "Stock_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Stock" DROP CONSTRAINT "Stock_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Stock" DROP CONSTRAINT "Stock_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StockAdjustment" DROP CONSTRAINT "StockAdjustment_stockId_fkey";

-- DropIndex
DROP INDEX "public"."SaleItem_stockId_idx";

-- DropIndex
DROP INDEX "public"."StockAdjustment_stockId_idx";

-- AlterTable
ALTER TABLE "public"."PrescriptionMedication" DROP COLUMN "stockId",
ADD COLUMN     "productId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."SaleItem" DROP COLUMN "stockId",
ADD COLUMN     "stockBatchId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "public"."StockAdjustment" DROP COLUMN "stockId",
ADD COLUMN     "stockBatchId" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."Stock";

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "brand" TEXT,
    "dosage" TEXT NOT NULL,
    "dosageUnit" "public"."DosageUnit" NOT NULL,
    "formulation" "public"."DrugFormulation" NOT NULL,
    "barcode" TEXT,
    "description" TEXT,
    "requiresPrescription" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BranchStock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minStockLevel" INTEGER NOT NULL DEFAULT 10,
    "sellingPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockBatch" (
    "id" TEXT NOT NULL,
    "branchStockId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "buyingPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockTransfer" (
    "id" TEXT NOT NULL,
    "stockBatchId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "public"."StockTransferStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "public"."Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "public"."Product"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_tenantId_name_brand_dosage_key" ON "public"."Product"("tenantId", "name", "brand", "dosage");

-- CreateIndex
CREATE INDEX "BranchStock_branchId_idx" ON "public"."BranchStock"("branchId");

-- CreateIndex
CREATE INDEX "BranchStock_productId_idx" ON "public"."BranchStock"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchStock_branchId_productId_key" ON "public"."BranchStock"("branchId", "productId");

-- CreateIndex
CREATE INDEX "StockBatch_branchStockId_idx" ON "public"."StockBatch"("branchStockId");

-- CreateIndex
CREATE INDEX "StockBatch_expiryDate_idx" ON "public"."StockBatch"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "StockBatch_branchStockId_batchNumber_key" ON "public"."StockBatch"("branchStockId", "batchNumber");

-- CreateIndex
CREATE INDEX "StockTransfer_fromBranchId_idx" ON "public"."StockTransfer"("fromBranchId");

-- CreateIndex
CREATE INDEX "StockTransfer_toBranchId_idx" ON "public"."StockTransfer"("toBranchId");

-- CreateIndex
CREATE INDEX "PrescriptionMedication_productId_idx" ON "public"."PrescriptionMedication"("productId");

-- CreateIndex
CREATE INDEX "SaleItem_stockBatchId_idx" ON "public"."SaleItem"("stockBatchId");

-- CreateIndex
CREATE INDEX "StockAdjustment_stockBatchId_idx" ON "public"."StockAdjustment"("stockBatchId");

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BranchStock" ADD CONSTRAINT "BranchStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BranchStock" ADD CONSTRAINT "BranchStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockBatch" ADD CONSTRAINT "StockBatch_branchStockId_fkey" FOREIGN KEY ("branchStockId") REFERENCES "public"."BranchStock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockAdjustment" ADD CONSTRAINT "StockAdjustment_stockBatchId_fkey" FOREIGN KEY ("stockBatchId") REFERENCES "public"."StockBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockTransfer" ADD CONSTRAINT "StockTransfer_stockBatchId_fkey" FOREIGN KEY ("stockBatchId") REFERENCES "public"."StockBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockTransfer" ADD CONSTRAINT "StockTransfer_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockTransfer" ADD CONSTRAINT "StockTransfer_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockTransfer" ADD CONSTRAINT "StockTransfer_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SaleItem" ADD CONSTRAINT "SaleItem_stockBatchId_fkey" FOREIGN KEY ("stockBatchId") REFERENCES "public"."StockBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PrescriptionMedication" ADD CONSTRAINT "PrescriptionMedication_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
