/**
 * Plan of the dev → prod inventory sync (pure: no database access, unit tested).
 *
 * Decided by the business (2026-11-17): production gets DEV's ingredient list with its minimum
 * stock; every stock in production ends at 0 (stock comes later from a physical count); costs
 * are not copied. Ingredients are matched by normalized name (the two databases were catalogued
 * separately: dev INS-###, prod PROD-###) and production takes DEV's SKU, so the recipe sync
 * (which travels by SKU) finds them.
 */
export interface SourceIngredient {
  sku: string;
  name: string;
  unit: string;
  minimumStock: number;
  maximumStock: number | null;
  isActive: boolean;
}

export interface TargetIngredient {
  id: string;
  sku: string | null;
  name: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number | null;
  isActive: boolean;
  /** Movements, purchase lines and count lines: a unit change would change their meaning. */
  historyCount: number;
  /** Soft-deleted (deletedAt): still holds its name in the unique index while active. */
  deleted?: boolean;
}

export interface IngredientUpdate {
  id: string;
  sourceSku: string;
  changes: { sku?: string; name?: string; unit?: string; minimumStock?: number; maximumStock?: number | null; isActive?: boolean; restore?: true };
  /** Unit change on an ingredient with history, allowed explicitly with --allow-unit-change. */
  unitChangeWithHistory: boolean;
}

export interface InventorySyncPlan {
  updates: IngredientUpdate[];
  creates: SourceIngredient[];
  /** Stock set to 0 with an adjustment of -currentStock. */
  zeroes: { id: string; name: string; unit: string; currentStock: number }[];
  /** Production ingredients without a DEV counterpart: left as they are (stock still goes to 0). */
  untouched: { sku: string | null; name: string }[];
  problems: string[];
}

export const normalizeName = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

export function planInventorySync(
  source: SourceIngredient[],
  target: TargetIngredient[],
  options: { allowUnitChange?: Set<string> } = {},
): InventorySyncPlan {
  const plan: InventorySyncPlan = { updates: [], creates: [], zeroes: [], untouched: [], problems: [] };
  const byName = new Map<string, TargetIngredient[]>();
  for (const t of target) byName.set(normalizeName(t.name), [...(byName.get(normalizeName(t.name)) ?? []), t]);

  // 1. Match by name only: the two databases were catalogued separately, so the same SKU may
  //    name different ingredients (normalize-catalog numbers INS-### per database). Among
  //    namesakes, the one in the same unit first (its history keeps its meaning), then the
  //    active one. An ingredient renamed in development shows up as "create" in the preview.
  const matchOf = new Map<string, TargetIngredient>();
  const claimed = new Set<string>();
  for (const item of source) {
    let candidates = (byName.get(normalizeName(item.name)) ?? []).filter((t) => !claimed.has(t.id));
    // A soft-deleted namesake is only used when nothing else matches: it is restored instead of
    // creating a duplicate (its name is still taken in the unique index).
    if (candidates.some((t) => !t.deleted)) candidates = candidates.filter((t) => !t.deleted);
    if (candidates.length > 1) candidates = candidates.filter((t) => t.unit === item.unit).length ? candidates.filter((t) => t.unit === item.unit) : candidates;
    if (candidates.length > 1) candidates = candidates.filter((t) => t.isActive).length ? candidates.filter((t) => t.isActive) : candidates;
    if (candidates.length > 1) {
      plan.problems.push(`"${item.name}" coincide con ${candidates.length} insumos activos de producción en la misma unidad; resuélvelo a mano.`);
      continue;
    }
    if (candidates[0]) {
      matchOf.set(item.sku, candidates[0]);
      claimed.add(candidates[0].id);
    }
  }
  const sourceSkus = new Set(source.map((s) => s.sku));

  // 2. Production ingredients without a counterpart: kept, but they give up a SKU development
  //    needs, and an active namesake of a synced ingredient is deactivated (applied first) so the
  //    synced one can take the name (active names are unique). Their history stays as it is.
  const syncedNames = new Set([...matchOf.keys()].map((sku) => normalizeName(source.find((s) => s.sku === sku)!.name)));
  for (const t of target) {
    if (claimed.has(t.id) || t.deleted) continue;
    plan.untouched.push({ sku: t.sku, name: t.name });
    const changes: IngredientUpdate['changes'] = {};
    if (t.sku && sourceSkus.has(t.sku)) changes.sku = `${t.sku}-PROD`;
    if (t.isActive && syncedNames.has(normalizeName(t.name))) changes.isActive = false;
    if (Object.keys(changes).length > 0) plan.updates.push({ id: t.id, sourceSku: t.sku ?? '', changes, unitChangeWithHistory: false });
  }

  // 3. Align matched ingredients; create the rest.
  for (const item of source) {
    const match = matchOf.get(item.sku);
    if (!match) {
      if (!plan.problems.some((problem) => problem.startsWith(`"${item.name}" coincide`))) plan.creates.push(item);
      continue;
    }
    const changes: IngredientUpdate['changes'] = {};
    if (match.deleted) changes.restore = true;
    if (match.sku !== item.sku) changes.sku = item.sku;
    if (match.name !== item.name) {
      // Active names are unique (ingredients_name_normalized_unique): another active production
      // ingredient already named like this would make the rename fail mid-transaction.
      // Unmatched namesakes are deactivated in step 2; a matched one is another synced ingredient.
      const namesake = (byName.get(normalizeName(item.name)) ?? []).find((t) => t.id !== match.id && t.isActive && claimed.has(t.id));
      if (namesake && match.isActive) {
        plan.problems.push(`"${match.name}" (${match.sku ?? 'sin SKU'}) tomaría el nombre "${item.name}", que ya usa otro insumo activo de producción (${namesake.sku ?? 'sin SKU'}).`);
        continue;
      }
      changes.name = item.name;
    }
    if (match.minimumStock !== item.minimumStock) changes.minimumStock = item.minimumStock;
    if ((match.maximumStock ?? null) !== (item.maximumStock ?? null)) changes.maximumStock = item.maximumStock;
    if (match.isActive !== item.isActive) changes.isActive = item.isActive;
    let unitChangeWithHistory = false;
    if (match.unit !== item.unit) {
      if (match.historyCount > 0 && !options.allowUnitChange?.has(item.sku)) {
        plan.problems.push(
          `"${item.name}" está en ${match.unit} en producción con ${match.historyCount} registro(s) de historial y en ${item.unit} en development. ` +
          `Cambiar la unidad cambia el significado de ese historial: autorízalo con --allow-unit-change=${item.sku}.`,
        );
        continue;
      }
      changes.unit = item.unit;
      unitChangeWithHistory = match.historyCount > 0;
    }
    if (Object.keys(changes).length > 0) plan.updates.push({ id: match.id, sourceSku: item.sku, changes, unitChangeWithHistory });
  }

  for (const t of target) {
    if (t.currentStock !== 0 && (!t.deleted || claimed.has(t.id))) plan.zeroes.push({ id: t.id, name: t.name, unit: t.unit, currentStock: t.currentStock });
  }
  return plan;
}
