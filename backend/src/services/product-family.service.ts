import type { z } from 'zod';
import { ProductFamilyRepository } from '../repositories/product-family.repository';
import { DuplicateError, NotFoundError } from '../utils/errors';
import type { createProductFamilySchema, updateProductFamilySchema } from '../validators/product-family.validator';

/** Product families: how the POS groups variants (Latte → Vainilla, Moka…). */
export const ProductFamilyService = {
  async findAll() {
    return ProductFamilyRepository.findAll();
  },

  async create(input: z.infer<typeof createProductFamilySchema>) {
    await ensureNameAvailable(input.name);
    return ProductFamilyRepository.create({
      name: input.name,
      categoryId: input.categoryId ?? null,
      displayOrder: input.displayOrder ?? 0,
    });
  },

  async update(id: string, input: z.infer<typeof updateProductFamilySchema>) {
    if (!(await ProductFamilyRepository.findById(id))) throw new NotFoundError('Familia no encontrada.');
    if (input.name !== undefined) await ensureNameAvailable(input.name, id);
    return ProductFamilyRepository.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.displayOrder !== undefined && { displayOrder: input.displayOrder }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  },
};

async function ensureNameAvailable(name: string, exceptId?: string) {
  const existing = await ProductFamilyRepository.findByNameInsensitive(name, exceptId);
  if (existing) throw new DuplicateError('PRODUCT_FAMILY', `Ya existe la familia "${existing.name}".`, existing.id);
}
