-- PD-40: dados separados por usuário (T-62).
-- Os dados gravados antes das contas não pertencem a ninguém e são descartados (decisão do usuário).
TRUNCATE TABLE
  "refund_allocations", "refunds", "installments", "recurrence_exceptions", "transactions",
  "installment_plans", "invoices", "recurrences", "credit_cards", "payment_methods",
  "categories", "financial_periods", "job_states"
  RESTART IDENTITY CASCADE;

-- DropIndex
DROP INDEX "financial_periods_reference_month_key";

-- DropIndex
DROP INDEX "transactions_financial_month_idx";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "credit_cards" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "financial_periods" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "installment_plans" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "installments" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "recurrence_exceptions" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "recurrences" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "refund_allocations" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "user_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "categories_user_id_idx" ON "categories"("user_id");

-- CreateIndex
CREATE INDEX "credit_cards_user_id_idx" ON "credit_cards"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_user_id_reference_month_key" ON "financial_periods"("user_id", "reference_month");

-- CreateIndex
CREATE INDEX "installment_plans_user_id_idx" ON "installment_plans"("user_id");

-- CreateIndex
CREATE INDEX "installments_user_id_idx" ON "installments"("user_id");

-- CreateIndex
CREATE INDEX "invoices_user_id_reference_month_idx" ON "invoices"("user_id", "reference_month");

-- CreateIndex
CREATE INDEX "payment_methods_user_id_idx" ON "payment_methods"("user_id");

-- CreateIndex
CREATE INDEX "recurrence_exceptions_user_id_idx" ON "recurrence_exceptions"("user_id");

-- CreateIndex
CREATE INDEX "recurrences_user_id_idx" ON "recurrences"("user_id");

-- CreateIndex
CREATE INDEX "refund_allocations_user_id_idx" ON "refund_allocations"("user_id");

-- CreateIndex
CREATE INDEX "refunds_user_id_idx" ON "refunds"("user_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_financial_month_idx" ON "transactions"("user_id", "financial_month");

-- AddForeignKey
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_exceptions" ADD CONSTRAINT "recurrence_exceptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_allocations" ADD CONSTRAINT "refund_allocations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nomes únicos por usuário, sem diferenciar maiúsculas (categories.md §5, payment-methods.md RN-MET-09).
DROP INDEX "categories_name_lower_key";
DROP INDEX "payment_methods_name_lower_key";
CREATE UNIQUE INDEX "categories_user_id_name_lower_key" ON "categories" ("user_id", lower("name"));
CREATE UNIQUE INDEX "payment_methods_user_id_name_lower_key" ON "payment_methods" ("user_id", lower("name"));
