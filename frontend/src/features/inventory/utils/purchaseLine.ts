import { convertQuantity, convertUnitCost } from './unitConversion'

/** A purchase line as captured on screen and as sent to the API (base unit). */
export interface PurchaseLine {
  ingredientId: string
  /** Quantity in the ingredient's base unit. */
  quantity: number
  /** Cost per base unit. */
  unitCost: number
  ingredientName?: string
  unitAbbreviation?: string
  /** What the user typed: quantity in the capture unit and the TOTAL cost of the line. */
  capturedQuantity?: number
  capturedTotalCost?: number
  captureUnit?: string
}

export interface PurchaseLineInput {
  ingredientId: string
  ingredientName?: string
  baseUnit: string
  /** Unit the quantity was typed in (defaults to the base unit). */
  captureUnit?: string
  quantity: number
  /** Total cost paid for the whole line (the form asks for "Costo Total"). */
  totalCost: number
}

/** Builds the line in base units; throws when the capture unit can't be converted. */
export function buildPurchaseLine(input: PurchaseLineInput): PurchaseLine {
  const captureUnit = input.captureUnit || input.baseUnit
  let quantity = input.quantity
  let unitCost = input.quantity > 0 ? input.totalCost / input.quantity : 0

  if (captureUnit !== input.baseUnit) {
    quantity = convertQuantity(input.quantity, captureUnit, input.baseUnit)
    unitCost = convertUnitCost(unitCost, captureUnit, input.baseUnit)
  }

  return {
    ingredientId: input.ingredientId,
    quantity,
    unitCost,
    ingredientName: input.ingredientName,
    unitAbbreviation: input.baseUnit,
    capturedQuantity: input.quantity,
    capturedTotalCost: input.totalCost,
    captureUnit,
  }
}

/** Values to put back in the form when a line is edited (lines restored from a draft carry only base units). */
export function getEditableValues(line: PurchaseLine): { quantity: number; totalCost: number; captureUnit: string } {
  return {
    quantity: line.capturedQuantity ?? line.quantity,
    totalCost: line.capturedTotalCost ?? line.quantity * line.unitCost,
    captureUnit: line.captureUnit ?? line.unitAbbreviation ?? '',
  }
}

/** Only what the API accepts for a line. */
export function toPurchaseItemPayload(line: PurchaseLine) {
  return { ingredientId: line.ingredientId, quantity: line.quantity, unitCost: line.unitCost }
}
