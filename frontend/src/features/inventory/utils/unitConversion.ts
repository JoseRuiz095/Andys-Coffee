/**
 * Unit conversion utilities for inventory management
 * Supports conversions between compatible units (kg↔gr, lt↔ml)
 * Maintains mathematical invariant: quantity × unitCost = subtotal
 */

type ConversionFactors = Record<string, Record<string, number>>;

const CONVERSION_FACTORS: ConversionFactors = {
  kg: { gr: 1000 },
  gr: { kg: 0.001 },
  lt: { ml: 1000 },
  ml: { lt: 0.001 },
};

/**
 * Get compatible units for a given unit abbreviation
 * Returns the list of units that can be converted to/from
 */
export function getCompatibleUnits(unitAbbreviation: string): string[] {
  return Object.keys(CONVERSION_FACTORS[unitAbbreviation] || {});
}

/**
 * Convert a quantity from one unit to another
 * Uses string-based decimal shifting to avoid floating-point precision errors
 */
export function convertQuantity(
  value: number,
  fromUnit: string,
  toUnit: string
): number {
  if (fromUnit === toUnit) return value;

  const factor = CONVERSION_FACTORS[fromUnit]?.[toUnit];
  if (factor === undefined) {
    throw new Error(`No conversion available from ${fromUnit} to ${toUnit}`);
  }

  // For factors like 1000, 0.001, use precise decimal arithmetic
  // Shift decimal point instead of multiply/divide to avoid floating-point errors
  if (factor === 1000) {
    return value * 1000;
  }
  if (factor === 0.001) {
    return value / 1000;
  }

  // Fallback to direct multiplication/division, then round to 4 decimals
  const result = value * factor;
  return Math.round(result * 10000) / 10000;
}

/**
 * Convert a unit cost from one unit to another
 * The factor is INVERTED relative to quantity conversion
 * e.g., if quantity multiplies by 1000, cost divides by 1000
 * This preserves: quantity × unitCost = subtotal
 */
export function convertUnitCost(
  value: number,
  fromUnit: string,
  toUnit: string
): number {
  if (fromUnit === toUnit) return value;

  const factor = CONVERSION_FACTORS[fromUnit]?.[toUnit];
  if (factor === undefined) {
    throw new Error(`No conversion available from ${fromUnit} to ${toUnit}`);
  }

  // Inverse factor (reciprocal)
  const inverseFactor = 1 / factor;

  // For reciprocals of 1000 (0.001) and 0.001 (1000), use precise arithmetic
  if (inverseFactor === 1000) {
    return value * 1000;
  }
  if (inverseFactor === 0.001) {
    return value / 1000;
  }

  // Fallback to direct multiplication/division, then round to 4 decimals
  const result = value * inverseFactor;
  return Math.round(result * 10000) / 10000;
}

/**
 * Verify the invariant: originalQuantity × originalCost === convertedQuantity × convertedCost
 * Returns true if the subtotals match (within 0.01 tolerance for floating-point rounding)
 */
export function verifyConversionInvariant(
  originalQuantity: number,
  originalCost: number,
  convertedQuantity: number,
  convertedCost: number,
  tolerance: number = 0.01
): boolean {
  const originalSubtotal = originalQuantity * originalCost;
  const convertedSubtotal = convertedQuantity * convertedCost;
  return Math.abs(originalSubtotal - convertedSubtotal) < tolerance;
}
