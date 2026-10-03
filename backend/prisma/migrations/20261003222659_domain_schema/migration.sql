-- CreateEnum
CREATE TYPE "category_type" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "payment_method_source" AS ENUM ('SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "payment_method_kind" AS ENUM ('STANDARD', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "transaction_status" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "transaction_origin" AS ENUM ('MANUAL', 'CREDIT_CARD', 'INSTALLMENT', 'RECURRENCE');

-- CreateEnum
CREATE TYPE "financial_period_status" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('OPEN', 'CLOSED', 'PAID');

-- CreateEnum
CREATE TYPE "recurrence_status" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "refund_strategy" AS ENUM ('FIRST_INSTALLMENTS', 'LAST_INSTALLMENTS', 'PROPORTIONAL');

-- CreateTable
CREATE TABLE "financial_periods" (
    "id" UUID NOT NULL,
    "reference_month" CHAR(7) NOT NULL,
    "status" "financial_period_status" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "category_type" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "source" "payment_method_source" NOT NULL,
    "kind" "payment_method_kind" NOT NULL DEFAULT 'STANDARD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" UUID NOT NULL,
    "payment_method_id" UUID NOT NULL,
    "best_purchase_day" SMALLINT NOT NULL,
    "due_day" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "credit_card_id" UUID NOT NULL,
    "reference_month" CHAR(7) NOT NULL,
    "closing_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "invoice_status" NOT NULL DEFAULT 'OPEN',
    "paid_at" DATE,
    "payment_method_id" UUID,
    "credit_balance" INTEGER NOT NULL DEFAULT 0,
    "credit_transferred_to_invoice_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "amount" INTEGER NOT NULL,
    "financial_month" CHAR(7) NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" DATE,
    "status" "transaction_status" NOT NULL DEFAULT 'PENDING',
    "category_id" UUID NOT NULL,
    "payment_method_id" UUID NOT NULL,
    "origin" "transaction_origin" NOT NULL,
    "purchase_date" DATE,
    "invoice_id" UUID,
    "recurrence_id" UUID,
    "occurrence_month" CHAR(7),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" UUID NOT NULL,
    "credit_card_id" UUID NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "installment_count" SMALLINT NOT NULL,
    "purchase_date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" UUID NOT NULL,
    "installment_plan_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "number" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurrences" (
    "id" UUID NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "amount" INTEGER NOT NULL,
    "category_id" UUID NOT NULL,
    "payment_method_id" UUID NOT NULL,
    "due_day" SMALLINT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "recurrence_status" NOT NULL DEFAULT 'ACTIVE',
    "paused_from" DATE,
    "paused_until" DATE,
    "cancelled_at" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurrence_exceptions" (
    "id" UUID NOT NULL,
    "recurrence_id" UUID NOT NULL,
    "occurrence_month" CHAR(7) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurrence_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "transaction_id" UUID,
    "installment_plan_id" UUID,
    "amount" INTEGER NOT NULL,
    "refund_date" DATE NOT NULL,
    "strategy" "refund_strategy",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_allocations" (
    "id" UUID NOT NULL,
    "refund_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "invoice_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_reference_month_key" ON "financial_periods"("reference_month");

-- CreateIndex
CREATE UNIQUE INDEX "credit_cards_payment_method_id_key" ON "credit_cards"("payment_method_id");

-- CreateIndex
CREATE INDEX "invoices_credit_transferred_to_invoice_id_idx" ON "invoices"("credit_transferred_to_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_credit_card_id_reference_month_key" ON "invoices"("credit_card_id", "reference_month");

-- CreateIndex
CREATE INDEX "transactions_financial_month_idx" ON "transactions"("financial_month");

-- CreateIndex
CREATE INDEX "transactions_invoice_id_idx" ON "transactions"("invoice_id");

-- CreateIndex
CREATE INDEX "transactions_category_id_idx" ON "transactions"("category_id");

-- CreateIndex
CREATE INDEX "transactions_payment_method_id_idx" ON "transactions"("payment_method_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_recurrence_id_occurrence_month_key" ON "transactions"("recurrence_id", "occurrence_month");

-- CreateIndex
CREATE INDEX "installment_plans_credit_card_id_idx" ON "installment_plans"("credit_card_id");

-- CreateIndex
CREATE UNIQUE INDEX "installments_transaction_id_key" ON "installments"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "installments_installment_plan_id_number_key" ON "installments"("installment_plan_id", "number");

-- CreateIndex
CREATE INDEX "recurrences_category_id_idx" ON "recurrences"("category_id");

-- CreateIndex
CREATE INDEX "recurrences_payment_method_id_idx" ON "recurrences"("payment_method_id");

-- CreateIndex
CREATE UNIQUE INDEX "recurrence_exceptions_recurrence_id_occurrence_month_key" ON "recurrence_exceptions"("recurrence_id", "occurrence_month");

-- CreateIndex
CREATE INDEX "refunds_transaction_id_idx" ON "refunds"("transaction_id");

-- CreateIndex
CREATE INDEX "refunds_installment_plan_id_idx" ON "refunds"("installment_plan_id");

-- CreateIndex
CREATE INDEX "refund_allocations_refund_id_idx" ON "refund_allocations"("refund_id");

-- CreateIndex
CREATE INDEX "refund_allocations_transaction_id_idx" ON "refund_allocations"("transaction_id");

-- CreateIndex
CREATE INDEX "refund_allocations_invoice_id_idx" ON "refund_allocations"("invoice_id");

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credit_transferred_to_invoice_id_fkey" FOREIGN KEY ("credit_transferred_to_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_credit_card_id_fkey" FOREIGN KEY ("credit_card_id") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_installment_plan_id_fkey" FOREIGN KEY ("installment_plan_id") REFERENCES "installment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_exceptions" ADD CONSTRAINT "recurrence_exceptions_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "recurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_installment_plan_id_fkey" FOREIGN KEY ("installment_plan_id") REFERENCES "installment_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_allocations" ADD CONSTRAINT "refund_allocations_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_allocations" ADD CONSTRAINT "refund_allocations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_allocations" ADD CONSTRAINT "refund_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===========================================================================
-- Constraints não expressáveis em Prisma (architecture.md §7.1, domain-model.md §3)
-- ===========================================================================

-- Unicidade de nomes sem diferenciar maiúsculas/minúsculas
CREATE UNIQUE INDEX "categories_name_lower_key" ON "categories" (lower("name"));
CREATE UNIQUE INDEX "payment_methods_name_lower_key" ON "payment_methods" (lower("name"));

-- Meses no formato YYYY-MM
ALTER TABLE "financial_periods" ADD CONSTRAINT "financial_periods_reference_month_format"
  CHECK ("reference_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reference_month_format"
  CHECK ("reference_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_financial_month_format"
  CHECK ("financial_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_occurrence_month_format"
  CHECK ("occurrence_month" IS NULL OR "occurrence_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "recurrence_exceptions" ADD CONSTRAINT "recurrence_exceptions_occurrence_month_format"
  CHECK ("occurrence_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- credit_cards: dias entre 1 e 31
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_best_purchase_day_range"
  CHECK ("best_purchase_day" BETWEEN 1 AND 31);
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_due_day_range"
  CHECK ("due_day" BETWEEN 1 AND 31);

-- invoices: vencimento estritamente posterior ao fechamento; dados de pagamento somente com PAID
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_due_date_after_closing_date"
  CHECK ("due_date" > "closing_date");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_data_iff_paid"
  CHECK (("status" = 'PAID') = ("paid_at" IS NOT NULL AND "payment_method_id" IS NOT NULL)
         AND ("status" = 'PAID' OR ("paid_at" IS NULL AND "payment_method_id" IS NULL)));
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_credit_balance_non_negative"
  CHECK ("credit_balance" >= 0);

-- installment_plans / installments
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_installment_count_min"
  CHECK ("installment_count" >= 2);
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_total_amount_positive"
  CHECK ("total_amount" > 0);
ALTER TABLE "installments" ADD CONSTRAINT "installments_number_positive"
  CHECK ("number" >= 1);

-- transactions: valor positivo; paid_at nulo se e somente se PENDING; recorrência somente na origem RECURRENCE
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_amount_positive"
  CHECK ("amount" > 0);
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_paid_at_iff_paid"
  CHECK (("status" = 'PENDING') = ("paid_at" IS NULL));
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurrence_iff_origin_recurrence"
  CHECK (("origin" = 'RECURRENCE') = ("recurrence_id" IS NOT NULL AND "occurrence_month" IS NOT NULL)
         AND ("origin" = 'RECURRENCE' OR ("recurrence_id" IS NULL AND "occurrence_month" IS NULL)));

-- recurrences: valor positivo; dia 1..31; cancelled_at somente quando CANCELLED
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_amount_positive"
  CHECK ("amount" > 0);
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_due_day_range"
  CHECK ("due_day" BETWEEN 1 AND 31);
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_cancelled_at_iff_cancelled"
  CHECK (("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL));

-- refunds: exatamente um alvo; strategy se e somente se houver plano; valor positivo
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_exactly_one_target"
  CHECK (("transaction_id" IS NULL) <> ("installment_plan_id" IS NULL));
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_strategy_iff_plan"
  CHECK (("strategy" IS NOT NULL) = ("installment_plan_id" IS NOT NULL));
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive"
  CHECK ("amount" > 0);

-- refund_allocations: valor positivo
ALTER TABLE "refund_allocations" ADD CONSTRAINT "refund_allocations_amount_positive"
  CHECK ("amount" > 0);
