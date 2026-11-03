-- Stable ledger posting order, including several lines posted at the same instant.
ALTER TABLE "StockMovement" ADD COLUMN "sequence" SERIAL NOT NULL;
CREATE UNIQUE INDEX "StockMovement_sequence_key" ON "StockMovement"("sequence");