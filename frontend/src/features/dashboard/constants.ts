export const cashDifferenceReasons = [
  'Error al entregar cambio',
  'Efectivo retirado durante el turno',
  'Venta registrada incorrectamente',
  'Otro motivo',
] as const;

export type CashDifferenceReason = typeof cashDifferenceReasons[number];
