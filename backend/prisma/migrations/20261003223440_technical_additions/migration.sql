-- AlterTable
ALTER TABLE "recurrences" ADD COLUMN     "created_on" DATE NOT NULL DEFAULT CURRENT_DATE;

-- CreateTable
CREATE TABLE "job_states" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "job_states_pkey" PRIMARY KEY ("key")
);
