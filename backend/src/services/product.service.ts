import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { createProductSchema, filterQuerySchema, updateProductSchema } from '../validators/product.validator';
import { z } from 'zod';
import { auditLog } from '../utils/logger';
import { ProductRepository } from '../repositories/product.repository';
import { ProductFamilyRepository } from '../repositories/product-family.repository';
import { ExtraRepository } from '../repositories/extra.repository';
import { runInTransaction, type Tx } from '../repositories/transaction';
import { AuthUser } from './auth.service';
import { AuthorizationError, DuplicateError, NotFoundError, ValidationError } from '../utils/errors';
import { paginationMeta, paginationOffset } from '../utils/pagination';
import { resolveImageUrl } from '../utils/imageKeys';
import { isJumboAvailable } from '../utils/productTemperature';
import { ProductImageService } from './product-image.service';
import {
  RecipeService,
  assertProductRecipeRules,
  ensureCanManageRecipes,
  resolveProductRecipe,
  type ResolvedProductRecipe,
} from './recipe.service';

type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Helper to enforce permission checks consistently
const ensureUserHasPermission = (user: AuthUser, permission: string) => {
  if (!user.permissions?.includes(permission)) {
    throw new AuthorizationError(`Permiso requerido: '${permission}'.`);
  }
};

/** Active products can't share a name (products_name_normalized_unique). */
async function ensureNameAvailable(name: string, exceptId?: string) {
  const existing = await ProductRepository.findActiveByName(name);
  if (existing && existing.id !== exceptId) {
    throw new DuplicateError('PRODUCT', `Ya existe un producto activo llamado "${existing.name}".`, existing.id);
  }
}

/** Category, family and extras referenced by the payload must exist. Returns the category kind. */
async function resolveReferences(
  tx: Tx,
  input: Pick<UpdateProductInput, 'categoryId' | 'familyId' | 'extraIds'>,
) {
  let isBeverage: boolean | undefined;
  if (input.categoryId) {
    const category = await ProductRepository.findCategoryKind(input.categoryId, tx);
    if (!category) throw new ValidationError('La categoría no existe.');
    isBeverage = category.isBeverage;
  } else if (input.categoryId === null) {
    isBeverage = false;
  }
  if (input.familyId && !(await ProductFamilyRepository.findById(input.familyId, tx))) {
    throw new ValidationError('La familia no existe.');
  }
  if (input.extraIds && (await ExtraRepository.countByIds(input.extraIds, tx)) !== input.extraIds.length) {
    throw new ValidationError('Uno o más extras no existen.');
  }
  return { isBeverage };
}

/** Recipe lines that apply to one temperature only (HOT or COLD). */
function countTemperatureLines(recipe: ResolvedProductRecipe) {
  return [...recipe.REGULAR, ...recipe.JUMBO].filter(({ temperature }) => temperature && temperature !== 'BOTH').length;
}

/** Writes the lists that replace stored ones (options, extras, recipe) when sent. */
async function writeProductLists(
  tx: Tx,
  productId: string,
  input: Pick<UpdateProductInput, 'options' | 'extraIds'>,
  recipe: ResolvedProductRecipe | null,
  user: AuthUser,
) {
  if (input.options) await ProductRepository.replaceOptions(tx, productId, input.options);
  if (input.extraIds) await ExtraRepository.replaceProductExtras(tx, productId, input.extraIds);
  if (recipe) await RecipeService.replaceProductRecipe(tx, productId, recipe, user);
}

/** Scalar product columns of the payload (lists and the recipe are written separately). */
function productColumns<T extends UpdateProductInput>(input: T): Omit<T, 'recipe' | 'extraIds' | 'options'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { recipe, extraIds, options, ...columns } = input;
  return columns;
}

