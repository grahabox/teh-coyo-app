-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "supplierName" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "ownership" "Ownership" NOT NULL,
    "invoiceReference" TEXT NOT NULL,
    "invoiceKey" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "dueDate" DATE,
    "note" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "totalAmount" DECIMAL(18,0) NOT NULL,
    "paidAmount" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'DRAFT',
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "confirmedBy" UUID,
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseLine" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "stockItemId" UUID NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "receivedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(18,0) NOT NULL,
    "lineAmount" DECIMAL(18,0) NOT NULL,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "stockDocumentId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "linkedExisting" BOOLEAN NOT NULL DEFAULT false,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchasePayment" (
    "id" UUID NOT NULL,
    "purchaseId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "amount" DECIMAL(18,0) NOT NULL,
    "method" TEXT NOT NULL,
    "fundingSource" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "referenceKey" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchasePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Purchase_locationId_createdAt_idx" ON "Purchase"("locationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_supplierId_entityId_invoiceKey_key" ON "Purchase"("supplierId", "entityId", "invoiceKey");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLine_purchaseId_stockItemId_key" ON "PurchaseLine"("purchaseId", "stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_stockDocumentId_key" ON "PurchaseReceipt"("stockDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchasePayment_purchaseId_referenceKey_key" ON "PurchasePayment"("purchaseId", "referenceKey");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "PurchaseLine_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_stockDocumentId_fkey" FOREIGN KEY ("stockDocumentId") REFERENCES "StockDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Whole-rupiah arithmetic, declared payments and actual receipts.
ALTER TABLE "Purchase" ADD CONSTRAINT "purchase_amounts" CHECK ("totalAmount" > 0 AND "paidAmount" >= 0 AND "paidAmount" <= "totalAmount" AND "currency" = 'IDR');
ALTER TABLE "Purchase" ADD CONSTRAINT "purchase_due_date" CHECK ("dueDate" IS NULL OR "dueDate" >= "businessDate");
ALTER TABLE "Purchase" ADD CONSTRAINT "purchase_confirmed" CHECK (("status" = 'DRAFT' AND "confirmedAt" IS NULL AND "confirmedBy" IS NULL AND "paidAmount" = 0) OR ("status" = 'CONFIRMED' AND "confirmedAt" IS NOT NULL AND "confirmedBy" IS NOT NULL));
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "purchase_line_range" CHECK ("quantity" > 0 AND "unitPrice" > 0 AND "lineAmount" > 0 AND "receivedQuantity" >= 0 AND "receivedQuantity" <= "quantity");
ALTER TABLE "PurchaseLine" ADD CONSTRAINT "purchase_line_rounding" CHECK ("lineAmount" = ROUND("quantity" * "unitPrice", 0));
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "purchase_payment_positive" CHECK ("amount" > 0 AND "method" IN ('CASH', 'BANK_TRANSFER'));
CREATE TRIGGER purchase_receipt_append_only BEFORE UPDATE OR DELETE ON "PurchaseReceipt"
FOR EACH ROW EXECUTE FUNCTION reject_stock_history_change();
CREATE TRIGGER purchase_payment_append_only BEFORE UPDATE OR DELETE ON "PurchasePayment"
FOR EACH ROW EXECUTE FUNCTION reject_stock_history_change();
