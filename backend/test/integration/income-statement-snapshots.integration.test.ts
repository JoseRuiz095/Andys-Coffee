import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../src/config/prisma";
import { incomeStatementService } from "../../src/services/income-statement.service";
import { incomeStatementRepository } from "../../src/repositories/income-statement.repository";

// IS-0/IS-1/IS-2 (estabilización 2026-11-14): frozen daily snapshots of the income statement.
// Days far in the past without operation: they are "final" (date < today, no open session),
// so reading them writes their snapshot.

const integrationEnabled = process.env.RUN_INTEGRATION_TESTS === "true";
const DAYS = ["2024-03-11", "2024-03-12", "2024-03-13"];
const FILTERED_DAY = "2024-03-20";
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

async function setFrozenNetProfit(day: string, netProfit: number) {
  await prisma.incomeStatementDailySnapshot.update({ where: { date: asDate(day) }, data: { netProfit } });
}

async function cleanup() {
  await prisma.incomeStatementDailySnapshot.deleteMany({ where: { date: { in: [...DAYS, FILTERED_DAY].map(asDate) } } });
}

after(async () => {
  if (integrationEnabled) await cleanup();
});

test("IS-0: una foto final se reutiliza para SU día (no la del día siguiente)", { skip: !integrationEnabled }, async () => {
  await cleanup();
  await incomeStatementService.getRangeFinancials(DAYS[0], DAYS[2]);
  // Frozen values that differ from a live recomputation (0 for a day without operation).
  await setFrozenNetProfit(DAYS[0], 111);
  await setFrozenNetProfit(DAYS[1], 222);

  const day = await incomeStatementService.getDayFinancials(DAYS[0]);
  assert.equal(day.movimientos.gananciaNeta, 111, "el día debe leer su foto congelada");

  const range = await incomeStatementService.getRangeFinancials(DAYS[0], DAYS[2]);
  assert.deepEqual(
    range.days.map((d) => [d.date, d.movimientos.gananciaNeta]),
    [[DAYS[0], 111], [DAYS[1], 222], [DAYS[2], 0]],
  );
});

test("IS-1: consultar un día filtrado por caja no congela la foto global", { skip: !integrationEnabled }, async () => {
  await cleanup();
  await incomeStatementService.getDayFinancials(FILTERED_DAY, randomUUID());
  assert.equal(await prisma.incomeStatementDailySnapshot.count({ where: { date: asDate(FILTERED_DAY) } }), 0);

  // Without a filter the final snapshot is written as before.
  await incomeStatementService.getDayFinancials(FILTERED_DAY);
  assert.equal(await prisma.incomeStatementDailySnapshot.count({ where: { date: asDate(FILTERED_DAY) } }), 1);
});

test("IS-2: invalidar un día invalida también las fotos posteriores (sus acumulados dependen de él)", { skip: !integrationEnabled }, async () => {
  await cleanup();
  await incomeStatementService.getRangeFinancials(DAYS[0], DAYS[2]);
  assert.equal(await prisma.incomeStatementDailySnapshot.count({ where: { date: { in: DAYS.map(asDate) } } }), 3);

  await incomeStatementRepository.invalidateSnapshot(DAYS[1]);
  const remaining = await prisma.incomeStatementDailySnapshot.findMany({ where: { date: { in: DAYS.map(asDate) } }, select: { date: true } });
  assert.deepEqual(remaining.map((s) => s.date.toISOString().slice(0, 10)), [DAYS[0]]);
});
