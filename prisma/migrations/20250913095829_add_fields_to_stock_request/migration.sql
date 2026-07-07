-- AlterTable
ALTER TABLE "public"."StockRequest" ADD COLUMN     "minStockLevel" INTEGER,
ADD COLUMN     "sellingPrice" DECIMAL(10,2);
