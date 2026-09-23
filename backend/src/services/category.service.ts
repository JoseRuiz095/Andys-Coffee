import type { Prisma } from '@prisma/client';
import { CategoryRepository } from '../repositories/category.repository';

export const CategoryService = {
  async getAll(page: number = 1, limit: number = 100, includeInactive: boolean = false) {
    const skip = (page - 1) * limit;
    return CategoryRepository.findAll(skip, limit, includeInactive);
  },

  async getById(id: string) {
    return CategoryRepository.findById(id);
  },

  async create(name: string, description?: string, imageUrl?: string, displayOrder?: number) {
    return CategoryRepository.create({
      name,
      description,
      imageUrl,
      displayOrder,
    });
  },

  async update(id: string, name?: string, description?: string, imageUrl?: string, displayOrder?: number, isActive?: boolean) {
    const data: Prisma.CategoryUpdateInput = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (displayOrder !== undefined) data.displayOrder = displayOrder;
    if (isActive !== undefined) data.isActive = isActive;
    return CategoryRepository.update(id, data);
  },

  async setActive(id: string, isActive: boolean) {
    return CategoryRepository.update(id, { isActive });
  },

  async delete(id: string) {
    return CategoryRepository.delete(id);
  },
};
