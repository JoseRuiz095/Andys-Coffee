import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { ExtraRepository } from '../repositories/extra.repository';
import { ProductRepository } from '../repositories/product.repository';
import { runInTransaction } from '../repositories/transaction';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import type { createExtraSchema, updateExtraSchema } from '../validators/extra.validator';

/** Extras: things sold on top of a product (priced per unit of that product). */
export const ExtraService = {
  async findAll() {
    return ExtraRepository.findAll();
  },

  async create(input: z.infer<typeof createExtraSchema>) {
    if (await ExtraRepository.findByNameInsensitive(input.name)) {
      throw new ConflictError(`Ya existe un extra llamado "${input.name}".`);
    }
    return ExtraRepository.create({
      name: input.name,
      description: input.description ?? null,
      price: new Prisma.Decimal(input.price),
      cost: new Prisma.Decimal(input.cost),
    });
  },

  async update(id: string, input: z.infer<typeof updateExtraSchema>) {
    if (!(await ExtraRepository.findById(id))) throw new NotFoundError('Extra no encontrado.');
    if (input.name && (await ExtraRepository.findByNameInsensitive(input.name, id))) {
      throw new ConflictError(`Ya existe un extra llamado "${input.name}".`);
    }
    return ExtraRepository.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.price !== undefined && { price: new Prisma.Decimal(input.price) }),
      ...(input.cost !== undefined && { cost: new Prisma.Decimal(input.cost) }),
    });
  },

  async setActive(id: string, isActive: boolean) {
    if (!(await ExtraRepository.findById(id))) throw new NotFoundError('Extra no encontrado.');
    return ExtraRepository.update(id, { isActive });
  },

  async delete(id: string) {
    if (!(await ExtraRepository.findById(id))) throw new NotFoundError('Extra no encontrado.');
    // Past sales keep a reference to the extra: once sold, it can only be deactivated.
    if ((await ExtraRepository.countSales(id)) > 0) {
      throw new ConflictError('Este extra ya se vendió; desactívalo en lugar de eliminarlo.');
    }
    await ExtraRepository.delete(id);
  },

  /** Sets which extras the POS offers with a product. */
  async setProductExtras(productId: string, extraIds: string[]) {
    if (!(await ProductRepository.findImageById(productId))) throw new NotFoundError('Producto no encontrado.');
    if ((await ExtraRepository.countByIds(extraIds)) !== extraIds.length) {
      throw new ValidationError('Uno o más extras no existen.');
    }
    await runInTransaction((tx) => ExtraRepository.replaceProductExtras(tx, productId, extraIds));
    return ProductRepository.findById(productId);
  },
};
