import assert from "node:assert/strict";
import { test } from "node:test";
import {
  shouldActivateScheduledOrder,
  shouldNotifyScheduledOrder,
} from "../src/services/order.service";

test("activa un pedido programado cuando llega su hora", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  const scheduledFor = new Date("2026-10-10T11:59:00.000Z");

  assert.equal(shouldActivateScheduledOrder(now, scheduledFor), true);
});

test("envía una sola alerta de preparación dentro de los 20 minutos y solo si no se avisó antes", () => {
  const now = new Date("2026-10-10T12:00:00.000Z");
  const scheduledFor = new Date("2026-10-10T12:15:00.000Z");

  assert.equal(shouldNotifyScheduledOrder(now, scheduledFor, null), true);
  assert.equal(shouldNotifyScheduledOrder(now, scheduledFor, new Date("2026-10-10T12:05:00.000Z")), false);
  assert.equal(shouldNotifyScheduledOrder(now, new Date("2026-10-10T12:45:00.000Z"), null), false);
});
