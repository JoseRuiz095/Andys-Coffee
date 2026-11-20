import { z } from 'zod';
import { catalogIdSchema } from './common.validator';

const MAX_QUANTITY = 1_000_000;
const MAX_LINES = 50;

const line = (quantity: z.ZodNumber | z.ZodType<number>) => z.strictObject({
  ingredientId: catalogIdSchema,
  quantity,
  // Unit the quantity was captured in (e.g. kg); converted to the ingredient's base unit.
  // Omitted = already in the ingredient's unit.
  unitId: catalogIdSchema.optional(),
});

// An ingredient may appear once per temperature (e.g. milk 300 ml HOT and 250 ml COLD).
const noRepeatedIngredients = (lines: { ingredientId: string; temperature?: string }[]) =>
  new Set(lines.map(({ ingredientId, temperature }) => `${ingredientId}:${temperature ?? 'BOTH'}`)).size === lines.length;

export const recipeTemperatureSchema = z.enum(['HOT', 'COLD', 'BOTH']);

/**
 * One recipe line of a product: how much of an ingredient one unit sold consumes. `temperature`
 * (products sold hot and cold): HOT/COLD lines apply only to that temperature, BOTH (default) to
 * either one.
 */
export const productRecipeLineSchema = line(
  z.number().finite().positive('La cantidad debe ser mayor a cero.').max(MAX_QUANTITY),
).extend({ temperature: recipeTemperatureSchema.optional() });

/** Extras may subtract an ingredient (substitutions, "sin azúcar"), but not by zero. */
export const extraRecipeLineSchema = line(
  z.number().finite().min(-MAX_QUANTITY).max(MAX_QUANTITY).refine((value) => value !== 0, 'La cantidad no puede ser cero.'),
);

const lines = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(schema).max(MAX_LINES, `Una receta admite hasta ${MAX_LINES} ingredientes.`)
    .refine((items) => noRepeatedIngredients(items as { ingredientId: string; temperature?: string }[]), 'Hay ingredientes repetidos en la receta.');

/**
 * Whole recipe of a product, by size. Sending it replaces the stored recipe (a size left out
 * is removed); not sending it leaves the recipe untouched.
 */
export const productRecipeSchema = z.strictObject({
  REGULAR: lines(productRecipeLineSchema),
  JUMBO: lines(productRecipeLineSchema).optional(),
});

export const extraRecipeSchema = lines(extraRecipeLineSchema);

export type ProductRecipeInput = z.infer<typeof productRecipeSchema>;
export type RecipeLineInput = z.infer<typeof productRecipeLineSchema>;
