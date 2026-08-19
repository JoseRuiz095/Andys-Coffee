import { Prisma } from '@prisma/client';
import { createProductSchema, filterQuerySchema, updateProductSchema } from '../validators/product.validator';
import { z } from 'zod';
import { UploadService } from './upload.service';
import { prisma } from '../config/prisma';

export const ProductService = {
  async findAll(query: z.infer<typeof filterQuerySchema>) {
    const page = parseInt(query.page);
    const limit = parseInt(query.limit);
    const skip = (page - 1) * limit;

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

    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          displayOrder: 'asc',
        },
        include: {
          category: {
            select: { id: true, name: true }
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data: products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findOne(id: string) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        extras: { include: { extra: true } },
        recipes: { include: { ingredient: true } },
      },
    });
  },

  async create(productData: z.infer<typeof createProductSchema>) {
    return prisma.product.create({
      data: productData,
    });
  },

  async update(id: string, productData: z.infer<typeof updateProductSchema>) {
    return prisma.product.update({
      where: { id },
      data: productData,
    });
  },

  async remove(id: string) {
    // Primero, buscamos el producto para obtener la URL de la imagen.
    const productToDelete = await prisma.product.findUnique({
      where: { id },
      select: { imageUrl: true },
    });

    // Luego, eliminamos el producto de la base de datos.
    await prisma.product.delete({
      where: { id },
    });

    // Finalmente, si el producto tenía una imagen, la eliminamos de Supabase Storage.
    if (productToDelete?.imageUrl) {
      await UploadService.deleteProductImage(productToDelete.imageUrl);
    }
  },
};