import { BranchStock, Product, StockBatch, Category, Supplier, Sale, SaleItem } from '@prisma/client';

export type ProductWithRelations = Product & {
  category: Category | null;
  supplier: Supplier | null;
};

export type BranchStockWithRelations = BranchStock & {
  product: ProductWithRelations;
  batches: StockBatch[];
};

export type SaleItemWithBatch = SaleItem & {
  stockBatch: StockBatch & {
    branchStock: BranchStock & {
      product: Product
    }
  }
}

export type SaleWithRelations = Sale & {
  items: SaleItemWithBatch[];
};

export const drugFormulations = [
  "TABLET", "CAPSULE", "LOZENGE", "POWDER", "GRANULES",
  "SYRUP", "SUSPENSION", "SOLUTION", "ELIXIR", "EMULSION",
  "CREAM", "OINTMENT", "GEL", "LOTION", "PATCH", "PASTE",
  "INJECTION", "INFUSION",
  "INHALER", "NEBULIZER_SOLUTION",
  "DROPS", "SUPPOSITORY", "SPRAY", "OIL", "PESSARIES"
];

export const dosageUnits = [
  "MG", "MCG", "G", "ML", "IU", "PERCENT", "PCS"
];
