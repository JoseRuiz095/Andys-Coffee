/*
  Warnings:

  - A unique constraint covering the columns `[cashRegisterId]` on the table `cash_sessions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "cash_sessions_cashRegisterId_key" ON "cash_sessions"("cashRegisterId");