export const ProductService = {
  async findAll(query: z.infer<typeof filterQuerySchema>) {
    const { page, limit } = query;
    const skip = paginationOffset(page, limit);

    const where: Prisma.ProductWhereInput = {
      ...(query.category && { categoryId: query.category }),
      ...(query.isActive && { isActive: query.isActive === 'true' }),
      ...(query.search && {
        name: {
          contains: query.search,
          mode: 'insensitive',
        },
      }),
    };

    const { products, total } = await ProductRepository.findWithPagination(where, skip, limit);

    return {
      data: products.map((product) => ({
        ...product,
        imageUrl: resolveImageUrl(product.imageUrl),
        // Amounts as numbers, as the frontend types them (Decimal serializes as a string).
        price: product.price.toNumber(),
        cost: product.cost.toNumber(),
        jumboPrice: product.jumboPrice?.toNumber() ?? null,
      })),
      pagination: paginationMeta(page, limit, total),
    };
  },

  async findOne(id: string) {
    const product = await ProductRepository.findById(id);
    if (!product) return null;
    const recipe = await RecipeService.getProductRecipe(id);

    return {
      ...product,
      imageUrl: resolveImageUrl(product.imageUrl),
      price: product.price.toNumber(),
      cost: product.cost.toNumber(),
      jumboPrice: product.jumboPrice?.toNumber() ?? null,
      // Ingredients and quantities per size, with the cost at current average cost.
      recipe,
      // R-04: cost suggested from the (regular) recipe at current average ingredient cost. The
      // product's own `cost` stays manual (it is what sales snapshot); the UI offers this as a hint.
      suggestedCost: recipe.REGULAR.lines.length > 0 ? recipe.REGULAR.cost : null,
    };
  },

  /**
   * Creates the product with its recipe, extras and options in one transaction: either all of
   * it is saved or nothing (decision D-5: the recipe is required unless the product doesn't
   * track inventory).
   */
  async create(productData: CreateProductInput, user: AuthUser, requestId?: string) {
    ensureUserHasPermission(user, 'products.create');
    if (productData.recipe) ensureCanManageRecipes(user);
    await ensureNameAvailable(productData.name);

    const columns = productColumns(productData);
    const newProductId = await runInTransaction(async (tx) => {
      const { isBeverage = false } = await resolveReferences(tx, productData);
      const recipe = productData.recipe ? await resolveProductRecipe(productData.recipe, tx) : null;
      assertProductRecipeRules({
        tracksInventory: productData.tracksInventory ?? true,
        isActive: true,
        jumboAvailable: isJumboAvailable({ jumboPrice: productData.jumboPrice ?? null }, isBeverage),
        regularLines: recipe?.REGULAR.length ?? 0,
        jumboLines: recipe?.JUMBO.length ?? 0,
        soldBothWays: productData.temperature === 'BOTH',
        temperatureLines: recipe ? countTemperatureLines(recipe) : 0,
      });

      const created = await ProductRepository.create({
        ...columns,
        categoryId: columns.categoryId ?? undefined,
        sku: columns.sku ?? `SKU-${randomUUID()}`,
      }, tx);
      await writeProductLists(tx, created.id, productData, recipe, user);
      return created.id;
    });

    auditLog({
      requestId,
      actor: { id: user.id, name: user.name },
      action: 'PRODUCT_CREATED',
      entity: 'product',
      entityId: newProductId,
    }, 'Product created');
    return (await ProductService.findOne(newProductId))!;
  },

  /**
   * Updates the product and, when sent, replaces its recipe, extras and options, all in one
   * transaction. The recipe rules are checked when the recipe is sent or when the change could
   * leave the product without a required recipe (tracking inventory, reactivating, Jumbo).
   * Editing other fields of a product that has no recipe yet is still allowed.
   */
  async update(id: string, productData: UpdateProductInput, user: AuthUser, requestId?: string) {
    ensureUserHasPermission(user, 'products.update');
    if (productData.recipe) ensureCanManageRecipes(user);

    const originalProduct = await ProductRepository.findAuditFieldsById(id);

    if (!originalProduct) {
      throw new NotFoundError('Producto no encontrado.');
    }
    if (productData.name !== undefined) await ensureNameAvailable(productData.name, id);

    const columns = productColumns(productData);
    await runInTransaction(async (tx) => {
      const current = await ProductRepository.findForRecipeRules(id, tx);
      if (!current) throw new NotFoundError('Producto no encontrado.');
      const { isBeverage = current.category?.isBeverage ?? false } = await resolveReferences(tx, productData);
      const recipe = productData.recipe ? await resolveProductRecipe(productData.recipe, tx) : null;

      const tracksInventory = productData.tracksInventory ?? current.tracksInventory;
      const isActive = productData.isActive ?? current.isActive;
      const jumboPrice = productData.jumboPrice !== undefined ? productData.jumboPrice : current.jumboPrice;
      const jumboAvailable = isJumboAvailable({ jumboPrice }, isBeverage);
      const wasJumboAvailable = isJumboAvailable(current, current.category?.isBeverage ?? false);
      const mustCheck = recipe !== null
        || (productData.temperature !== undefined && productData.temperature !== current.temperature)
        || (tracksInventory && !current.tracksInventory)
        || (isActive && !current.isActive)
        || jumboAvailable !== wasJumboAvailable;
      if (mustCheck) {
        const storedSizes = current.recipes.map(({ size }) => size);
        assertProductRecipeRules({
          tracksInventory,
          isActive,
          jumboAvailable,
          regularLines: recipe ? recipe.REGULAR.length : storedSizes.filter((size) => size === 'REGULAR').length,
          jumboLines: recipe ? recipe.JUMBO.length : storedSizes.filter((size) => size === 'JUMBO').length,
          soldBothWays: (productData.temperature !== undefined ? productData.temperature : current.temperature) === 'BOTH',
          temperatureLines: recipe
            ? countTemperatureLines(recipe)
            : current.recipes.filter(({ temperature }) => temperature !== 'BOTH').length,
        });
      }

      await ProductRepository.update(id, {
        ...columns,
        categoryId: columns.categoryId === null ? null : columns.categoryId ?? undefined,
        sku: columns.sku ?? undefined,
      }, tx);
      await writeProductLists(tx, id, productData, recipe, user);
    });

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    // The image changes through ProductImageService, which audits it on its own.
    const fieldsToAudit = ['price', 'jumboPrice', 'cost', 'isActive', 'temperature'];

    for (const field of fieldsToAudit) {
      const oldValue = originalProduct[field as keyof typeof originalProduct];
      const newValue = productData[field as keyof typeof productData];

      if (newValue !== undefined && String(oldValue) !== String(newValue)) {
        changes[field] = { from: oldValue, to: newValue };
      }
    }
    if (productData.recipe) changes.recipe = { from: 'replaced', to: 'replaced' };

    if (Object.keys(changes).length > 0) {
      auditLog({
        requestId,
        actor: { id: user.id, name: user.name },
        action: 'PRODUCT_UPDATED',
        entity: 'product',
        entityId: id,
        metadata: changes,
      }, 'Product updated');
    }

    return (await ProductService.findOne(id))!;
  },

  async remove(id: string, user: AuthUser, requestId?: string) {
    ensureUserHasPermission(user, 'products.delete');

    const productToDelete = await ProductRepository.findImageById(id);

    if (!productToDelete) {
      throw new NotFoundError('Producto no encontrado.');
    }

    auditLog({
      requestId,
      actor: { id: user.id, name: user.name },
      action: 'PRODUCT_DELETED',
      entity: 'product',
      entityId: id,
    }, 'Product deleted');

    await ProductRepository.delete(id);
    // After the row is gone: its file is deleted only if nothing else references it.
    await ProductImageService.release(productToDelete.imageUrl);
  },
};