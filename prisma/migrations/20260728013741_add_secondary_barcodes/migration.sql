-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "gtin" TEXT,
ADD COLUMN     "secondaryBarcodes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "serialNumber" TEXT;
