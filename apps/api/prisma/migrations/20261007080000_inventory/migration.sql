-- CreateEnum
CREATE TYPE "StockDocumentKind" AS ENUM ('OPENING', 'RECEIPT', 'ADJUSTMENT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "StockDocumentStatus" AS ENUM ('DRAFT', 'POSTED', 'SHIPPED', 'RECEIVED');

-- CreateTable
CREATE TABLE "StockBalance" (
    "locationId" UUID NOT NULL,
    "stockItemId" UUID NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "openingDate" DATE,
    "lastMovementDate" DATE,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("locationId","stockItemId")
);

-- CreateTable
CREATE TABLE "StockDocument" (
    "id" UUID NOT NULL,
    "kind" "StockDocumentKind" NOT NULL,
    "status" "StockDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "locationId" UUID NOT NULL,
    "destinationId" UUID,
    "businessDate" DATE NOT NULL,
    "reference" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "supplierName" TEXT,
    "requestHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMPTZ(3),

    CONSTRAINT "StockDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockDocumentLine" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "stockItemId" UUID NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "receivedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,

    CONSTRAINT "StockDocumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReceiptEvent" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReceiptEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "stockItemId" UUID NOT NULL,
    "lineId" UUID NOT NULL,
    "receiptEventId" UUID,
    "kind" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "balanceAfter" DECIMAL(18,6) NOT NULL,
    "businessDate" DATE NOT NULL,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockDocument_locationId_createdAt_idx" ON "StockDocument"("locationId", "createdAt");

-- CreateIndex
CREATE INDEX "StockDocument_destinationId_createdAt_idx" ON "StockDocument"("destinationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockDocumentLine_documentId_stockItemId_key" ON "StockDocumentLine"("documentId", "stockItemId");

-- CreateIndex
CREATE INDEX "StockMovement_locationId_stockItemId_createdAt_idx" ON "StockMovement"("locationId", "stockItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDocument" ADD CONSTRAINT "StockDocument_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDocumentLine" ADD CONSTRAINT "StockDocumentLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StockDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockDocumentLine" ADD CONSTRAINT "StockDocumentLine_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReceiptEvent" ADD CONSTRAINT "StockReceiptEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "StockDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_locationId_stockItemId_fkey" FOREIGN KEY ("locationId", "stockItemId") REFERENCES "StockBalance"("locationId", "stockItemId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "StockDocumentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_receiptEventId_fkey" FOREIGN KEY ("receiptEventId") REFERENCES "StockReceiptEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defensive invariants, in addition to application validation.
ALTER TABLE "StockBalance" ADD CONSTRAINT "stock_balance_nonnegative" CHECK ("quantity" >= 0);
ALTER TABLE "StockBalance" ADD CONSTRAINT "stock_balance_initialized" CHECK ("openingDate" IS NOT NULL OR ("quantity" = 0 AND "lastMovementDate" IS NULL));
ALTER TABLE "StockDocument" ADD CONSTRAINT "stock_document_destination" CHECK (("kind" = 'TRANSFER' AND "destinationId" IS NOT NULL AND "destinationId" <> "locationId") OR ("kind" <> 'TRANSFER' AND "destinationId" IS NULL));
ALTER TABLE "StockDocument" ADD CONSTRAINT "stock_document_status" CHECK (("kind" = 'TRANSFER' AND "status" IN ('DRAFT', 'SHIPPED', 'RECEIVED')) OR ("kind" <> 'TRANSFER' AND "status" IN ('DRAFT', 'POSTED')));
ALTER TABLE "StockDocumentLine" ADD CONSTRAINT "stock_line_received_range" CHECK ("receivedQuantity" >= 0 AND (("quantity" >= 0 AND "receivedQuantity" <= "quantity") OR ("quantity" < 0 AND "receivedQuantity" = 0)));
ALTER TABLE "StockMovement" ADD CONSTRAINT "stock_movement_balance_nonnegative" CHECK ("balanceAfter" >= 0);
ALTER TABLE "StockMovement" ADD CONSTRAINT "stock_movement_kind" CHECK ("kind" IN ('OPENING', 'RECEIPT', 'ADJUSTMENT', 'SHIPMENT', 'TRANSFER_RECEIPT'));

CREATE FUNCTION reject_stock_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Stock history is append-only; post a correcting document instead';
END;
$$;
CREATE TRIGGER stock_movement_append_only BEFORE UPDATE OR DELETE ON "StockMovement"
FOR EACH ROW EXECUTE FUNCTION reject_stock_history_change();
CREATE TRIGGER stock_receipt_append_only BEFORE UPDATE OR DELETE ON "StockReceiptEvent"
FOR EACH ROW EXECUTE FUNCTION reject_stock_history_change();
